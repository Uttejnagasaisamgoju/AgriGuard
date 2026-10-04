from pydantic_settings import BaseSettings
from typing import Optional, List
from pathlib import Path
import os

_BACKEND_ENV = str(Path(__file__).resolve().parent.parent.parent / ".env")


class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_NAME: str = "AgriGuard"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    ALLOWED_ORIGINS: str = (
        "http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:5174,"
        "http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:5173,http://127.0.0.1:8000,"
        "https://localhost,http://localhost,capacitor://localhost,ionic://localhost"
    )
    PUBLIC_URL: Optional[str] = None

    DATABASE_URL: str = "sqlite:///./agriguard.db"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 10
    ALLOWED_IMAGE_TYPES: str = "image/jpeg,image/png,image/webp"

    ML_MODEL_PATH: str = "./uploads/models/best_model.pt"
    ML_CONFIDENCE_HIGH: float = 0.80
    ML_CONFIDENCE_MEDIUM: float = 0.60
    ML_DEVICE: str = "cpu"
    LEAF_VALIDATOR_PATH: str = "./uploads/models/leaf_validator.joblib"
    DISEASE_CONFIDENCE_THRESHOLD: float = 0.65

    # AI Assistant & RAG
    AI_PROVIDER: str = "anthropic"   # anthropic | gemini | openai | local
    AI_MODEL: str = "claude-3-5-haiku-20241022"   # model identifier
    AI_API_KEY: str = ""             # unified API key slot
    AI_BASE_URL: Optional[str] = None # custom base URL for OpenAI-compatible/Ollama/vLLM endpoints
    ANTHROPIC_API_KEY: str = ""      # Anthropic API key
    GEMINI_API_KEY: str = ""         # Google Gemini API key
    OPENAI_API_KEY: str = ""         # OpenAI API key
    CLAUDE_MODEL: str = "claude-3-5-haiku-20241022"  # backward compat
    AI_TEMPERATURE: float = 0.3
    AI_MAX_TOKENS: int = 1200


    OPENWEATHER_API_KEY: str = "demo"
    SENTINEL_HUB_CLIENT_ID: str = ""
    SENTINEL_HUB_CLIENT_SECRET: str = ""

    REDIS_URL: str = "redis://localhost:6379/0"

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@agriguard.app"

    STORAGE_TYPE: str = "local"

    # Web Push / VAPID Keys
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_CLAIM_EMAIL: str = "mailto:support@agriguard.app"

    SECRET_KEY: str = "agriguard-dev-secret-key-please-change-in-production-2024"

    @property
    def allowed_origins_list(self) -> List[str]:
        origins = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        if self.PUBLIC_URL and self.PUBLIC_URL.strip():
            pub = self.PUBLIC_URL.strip().rstrip('/')
            if pub not in origins:
                origins.append(pub)
        return origins

    @property
    def allowed_image_types_list(self) -> List[str]:
        return [t.strip() for t in self.ALLOWED_IMAGE_TYPES.split(",")]

    class Config:
        env_file = (_BACKEND_ENV, ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
