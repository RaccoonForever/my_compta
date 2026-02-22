import logging
import firebase_admin
from firebase_admin import credentials
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.routes import router as v1_router
from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def init_firebase():
    """Initialize Firebase admin SDK."""
    if not firebase_admin._apps:
        cred_path = settings.GOOGLE_APPLICATION_CREDENTIALS
        if cred_path:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized successfully")
        else:
            # If no credentials file, use default (assumes GOOGLE_APPLICATION_CREDENTIALS env var)
            firebase_admin.initialize_app()
            logger.info("Firebase initialized with default credentials")


def create_app():
    # Initialize Firebase on app startup
    init_firebase()
    
    app = FastAPI(title="My Compta API", version="1.0.0")

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(v1_router, prefix="/api/v1")
    logger.info(f"App created with allowed origins: {settings.get_cors_origins()}")
    return app


app = create_app()
