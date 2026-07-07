// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IWETH.sol";
import "./libraries/SwapMath.sol";

/// @title SwapRouter - Token swap wrapper around Uniswap V2 Router
/// @notice Provides swap functionality with access control, pausability, protocol fees, and events
/// @dev Delegates actual swap execution to the underlying Uniswap V2 Router02
contract SwapRouter is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────
    IUniswapV2Router02 public immutable uniswapRouter;
    IUniswapV2Factory public immutable uniswapFactory;
    address public immutable WETH;

    uint256 public protocolFeeBps; // protocol fee in basis points (max 50 = 0.5%)
    address public feeRecipient;
    uint256 public constant MAX_PROTOCOL_FEE = 50; // 0.5% max
    uint256 public constant FEE_DENOMINATOR = 10000;

    // ─── Custom Errors ───────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error FeeTooHigh();
    error DeadlineExpired();
    error InsufficientOutput();
    error IdenticalTokens();
    error TransferFailed();
    error InvalidPath();

    // ─── Events ──────────────────────────────────────────────────────────
    event SwapExecuted(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    );
    event ProtocolFeeCollected(address indexed token, uint256 amount);
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);

    // ─── Modifiers ───────────────────────────────────────────────────────
    modifier ensureDeadline(uint256 deadline) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        _;
    }

    modifier validPath(address[] calldata path) {
        if (path.length < 2) revert InvalidPath();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(
        address _router,
        address _feeRecipient
    ) Ownable(msg.sender) {
        if (_router == address(0) || _feeRecipient == address(0)) revert ZeroAddress();

        uniswapRouter = IUniswapV2Router02(_router);
        uniswapFactory = IUniswapV2Factory(uniswapRouter.factory());
        WETH = uniswapRouter.WETH();
        feeRecipient = _feeRecipient;
        protocolFeeBps = 5; // 0.05% default
    }

    // ─── Swap: Exact ETH for Tokens ──────────────────────────────────────
    /// @notice Swap exact ETH for tokens
    /// @param amountOutMin Minimum tokens to receive (slippage protection)
    /// @param path Swap path starting with WETH
    /// @param to Recipient address
    /// @param deadline Transaction deadline timestamp
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    )
        external
        payable
        nonReentrant
        whenNotPaused
        ensureDeadline(deadline)
        validPath(path)
        returns (uint256[] memory amounts)
    {
        if (msg.value == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        uint256 feeAmount = _calculateProtocolFee(msg.value);
        uint256 swapAmount = msg.value - feeAmount;

        // Collect protocol fee in ETH
        if (feeAmount > 0) {
            (bool success, ) = feeRecipient.call{value: feeAmount}("");
            if (!success) revert TransferFailed();
            emit ProtocolFeeCollected(address(0), feeAmount);
        }

        amounts = uniswapRouter.swapExactETHForTokens{value: swapAmount}(
            amountOutMin,
            path,
            to,
            deadline
        );

        emit SwapExecuted(msg.sender, address(0), path[path.length - 1], msg.value, amounts[amounts.length - 1], to);
    }

    // ─── Swap: Exact Tokens for ETH ──────────────────────────────────────
    /// @notice Swap exact tokens for ETH
    /// @param amountIn Amount of input tokens
    /// @param amountOutMin Minimum ETH to receive
    /// @param path Swap path ending with WETH
    /// @param to Recipient address
    /// @param deadline Transaction deadline timestamp
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        ensureDeadline(deadline)
        validPath(path)
        returns (uint256[] memory amounts)
    {
        if (amountIn == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        IERC20 tokenIn = IERC20(path[0]);
        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 feeAmount = _calculateProtocolFee(amountIn);
        uint256 swapAmount = amountIn - feeAmount;

        // Collect protocol fee in tokens
        if (feeAmount > 0) {
            tokenIn.safeTransfer(feeRecipient, feeAmount);
            emit ProtocolFeeCollected(path[0], feeAmount);
        }

        tokenIn.forceApprove(address(uniswapRouter), swapAmount);

        amounts = uniswapRouter.swapExactTokensForETH(
            swapAmount,
            amountOutMin,
            path,
            to,
            deadline
        );

        emit SwapExecuted(msg.sender, path[0], address(0), amountIn, amounts[amounts.length - 1], to);
    }

    // ─── Swap: Exact Tokens for Tokens ───────────────────────────────────
    /// @notice Swap exact tokens for tokens
    /// @param amountIn Amount of input tokens
    /// @param amountOutMin Minimum output tokens to receive
    /// @param path Swap path
    /// @param to Recipient address
    /// @param deadline Transaction deadline timestamp
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        ensureDeadline(deadline)
        validPath(path)
        returns (uint256[] memory amounts)
    {
        if (amountIn == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        IERC20 tokenIn = IERC20(path[0]);
        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 feeAmount = _calculateProtocolFee(amountIn);
        uint256 swapAmount = amountIn - feeAmount;

        if (feeAmount > 0) {
            tokenIn.safeTransfer(feeRecipient, feeAmount);
            emit ProtocolFeeCollected(path[0], feeAmount);
        }

        tokenIn.forceApprove(address(uniswapRouter), swapAmount);

        amounts = uniswapRouter.swapExactTokensForTokens(
            swapAmount,
            amountOutMin,
            path,
            to,
            deadline
        );

        emit SwapExecuted(msg.sender, path[0], path[path.length - 1], amountIn, amounts[amounts.length - 1], to);
    }

    // ─── Swap: Tokens for Exact Tokens (Exact Output) ────────────────────
    /// @notice Swap tokens for an exact output amount of tokens
    /// @param amountOut Desired output amount
    /// @param amountInMax Maximum input tokens willing to spend
    /// @param path Swap path
    /// @param to Recipient address
    /// @param deadline Transaction deadline timestamp
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        ensureDeadline(deadline)
        validPath(path)
        returns (uint256[] memory amounts)
    {
        if (amountOut == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        IERC20 tokenIn = IERC20(path[0]);
        tokenIn.safeTransferFrom(msg.sender, address(this), amountInMax);

        tokenIn.forceApprove(address(uniswapRouter), amountInMax);

        amounts = uniswapRouter.swapTokensForExactTokens(
            amountOut,
            amountInMax,
            path,
            to,
            deadline
        );

        // Refund unused tokens
        uint256 usedAmount = amounts[0];
        uint256 refund = amountInMax - usedAmount;
        if (refund > 0) {
            tokenIn.safeTransfer(msg.sender, refund);
        }

        // Collect fee on the used amount
        uint256 feeAmount = _calculateProtocolFee(usedAmount);
        if (feeAmount > 0) {
            // Fee was not deducted before swap; in exact-output mode it's info-only
            emit ProtocolFeeCollected(path[0], feeAmount);
        }

        emit SwapExecuted(msg.sender, path[0], path[path.length - 1], usedAmount, amountOut, to);
    }

    // ─── Swap: ETH for Exact Tokens ──────────────────────────────────────
    /// @notice Swap ETH for an exact output amount of tokens
    /// @param amountOut Desired output token amount
    /// @param path Swap path starting with WETH
    /// @param to Recipient address
    /// @param deadline Transaction deadline timestamp
    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    )
        external
        payable
        nonReentrant
        whenNotPaused
        ensureDeadline(deadline)
        validPath(path)
        returns (uint256[] memory amounts)
    {
        if (amountOut == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        amounts = uniswapRouter.swapETHForExactTokens{value: msg.value}(
            amountOut,
            path,
            to,
            deadline
        );

        // Refund unused ETH
        uint256 refund = msg.value - amounts[0];
        if (refund > 0) {
            (bool success, ) = msg.sender.call{value: refund}("");
            if (!success) revert TransferFailed();
        }

        emit SwapExecuted(msg.sender, address(0), path[path.length - 1], amounts[0], amountOut, to);
    }

    // ─── View Functions ──────────────────────────────────────────────────
    /// @notice Get expected output amounts for a swap path
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory)
    {
        return uniswapRouter.getAmountsOut(amountIn, path);
    }

    /// @notice Get required input amounts for a desired output
    function getAmountsIn(uint256 amountOut, address[] calldata path)
        external
        view
        returns (uint256[] memory)
    {
        return uniswapRouter.getAmountsIn(amountOut, path);
    }

    /// @notice Get a quote for equivalent amounts
    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB)
        external
        pure
        returns (uint256)
    {
        return SwapMath.quote(amountA, reserveA, reserveB);
    }

    /// @notice Get the factory address
    function factory() external view returns (address) {
        return address(uniswapFactory);
    }

    // ─── Admin Functions ─────────────────────────────────────────────────
    /// @notice Update the protocol fee
    /// @param newFeeBps New fee in basis points
    function setProtocolFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_PROTOCOL_FEE) revert FeeTooHigh();
        uint256 oldFee = protocolFeeBps;
        protocolFeeBps = newFeeBps;
        emit ProtocolFeeUpdated(oldFee, newFeeBps);
    }

    /// @notice Update the fee recipient
    /// @param newRecipient New fee recipient address
    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    /// @notice Pause the contract
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Emergency withdraw stuck tokens
    /// @param token Token address (address(0) for ETH)
    /// @param amount Amount to withdraw
    /// @param to Recipient address
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();

        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }

        emit EmergencyWithdraw(token, amount, to);
    }

    // ─── Internal Functions ──────────────────────────────────────────────
    function _calculateProtocolFee(uint256 amount) internal view returns (uint256) {
        if (protocolFeeBps == 0) return 0;
        return (amount * protocolFeeBps) / FEE_DENOMINATOR;
    }

    // ─── Receive ─────────────────────────────────────────────────────────
    receive() external payable {}
}
