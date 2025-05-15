import os
from dotenv import load_dotenv
load_dotenv()

class Settings:
    PROJECT_NAME: str = "Log Transition Project"
    PROJECT_VERSION: str = "1.0.0"
    AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT")
    AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY")
    AZURE_OPENAI_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION")
    AZURE_OPENAI_DEPLOYMENT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT")

    AZURE_OPENAI_EMBED_API_ENDPOINT: str = os.getenv("AZURE_OPENAI_EMBED_API_ENDPOINT")
    AZURE_OPENAI_EMBED_API_KEY: str = os.getenv("AZURE_OPENAI_EMBED_API_KEY")
    AZURE_OPENAI_EMBED_MODEL: str = os.getenv("AZURE_OPENAI_EMBED_MODEL")
    AZURE_OPENAI_EMBED_VERSION: str = os.getenv("AZURE_OPENAI_EMBED_VERSION")

    SNOW_API_URL: str = os.getenv("SNOW_API_URL")
    SNOW_AUTH_USERNAME: str = os.getenv("SNOW_AUTH_USERNAME")
    SNOW_AUTH_PASSWORD: str = os.getenv("SNOW_AUTH_PASSWORD")

    # Database settings (PostgreSQL)
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "password")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "support_app_db")
    DATABASE_URL: str = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    
    # Mailgun settings
    MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY")
    MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN")
    MAILGUN_FROM_EMAIL = os.getenv("MAILGUN_FROM_EMAIL", f"Support Team <postmaster@{MAILGUN_DOMAIN}>")

    # JWT Settings
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "5p74$@hbo5apgZqzM@BVhiHG!RRDMn&P")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

settings = Settings()

if not settings.AZURE_OPENAI_ENDPOINT or not settings.AZURE_OPENAI_API_KEY:
    raise ValueError("AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY is not set in the environment")