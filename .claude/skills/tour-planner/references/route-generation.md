# Route Generation

When the user opts into route generation in Phase 2 (Question 4), this phase runs after the primary itinerary and companion docs are written. It produces one printable PDF per day plus a routes index, and (if Claude in Chrome is connected) opens each route in a tab so the user can review and save to their Google account.

## When to run this phase

- The user explicitly opted in via the elicitation question.
- The output mode is file-based (markdown or docx) — chat-only output skips routes since there's nowhere to put PDFs.
- The trip has at least one day with 3+ named stops worth routing (a single museum visit doesn't need a multi-stop map).

If any of those is missing, skip the phase and don't ask again.

## What gets produced

Inside the trip folder, a `routes/` subfolder containing:

```
routes/
├── Day_1_<DayName>_<Date>_route.pdf
├── Day_2_<DayName>_<Date>_route.pdf
├── ...
└── routes_index.json
```

Each PDF is one page and contains:

- Day title + subtitle (theme of the day)
- Mode (Walking / Transit + walking / etc.) and a distance + time estimate
- A short summary of the day's geographic flow
- A numbered table of stops with their addresses
- A QR code that decodes to the live Google Maps directions URL
- The clickable URL underneath the QR code
- A footer noting it pairs with the primary itinerary

The QR code is the operational core — a user can print the PDF, fold it in their pocket, and scan with their phone camera in town to get turn-by-turn navigation. The clickable URL is the desktop fallback.

`routes_index.json` is a structured list that the markdown itinerary's "Route maps" section can link to and that future tools (a budget script, a printable companion summary, etc.) can read to discover the day's routes.

## Step-by-step

### Step 1 — Build the per-day stops list

Re-read the primary itinerary you just produced and extract one ordered list per day. A day's list should typically include 4–8 named stops including origin and destination. Skip stops that are sub-actions of a larger stop (e.g., "find Kolodko mini-statue near Vörösmarty tér" is a sub-action of "Vörösmarty tér walk"). Skip lunch/coffee fillers unless they're meaningful waypoints.

For each stop, record:

- **Display name** (used in the PDF table) — e.g., "Hungarian Parliament Building"
- **Address line** — full street address with postal code where known
- **Search query for Google Maps** — usually the display name + city, but if the stop has a famous unambiguous name use just that name. *Avoid* generic names that Google may misresolve to a different city (e.g., "Lánchíd Söröző" without a city qualifier resolved to a Budapest restaurant when we wanted Szentendre). When in doubt, append the city/town/district name as a disambiguator.

Decide travel mode per day: `walking` for compact urban days, `transit` for cross-city days with metro/tram, `driving` only for road trips.

### Step 2 — Construct the Google Maps directions URLs

Format:

```
https://www.google.com/maps/dir/<Origin>/<Stop1>/<Stop2>/.../<Destination>/?travelmode=<walking|transit|driving>
```

Each stop is URL-encoded. Use `urllib.parse.quote()` (Python) — don't roll your own escaper.

Origin and destination should typically be the user's hotel or a transit hub (e.g., "Astoria, Budapest" or "Szentendre HÉV Station"). If it's a Szentendre-style day trip, origin and destination are both inside the day-trip town (the HÉV station), not Budapest — otherwise the route gets distorted by the long inter-city leg.

### Step 3 — Open in Claude in Chrome (optional)

If the Claude in Chrome connector is available, open each route in a tab so the user can:

- Review that Google Maps resolved each stop to the right place (Google's autocomplete sometimes picks the wrong city for ambiguous names).
- Click the share icon to "Send directions to phone" or use the Save button to add to their Google account (only works when they're signed in).

Workflow:

```python
# Pseudocode — adapt to actual tool calls
list_browsers()                    # find Chrome
select_browser(deviceId)
ctx = tabs_context_mcp(create=True)
tabId = ctx.availableTabs[0].tabId

for day in days:
    navigate(tabId, day.url)
    wait(6)                        # Maps takes ~6 sec to render the route
    screenshot(tabId, save=True)   # capture the resolved map for verification
    if not last_day:
        tabId = tabs_create_mcp()
```

If a stop got misresolved (you'll see it in the screenshot when the path zigzags out of the expected area), rebuild the URL with a more disambiguated query and re-navigate that tab.

**You cannot save routes to the user's Google account on their behalf** — that requires their login, which is a privacy boundary you must respect. Tell the user how to save manually (click share → send-to-phone, or sign in and click Save).

### Step 4 — Generate the PDFs

Run the bundled script:

```bash
python3 scripts/build_route_pdfs.py <output_dir> <routes_json>
```

Where `<routes_json>` is a JSON file you write with this shape:

```json
[
  {
    "slug": "Day_1_Friday_May22",
    "title": "Day 1 — Friday, May 22, 2026",
    "subtitle": "Arrival → Pest Icons → Sunset Cruise",
    "summary": "Half-day Pest icon walk ending at the 20:30 sunset cruise.",
    "mode": "Walking",
    "estimated": "~4 km on foot · ~1h 45m walking + sightseeing",
    "stops": [
      {"name": "Astoria (hotel)", "address": "Kossuth Lajos u. 19, 1053 Budapest"},
      {"name": "Shoes on the Danube Bank", "address": "Id. Antall József rkp., 1054 Budapest"}
    ],
    "url": "https://www.google.com/maps/dir/.../?travelmode=walking"
  }
]
```

The script writes one PDF per entry plus `routes_index.json` to the output directory.

### Step 5 — Cross-link the itinerary

Insert a "Route maps" section near the top of the primary itinerary (after the at-a-glance table, before "Practical basics"). Format:

```markdown
## Route maps (Google Maps + printable PDFs)

A multi-stop Google Maps route was built for each day and saved as a one-page PDF in [`routes/`](routes/). Each PDF contains the stops list with addresses, transit/walking estimate, the live Google Maps URL, and a QR code so you can tap-to-navigate from a printed copy.

| Day | Theme | Live route | Printable PDF |
|-----|-------|-----------|---------------|
| 1 — <date> | <theme> | [Open in Google Maps](<url>) | [Day 1 route PDF](routes/Day_1_..._route.pdf) |
| 2 — <date> | ... | ... | ... |

**To save these routes inside your Google account**: open each route URL in Chrome while signed in, click the share icon, then **Send directions to your phone** — they sync to Google Maps on your device.
```

Include a short note explaining you can't sign in on the user's behalf.

## Common pitfalls

- **Wrong city autocomplete.** Google Maps frequently picks a Budapest establishment when the user wanted a Szentendre one (and vice versa for any twin-named place). Always include the city/town in the search query for non-Budapest stops on a day-trip route.
- **Too many waypoints.** Google Maps caps directions at 10 waypoints on the web. If a day has more, group sub-stops into a single waypoint (e.g., "Castle Hill area" instead of 4 separate Castle Hill landmarks) or split into morning/afternoon routes.
- **Cross-river zig-zag.** Budget at most one Danube crossing per day route. Buda + Pest in one route always zigzags poorly.
- **Failure to verify resolution.** When Chrome is connected, screenshot each route and look at it. The map line should follow a coherent path. If it shoots off to a distant suburb, fix the offending waypoint.
- **No QR code library.** The PDF script uses `qrcode` Python package. If it's not installed, `pip install qrcode --break-system-packages` first. The script will surface a clear error if missing.

## What this phase explicitly does NOT do

- Sign into the user's Google account.
- Print PDFs to a physical printer.
- Generate static map images embedded in the PDF (the QR code + URL is the canonical link to the live, current map).
- Build offline maps. Suggest **Google Maps' "Download offline area"** to the user as a separate manual step if they're worried about data.
