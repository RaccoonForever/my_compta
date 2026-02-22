from abc import ABC, abstractmethod
from typing import List, Optional
from app.domain.models import Transaction


class TransactionRepository(ABC):
    """Abstract repository for transaction persistence."""

    @abstractmethod
    def save(self, tx: Transaction) -> None:
        """Save a transaction.
        
        Args:
            tx: Transaction to save.
        """
        raise NotImplementedError()

    @abstractmethod
    def list(self, year: Optional[int] = None) -> List[dict]:
        """List transactions, optionally filtered by year.
        
        Args:
            year: Optional year to filter by.
            
        Returns:
            List of transaction dictionaries.
        """
        raise NotImplementedError()

    @abstractmethod
    def list_by_user(self, user_id: str, year: Optional[int] = None) -> List[dict]:
        """List transactions for a specific user, optionally filtered by year.
        
        Args:
            user_id: User ID to filter by.
            year: Optional year to filter by.
            
        Returns:
            List of transaction dictionaries for the user.
        """
        raise NotImplementedError()
