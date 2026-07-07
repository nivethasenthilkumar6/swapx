# Backend API Reference

The backend exposes a read-only API on `http://localhost:3001/api`.

## 1. Tokens
### `GET /api/tokens`
Returns the curated list of popular tokens.

### `GET /api/tokens/search?q={query}`
Search for tokens by symbol, name, or address.

### `GET /api/tokens/{address}`
Get metadata for a specific token.

## 2. Prices
### `GET /api/prices/quote?amountIn={amount}&path={addr1}&path={addr2}`
Get a swap quote from the router.

### `GET /api/prices/{tokenA}/{tokenB}`
Get the current spot price between two tokens.

### `GET /api/prices/history/{tokenA}/{tokenB}`
Get the cached price history for charting.

## 3. Analytics
### `GET /api/analytics/overview`
Get protocol-wide TVL, volume, and pool lists.

### `GET /api/analytics/pools/{tokenA}/{tokenB}`
Get specific pool statistics.

### `GET /api/analytics/arbitrage`
Detect arbitrage opportunities.

## Standard Response Format
All successful responses follow:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": 1234567890
}
```

Errors follow:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": 1234567890
}
```
