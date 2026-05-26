// ─── DeepSeek V4 LLM Client ───
// Uses the OpenAI-compatible SDK to call DeepSeek API.

import OpenAI from "openai";
import { UserIntent } from "./types";

/** Pre-defined trading agent personas for prompt diversity */
const AGENT_PERSONAS = [
  {
    name: "MomentumBot",
    style: "trend-following momentum trader. You chase breakouts and ride trends aggressively.",
    riskProfile: "aggressive",
  },
  {
    name: "ArbitrageEye",
    style: "cross-market arbitrage hunter. You spot price inefficiencies between token pairs and exploit them.",
    riskProfile: "moderate",
  },
  {
    name: "DCA_Warden",
    style: "disciplined dollar-cost-averaging bot. You make periodic small buys regardless of market conditions.",
    riskProfile: "conservative",
  },
  {
    name: "YieldCompoundor",
    style: "yield optimizer. You harvest rewards, swap them, and compound back into the principal asset.",
    riskProfile: "conservative",
  },
  {
    name: "RebalanceKeeper",
    style: "portfolio rebalancer. You maintain a target 50/50 ratio between TokenA and TokenB, swapping when drift exceeds 5%.",
    riskProfile: "moderate",
  },
];

const SYSTEM_PROMPT = `You are an AI trading agent operating on the Aegis Protocol — a batch execution network.

Your job: generate a SINGLE structured swap intent as JSON.

Token addresses (Ethereum local network):
- TokenA: 0x5FbDB2315678afecb367f032d93F642f64180aa3 (primary)
- TokenB: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 (secondary)

Intent format (strict):
{
  "agentId": 0,
  "action": "swap",
  "user": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "tokenIn": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "tokenOut": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  "amountIn": "1000000000000000000",
  "metadata": "0x"
}

Rules:
- Only output valid JSON, no markdown, no explanation.
- amountIn is in wei (18 decimals). Generate amounts between 0.01 and 100 tokens.`;

export class LLMClient {
  private client: OpenAI;
  private model: string;
  private personaIndex = 0;
  private conversationHistory: { role: "system" | "user" | "assistant"; content: string }[] = [];

  constructor(apiKey: string, baseUrl: string, model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });
    this.model = model;
  }

  /** Rotate through agent personas for diverse intent generation */
  private getNextPersona() {
    const persona = AGENT_PERSONAS[this.personaIndex % AGENT_PERSONAS.length];
    this.personaIndex++;
    return persona;
  }

  /** Generate a single intent using DeepSeek V4 */
  async generateIntent(): Promise<UserIntent> {
    const persona = this.getNextPersona();

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: `You are ${persona.name}, a ${persona.style}
Your risk profile is: ${persona.riskProfile}.
Market signal: TokenA price is trending ${Math.random() > 0.5 ? "UP" : "DOWN"} by ${(Math.random() * 10).toFixed(2)}%.
Generate your next swap intent. Output ONLY valid JSON.`,
      },
    ];

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.8,
      max_tokens: 300,
    });

    const raw = response.choices[0]?.message?.content || "";
    return this.parseIntent(raw);
  }

  /** Generate a batch of N intents (one API call = one intent for simplicity) */
  async generateBatch(count: number): Promise<UserIntent[]> {
    const intents: UserIntent[] = [];
    for (let i = 0; i < count; i++) {
      try {
        const intent = await this.generateIntent();
        intents.push(intent);
      } catch (err: any) {
        console.error(`[LLM] Failed to generate intent #${i + 1}:`, err.message);
        // Fallback to a default swap intent
        intents.push(this.fallbackIntent());
      }
      // Respect API rate limits
      if (i < count - 1) await new Promise((r) => setTimeout(r, 200));
    }
    return intents;
  }

  private parseIntent(raw: string): UserIntent {
    // Try to extract JSON from the response (handles markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON found in response: ${raw.slice(0, 100)}`);

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      agentId: parsed.agentId ?? 0,
      action: parsed.action ?? "swap",
      user: parsed.user ?? "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      tokenIn: parsed.tokenIn ?? "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      tokenOut: parsed.tokenOut ?? "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      amountIn: parsed.amountIn ?? "1000000000000000000",
      metadata: parsed.metadata ?? "0x",
    };
  }

  private fallbackIntent(): UserIntent {
    return {
      agentId: 0,
      action: "swap",
      user: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      tokenIn: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      tokenOut: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      amountIn: String(BigInt(Math.floor(Math.random() * 100) + 1) * 10n ** 18n),
      metadata: "0x",
    };
  }
}
