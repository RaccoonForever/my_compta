import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore import FieldFilter
from datetime import datetime
from app.ports.repository import TransactionRepository
from app.domain.models import Transaction


class FirestoreTransactionRepository(TransactionRepository):
    """Firestore implementation of TransactionRepository."""

    def __init__(self, cred_path: str = None):
        """Initialize Firestore repository.
        
        Args:
            cred_path: Path to Firebase service account JSON file.
        """
        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_path) if cred_path else None
            firebase_admin.initialize_app(cred)
        self.db = firestore.client()

    def save(self, tx: Transaction) -> None:
        """Save a transaction to Firestore.
        
        Args:
            tx: Transaction object to save.
        """
        self.db.collection("transactions").document(tx.id).set({
            "id": tx.id,
            "user_id": tx.user_id,
            "amount": float(tx.amount),
            "tva_rate": float(tx.tva_rate),
            "description": tx.description,
            "created_at": tx.created_at,
            "tva": float(tx.tva),
            "total": float(tx.total),
            "year": tx.created_at.year,
        })

    def list(self, year: int = None) -> list:
        """List all transactions, optionally filtered by year (deprecated).
        
        Use list_by_user instead to filter by user.
        
        Args:
            year: Optional year to filter by.
            
        Returns:
            List of transaction dictionaries.
        """
        query = self.db.collection("transactions")
        if year:
            query = query.where(filter=FieldFilter("year", "==", year))
        docs = query.stream()
        return [doc.to_dict() for doc in docs]

    def list_by_user(self, user_id: str, year: int = None) -> list:
        """List transactions for a specific user, optionally filtered by year.
        
        Args:
            user_id: User ID to filter by.
            year: Optional year to filter by.
            
        Returns:
            List of transaction dictionaries for the user.
        """
        # Start query with user_id filter
        query = self.db.collection("transactions").where(
            filter=FieldFilter("user_id", "==", user_id)
        )
        # Chain year filter if provided
        if year:
            query = query.where(filter=FieldFilter("year", "==", year))
        docs = query.stream()
        return [doc.to_dict() for doc in docs]
