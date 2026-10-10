# AgriGuard 🌾

> **Smart Agriculture Platform for Crop Disease Detection & Farm Management**  
> **SIH 2026 Problem Statement 131** — *Crop Disease Detection & Farmer Advisory System*

---

## 🌐 Live Demo

| Service | URL | Status |
|---------|-----|--------|
| **Frontend (Vercel)** | [https://agri-guard-ecru.vercel.app](https://agri-guard-ecru.vercel.app) | ✅ Live |
| **Backend API (Railway)** | [https://agriguard.up.railway.app](https://agriguard.up.railway.app) | ✅ Live |
| **API Documentation (Swagger)** | [https://agriguard.up.railway.app/docs](https://agriguard.up.railway.app/docs) | ✅ Live |

---

## 🎯 Problem Statement 131 Alignment

| SIH 131 Requirement | AgriGuard Implementation |
|---------------------|--------------------------|
| **Crop Disease Detection** | PyTorch MobileNetV3 (23 classes) + Leaf Validation + CLAHE Enhancement |
| **Farmer Advisory** | AI Chat (Claude) + RAG Knowledge Base + Expert Consultation |
| **Multilingual Support** | 11 Indian Languages (EN, HI, TE, TA, KN, ML, MR, BN, KOK, KFA, TGY) + TTS |
| **Officer/Expert Workflow** | Case Management + Field Visits + Resolution Tracking |
| **Offline Capability** | PWA + Service Worker + Background Sync + IndexedDB |
| **Real-time Alerts** | WebSocket + Push Notifications (VAPID) |
| **Farm Management** | GeoJSON Boundaries + Satellite Imagery + Weather Integration |
| **Offline-first PWA** | Service Worker + Cache-First + Background Sync |

---

## ✨ Key Features

### 🔬 **AI-Powered Disease Detection**
- **Real PyTorch MobileNetV3** model (23 crop-disease classes)
- **Leaf Validation Pipeline**: Blur/Lighting/Screen/Moiré detection via CV + RandomForest
- **Image Enhancement**: CLAHE + Bilateral Denoise + Unsharp Masking
- **Uncertainty Quantification**: Shannon Entropy + Confidence Calibration
- **Explainable Results**: Top-3 predictions + Treatment recommendations

### 🌾 **Farm Management**
- Interactive map with GeoJSON boundaries
- Crop cycle tracking (sowing → harvest)
- Soil type, irrigation, variety tracking
- Satellite imagery integration (Sentinel Hub ready)

### 🤖 **AI Agriculture Assistant**
- Role-scoped responses (Farmer/Officer/Expert/Admin)
- RAG over agricultural knowledge base
- Conversation persistence + Streaming responses
- Domain intent filter (blocks non-agri queries)

### 👥 **Multi-Role Workflows**
| Role | Capabilities |
|------|--------------|
| **Farmer** | Scan crops, view farms, chat AI, consult experts, get alerts |
| **Officer** | Case management, field visits, farmer assignments, reports |
| **Expert** | Consultations, prescriptions, availability toggle |
| **Admin** | User management, system monitoring, analytics |

### 🌐 **Multilingual & Accessibility**
- **11 Languages**: English, Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, Konkani, Kodava, Bundeli, Bagheli
- **Text-to-Speech**: Read-aloud in all supported languages
- **Voice Mode**: Floating controls for hands-free operation
- **RTL Support**: Ready for Urdu/Arabic expansion

### 🔔 **Real-time & Offline**
- WebSocket for live updates (cases, messages, alerts)
- Push notifications (VAPID Web Push)
- Service Worker: Cache-first + Stale-while-revalidate
- Background sync for offline predictions
- PWA installable (Android APK available)

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │    Backend      │     │   ML Services   │
│   (Vercel)      │────▶│   (Railway)     │────▶│   (PyTorch)     │
│   React 19      │     │   FastAPI       │     │   MobileNetV3   │
│   Vite + TS     │     │   SQLite/PG     │     │   OpenCV        │
│   Tailwind      │     │   Redis         │     │   scikit-learn  │
│   PWA + SW      │     │   WebSocket     │     │   RandomForest  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         │              ┌────────┴────────┐              │
         │              │  External APIs  │              │
         │              │  OpenWeather    │              │
         │              │  Anthropic      │              │
         │              │  Sentinel Hub   │              │
         │              │  FCM/VAPID      │              │
         │              └─────────────────┘              │
         └───────────────────────────────────────────────┘
                    Real-time WebSocket + Push
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.12+
- Docker (for unified deployment)

### Backend (Local)
```bash
cd backend
cp .env.example .env
# Edit .env with your keys
pip install -r requirements.txt
python run.py
# Server at http://localhost:8000
```

### Frontend (Local)
```bash
cd frontend
npm install
npm run dev
# App at http://localhost:3001
```

### Unified Docker (Production)
```bash
docker build -t agriguard .
docker run -p 8080:8080 \
  -e DATABASE_URL=... \
  -e JWT_SECRET_KEY=... \
  -e ANTHROPIC_API_KEY=... \
  agriguard
```

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| **Farmer** | `farmer@demo.agriguard.app` | `Demo@1234` |
| **Officer** | `officer@demo.agriguard.app` | `Demo@1234` |
| **Expert** | `expert@demo.agriguard.app` | `Demo@1234` |
| **Admin** | `admin@demo.agriguard.app` | `Admin@1234` |

---

## 📱 Android APK
Download: [https://agriguard.up.railway.app/downloads/AgriGuard.apk](https://agriguard.up.railway.app/downloads/AgriGuard.apk)

---

## 📊 Test Results

```bash
cd backend
pytest tests/ -v --tb=short
```

**Key Metrics:**
- Disease Detection Accuracy: ~87% (23 classes)
- Leaf Validation Precision: ~93%
- API Response Time (p95): <300ms
- Multilingual Coverage: 11 languages
- API Test Coverage: 20+ test suites

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query |
| **Backend** | FastAPI, SQLAlchemy 2.0, Pydantic 2, JWT Auth, WebSocket |
| **Database** | SQLite (dev) / PostgreSQL (prod), Redis (cache/sessions) |
| **ML** | PyTorch 2.4, torchvision, OpenCV, scikit-learn, ONNX |
| **AI** | Anthropic Claude 3.5 Haiku, RAG with TF-IDF |
| **Deployment** | Vercel (frontend), Railway (backend), Docker |
| **Push** | VAPID Web Push, FCM fallback |
| **Maps** | Leaflet, Sentinel Hub ready |

---

## 📁 Project Structure

```
AgriGuard/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/routes/      # 12 API routers
│   │   ├── auth/            # JWT, dependencies
│   │   ├── database/        # SQLAlchemy, seeds
│   │   ├── models/          # 15+ SQLAlchemy models
│   │   ├── services/        # 15+ business logic services
│   │   ├── ml/              # Leaf validator, ML inference
│   │   └── websocket/       # Real-time manager
│   ├── uploads/models/      # ML models (PyTorch + joblib)
│   ├── Dockerfile           # Multi-stage build
│   └── requirements.txt
├── frontend/                # React + Vite
│   ├── src/
│   │   ├── components/      # 40+ React components
│   │   ├── context/         # React contexts (Auth, Farm, Lang, etc.)
│   │   ├── services/        # API client, push, read-aloud
│   │   ├── locales/         # 11 language files
│   │   └── utils/           # Translations, images, queue
│   ├── public/sw.js         # Service Worker
│   └── vercel.json          # Vercel rewrites
├── ml/                      # Training scripts (legacy)
├── training/                # Training pipelines (legacy)
├── Dockerfile               # Root: multi-stage unified
├── railway.toml             # Railway config
├── vercel.json              # Vercel rewrites
└── .railway/railway.ts      # IaC config
```

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET_KEY` | ✅ | 32-char secret for JWT signing |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key for AI chat |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | | Redis for cache/sessions |
| `PUBLIC_URL` | ✅ | Public frontend URL (CORS) |
| `SMTP_*` | | Email notifications |
| `VAPID_*` | ✅ | Web Push keys |
| `ANTHROPIC_API_KEY` | | AI chat provider |

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **SIH 2026** - Problem Statement 131
- **Anthropic** - Claude API for AI assistant
- **PyTorch Team** - MobileNetV3 architecture
- **OpenCV** - Image processing
- **Vercel & Railway** - Free hosting for demo

---

**Built with ❤️ for Indian Agriculture** 🇮🇳