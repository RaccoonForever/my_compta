import firebase_admin
from firebase_admin import credentials, firestore
from app.ports.repository import TransactionRepository
from app.domain.models import Transaction


class FirestoreTransactionRepository(TransactionRepository):
    def __init__(self, cred_path: str = None):
        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_path) if cred_path else None
            firebase_admin.initialize_app(cred)
        self.db = firestore.client()

    def save(self, tx: Transaction) -> None:
        self.db.collection("transactions").add({
            "id": tx.id,
            "amount": float(tx.amount),
            "tva_rate": float(tx.tva_rate),
            "description": tx.description,
        })

    def list(self, year: int) -> list:
        docs = self.db.collection("transactions").where("year", "==", year).stream()
        return [doc.to_dict() for doc in docs]
