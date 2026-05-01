from datetime import datetime, date
from sqlalchemy import (
    String, Integer, Float, Date, DateTime, ForeignKey, Text, Boolean, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    trips: Mapped[list["Trip"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    email_tokens: Mapped[list["EmailToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class EmailToken(Base):
    __tablename__ = "email_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(20))  # "verify" | "reset"
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="email_tokens")


class Trip(Base):
    __tablename__ = "trips"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    destination: Mapped[str] = mapped_column(String(120))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="planning")
    season: Mapped[str] = mapped_column(String(40), default="")
    style: Mapped[str] = mapped_column(String(100), default="")
    pace: Mapped[str] = mapped_column(String(40), default="")
    source_url: Mapped[str] = mapped_column(String(500), default="")
    hotel_name: Mapped[str] = mapped_column(String(200), default="")
    hotel_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    hotel_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    hotel_address: Mapped[str] = mapped_column(String(300), default="")
    journal: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owner: Mapped[User] = relationship(back_populates="trips")
    days: Mapped[list["Day"]] = relationship(back_populates="trip", cascade="all, delete-orphan", order_by="Day.n")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="trip", cascade="all, delete-orphan")
    companion_docs: Mapped[list["CompanionDoc"]] = relationship(back_populates="trip", cascade="all, delete-orphan")
    routes: Mapped[list["RouteAsset"]] = relationship(back_populates="trip", cascade="all, delete-orphan")
    street_food: Mapped[list["StreetFood"]] = relationship(back_populates="trip", cascade="all, delete-orphan")


class Day(Base):
    __tablename__ = "days"
    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    n: Mapped[int] = mapped_column(Integer)
    date_label: Mapped[str] = mapped_column(String(40), default="")
    theme: Mapped[str] = mapped_column(String(255), default="")
    mode: Mapped[str] = mapped_column(String(60), default="")

    trip: Mapped[Trip] = relationship(back_populates="days")
    stops: Mapped[list["Stop"]] = relationship(back_populates="day", cascade="all, delete-orphan", order_by="Stop.order_idx")


class Stop(Base):
    __tablename__ = "stops"
    id: Mapped[int] = mapped_column(primary_key=True)
    day_id: Mapped[int] = mapped_column(ForeignKey("days.id", ondelete="CASCADE"), index=True)
    order_idx: Mapped[int] = mapped_column(Integer, default=0)
    time_label: Mapped[str] = mapped_column(String(20), default="")
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(300), default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    hours: Mapped[str] = mapped_column(String(255), default="")
    tickets: Mapped[str] = mapped_column(String(255), default="")
    intro: Mapped[str] = mapped_column(Text, default="")
    highlights: Mapped[list] = mapped_column(JSON, default=list)
    transit: Mapped[str] = mapped_column(Text, default="")
    washroom: Mapped[str] = mapped_column(Text, default="")
    food: Mapped[list] = mapped_column(JSON, default=list)
    note: Mapped[str] = mapped_column(Text, default="")

    day: Mapped[Day] = relationship(back_populates="stops")
    check_ins: Mapped[list["CheckIn"]] = relationship(back_populates="stop", cascade="all, delete-orphan")
    photos: Mapped[list["Photo"]] = relationship(back_populates="stop", cascade="all, delete-orphan")
    voice_notes: Mapped[list["VoiceNote"]] = relationship(back_populates="stop", cascade="all, delete-orphan")


class CheckIn(Base):
    __tablename__ = "check_ins"
    id: Mapped[int] = mapped_column(primary_key=True)
    stop_id: Mapped[int] = mapped_column(ForeignKey("stops.id", ondelete="CASCADE"), index=True)
    visited_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    stop: Mapped[Stop] = relationship(back_populates="check_ins")


class Photo(Base):
    __tablename__ = "photos"
    id: Mapped[int] = mapped_column(primary_key=True)
    stop_id: Mapped[int] = mapped_column(ForeignKey("stops.id", ondelete="CASCADE"), index=True)
    path: Mapped[str] = mapped_column(String(500))
    caption: Mapped[str] = mapped_column(String(500), default="")
    taken_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    stop: Mapped[Stop] = relationship(back_populates="photos")


class VoiceNote(Base):
    __tablename__ = "voice_notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    stop_id: Mapped[int] = mapped_column(ForeignKey("stops.id", ondelete="CASCADE"), index=True)
    transcript: Mapped[str] = mapped_column(Text, default="")
    audio_path: Mapped[str] = mapped_column(String(500), default="")
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    stop: Mapped[Stop] = relationship(back_populates="voice_notes")


class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(300))
    url: Mapped[str] = mapped_column(String(500), default="")
    done: Mapped[bool] = mapped_column(Boolean, default=False)

    trip: Mapped[Trip] = relationship(back_populates="bookings")


class CompanionDoc(Base):
    __tablename__ = "companion_docs"
    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    file_path: Mapped[str] = mapped_column(String(500), default="")

    trip: Mapped[Trip] = relationship(back_populates="companion_docs")


class RouteAsset(Base):
    __tablename__ = "route_assets"
    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    day_n: Mapped[int] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(String(255))
    pdf_path: Mapped[str] = mapped_column(String(500), default="")
    map_url: Mapped[str] = mapped_column(String(500), default="")

    trip: Mapped[Trip] = relationship(back_populates="routes")


class IngestJob(Base):
    __tablename__ = "ingest_jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued|running|done|failed
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict)
    result_trip_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error: Mapped[str] = mapped_column(Text, default="")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class StreetFood(Base):
    __tablename__ = "street_food"
    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    slug: Mapped[str] = mapped_column(String(80))
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(60))
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    address: Mapped[str] = mapped_column(String(300))
    price_band: Mapped[str] = mapped_column(String(20))
    price_huf: Mapped[str] = mapped_column(String(60))
    locality_score: Mapped[float] = mapped_column(Float, default=0.0)
    why: Mapped[str] = mapped_column(Text, default="")
    hours: Mapped[str] = mapped_column(String(200), default="")

    trip: Mapped[Trip] = relationship(back_populates="street_food")
