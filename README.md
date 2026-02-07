# LOVECOIN

**Web3 Dating Platform** - Connect wallets, find love, powered by Solana.

Live at: [https://lovecoin.fun](https://lovecoin.fun)

---

## Architecture

```
                                    LOVECOIN PLATFORM
    ============================================================================
    
                                   +------------------+
                                   |   lovecoin.fun   |
                                   |   (Frontend)     |
                                   +--------+---------+
                                            |
                    +-----------------------+-----------------------+
                    |                       |                       |
            +-------v-------+       +-------v-------+       +-------v-------+
            |   Discovery   |       |    Matches    |       |  Marketplace  |
            |   (Swipe)     |       |    (Chat)     |       |    (Shop)     |
            +---------------+       +---------------+       +---------------+
                    |                       |                       |
                    +-----------------------+-----------------------+
                                            |
                                   +--------v---------+
                                   |   Solana RPC     |
                                   | (Wallet Connect) |
                                   +--------+---------+
                                            |
                    +-----------------------+-----------------------+
                    |                                               |
            +-------v-------+                               +-------v-------+
            |  API Server   |                               |   Solana      |
            |  (Fastify)    |                               |   Blockchain  |
            +-------+-------+                               +---------------+
                    |                                               |
            +-------v-------+                               +-------v-------+
            |  PostgreSQL   |                               |  Platform     |
            |  (Neon DB)    |                               |  Wallet       |
            +---------------+                               +---------------+


    DATA FLOW
    ============================================================================
    
    User Registration:
    [Wallet] --> [Sign Message] --> [API] --> [JWT Token] --> [Session]
    
    Verification Payment:
    [Wallet] --> [0.01 SOL] --> [Platform Wallet] --> [API Confirm] --> [Verified]
    
    Marketplace Purchase:
    [Buyer] --> [Price SOL] --> [97% Seller + 3% Platform] --> [API Record] --> [SOLD]
    
    Messaging:
    [User A] <--> [WebSocket] <--> [API] <--> [WebSocket] <--> [User B]
```

---

## Features

### Core Dating Features
- **Wallet-Based Authentication** - Sign in with Phantom or Solflare wallet
- **Profile Creation** - Display name, bio, interests, photos
- **Discovery** - Swipe through profiles (like/pass)
- **Matching** - Mutual likes create matches
- **Real-time Chat** - WebSocket-powered messaging
- **Photo Upload** - Profile and listing photos with S3/local storage

### Marketplace
- **List Items for Sale** - Post items with photos, description, price (SOL)
- **Browse Listings** - Filter by category, location, price range
- **Secure Purchases** - On-chain SOL transactions with 3% platform fee
- **Contact Seller** - In-app messaging with sellers

### Security & Verification
- **Entry Fee Verification** - 0.01 SOL payment to access platform
- **On-chain Transaction Verification** - All payments verified against Solana
- **JWT Authentication** - Secure session management
- **Rate Limiting** - Protection against abuse

### Mobile Support (PWA)
- **Installable** - Add to home screen on iOS/Android
- **Offline Capable** - Service worker caching
- **Native-like Experience** - Full-screen, standalone mode

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Backend | Fastify, Node.js, TypeScript |
| Database | PostgreSQL (Neon), Prisma ORM |
| Blockchain | Solana, @solana/web3.js |
| Wallets | Phantom, Solflare (Wallet Adapter) |
| Real-time | WebSockets (@fastify/websocket) |
| Storage | S3-compatible / Local filesystem |
| Hosting | Railway |

---

## Project Structure

```
lovecoin/
├── apps/
│   ├── api/                    # Backend API (Fastify)
│   │   ├── prisma/             # Database schema
│   │   ├── src/
│   │   │   ├── routes/         # API endpoints
│   │   │   ├── lib/            # Utilities (auth, s3, websocket)
│   │   │   └── config.ts       # Environment configuration
│   │   └── package.json
│   │
│   └── web/                    # Frontend (Next.js)
│       ├── public/             # Static assets (logo, manifest)
│       ├── src/
│       │   ├── app/            # Pages (App Router)
│       │   ├── components/     # Reusable components
│       │   ├── context/        # React contexts (theme)
│       │   └── lib/            # API client, auth helpers
│       └── package.json
│
├── packages/
│   └── shared/                 # Shared types/utilities
│
├── pnpm-workspace.yaml         # Monorepo configuration
└── package.json
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/challenge` | Get signing challenge |
| POST | `/auth/verify` | Verify signature, get JWT |
| GET | `/auth/session` | Validate session |
| POST | `/auth/logout` | End session |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get current user profile |
| POST | `/profile` | Create profile |
| PATCH | `/profile` | Update profile |
| POST | `/profile/photos` | Upload photo |
| DELETE | `/profile/photos/:id` | Delete photo |

### Discovery & Matching
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/discovery` | Get discoverable profiles |
| POST | `/discovery/like/:id` | Like a profile |
| POST | `/discovery/pass/:id` | Pass on a profile |
| GET | `/matches` | Get all matches |

### Conversations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/conversations` | List conversations |
| GET | `/conversations/:id` | Get conversation |
| GET | `/conversations/:id/messages` | Get messages |
| POST | `/conversations/:id/messages` | Send message |

### Marketplace
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/listings` | Browse all listings |
| GET | `/listings/:id` | Get listing details |
| POST | `/listings` | Create listing |
| PATCH | `/listings/:id` | Update listing |
| DELETE | `/listings/:id` | Delete listing |
| POST | `/listings/:id/photos` | Upload listing photo |
| POST | `/listings/:id/purchase` | Record purchase |
| POST | `/listings/:id/contact` | Message seller |

---

## Environment Variables

### API (`apps/api/.env`)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secure-random-secret
PLATFORM_WALLET_ADDRESS=your-solana-wallet
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VERIFICATION_FEE_LAMPORTS=10000000
MARKETPLACE_FEE_PERCENT=3
```

### Web (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_URL=https://your-api-url
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_PLATFORM_WALLET=your-solana-wallet
```

---

## Development

### Prerequisites
- Node.js 20+
- pnpm 8+
- PostgreSQL database

### Setup
```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm --filter @lovecoin/api run db:generate

# Push schema to database
pnpm --filter @lovecoin/api run db:push

# Start development servers
pnpm dev
```

### Build
```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @lovecoin/api build
pnpm --filter @lovecoin/web build
```

---

## Deployment

Deployed on **Railway** with automatic deployments from GitHub.

### Services
- **@lovecoin/api** - Backend API service
- **@lovecoin/web** - Frontend web service
- **PostgreSQL** - Managed database (Neon)

---

## License

MIT License - see LICENSE file for details.

---

## Links

- **Website**: [https://lovecoin.fun](https://lovecoin.fun)
- **GitHub**: [https://github.com/Lovecoinsolana/lovecoin](https://github.com/Lovecoinsolana/lovecoin)
