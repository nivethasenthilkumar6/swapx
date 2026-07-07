/**
 * Parse contract and Web3 transaction errors into human-readable messages.
 */
export function parseTransactionError(error: any): string {
  if (!error) {
    return 'An unknown error occurred during transaction execution.';
  }

  // Log error for debugging
  console.debug('Parsing Web3 Error:', error);

  const message = error.message || '';
  const code = error.code || '';

  // 1. User Rejected Action
  if (
    code === 'ACTION_REJECTED' ||
    code === 4001 ||
    message.includes('rejected') ||
    message.includes('User denied') ||
    message.includes('User rejected')
  ) {
    return 'Transaction was rejected. Please approve the transaction in your wallet to proceed.';
  }

  // 2. Insufficient Funds
  if (
    code === 'INSUFFICIENT_FUNDS' ||
    message.includes('insufficient funds') ||
    message.includes('balance')
  ) {
    return 'Insufficient ETH balance. You do not have enough Ether in your wallet to cover the transaction amount and network gas fees.';
  }

  // 3. Common DEX/Uniswap V2 Revert Reasons
  if (message.includes('INSUFFICIENT_OUTPUT_AMOUNT') || message.includes('amounts[1]')) {
    return 'Swap failed: Price slippage exceeded your tolerance limit. Try increasing slippage tolerance.';
  }

  if (message.includes('EXPIRED') || message.includes('deadline')) {
    return 'Transaction expired. The transaction was not processed within the deadline. Please try again.';
  }

  if (message.includes('TRANSFER_FROM_FAILED')) {
    return 'Token transfer failed. Please ensure you have approved the contract to spend your tokens and have sufficient balance.';
  }

  if (message.includes('INSUFFICIENT_A_AMOUNT') || message.includes('INSUFFICIENT_B_AMOUNT')) {
    return 'Add liquidity failed: Reserve ratio changed significantly. Please try again.';
  }

  if (message.includes('K')) {
    return 'DEX invariant failed. The constant product formula check failed.';
  }

  // 4. Fallback: Parse nested revert messages
  if (error.reason) {
    return `Transaction reverted: ${error.reason}`;
  }

  // Handle nested ethers/wagmi errors
  const nestedError = error.error || error.data;
  if (nestedError && nestedError.message) {
    return parseTransactionError(nestedError);
  }

  return 'Transaction failed. Check that you have enough tokens, gas fees, and are on Sepolia testnet.';
}
