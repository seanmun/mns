# Money Never Sleeps - Fantasy Basketball Dynasty Manager

> A sophisticated web application that brings real NBA salary cap management to fantasy basketball, where strategic keeper decisions and financial acumen determine dynasty success.

## 🏀 What is Money Never Sleeps?

Money Never Sleeps (MNS) is a premium fantasy basketball dynasty league management platform that mirrors the complexity and excitement of real NBA front office operations. Unlike traditional fantasy leagues, MNS challenges team owners to navigate actual NBA salary cap rules, manage keeper contracts, and make strategic financial decisions that have real monetary consequences.

**The stakes are real:** Exceed the salary cap aprons? Pay actual penalties into the prize pool. Want to keep multiple first-round players? Pay franchise tag fees. Every decision matters, every dollar counts, and every season builds your dynasty's legacy.

## ✨ What Makes MNS Special

### 🎯 Real NBA Salary Cap Rules
- **Apron System**: Navigate first apron ($195M) and second apron ($225M) thresholds with real financial penalties
- **Trade Cap Management**: Adjust your cap via trades (±$30M) to build your perfect roster
- **Penalty Enforcement**: $50 one-time fee for crossing first apron, $2 per $1M over second apron
- **Hard Cap**: $255M maximum ensures no team can infinitely spend their way to victory

### 🔒 Dynasty Keeper System
- **Keep Your Stars**: Maintain up to 8 players season-over-season, building a true dynasty
- **Advancing Rounds**: Keepers move up one round each year, rewarding early scouting
- **Smart Stacking**: Automatic algorithm resolves keeper round conflicts
- **Franchise Tags**: Keep multiple superstars with strategic franchise tag system ($15 per additional 1st rounder)

### 🆕 Rookie Development Pipeline
- **Redshirt System**: Stash rookies for $10, activate mid-season for $25
- **Rookie Draft**: Annual draft mirrors NBA draft with lottery system for non-playoff teams
- **International Stash**: Hold rights to international prospects until they sign NBA contracts
- **Round Valuation**: Early picks become Round 5-8 keepers, later picks become Round 13 keepers

### 📊 Advanced Analytics Dashboard
- **Real-time Cap Tracking**: Visual thermometer shows exactly where you stand
- **Smart Metrics**: See average salary per keeper and per remaining draft spot
- **Apron Warnings**: Know exactly how much you can spend before hitting penalty thresholds
- **Scenario Planning**: Save and compare multiple keeper configurations before committing

### 🎲 Prize Pool Investment System
The league fee ($50 per team) plus all penalties and fines create a prize pool that gets invested in a voted-upon asset (stocks, futures, Bitcoin). By playoffs, the pool could be $600, $2,000, or $150,000 - nobody knows!

**Payout Rules:**
- 📉 **Boiler Room Rule**: Pool declines → 80/20 split or 100% to first if under $300
- 💹 **Gordon Gekko Rule**: Pool grows → 70/20/10 split for top 3
- 🚀 **Bernie Sanders Rule**: Pool hits $10K+ → 40/15/9 for top 3, 4% to remaining 9 teams

## 🚀 Key Features

### For Team Owners
- **🔐 Secure Authentication**: Google OAuth with team-specific access
- **📱 Responsive Dashboard**: Manage your roster on any device with sleek dark theme
- **🎮 Interactive Decisions**: Keep, drop, or redshirt players with instant cap calculations
- **🔍 Round Conflict Resolver**: Visual stacking assistant makes keeper selection painless
- **💾 Scenario Management**: Test multiple keeper combinations before submitting
- **📈 Live Metrics**:
  - Cap usage with color-coded warnings
  - Average salary per keeper
  - Average spend per draft pick to stay under aprons
  - Keeper count (e.g., "8 / 8")
  - Total fees breakdown

### For Commissioners
- **⚙️ League Setup**: Configure leagues, teams, and cap settings
- **📤 CSV Import**: Bulk upload player salaries from any source
- **⏰ Deadline Management**: Set and enforce keeper submission deadlines
- **🔒 Roster Locking**: Lock all rosters when keeper period ends
- **📋 Reports**: Generate keeper lists, audit logs, and fee summaries
- **🎯 Team Privacy**: Keeper selections hidden until admin locks all rosters

### League Pages
- **📖 Record Book**: Championship history and owner accomplishments
- **📜 Rules**: Complete league rules with current cap structure
- **🎯 Draft Board**: Live snake draft with real-time updates and keeper integration
- **🆓 Free Agent Pool**: Sortable list of available players
- **💰 Portfolio Tracker**: Live prize pool valuation with blockchain integration
- **📱 Telegram Notifications**: Real-time draft pick announcements with @mentions

## 💻 Tech Stack

Built with modern, production-ready technologies:

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS 4 with custom dark theme (#0a0a0a)
- **Backend**: Firebase (Auth, Firestore, Storage, Cloud Functions)
- **Routing**: React Router v7
- **Deployment**: Vercel with automatic GitHub deployments
- **CSV Parsing**: Papaparse for robust data imports
- **Blockchain**: Alchemy API (ETH balance) + CoinGecko (price data)
- **Notifications**: Telegram Bot API for draft updates

## 🎮 How It Works

### 1. Pre-Season Keeper Selection
- Review your roster from last season
- Select up to 8 keepers (or fewer for more draft picks)
- Redshirt eligible rookies for future seasons
- Navigate cap constraints and apron thresholds
- Pay franchise tags for multiple first-round keepers
- Save scenarios to compare options

### 2. Draft
- 13 rounds, snake format
- Keepers occupy their assigned rounds
- Live draft board with real-time updates
- Fill remaining roster spots with new talent
- Draft order randomized after keepers locked
- Telegram notifications with @username tagging
- Admin tools to manually add keepers if needed

### 3. Regular Season
- Weekly head-to-head matchups
- 9 statistical categories
- Manage 15-player roster (10 active, 3 bench, 2 IR)
- Unlimited redshirt spots
- Make trades within cap constraints

### 4. Playoffs & Prize Pool
- Top 6 teams make playoffs
- Prize pool tracked in real-time via EVM wallet
- Live portfolio valuation (ETH balance + USD invested)
- Returns calculated and displayed on League Home
- Championship immortalized in Record Book
- Start planning next year's keepers!

## 🔧 Salary Cap Details (2025-2026 Season)

| Threshold | Amount | Consequence |
|-----------|--------|-------------|
| **First Apron** | $195M | $50 one-time fee (then stay over) |
| **Second Apron** | $225M | $2 per $1M over (base cap) |
| **Hard Cap** | $255M | Cannot exceed via any means |
| **Trade Range** | ±$30M | Adjustable from second apron |

### Fee Structure
- **Entry Fee**: $50 per team per season
- **First Apron Fee**: $50 (one-time)
- **Second Apron Penalty**: $2 per $1M over $225M
- **Franchise Tag**: $15 per additional 1st round keeper
- **Redshirt Fee**: $10 per player
- **Mid-Season Activation**: $25 per player
- **Commissioner Fines**: $1-$10 per violation

*All fees go directly into the prize pool investment!*

## 📱 Live Demo

**Production URL**: [https://mns-dusky.vercel.app](https://mns-dusky.vercel.app)

Experience the app yourself:
1. Sign in with Google
2. View league standings and records
3. Browse the rules and cap structure
4. Explore team rosters (keeper selections hidden until locked)

## 🏗️ Installation & Setup

### Prerequisites
- Node.js 20.18+
- Firebase project (Firestore + Auth)
- Vercel account (optional, for deployment)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/seanmun/mns.git
cd mns

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Firebase credentials

# Start development server
npm run dev

# Open http://localhost:5173
```

### Firebase Setup

1. Create Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Google provider
3. Enable **Firestore Database**
4. Copy config from Project Settings → General
5. Update `.env` with your Firebase credentials
6. Deploy security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Environment Variables

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Blockchain Integration (Optional - for portfolio tracking)
VITE_ALCHEMY_API_KEY=your_alchemy_api_key
```

## 📂 Project Structure

```
mns/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── CapThermometer.tsx      # Visual cap tracker with metrics
│   │   ├── Header.tsx              # Navigation with role-based menu
│   │   ├── RosterTable.tsx         # Main player management table
│   │   ├── StackingAssistant.tsx   # Keeper round conflict resolver
│   │   └── SummaryCard.tsx         # Cap/fees summary display
│   ├── pages/               # Route components
│   │   ├── Login.tsx               # Google OAuth sign-in
│   │   ├── TeamSelect.tsx          # All teams with status badges
│   │   ├── OwnerDashboard.tsx      # Main keeper management UI
│   │   ├── RecordBook.tsx          # Championship history
│   │   ├── Rules.tsx               # League rules documentation
│   │   ├── Draft.tsx               # Draft board interface
│   │   ├── FreeAgentPool.tsx       # Available players
│   │   └── Admin*.tsx              # Admin management pages
│   ├── lib/
│   │   ├── firebase.ts             # Firebase configuration
│   │   ├── keeperAlgorithms.ts     # Core business logic
│   │   └── blockchain.ts           # Alchemy/CoinGecko integration
│   ├── hooks/
│   │   └── useRoster.ts            # Firestore data hooks
│   ├── data/
│   │   └── hinkieQuotes.ts         # Daily motivational quotes
│   ├── contexts/
│   │   └── AuthContext.tsx         # Auth state management
│   └── types/
│       └── index.ts                # TypeScript definitions
├── public/icons/            # Custom app icons
├── firestore.rules          # Database security rules
└── vercel.json             # SPA routing configuration
```

## 🧮 Core Algorithms

### Keeper Round Stacking
When multiple players have the same keeper round:
1. Start from Round 13 and work up (bottom-up stacking)
2. First keeper gets their base round
3. Additional keepers stack to next available round
4. Franchise tag rule: Only one Round 1 keeper is free
5. Extra Round 1 keepers cost $15 each and reassign to Rounds 2+

See [`src/lib/keeperAlgorithms.ts`](src/lib/keeperAlgorithms.ts) for implementation.

### Cap Calculation
```typescript
effectiveCap = secondApron ($225M) + tradeDelta (±$30M)
capUsed = sum of all keeper salaries
remaining = effectiveCap - capUsed
firstApronFee = capUsed > $195M ? $50 : $0
secondApronPenalty = max(0, capUsed - $225M) * $2
```

## 🤝 Contributing

Contributions welcome! This is a private league app, but the code can be forked for your own dynasty league.

### Development
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

## 📄 Documentation

- **[CONTEXT.md](CONTEXT.md)** - Comprehensive technical documentation
- **[Rules Page](src/pages/Rules.tsx)** - Complete league rules
- **[Firebase Setup](https://firebase.google.com/docs)** - Firebase documentation

## 📜 License

MIT License - Feel free to fork and adapt for your own league!

## 👥 Credits

Built for the Money Never Sleeps fantasy basketball dynasty league.

**Admin**: smunley13@gmail.com
**Firebase Project**: mns-app-1bacc
**Live App**: [mns-dusky.vercel.app](https://mns-dusky.vercel.app)

---

*Money Never Sleeps - Where fantasy basketball meets Wall Street*
