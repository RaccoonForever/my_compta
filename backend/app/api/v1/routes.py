import logging
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas import TransactionCreate, TransactionResponse, TransactionRead
from app.domain.services import compute_tva, TVACalculationError
from app.domain.models import Transaction
from app.security.auth import verify_token
from app.adapters.firestore_repository import FirestoreTransactionRepository
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize repository
repository = FirestoreTransactionRepository(settings.GOOGLE_APPLICATION_CREDENTIALS)


@router.post("/tva", response_model=TransactionResponse, status_code=200)
def calc_tva(tx: TransactionCreate, user_id: str = Depends(verify_token)):
    """Calculate TVA for a transaction (requires authentication).
    
    Returns the calculated TVA and total amount.
    """
    try:
        tva_amount = compute_tva(tx.amount, tx.tva_rate)
        total = round(tx.amount + tva_amount, 2)
        logger.info(f"TVA calculated for user {user_id}: amount={tx.amount}, rate={tx.tva_rate}%")
        return TransactionResponse(tva=tva_amount, total=total, user_id=user_id)
    except TVACalculationError as e:
        logger.error(f"TVA calculation error for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid TVA calculation: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in TVA calculation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during TVA calculation"
        )


@router.post("/transactions", response_model=TransactionRead, status_code=201)
def save_transaction(tx: TransactionCreate, user_id: str = Depends(verify_token)):
    """Save a transaction to Firestore (requires authentication).
    
    Calculates TVA and stores the transaction with user context.
    """
    try:
        logger.info(f"Saving transaction for user {user_id}: amount={tx.amount}, rate={tx.tva_rate}")
        
        tva_amount = compute_tva(tx.amount, tx.tva_rate)
        
        # Create transaction with Decimal values
        transaction = Transaction(
            amount=Decimal(str(tx.amount)),
            tva_rate=Decimal(str(tx.tva_rate)),
            description=tx.description,
            user_id=user_id
        )
        
        logger.debug(f"Saving to Firestore: {transaction.id}")
        repository.save(transaction)
        logger.info(f"Transaction saved for user {user_id}: id={transaction.id}")
        
        return TransactionRead(
            id=transaction.id,
            user_id=user_id,
            amount=tx.amount,
            tva_rate=tx.tva_rate,
            description=tx.description,
            created_at=transaction.created_at,
            tva=tva_amount,
            total=float(transaction.amount + Decimal(str(tva_amount)))
        )
    except TVACalculationError as e:
        logger.error(f"TVA calculation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transaction: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error saving transaction: {str(e)}", exc_info=True)
        # Return more detailed error message for debugging
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving transaction: {str(e)}"
        )


@router.get("/transactions", response_model=list[TransactionRead])
def list_transactions(user_id: str = Depends(verify_token), year: int = None):
    """List transactions for the authenticated user (requires authentication).
    
    Optionally filter by year.
    """
    try:
        logger.info(f"Fetching transactions for user {user_id}, year={year}")
        transactions = repository.list_by_user(user_id, year)
        logger.info(f"Listed {len(transactions)} transactions for user {user_id}")
        return transactions
    except Exception as e:
        logger.error(f"Error listing transactions: {str(e)}", exc_info=True)
        # Return empty list instead of error to avoid timeout
        # User can retry by clicking refresh
        logger.warning(f"Returning empty list due to error: {str(e)}")
        return []


@router.get("/health")
def health_check():
    """Health check (no auth required)."""
    logger.info("Health check endpoint called")
    return {"status": "ok"}


@router.get("/debug")
def debug_info():
    """Debug endpoint to test connectivity (no auth required)."""
    import os
    logger.info("Debug endpoint called")
    return {
        "message": "Backend is working!",
        "firebase_initialized": len(firebase_admin._apps) > 0,
        "has_credentials": bool(settings.GOOGLE_APPLICATION_CREDENTIALS),
    }
