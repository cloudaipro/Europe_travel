from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import CurrentUser, hash_password, make_token, verify_password
from ..db import get_db
from ..models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=schemas.TokenOut)
def signup(payload: schemas.UserCreate, db: Annotated[Session, Depends(get_db)]):
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
    return schemas.TokenOut(access_token=make_token(u.id), user_id=u.id, email=u.email)


@router.post("/login", response_model=schemas.TokenOut)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
):
    user = db.query(User).filter_by(email=form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "bad credentials")
    return schemas.TokenOut(access_token=make_token(user.id), user_id=user.id, email=user.email)


@router.post("/login-json", response_model=schemas.TokenOut)
def login_json(payload: schemas.UserLogin, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter_by(email=payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "bad credentials")
    return schemas.TokenOut(access_token=make_token(user.id), user_id=user.id, email=user.email)


@router.get("/me", response_model=schemas.UserOut)
def me(user: CurrentUser):
    return user
