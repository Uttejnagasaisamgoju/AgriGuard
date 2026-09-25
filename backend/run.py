import os
import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    should_reload = False if os.environ.get("RELOAD", "").lower() in ("0", "false", "no") else settings.DEBUG
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=should_reload,
        log_level="info",
    )

