# Root Dockerfile for AgriGuard Backend (when Railway Root Directory is repository root "/")
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100 \
    ML_DEVICE=cpu \
    PORT=8000

WORKDIR /app

# Install system dependencies (Debian 12 Bookworm uses libgl1, not libgl1-mesa-glx)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy lean production requirements and install CPU-only PyTorch first
COPY backend/requirements.txt .
RUN pip install --no-cache-dir torch==2.4.1 torchvision==0.19.1 --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code and essential upload models
COPY backend/app ./app
COPY backend/uploads/models ./uploads/models
COPY backend/run.py .

# Ensure standard upload directory tree exists
RUN mkdir -p /app/uploads/images \
             /app/uploads/disease_detection \
             /app/uploads/profiles \
             /app/uploads/models \
             /app/uploads/enhanced \
             /app/uploads/scratch \
             /app/uploads/diagnostics

EXPOSE 8000

# Execute with exec in sh so Unix signals (SIGTERM/SIGINT) pass directly to uvicorn on Railway
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
