# Lovecoin

A dating platform built on Solana where meaningful connections are backed by real value.

## Overview

Lovecoin is a web3 dating application that uses Solana blockchain for:

- **Wallet-based authentication** - Sign in with your Solana wallet
- **Verification payments** - One-time payment to verify your profile
- **Paid messaging** - Each message requires a micro-payment, reducing spam and encouraging quality interactions

## Tech Stack

- **Frontend**: Next.js 14, React, TailwindCSS
- **Backend**: Fastify, Prisma, PostgreSQL
- **Blockchain**: Solana (wallet auth, payments)
- **Storage**: S3-compatible storage for photos
- **Real-time**: WebSocket for instant messaging

## Project Structure

```
lovecoin/
├── apps/
│   ├── api/          # Fastify REST API + WebSocket server
│   └── web/          # Next.js frontend
├── packages/
│   └── shared/       # Shared types and constants
└── docker-compose.yml
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 15+
- Solana wallet (Phantom, Solflare, etc.)

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Edit the .env files with your configuration

# Set up database
cd apps/api
pnpm db:push

# Start development servers
cd ../..
pnpm dev
```

### Development

```bash
# Start API server
pnpm dev:api

# Start web app
pnpm dev:web

# Run both
pnpm dev
```

The API runs on `http://localhost:3001` and the web app on `http://localhost:3000`.

## Features

- Solana wallet authentication
- Profile creation with photo uploads
- Swipe-based discovery (like/pass)
- Mutual matching system
- Real-time messaging via WebSocket
- Paid message verification on Solana
- User blocking and reporting
- Rate limiting and security

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /auth/challenge` | Get authentication challenge |
| `POST /auth/verify` | Verify wallet signature |
| `GET /profile` | Get user profile |
| `POST /profile` | Create profile |
| `GET /discovery` | Get profiles to swipe |
| `POST /discovery/like/:id` | Like a profile |
| `GET /matches` | Get matches |
| `GET /conversations/:id/messages` | Get messages |
| `POST /conversations/:id/messages` | Send message |

## License

MIT
