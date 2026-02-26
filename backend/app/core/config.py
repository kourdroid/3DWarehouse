from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Smatch 3D Warehouse API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    # Defaulting to an async in-memory SQLite database for zero-config local testing
    DATABASE_URL: str = "sqlite+aiosqlite:///:memory:"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
