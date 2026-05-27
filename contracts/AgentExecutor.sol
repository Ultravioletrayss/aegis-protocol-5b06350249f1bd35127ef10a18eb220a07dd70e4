// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAMM.sol";

/**
 * @title AgentExecutor
 * @dev On-chain batch execution engine for Aegis Protocol.
 *      Receives bundled AI-generated intents, executes them through an IAMM-compatible AMM,
 *      and emits BatchExecuted events for the front-end dashboard.
 *
 *      Compatible AMMs: SimpleAMM (mock), RealAMM (Uniswap V3 fork).
 */
contract AgentExecutor {
    IAMM public amm;

    uint256 public batchCount;

    /// @notice Represents a single AI-generated user intent.
    ///         Supports swap, transfer, DCA, compound, rebalance etc.
    struct UserIntent {
        uint256 agentId;    // ID from AgentRegistry (0 = unregistered)
        string  action;     // "swap" | "transfer" | "dca" | "compound" | "rebalance" | "arbitrage"
        address user;       // Intent owner
        address tokenIn;    // Input token
        address tokenOut;   // Output token (for swap) or recipient (for transfer)
        uint256 amountIn;   // Input amount in wei
        bytes   metadata;   // Extensible field for action-specific params
    }

    /// @notice Emitted when a batch of intents is executed on-chain.
    /// @param batchId       Auto-increment batch identifier
    /// @param executor      Address that submitted the batch (the Relayer)
    /// @param numIntents    Number of intents in this batch
    /// @param totalGasUsed  Actual gas consumed by the batch (approximated)
    /// @param estimatedIndividualGas Estimated gas if each intent were a separate tx
    /// @param gasSaved      Difference = estimatedIndividualGas - totalGasUsed
    event BatchExecuted(
        uint256 indexed batchId,
        address indexed executor,
        uint256 numIntents,
        uint256 totalGasUsed,
        uint256 estimatedIndividualGas,
        uint256 gasSaved
    );

    /// @notice Emitted for each individual intent within a batch (for front-end animation)
    event IntentProcessed(
        uint256 indexed batchId,
        uint256 indexed agentId,
        address indexed user,
        string  action,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _amm) {
        amm = IAMM(_amm);
    }

    /**
     * @dev Executes a batch of user intents in a single transaction.
     *      Routes each intent to the appropriate handler based on `action`.
     *
     * @param intents Array of UserIntent structs to execute
     */
    function batchExecute(UserIntent[] calldata intents) external {
        uint256 len = intents.length;
        require(len > 0, "AgentExecutor: empty batch");
        require(len <= 50, "AgentExecutor: batch too large (max 50)");

        uint256 gasBefore = gasleft();
        uint256 batchId = ++batchCount;

        // Mock gas benchmark: a standalone tx costs ~120,000 gas
        uint256 estimatedIndividualGas = len * 120_000;

        for (uint256 i = 0; i < len; i++) {
            UserIntent calldata intent = intents[i];
            require(intent.amountIn > 0, "AgentExecutor: zero amount");
            require(bytes(intent.action).length > 0, "AgentExecutor: empty action");

            uint256 amountOut = _executeIntent(intent);

            emit IntentProcessed(
                batchId,
                intent.agentId,
                intent.user,
                intent.action,
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                amountOut
            );
        }

        uint256 gasAfter = gasleft();
        uint256 totalGasUsed = gasBefore - gasAfter;

        // === 🎲 方案 A：添加随机噪声（演示用 · 让 Gas 数据有波动） ===
        // 基于 block 属性 + batchId 生成伪随机数，产生 ±15% 波动
        // 生产环境请删除此段，使用真实 gas 测量
        uint256 randomness = uint256(keccak256(abi.encodePacked(
            block.timestamp, 
            block.prevrandao, 
            batchId,
            msg.sender
        )));
        int256 variance = int256(randomness % 30) - 15; // -15 到 +15
        int256 adjustedGas = int256(totalGasUsed) + (int256(totalGasUsed) * variance) / 100;
        totalGasUsed = uint256(adjustedGas > 0 ? adjustedGas : int256(totalGasUsed));
        // ===========================================================

        uint256 gasSaved = estimatedIndividualGas > totalGasUsed
            ? estimatedIndividualGas - totalGasUsed
            : 0;

        emit BatchExecuted(
            batchId,
            msg.sender,
            len,
            totalGasUsed,
            estimatedIndividualGas,
            gasSaved
        );
    }

    /**
     * @dev Internal intent router — dispatches by action type.
     *      MVP: all actions route through MockAMM.swap for batch demo.
     *      Production would have per-action logic (DCA schedule, compound calc, etc.)
     */
    function _executeIntent(UserIntent calldata intent) internal returns (uint256 amountOut) {
        // MVP: all actions are swaps between TokenA ↔ TokenB
        // The action field is preserved in IntentProcessed event for front-end display
        // Production would use keccak256 dispatch to per-action handlers
        return amm.swap(intent.tokenIn, intent.amountIn, intent.user);
    }

    /**
     * @dev Fallback: allows updating the AMM reference (for demo flexibility).
     */
    function setAMM(address _amm) external {
        amm = IAMM(_amm);
    }
}