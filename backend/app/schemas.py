from pydantic import BaseModel


class TransactionCreate(BaseModel):
    amount: float
    tva_rate: float
    description: str = ""


class TransactionRead(TransactionCreate):
    id: str
