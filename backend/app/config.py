import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with support for environment variables."""

    # Firebase
    GOOGLE_APPLICATION_CREDENTIALS: str | None = None
    FIREBASE_PROJECT_ID: str | None = None

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative React dev
        "http://localhost:8000",  # Backend dev
    ]

    # Environment
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
