from abc import ABC, abstractmethod
from typing import List
from app.domain.models import Transaction


class TransactionRepository(ABC):
    @abstractmethod
    def save(self, tx: Transaction) -> None:
        raise NotImplementedError()

    @abstractmethod
    def list(self, year: int) -> List[dict]:
        raise NotImplementedError()
