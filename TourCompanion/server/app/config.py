from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://tour:tour@db:5432/tour"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 14
    upload_dir: str = "/app/uploads"
    cors_origins: str = "*"
    seed_on_boot: bool = True

    # Email + verification
    app_url: str = "http://127.0.0.1:8000"
    email_from: str = "Tour Companion <onboarding@tourcompanion.app>"
    resend_api_key: str = ""        # if empty → console backend
    verify_token_ttl_hours: int = 24
    reset_token_ttl_minutes: int = 60
    verify_grace_days: int = 7      # allow login un-verified for N days

    # Rate limits (slowapi-compatible strings)
    rate_login: str = "5/minute"
    rate_signup: str = "3/hour"
    rate_forgot: str = "3/hour"
    rate_default: str = "100/minute"
    rate_ingest: str = "10/hour"

    # S3-compatible object storage (R2/S3/Backblaze). Empty bucket → local volume.
    s3_bucket: str = ""
    s3_endpoint_url: str = ""    # blank = AWS default
    s3_region: str = "us-east-1"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_public_url_base: str = ""  # public URL prefix; if blank, presigned GETs

    # Anthropic / tour-planner ingest
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"
    ingest_max_seconds: int = 120

    class Config:
        env_file = ".env"


settings = Settings()
