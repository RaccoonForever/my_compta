# My Compta

Monorepo for a bookkeeping app with TVA (VAT) calculations, built with:
- **Backend**: FastAPI (Python) with hexagonal architecture
- **Frontend**: React + Vite + TypeScript
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication

## Quick Start

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
.\\.venv\\Scripts\\activate  # Windows
source .venv/bin/activate    # macOS/Linux
pip install -r requirements.txt
cp .env.example .env
# Add Firebase credentials to .env
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
# Add Firebase config to .env.local
npm run dev
```

Visit `http://localhost:5173` to access the app.

### 3. Firebase Setup
- Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/)
- Enable **Authentication** (Email/Password provider)
- Enable **Firestore Database**
- Download service account JSON from Project Settings → Service Accounts
- Follow instructions in `infra/firebase/README.md`

## Project Structure

```
my_compta/
├── backend/                    # FastAPI backend (Python)
│   ├── app/
│   │   ├── domain/            # Business logic (TVA calculations, models)
│   │   ├── ports/             # Repository interfaces (hexagonal)
│   │   ├── adapters/          # Firestore adapter
│   │   ├── api/v1/            # API routes
│   │   ├── security/          # Firebase auth verification
│   │   └── main.py            # FastAPI app with CORS middleware
│   ├── tests/
│   ├── requirements.txt
│   └── README.md
├── frontend/                   # React + Vite (TypeScript)
│   ├── src/
│   │   ├── hooks/             # useAuth hook
│   │   ├── firebase.ts        # Firebase config
│   │   ├── App.tsx            # Main component
│   │   └── main.tsx
│   ├── package.json
│   └── README.md
├── infra/firebase/             # Firebase infrastructure
│   └── README.md              # Firebase setup instructions
└── README.md
```

## Architecture

The backend follows **hexagonal (ports & adapters) architecture**:
- **Domain**: Core business logic independent of frameworks
- **Ports**: Interfaces defining external dependencies
- **Adapters**: Implementations (Firestore, Firebase Auth, etc.)

This makes the app:
- **Testable**: Easy to mock adapters
- **Modular**: Easy to swap implementations
- **Secure**: Clear boundary between domain and external services

## Key Features Implemented

- ✅ TVA calculation service
- ✅ Hexagonal architecture scaffold
- ✅ Firebase authentication (frontend & backend)
- ✅ CORS middleware for frontend-backend communication
- ✅ Transaction model and Firestore adapter
- ✅ Environment-based configuration
- ✅ Unit tests for TVA service

## Coming Next

- [ ] Full transaction persistence (year-based tracking)
- [ ] User-specific data isolation in Firestore
- [ ] Financial reports and exports
- [ ] Multi-user support with role-based access
- [ ] Docker Compose for local development
- [ ] CI/CD pipeline

## Documentation

- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)
- [Firebase README](./infra/firebase/README.md)

