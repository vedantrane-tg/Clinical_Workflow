import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    google_api_key: str | None = os.getenv("GOOGLE_GENERATIVE_AI_API_KEY") or None
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

    @property
    def ai_enabled(self) -> bool:
        return bool(self.google_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()

class Settings:
    google_api_key: str | None = os.getenv("GOOGLE_GENERATIVE_AI_API_KEY") or None
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
    deepgram_api_key: str | None = os.getenv("DEEPGRAM_API_KEY") or None
    deepgram_model: str = os.getenv("DEEPGRAM_MODEL", "nova-2")

    @property
    def ai_enabled(self) -> bool:
        return bool(self.google_api_key)

    @property
    def deepgram_enabled(self) -> bool:
        return bool(self.deepgram_api_key)