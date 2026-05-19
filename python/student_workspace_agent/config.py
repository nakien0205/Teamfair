import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from repo root
_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / ".env")
load_dotenv()

openrouter_url = "https://openrouter.ai/api/v1"

# Only these two models are permitted for this agent.
light_model = "deepseek/deepseek-v4-flash"
heavy_model = "deepseek/deepseek-v4-pro"

# Optional OpenRouter attribution (see https://openrouter.ai/docs)
# Production app: https://teamfair.vercel.app/ — override with OPENROUTER_HTTP_REFERER for local-only dev.
HTTP_REFERER = os.environ.get("OPENROUTER_HTTP_REFERER", "https://teamfair.vercel.app")
X_TITLE = os.environ.get("OPENROUTER_X_TITLE", "Teamfair Student Workspace Agent")


def get_openrouter_api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "Openrouter API key is missing. Set it in the project .env at the repo root."
        )
    return key
