# Aegis Protocol — AI Decision Strategy Design

> 深度求索 DeepSeek V4 系列模型驱动的链上智能体意图决策方案  
> Document Version 1.0 | Sprint 3 Deliverable

---

## 1. 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                   AI Decision Layer                      │
│  ┌───────────┐  ┌───────────┐  ┌────────────────────┐  │
│  │ Random    │  │ LLM Mode  │  │ Hybrid Mode        │  │
│  │ Generator │  │ (DeepSeek │  │ (30% LLM + 70%     │  │
│  │ (离线可用) │  │  V4 API)  │  │  deterministic)    │  │
│  └─────┬─────┘  └─────┬─────┘  └────────┬───────────┘  │
│        │              │                 │               │
│        └──────────────┼─────────────────┘               │
│                       ▼                                 │
│              POST /intent → Relayer                     │
│                       │                                 │
│                       ▼                                 │
│            AgentExecutor.batchExecute()                 │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 四种 AI 决策策略

### 2.1 Weighted (加权随机) — 默认策略

模拟**多智能体混合市场**，按概率分布生成不同行动类型：

| Action | 概率 | 模拟场景 |
|--------|------|---------|
| `swap` | 55% | 普通用户交易 |
| `dca` | 15% | 定投机器人 |
| `rebalance` | 15% | 投资组合再平衡 |
| `compound` | 10% | 收益复投 |
| `arbitrage` | 5% | 套利猎手 |

**适用演示场景**：压力测试、吞吐量验证、高信息密度大屏

### 2.2 Momentum (动量追踪)

基于**模拟市场趋势**做方向性决策：

```
if trend == "up"   → swap TokenA → TokenB (追涨)
if trend == "down" → swap TokenB → TokenA (止损/抄底)
```

- 市场模拟：TokenA 价格随机游走 (`random walk`)，波动率周期性变化
- 趋势切换：每 10 次迭代有 10% 概率切换方向

**适用演示场景**：展示"趋势跟随"智能体的链上行为模式

### 2.3 Arbitrage (套利)

监控模拟的 TokenA/TokenB **价格比率**：

```
ratio = TokenA_price / TokenB_price

if ratio > 1.05 → arbitrage A→B (TokenA 高估，卖出)
if ratio < 0.95 → arbitrage B→A (TokenB 高估，卖出)
else            → fallback to swap
```

- 套利交易量 = 普通交易量的 3x（模拟套利者的大额特征）
- 仅在价格偏离 > 5% 时触发

**适用演示场景**：展示高频套利智能体的机会捕获能力

### 2.4 DCA (定投)

**无视市场条件**，定期小额买入：

- 交易量：0.01 ~ 0.5  tokens（模拟定投小额特征）
- 方向交替：每 3 次迭代切换 TokenA↔TokenB
- 频率最高（15% 概率），模拟持续的定投行为

**适用演示场景**：展示"反脆弱"策略 vs 市场波动的关系

---

## 3. LLM 模式 — DeepSeek V4 集成

### 3.1 技术方案

| 维度 | 实现 |
|------|------|
| **API 协议** | OpenAI-compatible (`openai` npm SDK v4) |
| **Base URL** | `https://api.deepseek.com` |
| **推荐模型** | `deepseek-chat` (DeepSeek V4) |
| **Temperature** | 0.8（保证多样化输出） |
| **Max Tokens** | 300（仅需输出 JSON） |

### 3.2 Prompt 工程

采用 **System Prompt + 5 种 Agent Persona** 轮换策略：

| Persona | 角色设定 | 风险偏好 |
|---------|---------|---------|
| **MomentumBot** | 趋势追踪者，追逐突破和趋势 | Aggressive |
| **ArbitrageEye** | 跨市场套利猎手 | Moderate |
| **DCA_Warden** | 纪律性定投机器人 | Conservative |
| **YieldCompoundor** | 收益优化器，复投收益 | Conservative |
| **RebalanceKeeper** | 50/50 持仓再平衡器 | Moderate |

每次 API 调用轮换 persona，确保输出多样化。

### 3.3 JSON 解析策略

LLM 可能返回带 Markdown 代码块的 JSON：
```
```json
{...}
```
```
→ 正则提取 `/\{[\s\S]*\}/` → `JSON.parse()`

解析失败时自动 fallback 到默认 swap 意图。

### 3.4 速率限制

每两次 API 调用间隔 200ms，防止触发 DeepSeek API 限流。

---

## 4. Hybrid 模式

30% 概率使用 DeepSeek V4，70% 使用确定性随机：

```
if Math.random() < 0.3 → LLM generate (DeepSeek)
else                   → Random generate (deterministic)
```

**优势**：
- 保留 LLM 的语义多样性和真实感
- 降低 API 调用成本和延迟
- 离线 demo 时完全可用（仅 Random 模式）

---

## 5. 市场模拟引擎

确定性模式下内建一个轻量市场模拟器：

```
MarketState {
  tokenAPrice:  float    // USD，随机游走
  tokenBPrice:  float    // 固定 1.0（简化）
  volatility:   float    // 0.05 ~ 1.0，周期性变化
  trend:        enum     // up | down | sideways
  imbalance:    float    // -1.0 ~ 1.0（多空失衡度）
}
```

每次生成意图时 `tickMarket()`，模拟市场演化：
- 价格随机游走 (`drift = random * volatility * 0.1`)
- 波动率每 5% 概率 spike +50%，其余时间衰减 5%
- 趋势每 10% 概率切换

---

## 6. 运行方式

```bash
# 确定性随机模式（无需 API Key，课程 Demo 推荐）
cd ai-generator && npm run dev:random

# LLM 模式（需要 DEEPSEEK_API_KEY）
cd ai-generator && npm run dev:llm

# CLI 参数覆盖
npx ts-node src/index.ts --mode random --strategy momentum
npx ts-node src/index.ts --mode hybrid --strategy arbitrage
```

### 环境变量 (.env)

```env
RELAYER_URL=http://localhost:3001
DEEPSEEK_API_KEY=sk-xxx          # 仅 LLM/Hybrid 模式需要
DEEPSEEK_MODEL=deepseek-chat
MODE=random                       # random | llm | hybrid
INTERVAL_MS=800                   # 意图间隔
BATCH_BURST=5                     # 每轮生成意图数
STRATEGY=weighted                 # weighted | momentum | arbitrage | dca
```

---

## 7. 与课程考核点的对应

| 课程要求 | Aegis 实现 |
|---------|-----------|
| AI 智能体生成大量操作 | 4 策略 × 5 persona 循环生成 |
| 频繁再平衡仓位 | `rebalance` action（15% 概率） |
| 自动与多协议交互 | `action` 路由框架预留 transfer/compound 等 |
| 意图批处理减少 Gas | 每 10 个意图自动打包上链 |
| 模拟 AI 或链下智能层 | Random 模式离线可用 + LLM 模式可选 |
| 去中心化/效率/信任权衡 | 文档中可讨论 Relayer 中心化 vs 批处理效率 |

---

## 8. 未来扩展方向

1. **真实价格预言机**：接入 Chainlink Price Feed 替代模拟价格
2. **多 Agent 钱包**：每个 Agent 注册独立地址，通过 ERC-4337 UserOp 执行
3. **意图拍卖机制**：类似 CoW Protocol，多个 Solver 竞争最优执行路径
4. **跨链意图**：通过 Across/Axelar 将意图路由到不同链
5. **强化学习优化**：用历史 Gas 数据训练策略，自适应选择批处理大小

---

*Document generated for Aegis Protocol Sprint 3 — May 2026*
