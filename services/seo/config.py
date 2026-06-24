import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from the parent directory (services/)
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
