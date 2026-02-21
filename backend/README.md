# Backend (FastAPI) - My Compta

Hexagonal architecture backend for bookkeeping and TVA calculations.

## Prerequisites

- Python 3.10+
- Firebase project with service account
- Virtual environment (venv or conda)

## Installation

From the `backend/` directory:

```bash
python -m venv .venv
.\\.venv\\Scripts\\activate  # Windows
source .venv/bin/activate    # macOS/Linux

pip install -r requirements.txt
```

## Configuration

1. Copy `.env.example` to `.env` and fill in your Firebase credentials:
   ```bash
   cp .env.example .env
   ```

2. Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of your Firebase service account JSON.

3. Get Firebase project config from your Firebase console and update `.env` if needed.

## Running the Development Server

```bash
uvicorn app.main:app --reload --port 8000
```

API will be available at `http://localhost:8000/api/v1`

## Endpoints

### Health Check (no auth required)
```
GET /api/v1/health
```

### Calculate TVA (requires Firebase authentication)
```
POST /api/v1/tva
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "amount": 100,
  "tva_rate": 20,
  "description": "Invoice #123"
}
```

## Authentication

All endpoints except `/health` require a valid Firebase ID token in the `Authorization` header:
```
Authorization: Bearer <id-token>
```

The frontend handles login via Firebase Authentication and automatically includes the token in requests.

## Testing

```bash
pytest tests/
pytest tests/ -v  # Verbose
```

## Architecture

- `app/domain/` - Business logic (services, models)
- `app/ports/` - Port interfaces (repositories, etc.)
- `app/adapters/` - Implementations (Firestore, etc.)
- `app/api/v1/` - HTTP API routes
- `app/security/` - Authentication & authorization
- `tests/` - Unit tests

## CORS

CORS is enabled for `localhost:5173` (Vite dev), `localhost:3000`, and `localhost:8000`. Configure `CORS_ORIGINS` in `.env` to add more hosts.
