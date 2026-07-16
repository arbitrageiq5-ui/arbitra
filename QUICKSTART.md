# Arbitrage IQ - Quick Start Guide

Get the crypto arbitrage platform running in 5 minutes.

## 1. Setup Environment (1 minute)

```bash
# Copy environment template
cp .env.example .env.local

# Generate BETTER_AUTH_SECRET
openssl rand -base64 32
# Copy the output and paste it in .env.local as BETTER_AUTH_SECRET
```

### Required Variables
```env
DATABASE_URL=postgresql://...  # Get from Neon dashboard
BETTER_AUTH_SECRET=<generated-above>
OPENAI_API_KEY=sk-...         # Get from OpenAI dashboard
ENCRYPTION_KEY=any-random-string
```

## 2. Start Development Server (30 seconds)

```bash
# Install dependencies (if not done)
pnpm install

# Start the dev server
pnpm dev
```

Server runs at `http://localhost:3000`

## 3. Create Account (2 minutes)

1. Visit `http://localhost:3000/sign-up`
2. Enter email and password (8+ characters)
3. Click "Create account"
4. Redirected to dashboard automatically

## 4. View Opportunities (1 minute)

1. Dashboard shows real-time arbitrage opportunities
2. Green cards show:
   - Symbol (BTC, ETH, etc.)
   - Buy exchange and price
   - Sell exchange and price
   - Profit percentage
3. Click "Score" button to get AI analysis

## Features at a Glance

### Dashboard
- **Statistics**: Active opportunities, avg profit, notification count
- **Opportunity Table**: All detected arbitrage opportunities
- **Notifications**: Recent alerts and updates
- **User Menu**: View profile, sign out

### Settings (`/settings`)
- Add exchange API keys
- Manage connected exchanges
- Secure credential storage

### Authentication
- Sign in/up with email + password
- Automatic session management
- Secure cookie handling

## API Endpoints

### Price Monitoring
```bash
# Manually trigger price collection
curl http://localhost:3000/api/monitor

# Response includes detected opportunities
```

### Cron Monitoring (Production)
Configure in `vercel.json` - runs every 5 minutes on Vercel

## Database

Tables created automatically:
- `user` - User accounts
- `session` - Auth sessions
- `arbitrage_opportunities` - Detected opportunities
- `price_history` - Historical prices
- `portfolio` - Trading positions
- `notifications` - User notifications

## Next Steps

### To add real exchange connections:
1. Go to `/settings`
2. Add exchange API keys
3. Platform encrypts and stores them
4. Opportunities use real exchange data

### To enable AI scoring:
1. Ensure `OPENAI_API_KEY` is set
2. Click "Score" on any opportunity
3. Wait 3-10 seconds for GPT-4 analysis
4. See score and reasoning

### To deploy to production:
```bash
# Push to GitHub
git push origin main

# Vercel auto-deploys
# Set production environment variables in Vercel dashboard:
# - DATABASE_URL (Neon production)
# - BETTER_AUTH_SECRET
# - OPENAI_API_KEY
# - ENCRYPTION_KEY
```

## Common Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Check TypeScript
pnpm format           # Format code

# Database (manual)
pnpm db:push          # Sync schema to database
pnpm db:generate      # Generate Drizzle migration
```

## Troubleshooting

### Port 3000 already in use
```bash
# Kill existing process
lsof -i :3000
kill -9 <PID>

# Or use different port
PORT=3001 pnpm dev
```

### Database connection error
```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Verify PostgreSQL is running (if local)
psql -U postgres -d arbitrage_iq
```

### Sign-in not working
- Check BETTER_AUTH_SECRET is set
- Clear browser cookies
- Check server logs for errors

### No opportunities showing
- Monitor endpoint may not have run yet
- Try: `curl http://localhost:3000/api/monitor`
- Check that exchange APIs are responding

## Architecture Quick Reference

```
REQUEST FLOW:
User → Page (Next.js) → Server Action → Database
                    ↓
              Exchange APIs

AUTH FLOW:
Sign Up → Hash Password → Create User → Generate Session → Cookie

OPPORTUNITY DETECTION:
Timer/Cron → Monitor API → Get Prices → Detect Gaps → Store in DB → Show in UI

AI SCORING:
User clicks Score → OpenAI API → GPT-4 Analysis → Store Score → Display
```

## File Structure for Development

```
Key Files to Edit:
- app/page.tsx              - Dashboard page
- components/dashboard-client.tsx  - Dashboard UI
- lib/services/exchanges.ts - Exchange integrations
- app/actions/arbitrage.ts  - Business logic
- lib/db/schema.ts          - Database schema
```

## Environment Variables Explained

```
DATABASE_URL              # PostgreSQL connection
BETTER_AUTH_SECRET        # Session encryption key (≥32 chars)
OPENAI_API_KEY           # GPT-4 API access
ENCRYPTION_KEY           # Encrypt API credentials
NODE_ENV                 # development | production
VERCEL_URL               # Set by Vercel, auto-detected
```

## Security Notes

- Never commit `.env.local` to GitHub
- Use unique BETTER_AUTH_SECRET in production
- Rotate ENCRYPTION_KEY periodically
- Store backups of database credentials securely
- Monitor API key usage in OpenAI dashboard

## Performance Tips

- Monitor endpoint runs every 5 minutes (configurable)
- Opportunities cached for 5 minutes (configurable)
- Price history indexed by symbol + timestamp
- Dashboard updates on page refresh (could add WebSocket)

## Support

- Check README.md for full documentation
- See IMPLEMENTATION.md for architecture details
- Review app/actions/arbitrage.ts for available functions
- Check error logs in Vercel dashboard

---

Ready to go! Sign up and start finding arbitrage opportunities.
