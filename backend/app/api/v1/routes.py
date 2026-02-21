from fastapi import APIRouter, Depends
from app.schemas import TransactionCreate
from app.domain.services import compute_tva
from app.security.auth import verify_token

router = APIRouter()


@router.post("/tva")
def calc_tva(tx: TransactionCreate, user_id: str = Depends(verify_token)):
    """Calculate TVA for a transaction (requires authentication)."""
    t = compute_tva(tx.amount, tx.tva_rate)
    return {"tva": t, "total": round(tx.amount + t, 2), "user": user_id}


@router.get("/health")
def health_check():
    """Health check (no auth required)."""
    return {"status": "ok"}
