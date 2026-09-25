from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime
from app.database.session import get_db
from app.models.user import User, UserRole, RefreshToken
from app.auth.security import (
    hash_password, authenticate_user, create_access_token,
    create_refresh_token, save_refresh_token, revoke_refresh_token,
    decode_token, generate_verification_token
)
from app.auth.dependencies import get_current_user
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import re

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


from app.models.chat import ExpertProfile
from typing import Optional, List

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: Optional[str] = "FARMER"
    # Role-specific fields
    specialization: Optional[str] = None
    qualifications: Optional[str] = None
    years_experience: Optional[str] = None
    crops_expertise: Optional[List[str]] = None
    bio: Optional[str] = None
    assigned_region: Optional[str] = None
    department: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v.strip()


class LoginRequest(BaseModel):
    email: str
    password: str
    role: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/register", status_code=201)
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    clean_email = req.email.strip().lower()
    # Check if email exists
    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # Validate role
    try:
        role = UserRole(req.role.upper())
    except ValueError:
        role = UserRole.FARMER

    user = User(
        name=req.name.strip(),
        email=clean_email,
        phone=req.phone.strip() if req.phone else None,
        password_hash=hash_password(req.password),
        role=role,
        is_verified=True,  # For development, auto-verify
        verification_token=generate_verification_token(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if role == UserRole.EXPERT:
        profile = ExpertProfile(
            user_id=user.id,
            specialization=req.specialization or "Plant Pathology & Crop Protection",
            qualifications=req.qualifications or "Agricultural Scientist",
            years_experience=req.years_experience or "5",
            crops_expertise=req.crops_expertise or ["Rice", "Tomato", "Potato", "Maize"],
            is_online=True,
            is_verified=True,
            rating="4.9",
            total_consultations="0",
            bio=req.bio or f"Certified agricultural consultant specializing in {req.specialization or 'crop protection'}.",
        )
        db.add(profile)
        db.commit()

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    save_refresh_token(db, str(user.id), refresh_token)

    return {
        "message": "Account created successfully",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": _user_response(user),
    }


@router.post("/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, req.email, req.password, requested_role=req.role)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account has been disabled. Contact support.")

    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    save_refresh_token(db, str(user.id), refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": _user_response(user),
    }


@router.post("/refresh")
async def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == req.refresh_token,
        RefreshToken.is_revoked == False,
    ).first()

    if not db_token or db_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Refresh token expired or revoked")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Rotate refresh token
    revoke_refresh_token(db, req.refresh_token)
    new_access = create_access_token({"sub": str(user.id), "role": user.role.value})
    new_refresh = create_refresh_token({"sub": str(user.id)})
    save_refresh_token(db, str(user.id), new_refresh)

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


@router.post("/logout")
async def logout(req: RefreshRequest, db: Session = Depends(get_db)):
    revoke_refresh_token(db, req.refresh_token)
    return {"message": "Logged out successfully"}


from collections import defaultdict
import time
from datetime import timedelta
from app.auth.security import generate_temporary_password
from app.services.email_service import send_temporary_password_email

_reset_ip_attempts = defaultdict(list)
_reset_identifier_attempts = defaultdict(list)
RESET_RATE_WINDOW = 3600  # 1 hour
MAX_RESET_PER_IP = 30
MAX_RESET_PER_IDENTIFIER = 5


def _check_reset_rate_limit(client_ip: str, identifier: str):
    now = time.time()
    _reset_ip_attempts[client_ip] = [t for t in _reset_ip_attempts[client_ip] if now - t < RESET_RATE_WINDOW]
    _reset_identifier_attempts[identifier] = [t for t in _reset_identifier_attempts[identifier] if now - t < RESET_RATE_WINDOW]

    # Enforce per-identifier limit (5 requests per account/email per hour)
    if len(_reset_identifier_attempts[identifier]) >= MAX_RESET_PER_IDENTIFIER:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests for this account. Please check your inbox or try again later.",
        )

    # Enforce per-IP limit for external clients
    is_loopback = client_ip in ("127.0.0.1", "::1", "localhost", "testclient")
    if not is_loopback and len(_reset_ip_attempts[client_ip]) >= MAX_RESET_PER_IP:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests from this network. Please try again later.",
        )

    _reset_ip_attempts[client_ip].append(now)
    _reset_identifier_attempts[identifier].append(now)


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    clean_identifier = req.email.strip().lower()
    client_ip = request.client.host if request.client else "unknown"

    # Enforce rate limiting per IP and per identifier
    _check_reset_rate_limit(client_ip, clean_identifier)

    # Generic response returned to user regardless of account existence to prevent enumeration
    generic_response = {
        "message": "If an account exists for this email or username, a temporary password has been sent to your registered email address."
    }

    if not clean_identifier:
        return generic_response

    # Look up real account by email or name (case-insensitive)
    from sqlalchemy import func
    user = db.query(User).filter(
        (func.lower(func.trim(User.email)) == clean_identifier) |
        (func.lower(func.trim(User.name)) == clean_identifier)
    ).first()

    if not user:
        # Account not found: do nothing to DB, do not send email, return identical generic response
        return generic_response

    # Generate cryptographically secure random temporary password (sufficient entropy)
    temp_password = generate_temporary_password(length=12)

    # Hash temporary password using argon2 / bcrypt (NEVER store plaintext)
    user.password_hash = hash_password(temp_password)
    user.must_change_password = True
    user.temp_password_expires = datetime.utcnow() + timedelta(hours=1)
    user.updated_at = datetime.utcnow()
    db.commit()

    # Dispatch branded email containing the temporary password
    send_temporary_password_email(
        recipient_email=user.email,
        recipient_name=user.name,
        temporary_password=temp_password,
        expiry_hours=1,
    )

    return generic_response


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.reset_token == req.token,
        User.reset_token_expires > datetime.utcnow(),
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.password_hash = hash_password(req.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    user.must_change_password = False
    user.temp_password_expires = None
    user.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Password reset successfully"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return _user_response(current_user)


@router.put("/me")
async def update_profile(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed = {"name", "phone", "language"}
    for key, val in data.items():
        if key in allowed and val is not None:
            setattr(current_user, key, val)
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return _user_response(current_user)


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.auth.security import verify_password
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
    current_user.password_hash = hash_password(req.new_password)
    current_user.must_change_password = False
    current_user.temp_password_expires = None
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return {
        "message": "Password changed successfully",
        "user": _user_response(current_user),
    }


def _user_response(user: User) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role.value,
        "profile_image": user.profile_image,
        "language": user.language,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "must_change_password": bool(getattr(user, "must_change_password", False)),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }
