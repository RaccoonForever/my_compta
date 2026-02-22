from pydantic import BaseModel, Field, field_validator
from datetime import datetime


class TransactionCreate(BaseModel):
    """Schema for creating a transaction."""
    amount: float = Field(..., gt=0, description="Transaction amount (must be positive)")
    tva_rate: float = Field(..., ge=0, le=100, description="TVA rate as percentage (0-100)")
    description: str = Field(default="", max_length=500, description="Transaction description")

    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v: float) -> float:
        """Validate amount has max 2 decimal places."""
        if round(v, 2) != v:
            raise ValueError('Amount must have at most 2 decimal places')
        return v

    @field_validator('tva_rate')
    @classmethod
    def validate_tva_rate(cls, v: float) -> float:
        """Validate TVA rate has max 2 decimal places."""
        if round(v, 2) != v:
            raise ValueError('TVA rate must have at most 2 decimal places')
        return v


class TransactionRead(TransactionCreate):
    """Schema for reading a transaction."""
    id: str
    user_id: str
    created_at: datetime
    tva: float = Field(description="Calculated TVA amount")
    total: float = Field(description="Total amount including TVA")


class TransactionResponse(BaseModel):
    """Schema for TVA calculation response."""
    tva: float = Field(description="Calculated TVA amount")
    total: float = Field(description="Total amount including TVA")
    user_id: str = Field(description="User ID")
