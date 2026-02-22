import logging
import firebase_admin
from firebase_admin import auth as firebase_auth
from fastapi import HTTPException, Header
from typing import Optional

logger = logging.getLogger(__name__)


async def verify_token(authorization: Optional[str] = Header(None)) -> str:
    """
    Verify Firebase ID token from Authorization header.
    
    Expects: Authorization: Bearer <firebase-id-token>
    Returns: user_id (UID) if valid
    """
    if not authorization:
        logger.warning("Missing authorization header")
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        # Extract token from "Bearer <token>"
        parts = authorization.split(" ")
        if len(parts) != 2 or parts[0] != "Bearer":
            logger.warning(f"Invalid authorization format: {parts}")
            raise HTTPException(status_code=401, detail="Invalid authorization format")

        token = parts[1]
        logger.debug(f"Verifying token: {token[:20]}...")

        # Verify token with Firebase
        decoded_token = firebase_auth.verify_id_token(token)
        user_id = decoded_token.get("uid")

        if not user_id:
            logger.warning("Token has no UID")
            raise HTTPException(status_code=401, detail="Invalid token: no UID")

        logger.info(f"Token verified for user: {user_id}")
        return user_id

    except firebase_auth.InvalidIdTokenError as e:
        logger.error(f"Invalid ID token: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid ID token")
    except firebase_auth.ExpiredIdTokenError as e:
        logger.error(f"ID token expired: {str(e)}")
        raise HTTPException(status_code=401, detail="ID token expired")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token verification failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")
