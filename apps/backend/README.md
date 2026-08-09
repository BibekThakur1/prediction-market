# Prediction Market Backend

A prediction market backend with order matching, split/merge functionality, and onramp/offramp capabilities.

## Setup

1. Install dependencies:
```bash
bun install
```

2. Set up environment variables:
Create a `.env` file with:
```
SUPABASE_SECRET_KEY=your-supabase-secret-key
DATABASE_URL=your-database-url
```

3. Seed the database with sample data:
```bash
bun run seed.ts
```

This will create:
- 5 sample markets
- 3 sample users with starting balances
- Sample positions and order history

## Running the Server

```bash
bun run index.ts
```

The server will start on `http://localhost:3000`

## API Endpoints

### Public Endpoints
- `GET /` - Frontend interface
- `GET /markets` - Get all markets
- `GET /market?marketId=<id>` - Get specific market

### Protected Endpoints (require authentication)
- `POST /order` - Place an order (buy/sell yes/no)
- `POST /split` - Split USD into Yes/No positions
- `POST /merge` - Merge Yes/No positions back to USD
- `GET /balance` - Get user's USD balance
- `GET /positions` - Get user's positions
- `POST /history` - Get user's order history
- `POST /onramp` - Add USD to user balance
- `POST /offramp` - Withdraw USD from user balance

## Request/Response Examples

### Place Order
```bash
POST /order
Headers: Authorization: <your-auth-token>
Body: {
  "marketId": "market-uuid",
  "side": "yes",
  "type": "buy",
  "price": 60,
  "qty": 10
}
```

### Onramp
```bash
POST /onramp
Headers: Authorization: <your-auth-token>
Body: {
  "amount": 100.00
}
```

### Offramp
```bash
POST /offramp
Headers: Authorization: <your-auth-token>
Body: {
  "amount": 50.00
}
```

### Split
```bash
POST /split
Headers: Authorization: <your-auth-token>
Body: {
  "marketId": "market-uuid",
  "amount": 10
}
```

### Merge
```bash
POST /merge
Headers: Authorization: <your-auth-token>
Body: {
  "marketId": "market-uuid",
  "amount": 10
}
```

## Database Schema

- **User**: id, address, usdBalance
- **Market**: id, title, description, resolutionDescription, yesOrderbook, noOrderbook, totalQty
- **Position**: id, userId, marketId, type (Yes/No), qty
- **OrderHistory**: id, orderType, qty, price, userId, marketId

## Frontend

The frontend is accessible at `http://localhost:3000` and provides:
- Market listing and selection
- Order placement (buy/sell yes/no)
- Balance management with onramp/offramp
- Split/merge functionality
- Position tracking
- Order history

## Notes

- All monetary values are stored in cents (integers) to avoid floating-point precision issues
- The backend uses Express.js with CORS enabled
- Authentication is handled via Supabase auth tokens
- Order matching is handled through an orderbook system with reverse order support