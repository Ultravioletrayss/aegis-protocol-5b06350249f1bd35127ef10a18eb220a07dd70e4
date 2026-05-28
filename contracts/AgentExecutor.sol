// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAMM.sol";

contract AgentExecutor {
    IAMM public amm;
    uint256 public batchCount;

    struct UserIntent {
        uint256 agentId;
        string  action;
        address user;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        bytes   metadata;
    }

    event BatchExecuted(
        uint256 indexed batchId,
        address indexed executor,
        uint256 numIntents,
        uint256 totalGasUsed,
        uint256 estimatedIndividualGas,
        uint256 gasSaved
    );

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

    function batchExecute(UserIntent[] calldata intents) external {
        uint256 len = intents.length;
        require(len > 0, "AgentExecutor: empty batch");
        require(len <= 50, "AgentExecutor: batch too large (max 50)");

        uint256 gasBefore = gasleft();
        uint256 batchId = ++batchCount;
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

        // === 🎲 方案 A：Gas 随机噪声（演示用 · ±15% 波动） ===
        uint256 randomness = uint256(keccak256(abi.encodePacked(
            block.timestamp, 
            block.prevrandao, 
            batchId,
            msg.sender
        )));
        int256 variance = int256(randomness % 30) - 15;
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

    function _executeIntent(UserIntent calldata intent) internal returns (uint256 amountOut) {
        return amm.swap(intent.tokenIn, intent.amountIn, intent.user);
    }

    function setAMM(address _amm) external {
        amm = IAMM(_amm);
    }
}