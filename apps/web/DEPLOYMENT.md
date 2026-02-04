# Lovecoin Web - Deployment Guide

## Prerequisites

- Node.js 20+
- Vercel, Netlify, or any static hosting with SSR support

## Environment Variables

Create a `.env.production` file or set these in your hosting platform:

```bash
# API URL (your deployed API)
NEXT_PUBLIC_API_URL=https://api.lovecoin.app

# WebSocket URL (same as API, uses ws:// or wss://)
NEXT_PUBLIC_WS_URL=wss://api.lovecoin.app

# S3/CDN URL for photos
NEXT_PUBLIC_S3_URL=https://cdn.lovecoin.app
NEXT_PUBLIC_S3_BUCKET=lovecoin-photos
NEXT_PUBLIC_S3_REGION=us-east-1
```

## Deployment Options

### Option 1: Vercel (Recommended)

1. Connect your GitHub repo to Vercel
2. Set the root directory to `apps/web`
3. Add environment variables in Vercel dashboard
4. Deploy

### Option 2: Manual Build

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Build
cd apps/web
pnpm build

# Start (for Node.js hosting)
pnpm start
```

### Option 3: Docker

```bash
docker build -t lovecoin-web -f apps/web/Dockerfile .
docker run -d -p 3000:3000 lovecoin-web
```

## Static Export (Optional)

For static hosting without SSR:

```bash
# Add to next.config.js:
# output: 'export'

pnpm build
# Output in apps/web/out/
```

## Security Headers

Add these headers in your hosting platform or reverse proxy:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.lovecoin.app wss://api.lovecoin.app;
```

## Recommended Hosting

| Service | Type | Notes |
|---------|------|-------|
| Vercel | Serverless | Best for Next.js |
| Netlify | Static/SSR | Good free tier |
| Railway | Container | Easy deployment |
| Cloudflare Pages | Edge | Fast global CDN |

## Post-Deployment Checklist

- [ ] Verify wallet connection works
- [ ] Test payment flow on mainnet
- [ ] Check photo uploads work
- [ ] Verify WebSocket real-time messaging
- [ ] Test on mobile devices
