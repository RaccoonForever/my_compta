import firebase_admin
from firebase_admin import auth as firebase_auth
from fastapi import HTTPException, Header
from typing import Optional


async def verify_token(authorization: Optional[str] = Header(None)) -> str:
    """
    Verify Firebase ID token from Authorization header.
    
    Expects: Authorization: Bearer <firebase-id-token>
    Returns: user_id (UID) if valid
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        # Extract token from "Bearer <token>"
        parts = authorization.split(" ")
        if len(parts) != 2 or parts[0] != "Bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization format")

        token = parts[1]

        # Verify token with Firebase
        decoded_token = firebase_auth.verify_id_token(token)
        user_id = decoded_token.get("uid")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no UID")

        return user_id

    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid ID token")
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="ID token expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")
