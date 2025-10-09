# MNS Keeper Management App

A web application for managing fantasy basketball keeper rosters with advanced salary cap rules, keeper round stacking algorithms, and deadline enforcement.

## Overview

This application helps fantasy basketball league managers handle keeper decisions with complex rules including:
- **Salary cap management** with soft floor ($170M), base cap ($210M), and max cap ($250M)
- **Keeper round stacking** - automatic resolution when multiple players have the same keeper round
- **Franchise tag system** - only one Round 1 keeper is free; additional ones cost $15 each
- **Redshirt functionality** - eligible rookies can be redshirted ($10 fee) and activated mid-season ($25 fee)
- **Scenario planning** - save and compare different keeper configurations before submitting
- **Deadline enforcement** - automated roster locking at configurable deadlines

## Key Features

### For Team Owners
- **Google Authentication** - Secure sign-in with team-specific access
- **Interactive Roster Management** - Keep, drop, or redshirt players with real-time cap calculations
- **Automatic Keeper Round Assignment** - Based on draft history and rookie draft position
- **Stacking Assistant** - Visual tool to resolve keeper round conflicts with drag-and-drop
- **Cap Thermometer** - Visual indicator of cap usage with second apron penalty warnings
- **Scenario Saving** - Create and compare multiple keeper configurations
- **Summary Dashboard** - Real-time display of keepers count, cap usage, and all fees

### For Administrators
- **League & Team Setup** - Create leagues, configure teams, assign owners
- **CSV Import** - Bulk import player data with validation (via [AdminUpload.tsx](src/pages/AdminUpload.tsx))
- **Deadline Management** - Set keeper and redshirt deadlines
- **Roster Locking** - Lock/unlock team rosters manually or automatically
- **Reports & Exports** - Generate keeper lists, fees reports, and audit logs

## Business Rules

### Salary Cap
- **Soft floor**: $170M
- **Base cap**: $210M
- **Max cap** (with trades): $250M
- **Tradeable cap range**: ±$40M
- **Second apron penalty**: $2 per $1M over $210M (e.g., $220M cap = $20 penalty)

### Keeper Rounds
- **Max keepers**: 8 per team
- **Keeper round calculation**: Prior year round - 1 (minimum Round 1)
- **Rookie keeper mappings**:
  - Round 1, picks 1-3 → Round 5
  - Round 1, picks 4-6 → Round 6
  - Round 1, picks 7-9 → Round 7
  - Round 1, picks 10-12 → Round 8
  - Round 2-3 picks → Round 14

### Stacking Rules (see [keeperAlgorithms.ts](src/lib/keeperAlgorithms.ts))
- **Bottom-of-Draft stacking**: Multiple keepers in same round → stack downward (14 → 1)
- **Top-of-Draft rule**: Only one Round 1 keeper is free
- **Franchise tags**: Additional Round 1 keepers require $15 franchise tag each and get reassigned to next available round

### Redshirts
- **Eligibility**: Only rookies in their first contract year
- **Cost**: $10 per redshirt (doesn't count toward cap or keeper limit)
- **In-season activation**: $25 fee to activate mid-season
- **Round retention**: Keeps same round value for next year

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS 4
- **State Management**: TanStack Query (React Query)
- **Authentication**: Firebase Auth (Google provider)
- **Database**: Cloud Firestore
- **Routing**: React Router v7
- **Deployment**: Firebase Hosting

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── CapThermometer.tsx      # Visual cap usage indicator
│   ├── RosterTable.tsx         # Main roster management table
│   ├── StackingAssistant.tsx   # Keeper round conflict resolver
│   └── SummaryCard.tsx         # Summary stats display
├── contexts/
│   └── AuthContext.tsx         # Firebase auth state management
├── hooks/
│   └── useRoster.ts           # Custom hook for roster data/mutations
├── lib/
│   ├── firebase.ts            # Firebase configuration
│   └── keeperAlgorithms.ts    # Core business logic for stacking & cap calculations
├── pages/
│   ├── AdminUpload.tsx        # CSV import interface
│   ├── Login.tsx              # Google sign-in page
│   ├── OwnerDashboard.tsx     # Main roster management UI
│   └── TeamSelect.tsx         # Team selection page
├── types/
│   └── index.ts               # TypeScript type definitions
└── App.tsx                    # Main router & app structure
```

## Getting Started

### Prerequisites
- Node.js 20.18+
- npm or yarn
- Firebase project with Firestore, Auth, and Hosting enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd mns
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication → Google provider
   - Enable Firestore Database
   - Copy your Firebase config from Project Settings

4. **Configure environment**
   ```bash
   cp .env.example .env
   ```

   Add your Firebase credentials to `.env`:
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

5. **Deploy Firestore rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Open browser**
   Navigate to [http://localhost:5173](http://localhost:5173)

## Development

### Available Scripts

- `npm run dev` - Start development server with HMR
- `npm run build` - Type-check and build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

### Data Setup

For initial development, manually create sample data in Firestore:

**Collections needed:**
- `leagues` - League configuration (cap settings, deadlines)
- `teams` - Team info (name, owners, cap adjustments)
- `players` - Player data (salary, position, roster info)
- `rosters` - Team keeper decisions (one per team per season)

See [types/index.ts](src/types/index.ts) for full data schema.

## Deployment

### Firebase Hosting

1. **Install Firebase CLI**
   ```bash
   npm i -g firebase-tools
   firebase login
   ```

2. **Build and deploy**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

### Alternative: Vercel

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. Set environment variables in Vercel dashboard

## Documentation

- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- [README_APP.md](README_APP.md) - Detailed application documentation
- [Firebase Documentation](https://firebase.google.com/docs)

## License

MIT
