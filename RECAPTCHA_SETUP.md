# reCAPTCHA v3 Setup Guide

This registration system uses **reCAPTCHA v3** for bot protection. reCAPTCHA v3 is invisible to users and uses behavioral analysis to detect bots with a scoring system (0.0 = bot, 1.0 = human).

## Getting reCAPTCHA v3 Keys

1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Sign in with your Google account
3. Click the **+** button to create a new site
4. Fill in the form:
   - **Label**: ArbitrageIQ Registration
   - **reCAPTCHA type**: Select "reCAPTCHA v3"
   - **Domains**: Add your domain(s):
     - `localhost` (for local development)
     - Your production domain (e.g., `arbitrageiq.com`)
5. Accept the reCAPTCHA Terms of Service
6. Click **Submit**
7. You'll see your **Site Key** and **Secret Key**

## Configuration

### Local Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your reCAPTCHA keys to `.env.local`:
   ```
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LeIx...YOUR_SITE_KEY
   RECAPTCHA_SECRET_KEY=6LeIx...YOUR_SECRET_KEY
   ```

3. Restart your dev server:
   ```bash
   pnpm dev
   ```

### Production (Vercel)

1. Go to your Vercel project settings
2. Navigate to **Settings** > **Environment Variables**
3. Add two new variables:
   - **Key**: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
     - **Value**: Your reCAPTCHA Site Key
     - **Environments**: Production, Preview, Development
   - **Key**: `RECAPTCHA_SECRET_KEY`
     - **Value**: Your reCAPTCHA Secret Key
     - **Environments**: Production (only)

## How Registration Works

1. **User fills form** with: name, email, phone, country, trading experience level, password
2. **reCAPTCHA v3 scores the submission** invisibly (0.0–1.0)
3. **Server validates**:
   - Captcha score ≥ 0.5 (threshold for legitimate)
   - IP rate limiting: max 5 registration attempts per IP per hour
   - Email uniqueness
4. **Audit logging**: Every signup attempt is logged with:
   - IP address
   - User-agent (browser info)
   - Captcha score
   - Country, trading experience level
   - Pass/fail reason
5. **User created** and email verification is sent

## Viewing Registration Audits

All registration attempts are logged in the `registration_audits` table:

```sql
SELECT * FROM registration_audits ORDER BY "createdAt" DESC LIMIT 100;
```

Admin dashboard will eventually show:
- Total signups
- Success/rejection breakdown
- Captcha score distribution
- IP-based anomaly detection
- Geographic distribution

## Troubleshooting

**Issue**: "reCAPTCHA not available" error
- **Solution**: Verify `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is set in your `.env.local` or Vercel environment variables

**Issue**: "Captcha verification failed" on every submission
- **Solution**: Check that `RECAPTCHA_SECRET_KEY` is correctly set on the server (not client)

**Issue**: "Rate limited" error
- **Solution**: The IP has tried registering 5+ times in the last hour. Wait 1 hour and try again, or use a different IP/VPN

**Issue**: High bot rejection rate
- **Solution**: Adjust the `CAPTCHA_SCORE_THRESHOLD` in `app/actions/secure-registration.ts` (default 0.5). Increase to 0.6–0.7 for stricter filtering.

## Security Best Practices

- ✅ reCAPTCHA v3 tokens expire after 2 minutes — tokens must be verified immediately
- ✅ Secret key is server-only and never exposed to client
- ✅ IP rate limiting prevents brute-force signup attacks
- ✅ All registration attempts are audited for compliance/fraud investigation
- ✅ User data (phone, country, experience) is stored for KYC profiling
