# Frontend (React + Vite + Firebase)

Minimal React + Vite UI for My Compta bookkeeping app with Firebase authentication.

## Prerequisites

- Node 18+ and npm (or yarn)
- Firebase project with Authentication enabled
- Running backend development server (`http://localhost:8000`)

## Installation

From the `frontend/` directory:

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your Firebase project credentials from your Firebase console:
   - Project Settings → Your apps → Web
   - Copy the config values into `.env.local`

## Running the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (typically).

The Vite dev server automatically proxies `/api/*` requests to `http://localhost:8000`.

## Building for Production

```bash
npm run build
npm run preview  # Test production build
```

## Features

- **Firebase Authentication**: Email/password login
- **Token Management**: Automatically includes Bearer token in API requests
- **API Integration**: Calls backend `/api/v1/tva` endpoint
- **Error Handling**: User-friendly error messages

## Architecture

- `src/firebase.ts` - Firebase SDK initialization
- `src/hooks/useAuth.ts` - Authentication state management
- `src/App.tsx` - Main component (login + TVA calculator)

