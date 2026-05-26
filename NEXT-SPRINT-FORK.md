# Aegis Protocol — Sprint 5: Mainnet Forking & Nonce Management

> 在真实链上交易 + 管理多智能体 Nonce 冲突的技术方案  
> Document Version 1.0 | Sprint 5 Candidate

---

## 1. Hardhat Mainnet Forking

### 1.1 原理

Hardhat 支持 **主网分叉（Forking）**：在本地启动一个以太坊主网状态的快照节点。你的合约可以读取真实链上的 Uniswap 池子、ERC20 余额等，而所有写入操作（交易、部署）仅在本地生效，**不消耗真实 Gas，不产生真实交易**。

```
┌────────────────────────────────────────┐
│  Local Hardhat Fork Node               │
│  ┌──────────────┐   ┌──────────────┐   │
│  │  FakeERC20   │   │  UniswapV3   │   │
│  │  (你的合约)   │   │  (只读分叉)   │   │
│  └──────┬───────┘   └──────┬───────┘   │
│         │                  │           │
│         ▼                  ▼           │
│    AgentExecutor      WETH/USDC池     │
│    .batchExecute()    (主网快照)      │
└────────────────────────────────────────┘
         │
         ▼
    RPC: https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### 1.2 先决条件

1. **主网 RPC URL**（任选一个）：
   - [Alchemy](https://www.alchemy.com/) — 免费 tier 每天 3 亿 CU
   - [Infura](https://infura.io/) — 免费 tier 每天 10 万请求
   - [QuickNode](https://www.quicknode.com/) — 免费 tier

2. **配置 `.env`**：
   ```
   MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
   ```

3. **为 Relayer 注入测试 ETH**（分叉节点默认账户有 10000 ETH）：

### 1.3 运行 Forking

```bash
# 1. 启动分叉节点
npm run fork

# 2. 部署合约到分叉节点
npm run deploy:fork

# 3. 运行 Relayer（使用新部署的合约地址）
npm run relayer

# 4. 运行 AI 生成器
npm run ai
```

### 1.4 真实交易验证

分叉模式下你的合约可以：

| 能力 | 说明 |
|------|------|
| ✅ 读取真实 WETH/USDC 价格 | `IUniswapV3Pool.slot0()` → sqrtPriceX96 |
| ✅ 模拟真实 Swap | 调用 UniswapV3 的 `swap()` 方法 |
| ✅ 持有真实 Token 余额 | `hardhat_setBalance` 注入 WETH |
| ❌ 无法持久化到主网 | 所有修改仅在本地 |

### 1.5 合约适配（Sprint 5 任务）

需要新建 `RealAMM.sol`：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUniswapV3Pool {
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

contract RealAMM {
    // Uniswap V3 WETH/USDC 0.3% pool on Ethereum mainnet
    address constant WETH_USDC_POOL = 0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8;
    
    // For MVP: route all swap requests through this real pool
    function swap(address tokenIn, uint256 amountIn, address user) external returns (uint256) {
        // Implementation: encode swap params and call IUniswapV3Pool.swap()
        // ...
    }
}
```

---

## 2. Nonce 管理

### 2.1 当前架构（单 Relayer，单 Nonce）

```
IntentQueue → batchExecute() ═══ relayWallet.sendTransaction()
                                  Nonce: auto-increment by ethers.js
```

**现状**：Relayer 使用 `ethers.Wallet` 单账户。`batchExecute()` 一次提交一个大 tx（含 10 个意图）。ethers.js 自动管理 Nonce，**不存在冲突**。

### 2.2 风险场景

一旦引入**异步打包**（不等到 10 个就发），或**多 Relayer 实例**：

```
Scenario A: 条件触发快发
  队列收到 3 个紧急 arbitrage → 立即 flush → Nonce N
  队列收到 7 个普通 swap → 等待 → Nonce N+1 ✅

Scenario B: Nonce 抢占
  Relayer-1: batchExecute([arbitrage]) → Nonce 5
  Relayer-2: batchExecute([swap×5])    → Nonce 5 ❌ 冲突!
```

### 2.3 防御方案（Sprint 5 任务）

| 方案 | 复杂度 | 说明 |
|------|--------|------|
| **方案 1: Nonce 预分配** | 低 | Relayer 启动时获取当前 Nonce，维护本地计数器。`transactionCount = await provider.getTransactionCount(wallet.address)` |
| **方案 2: 交易队列 + 串行化** | 低 | 维护一个 `txQueue`，所有 `sendTransaction` 排队串行执行，保证 Nonce 按序递增 |
| **方案 3: 多 Relayer 账户池** | 中 | 每个 Relayer 实例使用不同账户，避免 Nonce 冲突 |
| **方案 4: 临时 Nonce 替代** | 低 | `{ gasLimit: estimate, nonce: nonce++ }` 手动设置 Nonce |

**推荐 MVP 方案**（当前代码已实现）：

`relayer/src/blockchain.ts` 中的 `submitBatch()` 方法已经是**串行单线程**调用：
```typescript
const tx = await this.contract.batchExecute(intents, { gasLimit: 5_000_000 });
const receipt = await tx.wait(); // 等待确认后才处理下一批
```

这意味着同一时刻只有一个 pending tx，ethers.js 的自动 Nonce 管理足够安全。

### 2.4 未来多智能体 Nonce 策略

```
      Agent A → IntentQueue ─┐
      Agent B → IntentQueue ─┤
      Agent C → IntentQueue ─┤→ batchExecute() → Nonce N
      Agent D → IntentQueue ─┘
```

当引入 **per-Agent Nonce**（每个智能体有自己的 Nonce 序列）：
1. 合约端：`mapping(address => uint256) public agentNonce`
2. Relayer 端：每个 Intent 携带 `agentNonce`，合约校验

```
function batchExecute(UserIntent[] calldata intents) external {
    for (uint i = 0; i < intents.length; i++) {
        require(intents[i].nonce == agentNonce[intents[i].user] + 1);
        agentNonce[intents[i].user]++;
    }
}
```

---

## 3. Sprint 5 待办清单

### P0 — 分叉交易真实化
- [ ] 注册 Alchemy/Infura 获取 `MAINNET_RPC_URL`
- [ ] 配置 `.env` + `hardhat-fork` 网络
- [ ] 编写 `RealAMM.sol` 接入 UniswapV3
- [ ] 在分叉节点上验证真实价格 Swap

### P1 — Nonce 鲁棒性
- [ ] Relayer 启动时获取最新 Nonce
- [ ] 实现 txQueue 串行化
- [ ] 添加失败重试机制（当前 batch 失败会回退入队）

### P2 — 多账户支持
- [ ] 为每个 Agent 分配独立 Relayer 子账户
- [ ] 实现 `perAgentNonce` 合约校验
- [ ] 支持并发批量提交

---

*Document generated for Aegis Protocol — May 2026*
