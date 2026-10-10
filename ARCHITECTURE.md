# AgriGuard Architecture Diagram

## System Overview

```mermaid
graph TB
    subgraph "Client Layer"
        A[Web Browser / PWA]
        B[Android App / Capacitor]
    end

    subgraph "CDN / Edge"
        C[Vercel Edge Network]
        D[Railway Edge Proxy]
    end

    subgraph "Frontend Services"
        E[React 19 SPA<br/>Vite + TypeScript<br/>Tailwind CSS]
        F[Service Worker<br/>Cache-First + Sync]
        G[WebSocket Client<br/>Real-time Updates]
        H[Push Notifications<br/>VAPID Web Push]
    end

    subgraph "Backend API (Railway)"
        I[FastAPI Application<br/>Python 3.12]
        J[JWT Authentication<br/>Role-based Access]
        K[WebSocket Server<br/>Real-time Manager]
        L[REST API Routes<br/>12 Routers]
    end

    subgraph "Business Logic Services"
        M[ML Service<br/>PyTorch MobileNetV3]
        N[Leaf Validator<br/>CV + RandomForest]
        O[Image Enhancement<br/>OpenCV CLAHE]
        P[AI Chat Service<br/>Claude + RAG]
        Q[RAG Service<br/>TF-IDF Knowledge Base]
        R[Agricultural Analysis<br/>Severity + Recommendations]
        S[Weather Service<br/>OpenWeather + Sentinel]
        T[Notification Service<br/>Push + In-App + Email]
        U[Translation Service<br/>11 Languages + TTS]
        V[Push Service<br/>VAPID + FCM]
    end

    subgraph "Data Layer"
        W[(SQLite / PostgreSQL<br/>SQLAlchemy 2.0)]
        X[(Redis<br/>Cache + Sessions)]
        Y[File Storage<br/>Uploads + Models]
    end

    subgraph "External APIs"
        Z[Anthropic Claude 3.5 Haiku]
        AA[OpenWeather API]
        AB[Sentinel Hub]
        AC[Google Translate]
        AD[FCM / VAPID Push]
    end

    %% Connections
    A --> C
    B --> C
    C --> E
    E --> F
    E --> G
    E --> H
    E -->|/api/*| D
    D --> I
    I --> J
    I --> K
    I --> L
    L --> M
    L --> N
    L --> O
    L --> P
    L --> Q
    L --> R
    L --> S
    L --> T
    L --> U
    L --> V
    M --> Y
    N --> Y
    O --> Y
    P --> Z
    Q --> Y
    S --> AA
    S --> AB
    U --> AC
    V --> AD
    V --> T
    I --> W
    I --> X
    K --> G
    H --> AD
```

---

## Data Flow: Disease Detection

```mermaid
sequenceDiagram
    participant U as User (Farmer)
    participant F as Frontend (React)
    participant A as API Gateway
    participant S as Storage Service
    participant V as Leaf Validator
    participant E as Enhancement Service
    participant M as ML Service
    participant DB as Database
    participant N as Notification Service

    U->>F: Capture/Upload leaf image
    F->>A: POST /api/diseases/ml/predict (multipart)
    A->>S: Save original upload
    S-->>A: File path
    A->>V: Validate leaf quality
    V-->>A: is_valid + metrics
    alt Invalid leaf
        A-->>F: 422 Validation Rejected
    else Valid leaf
        A->>E: Enhance image (CLAHE + denoise)
        E-->>A: Enhanced image path
        A->>M: PyTorch inference (224x224)
        M-->>A: Disease + confidence + top-3
        A->>DB: Save prediction + results
        A->>N: Create notifications (farmer + officer + expert)
        A-->>F: Full prediction response
    end
    F-->>U: Display diagnosis + treatment
```

---

## Deployment Topology

```mermaid
graph LR
    subgraph "GitHub"
        GH[github.com/Uttejnagasaisamgoju/AgriGuard]
    end

    subgraph "CI/CD"
        GH -->|push main| VERCEL[Vercel<br/>Frontend Build]
        GH -->|push main| RAILWAY[Railway<br/>Docker Build]
    end

    subgraph "Production"
        VERCEL -->|https://agri-guard-ecru.vercel.app| FE[Frontend<br/>React SPA]
        RAILWAY -->|https://agriguard.up.railway.app| BE[Backend<br/>FastAPI + ML]
    end

    subgraph "External"
        BE --> ANTH[Anthropic Claude]
        BE --> OW[OpenWeather]
        BE --> SENT[Sentinel Hub]
        BE --> PUSH[VAPID/FCM]
    end

    FE -->|/api/* →| BE
    FE -->|/ws →| BE
```

---

## Security Architecture

```mermaid
graph TD
    subgraph "Authentication"
        A[JWT Access Token<br/>1hr expiry]
        B[Refresh Token<br/>7 days, rotating]
        C[Role Claims<br/>FARMER/OFFICER/EXPERT/ADMIN]
    end

    subgraph "Authorization"
        D[Route Guards<br/>Role-based]
        E[Resource Ownership<br/>User-scoped queries]
        F[Rate Limiting<br/>SlowAPI per IP/User]
    end

    subgraph "Data Protection"
        G[Argon2 Password Hash]
        G --> H[HTTPS Only]
        H --> I[Secure Cookies]
        I --> J[CORS Whitelist]
    end

    subgraph "Secrets"
        K[Environment Variables<br/>Railway/Vercel]
        L[VAPID Keys<br/>Web Push]
        M[ANTHROPIC_API_KEY<br/>Server-only]
    end

    A --> D
    B --> D
    C --> D
    D --> E
    E --> F
```

---

## Scalability Considerations

```mermaid
graph LR
    subgraph "Horizontal Scaling"
        A[Railway Replicas<br/>CPU-based autoscaling]
        B[Redis Cluster<br/>Session + Cache]
        C[PostgreSQL Read Replicas]
    end

    subgraph "ML Optimization"
        D[ONNX Export<br/>Faster inference]
        E[Model Quantization<br/>INT8 for edge]
        F[Batch Inference<br/>Multiple images]
    end

    subgraph "Caching"
        G[Vercel Edge Cache<br/>Static assets]
        H[Redis Query Cache<br/>Disease library]
        I[CDN for Models<br/>ONNX + weights]
    end
```

---

## Monitoring & Observability

```mermaid
graph TB
    subgraph "Logs"
        A[Structlog JSON<br/>Railway Logs]
        B[Access Logs<br/>Request/Response]
        C[Error Tracking<br/>Sentry-ready]
    end

    subgraph "Metrics"
        D[Health Checks<br/>/api/health]
        I[API Latency p50/p95/p99]
        J[ML Inference Time]
        K[Cache Hit Rate]
    end

    subgraph "Alerts"
        E[Deployment Failures]
        F[Error Rate > 5%]
        G[DB Connection Pool]
        H[ML Model Load Fail]
    end

    A --> E
    B --> F
    C --> G
    D --> H
    I --> J
    K --> H
```