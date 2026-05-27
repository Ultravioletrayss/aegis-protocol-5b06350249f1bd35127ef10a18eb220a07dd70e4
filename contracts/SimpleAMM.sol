// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AegisToken.sol";
import "./IAMM.sol";

/**
 * @title SimpleAMM
 * @dev Mock AMM for local Hardhat testing — uses 1:1 exchange with 0.3% fee.
 *      Implements IAMM for compatibility with AgentExecutor.
 */
contract SimpleAMM is IAMM {
    AegisToken public tokenA;
    AegisToken public tokenB;

    event SwapExecuted(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 gasUsed
    );

    constructor(address _tokenA, address _tokenB) {
        tokenA = AegisToken(_tokenA);
        tokenB = AegisToken(_tokenB);
    }
    
    /**
     * @dev Simple 1:1 swap between tokenA ↔ tokenB.
     *      A real AMM would use x*y=k; we fake it for the MVP.
     * @param user The original intent owner (caller in direct mode, end-user in batch mode)
     */
    function swap(address tokenIn, uint256 amountIn, address user) external returns (uint256 amountOut) {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "SimpleAMM: unknown token");
        
        // === 🎲 方案 B：大额交易消耗更多 Gas（演示用 · 让 Gas 随金额波动） ===
        // 如果金额 > 10 tokens，执行额外计算消耗 Gas，模拟「大额交易更复杂」
        // 生产环境请删除此段，使用真实 AMM 逻辑
        if (amountIn > 10 ether) {
            uint256 iterations = amountIn / 10 ether; // 金额越大，循环越多
            if (iterations > 50) iterations = 50; // 上限保护，防止区块超时
            
            bytes32 dummy = 0;
            for (uint256 i = 0; i < iterations; i++) {
                // 消耗计算的 Gas，结果丢弃
                dummy = keccak256(abi.encodePacked(dummy, i, amountIn, block.timestamp));
            }
            // 防止编译器优化掉 dummy 变量（永远为 true 的 require）
            require(dummy != 0 || true, "");
        }
        // =====================================================================

        // 1:1 exchange rate, mock 0.3% fee
        uint256 fee = (amountIn * 3) / 1000;
        amountOut = amountIn - fee;

        address tokenOut = tokenIn == address(tokenA) ? address(tokenB) : address(tokenA);

        AegisToken(tokenIn).transferFrom(user, address(this), amountIn);
        AegisToken(tokenOut).transfer(user, amountOut);

        uint256 gasUsed = gasleft();

        emit SwapExecuted(user, tokenIn, tokenOut, amountIn, amountOut, gasUsed);
    }
}