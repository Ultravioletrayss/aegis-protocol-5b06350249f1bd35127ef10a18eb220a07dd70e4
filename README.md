
> **v0.1 — MVP** | 基于 DeepSeek V4 × Solidity × Vue 3 构建  
> *由 AI 驱动的链上智能体批处理执行网络 — 区块链课程期末项目*

---

## 一、快速启动（5 分钟）

### 前置条件

| 工具 | 版本 | 备注 |
|------|------|------|
| Node.js | ≥ 18.x | `node --version` |
| npm | ≥ 9.x | `npm --version` |
| MetaMask | 浏览器插件 | [下载](https://metamask.io) |
| Git | — | `git --version` |

### 启动步骤

```bash
# 1. 安装根目录依赖
cd aegis-protocol
npm install

# 2. 启动本地 Hardhat 节点（新终端）
npx hardhat node

# 3. 部署合约 + 授权（新终端）
npm run deploy:local
npm run approve:local

# 4. 安装并启动 Relayer（新终端）
cd relayer && npm install && npx ts-node src/index.ts

# 5. 安装并启动 Dashboard（新终端）
cd dashboard && npm install && npx vite --host

# 6. 可选：启动 AI 意图生成器（新终端）
cd ai-generator && npm install && npx ts-node src/index.ts --mode random --strategy weighted
```

打开浏览器 → **`http://localhost:5173`** → 点击 🦊 **CONNECT** 连接 MetaMask → 看到实时意图流！

---

## 二、架构总览

```
┌──────────────────────────────────────────────────────────┐
│                   前端可视化大屏                           │
│    Vue 3 + Tailwind CSS + ECharts + 液态玻璃 UI           │
│    [Intent Terminal] [Batching Engine] [Performance]     │
└─────────────────────┬────────────────────────────────────┘
                      │ POST /intent
                      ▼
┌──────────────────────────────────────────────────────────┐
│              链下智能体中继器 (TypeScript)                  │
│    Express 服务 · 意图队列 (满 10 打包) · 链上事件监听     │
└─────────────────────┬────────────────────────────────────┘
                      │ batchExecute()
                      ▼
┌──────────────────────────────────────────────────────────┐
│              智能合约执行层 (Solidity)                     │
│    ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│    │AegisToken│  │ SimpleAMM│  │   AgentExecutor      │  │
│    │(MockERC20)│  │(IAMM实现) │  │   (批处理引擎)       │  │
│    └──────────┘  └──────────┘  └──────────────────────┘  │
│    ┌──────────┐  ┌──────────┐                             │
│    │AgentReg. │  │ RealAMM  │ ← Sprint 5: Uniswap V3    │
│    └──────────┘  └──────────┘                             │
└─────────────────────┬────────────────────────────────────┘
                      │ API 调用
                      ▼
┌──────────────────────────────────────────────────────────┐
│              AI 决策源 (DeepSeek V4)                      │
│    4 种策略: Weighted / Momentum / Arbitrage / DCA       │
│    5 Agent Persona: MomentumBot, ArbitrageEye...         │
└──────────────────────────────────────────────────────────┘
```

### 核心数据流

```
DeepSeek V4 / 随机生成器
    │ 生成 {action, tokenIn, amountIn}
    ▼
POST /intent → Relayer Queue
    │ 满 10 个自动 Flush
    ▼
AgentExecutor.batchExecute()
    │ 遍历意图 → IAMM.swap()
    ▼
emit BatchExecuted(batchId, gasSaved, ...)
    │ Relayer 事件监听
    ▼
Dashboard 轮询 GET /batches
    │ 弹出 Batch Popup + 更新 ECharts
```

---

## 三、合约架构 (6 份)

| 合约 | 路径 | 说明 |
|------|------|------|
| `AegisToken.sol` | `contracts/` | 模拟 ERC20，部署两次为 TokenA/TokenB |
| `SimpleAMM.sol` | `contracts/` | 模拟 AMM，1:1 汇率 + 0.3% 手续费 |
| `RealAMM.sol` | `contracts/` | Uniswap V3 适配器 (需 Mainnet Fork) |
| `IAMM.sol` | `contracts/` | 统一 AMM 接口 |
| `AgentRegistry.sol` | `contracts/` | 智能体链上注册 |
| `AgentExecutor.sol` | `contracts/` | 批处理执行引擎 (核心) |

---

## 四、测试

```bash
# 智能合约测试
npx hardhat test

# Relayer E2E 测试
cd relayer && npx ts-node src/e2e-test.ts

# 类型检查
cd dashboard && npx vue-tsc --noEmit
```

**测试结果**: `13/13 passing` — AegisToken(4) + AgentRegistry(2) + SimpleAMM(1) + AgentExecutor(6)

---

## 五、Mainnet Forking (Sprint 5)

让智能体在本地调用**真实 Uniswap V3 池**：

```bash
# 1. .env 添加 MAINNET_RPC_URL (Alchemy/Infura 免费版即可)
echo "MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY" >> .env

# 2. 启动分叉节点
npm run fork

# 3. 部署 RealAMM
npm run deploy:fork

# 4. 启动 Relayer (更新 AGENT_EXECUTOR_ADDRESS)
npm run relayer

# ✅ 现在 Agent 的交易经过真实 Uniswap V3 WETH/USDC 池
```

---

## 六、演示流程 (10 分钟)

| 时间 | 章节 | 操作 | 讲什么 |
|------|------|------|--------|
| **0:00-1:30** | 背景与问题 | 打开 Dashboard，展示 Header | "AI Agent 正成为新 Web3 用户。高频操作导致 Gas 拥堵。Aegis Protocol 通过'意图批处理'解决这个问题。" |
| **1:30-3:00** | 架构概览 | 点击 **▶ SIM** 侧栏 → 展示架构图 | "四层架构：AI 决策层 → 中继器排队 → 合约批处理 → 性能监控" |
| **3:00-4:30** | AI 决策演示 | 点击 **INJECT** 按钮 5-6 次 | 看 Terminal 出现不同 action (swap/dca/rebalance/compound/arbitrage)。"AI 根据市场信号选择策略。DeepSeek V4 生成结构化 JSON 意图。" |
| **4:30-6:00** | 批处理对比 | 连续 INJECT 满 10 个 | 看 Batching Engine 的液态桶填满 → 弹出 **Batch Popup**(批量节省 ~80% Gas)。"10 个独立交易需 1.2M Gas，打包只需 240K。图表显示 Batch vs Individual 对比。" |
| **6:00-7:30** | 性能分析 | 点击 ECharts **THROUGHPUT** / **CUMULATIVE** | 切换三种图表模式。"Gas 对比、批处理吞吐量、累计节省。点击 REPORT → Trilemma 分析。" |
| **7:30-9:00** | 深度钻取 | 点击 Terminal 任意行 | 弹出 AI 推理逻辑。"DeepSeek 判断了趋势方向，选择了最优执行路径。" |
| **9:00-10:00** | 总结与展望 | 打开 NEXT-SPRINT-FORK.md | "当前 MVP 使用模拟 AMM。Sprint 5 已准备 Uniswap V3 Forking 支持，未来可做多 Agent 并发和意图拍卖机制。" |

---

## 七、项目结构

```
aegis-protocol/
├── contracts/          Solidity 合约 (6 份)
│   ├── AegisToken.sol
│   ├── SimpleAMM.sol
│   ├── RealAMM.sol
│   ├── IAMM.sol
│   ├── AgentRegistry.sol
│   └── AgentExecutor.sol
├── relayer/            TypeScript 中继器
│   ├── src/index.ts    Express 服务 (端口 3001)
│   ├── src/queue.ts    意图队列
│   ├── src/blockchain.ts 链上交互
│   └── src/e2e-test.ts E2E 测试
├── ai-generator/       AI 意图生成器
│   ├── src/index.ts    编排器 (3 模式)
│   ├── src/llm-client.ts DeepSeek V4 客户端
│   ├── src/random-generator.ts 4 策略
│   └── AI-DECISION-DESIGN.md 决策方案设计
├── dashboard/          Vue 3 前端大屏
│   └── src/components/
│       ├── LiquidCard.vue      液态玻璃卡片
│       ├── IntentTerminal.vue  AI 终端面板
│       ├── BatchingEngine.vue  批处理引擎
│       ├── PerformanceChart.vue ECharts 图表
│       ├── MarketPanel.vue     市场数据面板
│       └── StatsBar.vue        顶部状态栏
├── scripts/            部署脚本
├── test/               合约测试
├── UI-DESIGN.md        UI 设计规范
└── NEXT-SPRINT-FORK.md Forking + Nonce 方案
```

---

## 八、Git 提交规范

```
feat(ui): add liquid glass card component
feat(contract): implement AgentExecutor batch execution
fix(relayer): resolve nonce conflict in batch submission
refactor(amm): rename FakeERC20 → AegisToken, add IAMM interface
docs(readme): add deployment guide and demo script
```

---

*Built for Advanced Blockchain Development Course — May 2026*  
*Model: DeepSeek V4 Flash via GitHub Copilot*
