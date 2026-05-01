from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://tour:tour@db:5432/tour"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 14
    upload_dir: str = "/app/uploads"
    cors_origins: str = "*"
    seed_on_boot: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
