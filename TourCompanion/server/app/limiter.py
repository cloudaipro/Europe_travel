"""SlowAPI limiter shared across routes."""
from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.rate_default],
)
