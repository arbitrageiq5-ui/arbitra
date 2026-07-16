# Arbitrage IQ - Deployment Guide

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations completed
- [ ] Tests passing locally
- [ ] API rate limiting configured
- [ ] Security headers set up
- [ ] Error monitoring configured

## Environment Variables Required

```
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname
NEON_AUTH_COOKIE_SECRET=<random-32-char-string>

# API Keys
OPENAI_API_KEY=sk-...

# Authentication
BETTER_AUTH_SECRET=<random-32-char-string>
BETTER_AUTH_URL=https://yourdomain.com (optional, falls back to auto-detection)

# Encryption
ENCRYPTION_KEY=<random-32-char-string>

# Optional: Analytics
SENTRY_DSN=https://...@sentry.io/...
```

## Generating Secure Keys

```bash
# Generate BETTER_AUTH_SECRET
openssl rand -base64 32

# Generate NEON_AUTH_COOKIE_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY
openssl rand -base64 32
```

## Deployment Steps

### 1. Vercel Deployment (Recommended)

```bash
# Connect your GitHub repository
vercel link

# Set environment variables in Vercel dashboard
# Settings > Environment Variables

# Deploy
vercel deploy
```

### 2. Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t arbitrage-iq .
docker run -e DATABASE_URL=... -e OPENAI_API_KEY=... -p 3000:3000 arbitrage-iq
```

### 3. AWS ECS Deployment

1. Create ECR repository
2. Build and push Docker image
3. Create ECS task definition
4. Create ECS service
5. Configure ALB/NLB for load balancing

### 4. Database Migration (AWS RDS / Neon)

```bash
# For Neon (via Vercel dashboard)
# 1. Connect Neon integration
# 2. Run migrations (already applied via Neon MCP)

# For AWS RDS
# 1. Create RDS instance
# 2. Run Drizzle migrations
# 3. Set DATABASE_URL connection string
```

## Post-Deployment Configuration

### 1. Set Up Error Monitoring

```typescript
// lib/sentry.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### 2. Configure Content Security Policy

```typescript
// next.config.mjs
export default {
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        },
      ],
    },
  ],
}
```

### 3. Set Up Monitoring

- CloudWatch or Datadog for logs
- New Relic or DataDog for APM
- Sentry for error tracking

### 4. Configure Auto-scaling

For production (AWS RDS or similar):
- Configure connection pooling
- Set up read replicas for high traffic
- Enable backups and point-in-time recovery

## Performance Optimization

### 1. Enable Compression

Next.js automatically gzips responses over 1KB.

### 2. Optimize Images

Images in public folder are automatically optimized by Next.js 16.

### 3. Database Query Optimization

```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_user_id ON arbitrage_opportunities(userId);
CREATE INDEX idx_symbol ON arbitrage_opportunities(symbol);
CREATE INDEX idx_created_at ON arbitrage_opportunities(createdAt);
CREATE INDEX idx_portfolio_user_id ON portfolio(userId);
```

### 4. Implement Caching

```typescript
// lib/cache.ts
export const revalidate = {
  short: 60,      // 1 minute
  medium: 300,    // 5 minutes
  long: 3600,     // 1 hour
}
```

## Security Best Practices

### 1. API Rate Limiting

```typescript
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 h"),
});
```

### 2. Input Validation

Always validate user input with Zod:

```typescript
import { z } from 'zod'

const opportunitySchema = z.object({
  symbol: z.string().min(1).max(10),
  buyExchange: z.enum(['binance', 'kraken', 'coinbase']),
  buyPrice: z.number().positive(),
})
```

### 3. CORS Configuration

```typescript
// middleware.ts
export const config = {
  matcher: ['/api/:path*'],
}

export function middleware(request: NextRequest) {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
```

### 4. Database Security

- Use environment variables for connection strings (never hardcode)
- Enable SSL/TLS for database connections
- Use IAM authentication for cloud databases
- Regular backups and disaster recovery

### 5. API Key Management

- Rotate API keys every 90 days
- Use separate keys per environment
- Monitor API key usage for anomalies
- Never log API keys

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Performance**
   - API response times
   - Database query latency
   - WebSocket connection health

2. **Availability**
   - 99.5% uptime target
   - Exchange API health
   - Database availability

3. **Business**
   - Number of opportunities detected
   - AI scoring latency
   - User engagement

### Alert Thresholds

- API response time > 500ms
- Error rate > 1%
- Exchange API timeout
- Database connection pool exhausted
- OpenAI API rate limit approaching

## Scaling Strategy

### Horizontal Scaling

1. **Load Balancer**: Distribute traffic across multiple instances
2. **Database Read Replicas**: For read-heavy workloads
3. **Redis Cache**: Distributed caching layer

### Vertical Scaling

1. Increase server resources (CPU, RAM)
2. Upgrade database instance size
3. Increase connection pool size

### Cost Optimization

- Use spot instances for non-critical workloads
- Implement auto-scaling based on metrics
- Cache aggressively to reduce API calls
- Batch process opportunities to reduce compute

## Troubleshooting

### Common Issues

**Issue**: Database connection timeout
```
Solution: Check DATABASE_URL, network security groups, and connection pool settings
```

**Issue**: OpenAI API rate limit
```
Solution: Implement exponential backoff, batch scoring, and request caching
```

**Issue**: WebSocket disconnections
```
Solution: Implement heartbeat, automatic reconnection, and connection pooling
```

**Issue**: Memory leaks
```
Solution: Monitor with Node.js inspector, check for event listener cleanup, use profiling tools
```

## Rollback Plan

1. **Blue-Green Deployment**
   - Keep previous version running
   - Switch traffic instantly if needed
   - Zero-downtime rollbacks

2. **Database Rollback**
   ```bash
   # With Neon
   vercel env pull  # Get current backup
   # Restore from backup point
   ```

3. **Code Rollback**
   ```bash
   git revert <commit-hash>
   git push
   vercel redeploy
   ```

## Support & Resources

- **Documentation**: See README.md, QUICKSTART.md, IMPLEMENTATION.md
- **Issues**: GitHub Issues for bug reports
- **Help**: Open support ticket for deployment assistance

## Next Steps

1. Review all environment variables
2. Test in staging environment
3. Run security audit
4. Set up monitoring
5. Deploy to production
6. Verify all systems operational
7. Announce to users
