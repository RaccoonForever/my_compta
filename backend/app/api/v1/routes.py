from fastapi import APIRouter
from app.schemas import TransactionCreate
from app.domain.services import compute_tva

router = APIRouter()


@router.post("/tva")
def calc_tva(tx: TransactionCreate):
    t = compute_tva(tx.amount, tx.tva_rate)
    return {"tva": t, "total": round(tx.amount + t, 2)}
