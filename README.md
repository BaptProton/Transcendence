# ft_transcendence

A full-stack multiplayer Pong web application with real-time gameplay, tournaments, and blockchain score recording.

> Final project of the 42 school curriculum

## Overview

ft_transcendence is a single-page application that allows users to play Pong against each other in real-time, participate in tournaments, and record tournament results on the Avalanche blockchain.

### Key Features

- **Local Multiplayer** - Two players on the same keyboard
- **AI Opponent** - Three difficulty levels with trajectory prediction (same paddle speed as human players)
- **Tournament System** - Dynamic bracket generation with elimination rounds
- **Blockchain Integration** - Tournament scores recorded on Avalanche testnet
- **OAuth Authentication** - Sign in with 42 or GitHub accounts
- **Two-Factor Authentication** - TOTP-based 2FA with QR code setup

## Contributors

- [BaptProton](https://github.com/BaptProton)
- [gachetc](https://github.com/gachetc)
- [GxLuck02](https://github.com/GxLuck02)
- [Lubachma](https://github.com/Lubachma)
- [tmartinelli26](https://github.com/tmartinelli26)

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | TypeScript, Vite, Custom SPA Router |
| **Backend** | Node.js, Fastify 4.x |
| **Database** | SQLite (better-sqlite3) |
| **Authentication** | JWT, bcrypt, OAuth 2.0, 2FA (TOTP) |
| **Blockchain** | Avalanche Fuji testnet, Solidity, Web3.js |
| **Infrastructure** | Docker, Nginx |

## Quick Start

### Prerequisites

- Docker (v20.10+)
- Docker Compose (v2.0+)

### Installation

```bash
# Clone the repository
git clone <repository_url>
cd transcendence

# Build and start all services
make
```

The application will be available at **https://<YOUR_IP>:8443**

> Note: Accept the self-signed SSL certificate in your browser

### Development Commands

```bash
make          # Setup + build + start (single command)
make help     # Show all available commands
make setup    # Run setup scripts (SSL + env)
make ssl      # Generate SSL certificates
make env      # Generate .env from template
make build    # Build Docker images
make frontend # Build frontend only
make up       # Start services
make down     # Stop services
make logs     # View real-time logs
make clean    # Stop and remove containers
make fclean   # Stop, remove containers and volumes
make re       # Full rebuild
make rebuild  # Rebuild without cache
make purge    # Purge ALL Docker cache
```

## Project Structure

```
transcendence/
├── backend/
│   └── src/
│       ├── server.js                  # Main Fastify server
│       ├── db.js                      # SQLite schema and migrations
│       ├── routes/
│       │   ├── auth.js                # Authentication (login, register)
│       │   ├── users.js               # User routes (profile, friends, search, logout)
│       │   ├── oauth.js               # OAuth 2.0 (42 + GitHub)
│       │   ├── twoFactor.js           # Two-Factor Authentication
│       │   ├── pong.js                # Match management
│       │   ├── stats.js               # Player statistics
│       │   └── blockchain.js          # Avalanche integration
│       ├── services/
│       │   ├── matchService.js        # Match business logic
│       │   └── oauthService.js        # OAuth business logic
│       ├── utils/
│       │   ├── password.js            # Password hashing (bcrypt)
│       │   ├── validation.js          # Input validation & sanitization
│       │   ├── twoFactor.js           # 2FA utilities (TOTP, QR)
│       │   ├── userSerializer.js      # User data serialization
│       │   ├── cookieHelper.js        # Auth cookie management
│       │   └── ResourceTracker.js     # System resource tracking
├── frontend/
│   ├── css/
│   │   ├── main.css                   # Global styles
│   │   ├── pong.css                   # Game styles
│   │   ├── tournament.css             # Tournament bracket styles
│   │   ├── stats.css                  # Statistics page styles
│   │   └── account.css                # Account/profile styles
│   └── src/
│       ├── main.ts                    # SPA router entry point
│       ├── types/index.ts             # TypeScript type definitions
│       ├── pages/
│       │   ├── auth.page.ts           # Authentication pages
│       │   ├── profile.page.ts        # Profile page
│       │   ├── friends.page.ts        # Friends management page
│       │   ├── pong.page.ts           # Pong game page
│       │   ├── tournament.page.ts     # Tournament page
│       │   ├── stats.page.ts          # Statistics page
│       │   └── user.page.ts           # User page
│       ├── templates/
│       │   ├── home.template.ts       # Home page template
│       │   ├── login.template.ts      # Login form template
│       │   ├── register.template.ts   # Registration form template
│       │   ├── profile.template.ts    # Profile template
│       │   ├── friends.template.ts    # Friends list template
│       │   ├── pong.template.ts       # Pong game template
│       │   ├── tournament.template.ts # Tournament bracket template
│       │   └── common.template.ts     # Common template components
│       ├── services/
│       │   ├── api.service.ts         # HTTP API client
│       │   ├── auth.service.ts        # Authentication service
│       │   ├── friends.service.ts     # Friends management
│       │   ├── profile.service.ts     # Profile management
│       │   ├── stats.service.ts       # Statistics service
│       │   ├── tournament.service.ts  # Tournament service
│       │   └── twoFactor.service.ts   # 2FA service
│       ├── games/
│       │   ├── pong.ts                # Game module exports
│       │   ├── pong-engine.ts         # Game engine core
│       │   ├── pong-render.ts         # Canvas rendering
│       │   └── pong-ai.ts             # AI opponent logic
│       ├── statistique/
│       │   └── stats.ts               # Stats display component
│       └── utils/
│           ├── validation.ts          # Input validation
│           └── helpers.ts             # Utility functions
├── nginx/
│   ├── nginx.conf                     # SSL termination, reverse proxy
│   └── ssl/                           # SSL certificates
├── docs/                              # Documentation
├── docker-compose.yml
├── Makefile
├── generate_ssl.sh                    # SSL certificate generator
└── .env.exemple                       # Environment variables template
```

## Modules Implemented

### Mandatory Part
- Pong game with two local players
- Tournament system with player aliases
- Match announcements and bracket progression
- Single-page application with browser navigation support

### Major Modules

| Module | Description |
|--------|-------------|
| **Backend Framework** | Fastify + Node.js with full REST API |
| **AI Opponent** | Three difficulty levels, trajectory prediction (same speed as players) |
| **OAuth 2.0 Authentication** | OAuth 2.0 with 42 and GitHub providers |
| **Blockchain** | Tournament scores on Avalanche Fuji testnet |
| **Standard User Management** | Registration, profiles, friends, match history |
| **Two-Factor Authentication** | TOTP 2FA with QR codes, JWT access/refresh tokens |

### Minor Modules

| Module | Description |
|--------|-------------|
| **Database** | SQLite with better-sqlite3 |
| **Stats Dashboard** | Player statistics and match history |
| **Browser Compatibility** | Support Firefox 115+ and Chrome 115+ with CSS linting (stylelint) |

## Configuration

Copy `.env.exemple` to `.env` and configure the following:

### JWT Secret (Required)

```bash
# Generate with: openssl rand -base64 32
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
```

### OAuth Setup (Optional)

```bash
# 42 OAuth - Create at: https://profile.intra.42.fr/oauth/applications
OAUTH42_CLIENT_ID=your_client_id
OAUTH42_SECRET=your_secret

# GitHub OAuth - Create at: https://github.com/settings/developers
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_secret
```

### Blockchain Setup

```bash
# Avalanche Fuji testnet
WEB3_PROVIDER_URI=https://api.avax-test.network/ext/bc/C/rpc
BLOCKCHAIN_PRIVATE_KEY=your_private_key_without_0x
CONTRACT_ADDRESS=deployed_contract_address
```

Get test AVAX from the [Avalanche Faucet](https://faucet.avax.network/).

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/register/` | Create account |
| POST | `/api/users/login/` | Login |
| POST | `/api/users/login/2fa/` | Login with 2FA code |
| POST | `/api/users/logout/` | Logout |
| POST | `/api/auth/refresh/` | Refresh access token |
| GET | `/api/auth/oauth/42/` | 42 OAuth flow |
| GET | `/api/auth/oauth/github/` | GitHub OAuth flow |
| GET | `/api/auth/oauth/42/callback/` | 42 OAuth callback |
| GET | `/api/auth/oauth/github/callback/` | GitHub OAuth callback |
| POST | `/api/auth/oauth/2fa/complete/` | Complete 2FA after OAuth |
| GET | `/api/auth/status` | Check auth status |
| POST | `/api/auth/2fa/setup/` | Generate 2FA secret + QR code |
| POST | `/api/auth/2fa/enable/` | Verify and enable 2FA |
| POST | `/api/auth/2fa/disable/` | Disable 2FA |
| GET | `/api/auth/2fa/status/` | Get 2FA status |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me/` | Current user |
| PATCH | `/api/users/profile/` | Update profile |
| GET | `/api/users/search/` | Search users by username |
| GET | `/api/users/friends/` | Friends list |
| POST | `/api/users/friends/:id/add/` | Add friend |
| DELETE | `/api/users/friends/:id/remove/` | Remove friend |

### Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/stats` | Current user statistics |
| GET | `/api/users/:id/stats` | User statistics by ID |
| GET | `/api/stats/dashboard` | Stats dashboard |
| POST | `/api/stats/save-match` | Save match result |

### Pong
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pong/matches/create/` | Create match |
| GET | `/api/pong/matches/:id/` | Get match details |
| GET | `/api/pong/matches/history/` | Match history |

### Tournaments
Tournament management is handled client-side (local state + localStorage). There are no REST endpoints.

### Blockchain
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/blockchain/tournament/record/` | Record score on blockchain |
| GET | `/api/blockchain/history/` | Transaction history |

## AI Algorithm

The AI opponent uses **trajectory prediction** to determine paddle movement:

1. **Refresh Rate**: Updates game state once per second (as required by subject)
2. **Prediction**: Calculates ball trajectory including wall bounces
3. **Movement**: Simulates keyboard input (same system as human players)
4. **Same Speed**: AI paddle speed is identical to human players (as required by subject)
5. **Difficulty Levels** (via prediction accuracy):
   - **Easy**: 150px prediction error margin
   - **Medium**: 60px prediction error margin
   - **Hard**: 10px prediction error margin (very precise)

The implementation does not use pathfinding algorithms (A* is prohibited by the subject).

## Security

- Password hashing with bcrypt (12 rounds)
- JWT authentication with access/refresh tokens
- Two-Factor Authentication (TOTP) with QR codes
- Input validation on frontend and backend
- SQL injection protection via prepared statements
- XSS protection with HTML sanitization
- HTTPS/WSS encryption
- Rate limiting (100 req/min global, 5 req/min for auth)
- OAuth state parameter for CSRF protection

## Troubleshooting

### Services not starting
```bash
docker-compose logs          # Check all logs
docker-compose logs api      # Check backend logs
make re                      # Full rebuild
```


### Database issues
```bash
docker-compose exec api ls -la /app/data/  # Check database file
make clean && make                          # Reset everything
```

## License

This project was developed as part of the 42 school curriculum.
