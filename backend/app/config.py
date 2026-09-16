import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    google_api_key: str | None = (
        os.getenv("GOOGLE_GENERATIVE_AI_API_KEY") or os.getenv("GEMINI_API_KEY") or None
    )
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    deepgram_api_key: str | None = os.getenv("DEEPGRAM_API_KEY") or None
    deepgram_model: str = os.getenv("DEEPGRAM_MODEL", "nova-2")

    jwt_secret: str = os.getenv("JWT_SECRET", "change-me-to-a-random-64-char-string")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_expiry_minutes: int = int(os.getenv("JWT_EXPIRY_MINUTES", "480"))

    razorpay_key_id: str | None = os.getenv("RAZORPAY_KEY_ID") or None
    razorpay_key_secret: str | None = os.getenv("RAZORPAY_KEY_SECRET") or None
    razorpay_webhook_secret: str | None = os.getenv("RAZORPAY_WEBHOOK_SECRET") or None

    @property
    def ai_enabled(self) -> bool:
        return bool(self.google_api_key)

    @property
    def deepgram_enabled(self) -> bool:
        return bool(self.deepgram_api_key)

    @property
    def razorpay_enabled(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
