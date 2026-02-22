from dataclasses import dataclass, field
from decimal import Decimal
from datetime import datetime
import uuid


@dataclass
class Transaction:
    """Domain model for a transaction."""
    amount: Decimal
    tva_rate: Decimal
    user_id: str
    description: str = ""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def tva(self) -> Decimal:
        """Calculate TVA for this transaction."""
        from app.domain.services import compute_tva
        return Decimal(str(compute_tva(float(self.amount), float(self.tva_rate))))

    @property
    def total(self) -> Decimal:
        """Calculate total including TVA."""
        return self.amount + self.tva
