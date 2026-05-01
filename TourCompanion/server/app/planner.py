"""Trip planner. Calls Anthropic to produce a structured itinerary JSON, falls
back to a deterministic mock when ANTHROPIC_API_KEY is unset (dev / CI)."""
import json
import logging
from datetime import date, timedelta

from .config import settings

log = logging.getLogger("planner")

SYSTEM_PROMPT = """\
You are a research-grounded travel itinerary builder. Given a destination, day
count, optional source URL/style, output a JSON object matching this schema:

{
  "name": "<short trip name>",
  "destination": "<city, country>",
  "season": "<short>",
  "style": "<short>",
  "pace": "Moderate|Slow|Intense",
  "hotel_name": "<plausible neighborhood/area>",
  "hotel_lat": 0.0, "hotel_lng": 0.0,
  "hotel_address": "<short>",
  "bookings": [{"label":"<thing to book before arrival>","url":"","done":false}],
  "days": [
    {
      "n": 1, "date_label": "Day 1", "theme": "<short>", "mode": "<Walking|Transit + walking|...>",
      "stops": [
        {
          "time_label": "09:00", "name": "<landmark>", "lat": 0.0, "lng": 0.0,
          "address": "<short>", "hours": "<short>", "tickets": "<HUF/EUR/etc>",
          "intro": "<1-2 sentence why this matters>",
          "highlights": ["<bullet>", "<bullet>"],
          "transit": "<how to get here from previous stop>",
          "washroom": "<paid/free + location>",
          "food": ["<nearby option>"]
        }
      ]
    }
  ]
}

Rules:
- 4-6 stops per day. Cluster geographically. Anchor + filler pacing.
- Realistic lat/lng for known landmarks (within 0.001 degrees of truth).
- Output ONLY the JSON object, no preamble, no code fences.
"""


def _mock_plan(destination: str, days: int, style: str) -> dict:
    """Deterministic placeholder when no API key is configured."""
    return {
        "name": f"{destination} {days}-day {style or 'mixed'} (mock)",
        "destination": destination,
        "season": "any",
        "style": style or "mixed",
        "pace": "Moderate",
        "hotel_name": "Centrally located hotel",
        "hotel_lat": 0.0, "hotel_lng": 0.0,
        "hotel_address": destination,
        "bookings": [
            {"label": f"Top museum tickets in {destination}", "url": "", "done": False},
            {"label": "Restaurant reservation for arrival night", "url": "", "done": False},
        ],
        "days": [
            {
                "n": i + 1, "date_label": f"Day {i + 1}",
                "theme": f"Mock day {i + 1}", "mode": "Walking",
                "stops": [
                    {
                        "time_label": f"{9 + 2*j:02d}:00",
                        "name": f"Mock stop {j+1} (day {i+1})",
                        "lat": 0.0, "lng": 0.0,
                        "address": destination,
                        "hours": "9:00–18:00",
                        "tickets": "Free",
                        "intro": f"Stub stop — replace with real planner output by setting ANTHROPIC_API_KEY.",
                        "highlights": ["mock highlight"],
                        "transit": "Walk",
                        "washroom": "Nearby café",
                        "food": ["Nearby spot"],
                    }
                    for j in range(4)
                ],
            }
            for i in range(days)
        ],
    }


def _strip_code_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        # ```json or ```
        t = t.split("\n", 1)[1] if "\n" in t else t[3:]
        if t.endswith("```"):
            t = t.rsplit("```", 1)[0]
    return t.strip()


def _call_anthropic(destination: str, days: int, source_url: str, style: str) -> dict:
    import anthropic
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    user_msg = (
        f"Destination: {destination}\n"
        f"Number of days: {days}\n"
        f"Style: {style or 'mixed'}\n"
        + (f"Source URL: {source_url}\n" if source_url else "")
        + "\nReturn the JSON object."
    )
    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=8000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    text = "".join(b.text for b in response.content if hasattr(b, "text"))
    text = _strip_code_fence(text)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        log.exception("Anthropic returned non-JSON; first 500 chars: %s", text[:500])
        raise ValueError(f"planner output not valid JSON: {e}") from e


def plan_trip(destination: str, days: int, source_url: str = "", style: str = "") -> dict:
    """Produce a Trip dict ready for DB insertion."""
    if days < 1 or days > 14:
        raise ValueError("days must be 1..14")
    if settings.anthropic_api_key:
        log.info("planner: calling anthropic for %s (%d days)", destination, days)
        plan = _call_anthropic(destination, days, source_url, style)
    else:
        log.warning("planner: ANTHROPIC_API_KEY not set — using mock")
        plan = _mock_plan(destination, days, style)

    # Annotate with start/end dates (default: starts today)
    start = date.today()
    plan.setdefault("start_date", start.isoformat())
    plan.setdefault("end_date", (start + timedelta(days=days - 1)).isoformat())
    plan.setdefault("source_url", source_url)
    return plan
