# Arbitrage IQ - Crypto Arbitrage Intelligence Platform

A sophisticated, production-ready cryptocurrency arbitrage detection platform that identifies real-time profit opportunities across multiple crypto exchanges using AI-powered scoring.

## Features

### Core Functionality
- **Real-time Price Monitoring**: Fetches prices from 6 major exchanges simultaneously (Binance, Kraken, Coinbase, Bybit, KuCoin, Huobi)
- **Arbitrage Detection Engine**: Identifies profitable trading opportunities with configurable minimum profit thresholds
- **AI-Powered Scoring**: Uses OpenAI GPT-4 to score opportunities based on exchange reliability, liquidity, fees, and execution risk
- **Portfolio Tracking**: Track your positions across exchanges with live profit/loss calculations
- **Paper Trading**: Simulate trades without real funds to test strategies
- **In-App Notifications**: Real-time alerts for high-potential opportunities
- **User Authentication**: Secure email/password authentication with session management

### Technical Stack
- **Frontend**: Next.js 16 with React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js Server Actions, Node.js
- **Database**: PostgreSQL via Neon with Drizzle ORM
- **Authentication**: Better Auth for secure user management
- **AI Integration**: OpenAI GPT-4 API for opportunity scoring
- **API Integrations**: Axios for REST calls across 6 crypto exchanges
- **Encryption**: CryptoJS for secure API key storage

## Getting Started

### Prerequisites
- Node.js 18+ and pnpm
- PostgreSQL database (Neon recommended)
- OpenAI API key
- Exchange API credentials (optional, for live trading)

### Installation

1. **Clone and install dependencies**:
```bash
pnpm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `BETTER_AUTH_SECRET`: Authentication secret (generate: `openssl rand -base64 32`)
- `OPENAI_API_KEY`: Your OpenAI API key
- `ENCRYPTION_KEY`: Key for encrypting API credentials

3. **Database setup**:
The database schema is automatically created via the Neon MCP integration. Tables include:
- `user`, `session`, `account`, `verification` (Better Auth)
- `exchange_accounts`: Store encrypted exchange API credentials
- `price_history`: Historical price data from exchanges
- `arbitrage_opportunities`: Detected opportunities with AI scores
- `portfolio`: User portfolio positions
- `notifications`: User notifications

4. **Start the development server**:
```bash
pnpm dev
```

Visit `http://localhost:3000` and sign up to get started.

## Architecture

### Service Layer (`lib/services/exchanges.ts`)
- Unified interface for 6 crypto exchanges
- Parallel price fetching for low-latency data collection
- Arbitrage opportunity detection with configurable thresholds
- Encryption/decryption for sensitive API keys

### Server Actions (`app/actions/arbitrage.ts`)
- `saveArbitrageOpportunity()`: Store detected opportunities
- `getArbitrageOpportunities()`: Fetch pending opportunities
- `scoreOpportunityWithAI()`: Get GPT-4 analysis and scoring
- `updatePortfolio()`: Track trading positions
- `createNotification()`: Send alerts to users

### API Routes
- `GET /api/monitor`: Real-time price monitoring and opportunity detection
- `GET /api/cron/check-arbitrage`: Scheduled arbitrage checking (Vercel Cron compatible)
- `POST /api/auth/[...all]`: Better Auth handler for authentication

### Components
- `DashboardClient`: Main dashboard with real-time opportunities, stats, and notifications
- `AuthForm`: Reusable sign-in/sign-up form
- `ExchangeSettings`: Manage exchange API connections

## Monitoring & Opportunities

### How It Works
1. **Price Collection**: Every 30 seconds, prices are fetched from all 6 exchanges simultaneously
2. **Opportunity Detection**: System identifies price differences > 0.3% between exchanges
3. **AI Scoring**: Each opportunity is scored by GPT-4 considering:
   - Exchange reliability and reputation
   - Liquidity on each exchange
   - Withdrawal and trading fees
   - Market volatility and execution risk
4. **Notification**: Opportunities with high AI scores trigger notifications

### Accessing Opportunities
1. Sign in to the dashboard
2. View real-time opportunities in the main table
3. Click "Score" to get AI analysis
4. Sort by profit percentage or AI score

## Integration Guide

### Adding Exchange API Keys
1. Go to Settings page (`/settings`)
2. Click "Add Exchange Account"
3. Select exchange, enter API Key and Secret
4. Keys are encrypted before storage

### Setting Up Cron Monitoring
Add this to `vercel.json` for automated monitoring:
```json
{
  "crons": [{
    "path": "/api/cron/check-arbitrage",
    "schedule": "*/5 * * * *"
  }]
}
```

## API Reference

### GET /api/monitor
Fetches prices from all exchanges and detects arbitrage opportunities.

Response:
```json
{
  "success": true,
  "pricesCollected": 60,
  "opportunitiesFound": 12,
  "topOpportunities": [
    {
      "symbol": "BTCUSDT",
      "buyExchange": "binance",
      "buyPrice": 43000.50,
      "sellExchange": "kraken",
      "sellPrice": 43500.75,
      "profitPercentage": 1.16,
      "profitAmount": 500.25
    }
  ]
}
```

### POST /api/actions (Server Actions)
All data mutations go through typed Server Actions for security.

## Security

### Best Practices Implemented
- **Encrypted API Keys**: All exchange credentials encrypted with AES-256
- **Session Management**: 7-day sessions with automatic renewal
- **User Scoping**: Every query filtered by authenticated user ID
- **CORS Protection**: Trust-based origin validation
- **Rate Limiting**: Implement per-user rate limits on exchange calls
- **Audit Logging**: All trade actions logged for compliance

### Production Deployment
1. Set strong `BETTER_AUTH_SECRET`
2. Use managed PostgreSQL (Neon recommended)
3. Enable HTTPS only
4. Set `NODE_ENV=production`
5. Configure appropriate CORS origins
6. Use environment-specific API keys

## Performance Optimization

### Caching Strategy
- Price history stored in PostgreSQL
- Opportunities cached for 5-minute windows
- Revalidate tags on new opportunity detection

### Concurrency
- Parallel exchange API calls for low latency
- Connection pooling via Neon serverless
- Batch AI scoring for multiple opportunities

## Common Issues

### "Module not found" errors
Clear cache and restart dev server:
```bash
rm -rf .next
pnpm dev
```

### Database connection errors
Verify `DATABASE_URL` in `.env.local` and ensure Neon project is active.

### OpenAI API errors
Check `OPENAI_API_KEY` format and account quota/billing status.

### Exchange API failures
Exchanges may be temporarily unavailable. System retries and gracefully degrades.

## Development

### Adding a New Exchange
1. Add fetcher function to `lib/services/exchanges.ts`
2. Update `getPricesAcrossExchanges()` to include new exchange
3. Test with `POST /api/monitor`

### Extending AI Scoring
Edit the prompt in `scoreOpportunityWithAI()` server action to customize GPT-4 analysis criteria.

### Database Schema Changes
Use Neon MCP to execute DDL statements directly - migrations not required for development.

## Roadmap

- [ ] WebSocket support for real-time price updates
- [ ] Advanced portfolio analytics and backtesting
- [ ] Multi-exchange execution bot
- [ ] SMS and email notifications
- [ ] Mobile app (React Native)
- [ ] Advanced charting and technical analysis
- [ ] Machine learning for pattern recognition

## Support

For issues, questions, or feature requests, open an issue on GitHub or contact support.

## License

MIT License - see LICENSE file for details
