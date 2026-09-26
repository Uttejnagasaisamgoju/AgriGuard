# Railway Environment Variables Checklist (AgriGuard Backend)

Because `.env` is intentionally excluded by `.dockerignore` to avoid leaking secrets into container images, all production environment variables must be configured directly in **Railway -> Settings -> Variables**.

---

## 1. Critical & Security-Required Variables

| Variable | Default in Code | Recommended Production Value | Notes |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `"sqlite:///./agriguard.db"` | `${{Postgres.DATABASE_URL}}` *(Railway PostgreSQL)* | **CRITICAL**: Railway containers are ephemeral. If not connected to Railway Postgres, data will be lost on container restarts. Automatically handles `postgres://` or `postgresql://`. |
| `SECRET_KEY` | `"agriguard-dev-secret-key-..."` | Generated 32+ character random hex/alphanumeric string | **CRITICAL SECURITY**: Cryptographic secret for signing sessions and sensitive tokens. Never leave as dev default. |
| `JWT_SECRET_KEY` | `"change-me-in-production"` | Generated 32+ character random hex/alphanumeric string | **CRITICAL SECURITY**: Key used to sign JWT access & refresh tokens. Leaving as default allows JWT token forgery. |
| `ALLOWED_ORIGINS` | `localhost:3000, 5173...` | `https://your-frontend.vercel.app,https://your-domain.com` | Comma-separated list of origins permitted to make CORS requests. |
| `PUBLIC_URL` | `None` | `https://your-railway-app.up.railway.app` | Canonical public HTTPS URL of this deployed backend. |
| `APP_ENV` | `"development"` | `"production"` | Signals production runtime mode. |
| `DEBUG` | `True` | `False` | Disables debug logs and prevents leaking detailed stack traces in responses. |

---

## 2. ML & Service Configuration

| Variable | Default in Code | Recommended Production Value | Notes |
| :--- | :--- | :--- | :--- |
| `ML_DEVICE` | `"cpu"` | `"cpu"` | Standard Railway instances do not have GPUs. Leave as `cpu`. |
| `ML_MODEL_PATH` | `"./uploads/models/best_model.pt"` | `"./uploads/models/best_model.pt"` | Pre-populated inside Docker container via `COPY`. |
| `LEAF_VALIDATOR_PATH` | `"./uploads/models/leaf_validator.joblib"` | `"./uploads/models/leaf_validator.joblib"` | Pre-populated inside Docker container via `COPY`. |
| `UPLOAD_DIR` | `"./uploads"` | `"./uploads"` | Upload root directory. |
| `PORT` | `8000` | Injected by Railway `${PORT}` | Do not hardcode; Railway automatically assigns and injects the port. |

---

## 3. Third-Party API Keys & External Integrations

| Variable | Default in Code | Purpose | Behavior if Missing |
| :--- | :--- | :--- | :--- |
| `ANTHROPIC_API_KEY` | `""` | Claude AI Agriculture Assistant | Falls back gracefully to local verified RAG knowledge engine if unset. |
| `AI_PROVIDER` | `"anthropic"` | Primary AI provider (`anthropic`, `gemini`, `openai`) | Defaults to Claude. |
| `AI_MODEL` | `"claude-3-5-haiku-20241022"` | AI model identifier | Defaults to Claude 3.5 Haiku. |
| `GEMINI_API_KEY` | `""` | Google Gemini API (alternative AI provider) | Optional fallback. |
| `OPENAI_API_KEY` | `""` | OpenAI API (alternative AI provider) | Optional fallback. |
| `OPENWEATHER_API_KEY` | `"demo"` | OpenWeatherMap API for live forecast | `"demo"` will rate-limit or fail; set real key for live weather data. |
| `GOOGLE_TRANSLATE_API_KEY` | `""` | Cloud Translation API | Falls back to internal multilingual dictionaries if missing. |
| `GOOGLE_CLOUD_PROJECT` | `""` | Google Cloud Project ID | Optional. |
| `SENTINEL_HUB_CLIENT_ID` | `""` | Sentinel Hub NDVI Satellite imagery | Optional. |
| `SENTINEL_HUB_CLIENT_SECRET` | `""` | Sentinel Hub Client Secret | Optional. |
| `REDIS_URL` | `"redis://localhost:6379/0"` | Redis cache & Celery message broker | Set to Railway Redis service URL if Celery/Redis are provisioned. |

---

## 4. Email & Push Notifications (Optional)

| Variable | Default in Code | Purpose | Behavior if Missing |
| :--- | :--- | :--- | :--- |
| `SMTP_HOST` | `"smtp.gmail.com"` | SMTP Server host | Used for OTP and verification emails. |
| `SMTP_PORT` | `587` | SMTP Port (TLS: 587) | Default is 587. |
| `SMTP_USER` | `""` | Email account username | Email features skipped if empty. |
| `SMTP_PASSWORD` | `""` | Email app password | Email features skipped if empty. |
| `SMTP_FROM` | `"noreply@agriguard.app"` | Outgoing sender address | Default is noreply. |
| `VAPID_PUBLIC_KEY` | `""` | Web Push VAPID public key | If empty, service generates persistent keys on disk. |
| `VAPID_PRIVATE_KEY` | `""` | Web Push VAPID private key | If empty, service generates persistent keys on disk. |
| `VAPID_CLAIM_EMAIL` | `"mailto:support@agriguard.app"` | VAPID contact email | Default is support@agriguard.app. |
