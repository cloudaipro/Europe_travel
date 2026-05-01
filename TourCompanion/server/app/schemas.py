from datetime import date, datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str = ""


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    display_name: str


class StopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    order_idx: int
    time_label: str
    name: str
    address: str
    lat: float | None
    lng: float | None
    hours: str
    tickets: str
    intro: str
    highlights: list
    transit: str
    washroom: str
    food: list
    note: str
    check_in_count: int = 0
    photo_paths: list[str] = []
    voice_transcript: str = ""


class DayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    n: int
    date_label: str
    theme: str
    mode: str
    stops: list[StopOut]


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    label: str
    url: str
    done: bool


class CompanionDocOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    file_path: str


class RouteAssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    day_n: int
    label: str
    pdf_path: str
    map_url: str


class StreetFoodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    slug: str
    name: str
    category: str
    lat: float | None
    lng: float | None
    address: str
    price_band: str
    price_huf: str
    locality_score: float
    why: str
    hours: str


class TripSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    destination: str
    start_date: date
    end_date: date
    status: str


class TripDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    destination: str
    start_date: date
    end_date: date
    status: str
    season: str
    style: str
    pace: str
    source_url: str
    hotel_name: str
    hotel_lat: float | None
    hotel_lng: float | None
    hotel_address: str
    journal: str
    days: list[DayOut]
    bookings: list[BookingOut]
    companion_docs: list[CompanionDocOut]
    routes: list[RouteAssetOut]
    street_food: list[StreetFoodOut]


class TripCreate(BaseModel):
    name: str
    destination: str
    start_date: date
    end_date: date
    season: str = ""
    style: str = ""
    pace: str = ""


class CheckInIn(BaseModel):
    lat: float | None = None
    lng: float | None = None


class JournalIn(BaseModel):
    journal: str


class VoiceNoteIn(BaseModel):
    transcript: str


class IngestIn(BaseModel):
    destination: str
    days: int
    source_url: str = ""
    style: str = ""


class IngestOut(BaseModel):
    job_id: str
    status: str
    message: str
