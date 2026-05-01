import secrets
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import CurrentUser, hash_password, make_token, verify_password
from ..config import settings
from ..db import get_db
from ..limiter import limiter
from ..mailer import send_reset_email, send_verify_email
from ..models import EmailToken, User

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def _issue_email_token(db: Session, user: User, kind: str) -> str:
    if kind == "verify":
        ttl = timedelta(hours=settings.verify_token_ttl_hours)
    elif kind == "reset":
        ttl = timedelta(minutes=settings.reset_token_ttl_minutes)
    else:
        raise ValueError(f"unknown kind {kind}")
    tok = EmailToken(
        user_id=user.id, token=_new_token(), kind=kind,
        expires_at=datetime.utcnow() + ttl,
    )
    db.add(tok)
    db.commit()
    db.refresh(tok)
    return tok.token


@router.post("/signup", response_model=schemas.TokenOut)
@limiter.limit(settings.rate_signup)
def signup(
    request: Request,
    payload: schemas.UserCreate,
    db: Annotated[Session, Depends(get_db)],
):
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "email taken")
    u = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name or payload.email.split("@")[0],
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    token = _issue_email_token(db, u, "verify")
    try:
        send_verify_email(u.email, token)
    except Exception:
        # never let email failure block signup
        pass
    return schemas.TokenOut(access_token=make_token(u.id), user_id=u.id, email=u.email)


def _check_login_grace(user: User) -> None:
    """Reject login if email not verified AND grace window elapsed."""
    if user.email_verified_at:
        return
    grace_end = user.created_at + timedelta(days=settings.verify_grace_days)
    if datetime.utcnow() > grace_end:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "email not verified — verification grace period expired",
        )


@router.post("/login", response_model=schemas.TokenOut)
@limiter.limit(settings.rate_login)
def login(
    request: Request,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
):
    user = db.query(User).filter_by(email=form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "bad credentials")
    _check_login_grace(user)
    return schemas.TokenOut(access_token=make_token(user.id), user_id=user.id, email=user.email)


@router.post("/login-json", response_model=schemas.TokenOut)
@limiter.limit(settings.rate_login)
def login_json(
    request: Request,
    payload: schemas.UserLogin,
    db: Annotated[Session, Depends(get_db)],
):
    user = db.query(User).filter_by(email=payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "bad credentials")
    _check_login_grace(user)
    return schemas.TokenOut(access_token=make_token(user.id), user_id=user.id, email=user.email)


@router.get("/me", response_model=schemas.UserOut)
def me(user: CurrentUser):
    return user


@router.post("/verify")
def verify_email(payload: schemas.VerifyIn, db: Annotated[Session, Depends(get_db)]):
    tok = db.query(EmailToken).filter_by(token=payload.token, kind="verify").first()
    if not tok or tok.used_at or tok.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid or expired token")
    user = db.get(User, tok.user_id)
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "user gone")
    user.email_verified_at = datetime.utcnow()
    tok.used_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "verified_at": user.email_verified_at.isoformat()}


@router.post("/resend-verification")
@limiter.limit(settings.rate_signup)
def resend_verification(
    request: Request,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    if user.email_verified_at:
        return {"ok": True, "already_verified": True}
    token = _issue_email_token(db, user, "verify")
    try:
        send_verify_email(user.email, token)
    except Exception:
        pass
    return {"ok": True}


@router.post("/forgot")
@limiter.limit(settings.rate_forgot)
def forgot(
    request: Request,
    payload: schemas.ForgotIn,
    db: Annotated[Session, Depends(get_db)],
):
    """Always returns 200 — never reveals whether email exists."""
    user = db.query(User).filter_by(email=payload.email).first()
    if user:
        token = _issue_email_token(db, user, "reset")
        try:
            send_reset_email(user.email, token)
        except Exception:
            pass
    return {"ok": True}


@router.post("/reset")
def reset(payload: schemas.ResetIn, db: Annotated[Session, Depends(get_db)]):
    if len(payload.new_password) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "password too short")
    tok = db.query(EmailToken).filter_by(token=payload.token, kind="reset").first()
    if not tok or tok.used_at or tok.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid or expired token")
    user = db.get(User, tok.user_id)
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "user gone")
    user.password_hash = hash_password(payload.new_password)
    tok.used_at = datetime.utcnow()
    db.commit()
    return {"ok": True}
