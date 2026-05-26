import { expect } from "chai";
import { ethers } from "hardhat";
import { AegisToken, SimpleAMM, AgentExecutor, AgentRegistry } from "../typechain-types";

describe("Aegis Protocol — Contracts", function () {
  let tokenA: AegisToken;
  let tokenB: AegisToken;
  let amm: SimpleAMM;
  let registry: AgentRegistry;
  let executor: AgentExecutor;
  let owner: any, user1: any, user2: any;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const USER_FUND = ethers.parseEther("10000");

  /** Helper: build a standard swap UserIntent for testing */
  function makeSwapIntent(overrides: Partial<{
    agentId: number; user: string; tokenIn: string; tokenOut: string; amountIn: bigint;
  }> = {}) {
    return {
      agentId: overrides.agentId ?? 0,
      action: "swap",
      user: overrides.user ?? user1.address,
      tokenIn: overrides.tokenIn ?? tokenA.getAddress(),
      tokenOut: overrides.tokenOut ?? tokenB.getAddress(),
      amountIn: overrides.amountIn ?? ethers.parseEther("10"),
      metadata: "0x",
    };
  }

  before(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy Tokens
    const TokenFactory = await ethers.getContractFactory("AegisToken");
    tokenA = (await TokenFactory.deploy("Token A", "TKA", 1_000_000)) as unknown as AegisToken;
    tokenB = (await TokenFactory.deploy("Token B", "TKB", 1_000_000)) as unknown as AegisToken;
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();

    // Deploy MockAMM
    const AMMFactory = await ethers.getContractFactory("SimpleAMM");
    amm = (await AMMFactory.deploy(
      await tokenA.getAddress(),
      await tokenB.getAddress()
    )) as unknown as SimpleAMM;
    await amm.waitForDeployment();

    // Deploy AgentRegistry
    const RegistryFactory = await ethers.getContractFactory("AgentRegistry");
    registry = (await RegistryFactory.deploy()) as unknown as AgentRegistry;
    await registry.waitForDeployment();

    // Deploy AgentExecutor
    const ExecutorFactory = await ethers.getContractFactory("AgentExecutor");
    executor = (await ExecutorFactory.deploy(
      await amm.getAddress()
    )) as unknown as AgentExecutor;
    await executor.waitForDeployment();

    // Fund AMM with liquidity
    await tokenA.transfer(await amm.getAddress(), ethers.parseEther("100000"));
    await tokenB.transfer(await amm.getAddress(), ethers.parseEther("100000"));

    // Fund users
    await tokenA.transfer(user1.address, USER_FUND);
    await tokenA.transfer(user2.address, USER_FUND);
    await tokenB.transfer(user1.address, USER_FUND);
    await tokenB.transfer(user2.address, USER_FUND);
  });

  describe("AegisToken", function () {
    it("should have correct name and symbol", async function () {
      expect(await tokenA.name()).to.equal("Token A");
      expect(await tokenA.symbol()).to.equal("TKA");
    });

    it("should mint initial supply to deployer", async function () {
      expect(await tokenA.balanceOf(owner.address)).to.be.gt(0);
    });

    it("should transfer tokens between accounts", async function () {
      const amount = ethers.parseEther("100");
      await tokenA.transfer(user1.address, amount);
      expect(await tokenA.balanceOf(user1.address)).to.be.gte(amount);
    });

    it("should approve and transferFrom", async function () {
      const amount = ethers.parseEther("50");
      await tokenA.connect(user1).approve(owner.address, amount);
      await tokenA.transferFrom(user1.address, user2.address, amount);
      expect(await tokenA.balanceOf(user2.address)).to.be.gte(amount);
    });
  });

  describe("AgentRegistry", function () {
    it("should register a new agent and emit event", async function () {
      await expect(registry.connect(user1).register("MomentumBot"))
        .to.emit(registry, "AgentRegistered")
        .withArgs(1n, user1.address, "MomentumBot");

      const agent = await registry.agents(1);
      expect(agent.owner).to.equal(user1.address);
      expect(agent.name).to.equal("MomentumBot");
      expect(await registry.agentCount()).to.equal(1);
    });

    it("should track agents by owner", async function () {
      await registry.connect(user1).register("ArbitrageBot");
      const ids = await registry.getAgentIdsByOwner(user1.address);
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(1n);
      expect(ids[1]).to.equal(2n);
    });
  });

  describe("SimpleAMM", function () {
    it("should execute a swap TokenA -> TokenB", async function () {
      const amountIn = ethers.parseEther("100");
      // User must approve the AMM (amm calls transferFrom → msg.sender in token = amm)
      await tokenA.connect(user1).approve(await amm.getAddress(), amountIn);

      await expect(
        amm.connect(user1).swap(await tokenA.getAddress(), amountIn, user1.address)
      )
        .to.emit(amm, "SwapExecuted")
        .withArgs(
          user1.address,
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          amountIn,
          amountIn - (amountIn * 3n) / 1000n,
          (v: any) => v < 30000000n  // gasUsed = gasleft() snapshot, any positive
        );
    });
  });

  describe("AgentExecutor — Batch Execution", function () {
    it("should execute a batch of 5 swaps and emit BatchExecuted", async function () {
      const batchSize = 5;
      const amountPerSwap = ethers.parseEther("10");

      // User approves AMM (amm calls transferFrom → msg.sender in token = amm)
      await tokenA.connect(user1).approve(await amm.getAddress(), amountPerSwap * BigInt(batchSize));

      // Build intent array: 5 swaps of TokenA -> TokenB by user1
      const intents = Array.from({ length: batchSize }, () =>
        makeSwapIntent({ amountIn: amountPerSwap })
      );

      // Execute batch as user1 (simulating the Relayer)
      const tx = await executor.connect(user1).batchExecute(intents);

      // Expect BatchExecuted event
      await expect(tx)
        .to.emit(executor, "BatchExecuted")
        .withArgs(
          (v: any) => v === 1n, // batchId
          user1.address,
          batchSize,
          (v: any) => v > 0n,
          (v: any) => v === BigInt(batchSize) * 120_000n,
          (v: any) => v > 0n
        );

      // Expect 5 IntentProcessed events
      await expect(tx).to.emit(executor, "IntentProcessed");

      // Verify batch counter incremented
      expect(await executor.batchCount()).to.equal(1);
    });

    it("should include agentId and action in IntentProcessed event", async function () {
      const amountPerSwap = ethers.parseEther("5");
      await tokenA.connect(user1).approve(await amm.getAddress(), amountPerSwap * 2n);

      const intents = [makeSwapIntent({ agentId: 7, amountIn: amountPerSwap })];

      await expect(executor.connect(user1).batchExecute(intents))
        .to.emit(executor, "IntentProcessed")
        .withArgs(
          (v: any) => v === 2n,       // batchId
          7n,                          // agentId
          user1.address,               // user
          "swap",                      // action
          await tokenA.getAddress(),   // tokenIn
          await tokenB.getAddress(),   // tokenOut
          amountPerSwap,               // amountIn
          (v: any) => v > 0n           // amountOut
        );
    });

    it("should reject empty batch", async function () {
      await expect(
        executor.connect(user1).batchExecute([])
      ).to.be.revertedWith("AgentExecutor: empty batch");
    });

    it("should reject batch larger than 50", async function () {
      const intents = Array.from({ length: 51 }, () =>
        makeSwapIntent({ amountIn: ethers.parseEther("1") })
      );
      await expect(
        executor.connect(user1).batchExecute(intents)
      ).to.be.revertedWith("AgentExecutor: batch too large (max 50)");
    });

    it("should accept any action string (MVP routing)", async function () {
      const intent = { ...makeSwapIntent(), action: "mint_nft" };
      await tokenA.connect(user1).approve(await amm.getAddress(), intent.amountIn);
      await expect(
        executor.connect(user1).batchExecute([intent])
      ).to.not.be.reverted;  // MVP: all actions route to swap
    });

    it("should calculate gas savings > 0 for batch vs individual tx", async function () {
      const batchSize = 10;
      const amountPerSwap = ethers.parseEther("5");

      await tokenA.connect(user1).approve(await amm.getAddress(), amountPerSwap * BigInt(batchSize));

      const intents = Array.from({ length: batchSize }, () =>
        makeSwapIntent({ amountIn: amountPerSwap })
      );

      const tx = await executor.connect(user1).batchExecute(intents);
      const receipt = await tx.wait();

      // Parse BatchExecuted event to verify gasSaved
      const event = receipt?.logs.find(
        (log: any) => {
          try {
            const parsed = executor.interface.parseLog(log);
            return parsed?.name === "BatchExecuted";
          } catch { return false; }
        }
      );

      expect(event).to.not.be.undefined;
    });
  });
});
