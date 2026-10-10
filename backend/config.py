from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    gemini_api_key: str
    access_token_expire_minutes: int = 60

    # Deployment settings (defaults keep local development working)
    database_ssl: bool = False
    allowed_origins: str = "http://localhost:3000,http://localhost:3001"

    # Limits that protect your Gemini quota once the site is public
    max_upload_mb: int = 10
    max_pdf_pages: int = 50
    max_documents_per_user: int = 5

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()