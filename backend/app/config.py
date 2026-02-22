import os
from pydantic import field_validator, ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with support for environment variables."""

    model_config = ConfigDict(env_file=".env", case_sensitive=True)

    # Firebase
    GOOGLE_APPLICATION_CREDENTIALS: str | None = None
    FIREBASE_PROJECT_ID: str | None = None

    # CORS (will be parsed from comma-separated string in .env)
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8000"

    # Environment
    ENVIRONMENT: str = "development"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Keep as string; we'll parse it when using."""
        if isinstance(v, list):
            return ",".join(v)
        return v
    
    def get_cors_origins(self) -> list[str]:
        """Parse CORS_ORIGINS string into a list."""
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
