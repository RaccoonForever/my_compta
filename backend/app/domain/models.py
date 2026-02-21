from dataclasses import dataclass
from decimal import Decimal


@dataclass
class Transaction:
    id: str
    amount: Decimal
    tva_rate: Decimal
    description: str = ""
