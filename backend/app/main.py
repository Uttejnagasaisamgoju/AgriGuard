"""
AgriGuard Backend — Main FastAPI Application
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db, create_tables
from app.api.routes import auth, farms, disease, weather, notifications, chat, officer, reports, expert, ai, translation
from app.websocket.manager import manager
from app.auth.dependencies import get_ws_user

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting AgriGuard Backend v{settings.APP_VERSION} [{settings.APP_ENV}]")

    # Create database tables
    try:
        create_tables()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

    # Seed initial data
    try:
        from app.database.seed import seed_database
        from app.services.rag_service import rag_service
        with next(get_db()) as db:
            seed_database(db)
            rag_service.seed_initial_knowledge(db)
    except Exception as e:
        logger.warning(f"Seed data: {e}")

    # Ensure upload directories exist
    upload_dir = Path(settings.UPLOAD_DIR)
    for subdir in ["images", "disease_detection", "profiles", "models", "enhanced"]:
        (upload_dir / subdir).mkdir(parents=True, exist_ok=True)

    yield

    # Shutdown
    logger.info("Shutting down AgriGuard Backend")


app = FastAPI(
    title="AgriGuard API",
    description="Smart Agriculture Platform — Crop Disease Detection, Farm Management, Expert Consultation",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — explicitly allow local ports, private LAN IPs, mobile schemes, and any public HTTPS domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_origin_regex=r"^https?:\/\/((localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})|([a-zA-Z0-9-]+\.)*(loca\.lt|trycloudflare\.com|agriguard\.app))(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploads
upload_dir = Path(settings.UPLOAD_DIR)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

# API Routes
app.include_router(auth.router)
app.include_router(farms.router)
app.include_router(disease.router)
app.include_router(weather.router)
app.include_router(notifications.router)
app.include_router(chat.router)
app.include_router(officer.router)
app.include_router(expert.router)
app.include_router(reports.router)
app.include_router(ai.router)
app.include_router(translation.router)


@app.get("/api/health")
async def health_check(db: Session = Depends(get_db)):
    from sqlalchemy import text
    import time
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Health check DB probe failed: {e}")
        db_status = f"unhealthy: {str(e)}"

    is_healthy = db_status == "healthy"
    return {
        "status": "healthy" if is_healthy else "degraded",
        "database": db_status,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "timestamp": time.time(),
    }


@app.get("/api/v1/system/network-info")
@app.get("/api/system/network-info")
async def get_network_info(request: Request):
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
    except Exception:
        local_ip = '127.0.0.1'
    finally:
        s.close()

    # Determine protocol and host from incoming request headers
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    forwarded_host = request.headers.get("x-forwarded-host", request.headers.get("host", f"{local_ip}:8000"))

    if "loca.lt" in forwarded_host or (proto == "https" and not forwarded_host.startswith("127.") and not forwarded_host.startswith("localhost")):
        base_public = f"{proto}://{forwarded_host}"
    elif settings.PUBLIC_URL and settings.PUBLIC_URL.strip():
        base_public = settings.PUBLIC_URL.strip().rstrip('/')
    else:
        base_public = f"http://{local_ip}:3001"

    return {
        "local_ip": local_ip,
        "frontend_port": 3001,
        "backend_port": 8000,
        "public_url": base_public,
        "share_url": f"{base_public}/?screen=download",
        "apk_url": f"{base_public}/downloads/AgriGuard.apk",
    }


@app.get("/api/dashboard")
async def get_dashboard(
    current_user=Depends(__import__("app.auth.dependencies", fromlist=["get_current_user"]).get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.farm import Farm
    from app.models.disease import DiseasePrediction
    from app.models.user import User, UserRole
    from app.models.officer import OfficerCase

    farms_count = db.query(Farm).filter(Farm.user_id == current_user.id).count()
    predictions = db.query(DiseasePrediction).filter(DiseasePrediction.user_id == current_user.id).all()
    diseases_detected = sum(1 for p in predictions if p.primary_disease and p.primary_disease != "Healthy")
    healthy_crops = sum(1 for p in predictions if p.primary_disease == "Healthy")
    active_officers = db.query(User).filter(User.role == UserRole.OFFICER, User.is_active == True).count()

    # Real database activities across predictions, cases, and notifications
    from app.models.notification import Notification
    from app.models.officer import CaseStatus

    activities = []
    # 1. Disease Predictions
    recent = db.query(DiseasePrediction).filter(
        DiseasePrediction.user_id == current_user.id
    ).order_by(DiseasePrediction.created_at.desc()).limit(8).all()
    for p in recent:
        is_h = p.primary_disease and "healthy" in p.primary_disease.lower()
        activities.append({
            "id": f"pred-{p.id}",
            "event_type": "disease_detection",
            "title": f"Crop Diagnosis: {p.primary_disease}" if not is_h else "Healthy Crop Scan",
            "subtitle": f"{p.primary_crop or 'Crop'} • {int((p.overall_confidence or 0.88)*100)}% confidence",
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "color": "#34d399" if is_h else "#f87171",
        })

    # 2. Officer Cases
    user_cases = db.query(OfficerCase).filter(
        (OfficerCase.farmer_id == current_user.id) | (OfficerCase.officer_id == current_user.id)
    ).order_by(OfficerCase.updated_at.desc()).limit(5).all()
    for c in user_cases:
        is_res = c.status == CaseStatus.RESOLVED
        event_time = c.resolved_at or c.updated_at or c.created_at
        activities.append({
            "id": f"case-{c.id}",
            "event_type": "case_resolution" if is_res else "case_update",
            "title": f"Case Resolved: {c.title}" if is_res else f"Case Update: {c.title}",
            "subtitle": f"Status: {c.status.value.replace('_', ' ').title()} • Priority: {c.priority.title()}",
            "created_at": event_time.isoformat() if event_time else None,
            "color": "#38bdf8" if is_res else "#fbbf24",
        })

    # Sort strictly by created_at DESC
    activities = [a for a in activities if a["created_at"]]
    activities.sort(key=lambda x: x["created_at"], reverse=True)

    return {
        "user": {
            "name": current_user.name,
            "role": current_user.role.value,
        },
        "stats": {
            "total_farms": farms_count,
            "diseases_detected": diseases_detected,
            "healthy_crops": healthy_crops,
            "active_officers": active_officers,
        },
        "recent_alerts": [
            {
                "id": str(p.id),
                "disease": p.primary_disease,
                "crop": p.primary_crop,
                "confidence": p.overall_confidence,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in recent[:5]
        ],
        "recent_activities": activities[:8],
    }


# WebSocket endpoint for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    token = websocket.query_params.get("token")
    user = None
    if token:
        user = await get_ws_user(websocket, db)

    if not user:
        await websocket.accept()
        await websocket.send_json({"type": "error", "message": "Authentication required"})
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, str(user.id))
    try:
        await websocket.send_json({
            "type": "connected",
            "user_id": str(user.id),
            "message": "Connected to AgriGuard real-time service",
        })
        while True:
            data = await websocket.receive_json()
            # Handle ping/heartbeat
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, str(user.id))
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, str(user.id))


import mimetypes
mimetypes.add_type("application/vnd.android.package-archive", ".apk")

@app.get("/downloads/AgriGuard.apk")
async def download_agriguard_apk():
    """Deliver real, signed Android release package with proper attachment headers"""
    apk_candidates = [
        frontend_dist / "downloads" / "AgriGuard.apk",
        Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "downloads" / "AgriGuard.apk",
        Path(__file__).resolve().parent.parent.parent / "frontend" / "android" / "app" / "build" / "outputs" / "apk" / "release" / "app-release.apk",
    ]
    for apk_file in apk_candidates:
        if apk_file.is_file() and apk_file.stat().st_size > 1000000:
            return FileResponse(
                path=str(apk_file),
                media_type="application/vnd.android.package-archive",
                filename="AgriGuard.apk",
                headers={
                    "Content-Disposition": 'attachment; filename="AgriGuard.apk"',
                    "Content-Type": "application/vnd.android.package-archive",
                    "Accept-Ranges": "bytes",
                    "Cache-Control": "public, max-age=3600",
                }
            )
    return JSONResponse(status_code=404, content={"detail": "AgriGuard.apk not found"})

# ─── Mount Compiled Frontend (SPA) ────────────────
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    downloads_dir = frontend_dist / "downloads"
    if downloads_dir.exists():
        app.mount("/downloads", StaticFiles(directory=str(downloads_dir)), name="downloads")

    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="spa-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Exclude internal/API endpoints
        if full_path.startswith(("api", "uploads", "docs", "redoc", "openapi.json", "ws")):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})

        target_file = frontend_dist / full_path
        if full_path and target_file.is_file():
            return FileResponse(str(target_file))

        index_file = frontend_dist / "index.html"
        if index_file.is_file():
            return FileResponse(str(index_file))

        return JSONResponse(status_code=404, content={"detail": "Frontend index.html not found"})

