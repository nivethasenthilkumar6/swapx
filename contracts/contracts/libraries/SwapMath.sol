// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SwapMath - AMM mathematical utilities for Uniswap V2 style constant product pools
/// @notice Provides functions for price calculation, impact analysis, and fee computation
library SwapMath {
    uint256 private constant FEE_DENOMINATOR = 10000;
    uint256 private constant PRECISION = 1e18;

    /// @notice Custom errors
    error InsufficientInputAmount();
    error InsufficientLiquidity();
    error InsufficientOutputAmount();
    error InvalidReserves();

    /// @notice Calculate the output amount given an input amount and reserves
    /// @dev Uses the constant product formula: (x + dx)(y - dy) = x * y
    /// @param amountIn The input amount
    /// @param reserveIn The reserve of the input token
    /// @param reserveOut The reserve of the output token
    /// @param feeBps The fee in basis points (e.g. 30 = 0.30%)
    /// @return amountOut The calculated output amount
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 feeBps
    ) internal pure returns (uint256 amountOut) {
        if (amountIn == 0) revert InsufficientInputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - feeBps);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    /// @notice Calculate the input amount needed for a desired output amount
    /// @param amountOut The desired output amount
    /// @param reserveIn The reserve of the input token
    /// @param reserveOut The reserve of the output token
    /// @param feeBps The fee in basis points
    /// @return amountIn The required input amount
    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 feeBps
    ) internal pure returns (uint256 amountIn) {
        if (amountOut == 0) revert InsufficientOutputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        if (amountOut >= reserveOut) revert InsufficientLiquidity();

        uint256 numerator = reserveIn * amountOut * FEE_DENOMINATOR;
        uint256 denominator = (reserveOut - amountOut) * (FEE_DENOMINATOR - feeBps);
        amountIn = (numerator / denominator) + 1;
    }

    /// @notice Calculate the spot price of tokenA in terms of tokenB
    /// @param reserveA Reserve of token A
    /// @param reserveB Reserve of token B
    /// @return price The spot price with PRECISION decimals
    function getSpotPrice(
        uint256 reserveA,
        uint256 reserveB
    ) internal pure returns (uint256 price) {
        if (reserveA == 0) revert InvalidReserves();
        price = (reserveB * PRECISION) / reserveA;
    }

    /// @notice Calculate price impact of a trade
    /// @param amountIn The input amount
    /// @param reserveIn The reserve of input token
    /// @param reserveOut The reserve of output token
    /// @param feeBps The fee in basis points
    /// @return impactBps Price impact in basis points
    function getPriceImpact(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 feeBps
    ) internal pure returns (uint256 impactBps) {
        if (reserveIn == 0 || reserveOut == 0) revert InvalidReserves();

        // Ideal output (no slippage) = amountIn * reserveOut / reserveIn
        uint256 idealOutput = (amountIn * reserveOut) / reserveIn;
        if (idealOutput == 0) return 0;

        uint256 actualOutput = getAmountOut(amountIn, reserveIn, reserveOut, feeBps);

        // Impact = (ideal - actual) / ideal * 10000
        if (idealOutput > actualOutput) {
            impactBps = ((idealOutput - actualOutput) * FEE_DENOMINATOR) / idealOutput;
        }
    }

    /// @notice Calculate the execution price of a swap
    /// @param amountIn The input amount
    /// @param amountOut The output amount
    /// @return executionPrice The execution price with PRECISION decimals
    function getExecutionPrice(
        uint256 amountIn,
        uint256 amountOut
    ) internal pure returns (uint256 executionPrice) {
        if (amountIn == 0) revert InsufficientInputAmount();
        executionPrice = (amountOut * PRECISION) / amountIn;
    }

    /// @notice Calculate minimum received with slippage tolerance
    /// @param amountOut The expected output amount
    /// @param slippageBps The slippage tolerance in basis points
    /// @return minReceived The minimum amount to receive
    function getMinimumReceived(
        uint256 amountOut,
        uint256 slippageBps
    ) internal pure returns (uint256 minReceived) {
        minReceived = (amountOut * (FEE_DENOMINATOR - slippageBps)) / FEE_DENOMINATOR;
    }

    /// @notice Calculate the LP fee for a given trade
    /// @param amountIn The input amount
    /// @param feeBps The fee in basis points
    /// @return fee The LP fee amount
    function getLPFee(
        uint256 amountIn,
        uint256 feeBps
    ) internal pure returns (uint256 fee) {
        fee = (amountIn * feeBps) / FEE_DENOMINATOR;
    }

    /// @notice Equivalent of Uniswap's quote function
    /// @param amountA Amount of token A
    /// @param reserveA Reserve of token A
    /// @param reserveB Reserve of token B
    /// @return amountB Equivalent amount of token B
    function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) internal pure returns (uint256 amountB) {
        if (amountA == 0) revert InsufficientInputAmount();
        if (reserveA == 0 || reserveB == 0) revert InsufficientLiquidity();
        amountB = (amountA * reserveB) / reserveA;
    }

    /// @notice Detect potential arbitrage between two pools
    /// @param reserveA1 Reserve of token A in pool 1
    /// @param reserveB1 Reserve of token B in pool 1
    /// @param reserveA2 Reserve of token A in pool 2
    /// @param reserveB2 Reserve of token B in pool 2
    /// @return priceDiffBps The price difference in basis points
    /// @return isArbitrage Whether arbitrage opportunity exists (> 50 bps difference)
    function detectArbitrage(
        uint256 reserveA1,
        uint256 reserveB1,
        uint256 reserveA2,
        uint256 reserveB2
    ) internal pure returns (uint256 priceDiffBps, bool isArbitrage) {
        if (reserveA1 == 0 || reserveA2 == 0) return (0, false);

        uint256 price1 = getSpotPrice(reserveA1, reserveB1);
        uint256 price2 = getSpotPrice(reserveA2, reserveB2);

        uint256 diff;
        if (price1 > price2) {
            diff = price1 - price2;
        } else {
            diff = price2 - price1;
        }

        priceDiffBps = (diff * FEE_DENOMINATOR) / price1;
        isArbitrage = priceDiffBps > 50; // > 0.5% difference
    }
}
