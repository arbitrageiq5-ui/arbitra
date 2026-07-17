# Secure Registration System — Complete Implementation

## Overview
A production-grade registration system with reCAPTCHA v3 bot protection, multi-field KYC capture, IP-based rate limiting, and full audit logging.

## What Was Added

### 1. **Database Schema** (`lib/db/schema.ts`)
- **User table new columns**:
  - `phone` — Contact number (optional)
  - `country` — User's country (required)
  - `tradingExperienceLevel` — 'beginner' | 'intermediate' | 'advanced' (default: 'beginner')
  
- **New `registrationAudits` table**:
  - Logs every signup attempt (success & failure)
  - Captures: email, IP, user-agent, captcha score, country, experience level
  - Status tracking: 'pending' | 'success' | 'rejected'
  - Rejection reason for failed attempts

### 2. **Server Action** (`app/actions/secure-registration.ts`)
A complete registration flow with:

- **`registerWithCaptcha()`** — Main registration endpoint:
  - Validates reCAPTCHA v3 token (score threshold: 0.5)
  - IP rate limiting: max 5 attempts per hour
  - Email uniqueness check
  - User creation with all extended fields
  - Audit logging for all attempts

- **`verifyCaptcha()`** — reCAPTCHA v3 verification:
  - Calls Google's siteverify API with token, IP, and secret
  - Returns score (0.0–1.0) and success flag
  - Graceful fallback if RECAPTCHA_SECRET_KEY not set

- **`checkRateLimit()`** — IP-based rate limiting:
  - Queries last 1 hour of signup attempts from this IP
  - Blocks if 5+ attempts found
  - Prevents brute-force attacks

- **`getClientIp()`** — Proxy-aware IP extraction:
  - Reads X-Forwarded-For, X-Real-IP, CF-Connecting-IP headers
  - Works with reverse proxies (Vercel, Cloudflare, etc.)

### 3. **Registration Component** (`components/landing/registration.tsx`)
Completely redesigned with:

- **reCAPTCHA v3 integration**:
  - Loads Google's reCAPTCHA script on mount
  - Calls `window.grecaptcha.execute()` on form submit
  - Token sent to server for verification

- **Extended form fields**:
  - Full Name (required)
  - Email (required)
  - Phone (optional)
  - Country (required) — 14 countries + "Other"
  - Trading Experience Level (required) — Beginner/Intermediate/Advanced
  - Password (required)

- **Security UI**:
  - Green security notice explaining reCAPTCHA v3
  - Clear error messages for failed submissions
  - Loading state during submission

### 4. **Environment Configuration** (`.env.example`)
Added reCAPTCHA keys:
```
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_site_key
RECAPTCHA_SECRET_KEY=your_secret_key_server_only
```

### 5. **Setup Guide** (`RECAPTCHA_SETUP.md`)
Complete step-by-step guide for getting and configuring reCAPTCHA v3 keys.

## Security Features

1. **Bot Protection**: reCAPTCHA v3 behavioral analysis (invisible)
2. **Rate Limiting**: Max 5 signup attempts per IP per hour
3. **Audit Trail**: Every signup logged with IP, user-agent, captcha score
4. **KYC Capture**: Phone, country, trading experience for profiling
5. **Email Validation**: Ensures unique accounts
6. **Server-side Verification**: Secret key never exposed to client
7. **Proxy Awareness**: Correctly detects IP through reverse proxies

## How to Set Up

1. **Get reCAPTCHA v3 keys**:
   - Visit https://www.google.com/recaptcha/admin
   - Create a new site with reCAPTCHA v3
   - Copy your Site Key and Secret Key

2. **Add environment variables**:
   - Local: Update `.env.local` with your keys
   - Production (Vercel): Add to project Settings > Environment Variables

3. **Test**:
   - Navigate to registration form
   - Submit with test data
   - Check `registration_audits` table for logged attempt

## Database Queries

View registration audits:
```sql
-- All successful signups
SELECT * FROM registration_audits 
WHERE registration_status = 'success'
ORDER BY "createdAt" DESC;

-- Failed registrations (bots likely)
SELECT email, ip_address, captcha_score, rejection_reason
FROM registration_audits
WHERE registration_status = 'rejected'
ORDER BY "createdAt" DESC;

-- Captcha score distribution
SELECT ROUND(captcha_score::numeric, 1) as score, COUNT(*) as count
FROM registration_audits
GROUP BY ROUND(captcha_score::numeric, 1)
ORDER BY score DESC;
```

## Files Modified

- ✅ `lib/db/schema.ts` — Added user columns & registrationAudits table
- ✅ `app/actions/secure-registration.ts` — New server action with reCAPTCHA validation
- ✅ `components/landing/registration.tsx` — Updated UI with all KYC fields + reCAPTCHA
- ✅ `.env.example` — reCAPTCHA key placeholders
- ✅ `RECAPTCHA_SETUP.md` — Setup documentation
