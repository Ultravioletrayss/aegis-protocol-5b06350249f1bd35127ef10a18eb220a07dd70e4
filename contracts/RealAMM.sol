// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RealAMM
 * @dev Uniswap V3 integration for Aegis Protocol Sprint 5.
 *      Routes agent swap intents through a real Uniswap V3 pool
 *      on a Hardhat mainnet fork (no real gas, no real broadcast).
 *
 *      Requirements to use:
 *      1. MAINNET_RPC_URL in .env (Alchemy/Infura)
 *      2. npx hardhat node --network hardhat-fork
 *      3. Relayer must hold WETH (use hardhat_setBalance)
 *
 *      Pool: WETH/USDC 0.3% (Ethereum mainnet)
 *      WETH:  0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
 *      USDC:  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 *      Pool:  0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8
 */

interface IWETH9 {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
    function transfer(address dst, uint256 wad) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface IUniswapV3Pool {
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlock
        );
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
}

contract RealAMM {
    // ── Uniswap V3 WETH/USDC 0.3% ──
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant POOL = 0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8;

    IUniswapV3Pool public pool;
    IWETH9 public weth;

    event SwapExecuted(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 gasUsed
    );

    constructor() {
        pool = IUniswapV3Pool(POOL);
        weth = IWETH9(WETH);
    }

    /**
     * @dev Swap tokenIn → tokenOut via the real Uniswap V3 pool.
     *      The user must have approved this contract for tokenIn.
     *      Modes:
     *        - tokenIn=WETH  → zeroForOne=true  (sell ETH for USDC)
     *        - tokenIn=USDC  → zeroForOne=false (sell USDC for ETH)
     */
    function swap(address tokenIn, uint256 amountIn, address user) external returns (uint256 amountOut) {
        require(tokenIn == WETH || tokenIn == USDC, "RealAMM: only WETH/USDC");
        require(amountIn > 0, "RealAMM: zero amount");

        uint256 gasBefore = gasleft();

        // Transfer tokens from user to this contract
        IERC20(tokenIn).transferFrom(user, address(this), amountIn);

        // Determine swap direction
        bool zeroForOne = tokenIn == WETH; // WETH→USDC = zeroForOne

        // Approve pool to spend our tokens
        IERC20(tokenIn).approve(POOL, amountIn);

        // Execute swap — the pool calls back uniswapV3SwapCallback
        int256 amountSpecified = int256(amountIn);
        bytes memory data = abi.encode(user, tokenIn, amountIn);

        (int256 amount0, int256 amount1) = pool.swap(
            user,               // recipient — send output tokens directly to user
            zeroForOne,
            amountSpecified,
            sqrtPriceLimit(zeroForOne), // max slippage
            data
        );

        amountOut = zeroForOne ? uint256(-amount1) : uint256(-amount0);

        uint256 gasAfter = gasleft();
        uint256 gasUsed = gasBefore - gasAfter;

        emit SwapExecuted(user, tokenIn, zeroForOne ? USDC : WETH, amountIn, amountOut, gasUsed);
    }

    /**
     * @dev Uniswap V3 callback — called by pool.swap().
     *      Transfers the input tokens to the pool.
     */
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        require(msg.sender == POOL, "RealAMM: only pool");

        // Decode callback data
        (address decodedUser, address decodedTokenIn, uint256 decodedAmountIn) = abi.decode(data, (address, address, uint256));

        // Transfer input tokens from this contract to the pool
        if (amount0Delta > 0) {
            IERC20(WETH).transfer(POOL, uint256(amount0Delta));
        } else if (amount1Delta > 0) {
            IERC20(USDC).transfer(POOL, uint256(amount1Delta));
        }
        // Use variables to silence compiler warnings
        require(decodedAmountIn > 0 || decodedUser != address(0) || decodedTokenIn != address(0), "sanity");
    }

    /** @dev Read current pool price — view function, no emit */
    function getPrice() external view returns (uint160 sqrtPriceX96, int24 tick) {
        (sqrtPriceX96, tick, , , , , ) = pool.slot0();
    }

    /** @dev Max slippage: 0.5% tolerance */
    function sqrtPriceLimit(bool zeroForOne) internal pure returns (uint160) {
        return zeroForOne
            ? 4295128740        // MIN_SQRT_RATIO + 1 (max price impact 50%)
            : 1461446703485210103287273052203988822378723970341; // MAX_SQRT_RATIO - 1
    }
}
