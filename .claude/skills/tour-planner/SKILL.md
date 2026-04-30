---
name: tour-planner
description: Plan multi-day travel itineraries from user-provided source materials (YouTube playlists, lists of URLs, uploaded PDFs/docs, or named destinations) and produce a polished primary itinerary plus optional companion documents (food guide, packing list, phrasebook, budget tracker). Use this skill whenever the user wants to plan a trip, build a travel itinerary, organize a tour, or prepare a vacation — especially when they reference source materials like "this playlist", "these videos", or "this guide", give a destination plus duration ("3 days in Budapest", "a week in Tokyo"), or ask for travel documents. The skill applies a research-grounded methodology — geographic clustering, anchor + filler pacing, energy-curve sequencing, per-stop transit/washroom/food layering, closure validation, and asset localization — that produces itineraries usable on a phone in the rain. Trigger this even when the user only says "plan my trip" without explicitly asking for a "skill" or "tour planner".
---

# Tour Planner

A research-grounded travel-itinerary builder. Given source material (a playlist, URLs, uploads) and trip parameters (dates, style, group), it produces a phone-readable itinerary plus optional companion documents.

This skill is designed to be invoked once per trip. The same workflow applies whether the user gives a YouTube playlist, a list of bookmarked URLs, a single destination name, or a stack of uploaded PDFs.

## When to use this skill

Trigger on any of these signals (do not wait for the user to name "tour planner" or "skill"):

- "Plan a 3-day trip to ___" / "build me an itinerary for ___"
- "Use this playlist: ___" + travel context
- "Here are some links / a guide PDF / my saved bookmarks — turn it into a plan"
- "I'm going to ___ for ___ days — what should I do?"
- "Help me prepare for my trip"
- "Make me a travel document for ___"

## The 6-phase workflow

Run these phases in order. Each phase has a small reference file with the detail you need. Read the reference inline when you reach that phase — don't try to memorize everything upfront.

### Phase 1 — Source ingestion

Extract candidate stops from whatever the user gave you. Source priority is **what the user provided** > what you know from training. The user's curation is signal, not noise — even if you'd rank attractions differently, respect the source's emphasis.

Source types and how to handle each:

- **YouTube playlist URL** → run `scripts/extract_youtube_playlist.py <url>` to get a JSON list of `{videoId, title}`. Parse the titles for landmark names. The script is self-contained Python — no setup needed.
- **List of URLs** → fetch each with web_fetch; for each, extract the page title, any landmark names mentioned, and the meta description. Watch for redirects and length limits — if a fetch dumps to a temp file, parse it via grep/python rather than reading the whole thing.
- **Uploaded files** (PDF, DOCX, MD, TXT) → read them directly with the file tool. Pull out place names, addresses, and any embedded recommendations.
- **Just a destination name** ("3 days in Budapest") → there is no source to extract; skip to Phase 2 and rely on your own knowledge for candidates.

After ingestion, write a short candidate list to scratch space. Don't show the user the raw list — they'll judge it best after Phase 4 sequencing.

For details on each source type, see [references/source-extraction.md](references/source-extraction.md).

### Phase 2 — Constraint elicitation

Travelers don't know they're under-specifying until you ask. Use the AskUserQuestion tool (or inline questions if unavailable) to ask **at most 4 questions** in a single batch. Asking more than 4 fatigues the user; asking fewer than 3 leaves the plan generic.

The four canonical questions, adapt phrasing per destination:

1. **When are they going?** Season-aware planning matters: cherry blossoms, Christmas markets, Aug 20 St. Stephen's Day, monsoon, off-season museum hour reductions.
2. **What style of trip?** Classic highlights / foodie / quirky-hidden / mixed. This determines anchor selection.
3. **Pace and day-trip openness?** Slow vs balanced vs intense, and whether they want to leave the base city for a day.
4. **Output format?** Markdown / DOCX / both / chat-only. Pin this early so you don't rebuild later.

Skip questions whose answers are already in the conversation. Don't ask for budget unless the user signaled they care — tier hints (budget tips alongside premium options) cover most cases.

For the full elicitation playbook including secondary questions (mobility, dietary, group composition), see [references/elicitation.md](references/elicitation.md).

### Phase 3 — Candidate scoring & geographic clustering

Score each candidate stop on three axes:

- **Source weight**: how prominently it featured in the user's source (0–3)
- **Style match**: how well it fits the user's stated style (0–3)
- **Anchor potential**: timed/ticketed / iconic / signature view = high (0–3); flexible filler = low

Then **cluster by neighborhood**, not by score. Academic research on tourist trip design problems consistently shows geographic clustering is the dominant approach — *"a tourist should not leave a neighborhood before visiting all its specified locations"*. Drop pins on a mental map; group stops by walking-distance zones (10 min walk apart = same cluster). One cluster = roughly one half-day.

The number of days available × pace setting tells you how many anchors to pick:

| Pace      | Anchors per day | Fillers per day | Free time |
|-----------|-----------------|-----------------|-----------|
| Slow      | 1               | 1–2             | Long      |
| Balanced  | 2               | 2–3             | Moderate  |
| Intense   | 3               | 2–4             | Minimal   |

Anchors are the timed/booked sights (Parliament tour, Hospital in the Rock, a thermal bath). Fillers are flexible (a café, a square, a viewpoint, a market browse) that flex with mood and weather. **Always include at least one indoor filler per day** as a weather hedge.

For more on pacing math, anchor selection, and clustering heuristics, see [references/methodology.md](references/methodology.md).

### Phase 4 — Day-by-day sequencing

For each cluster (= day), sequence within the day along the **energy curve**:

- **Morning (08:00–12:00)** — energy-intensive items: timed museum tours, hikes, the busiest landmark before crowds.
- **Lunch (12:00–14:00)** — local restaurant, market hall, or a long café sit. Hungarians eat their main hot meal at lunch; Spaniards delay it; Japanese expect prompt 12:00 lines. Match the destination.
- **Afternoon (14:00–18:00)** — medium-effort: scenic walks, a single museum, photo loops, shopping.
- **Late afternoon / sunset (17:00–20:00)** — relaxation cued to golden hour: rooftop bar, viewpoint, thermal bath, riverside walk.
- **Dinner (19:00–22:00)** — second meal anchor; book if the spot needs reservations.
- **Evening (after 21:00)** — optional nightlife, ruin bar, night cruise, illuminated landmarks.

Sequencing rules:

- Match the destination's local rhythm. Spanish 21:30 dinners ≠ German 18:30 dinners.
- Avoid back-to-back museums (museum fatigue is a documented effect; cap at 1 heavy museum/day).
- Pair indoor + outdoor in every day so weather doesn't kill the plan.
- Respect closures: many European museums close Mondays, many traditional restaurants close Sundays, religious sites close during services. Validate before committing.
- Front-load timed/ticketed items; leave the flexible filler later.

### Phase 5 — Per-stop layering

This is the difference between a brochure and a usable itinerary. **Every stop** in the final document gets a uniform info block. Skipping any of these breaks the doc on a rainy phone screen.

Mandatory fields per stop:

- **Address** (full, including postal code where possible)
- **Map link** (`https://maps.google.com/?q=...`)
- **Hours** (and seasonal variation if relevant)
- **Tickets / booking** (price, whether to book ahead, where)
- **Brief intro** (2–4 sentences — the *why*, not just the what)
- **Highlights & tips** (3–5 bullets, including non-obvious tactics — best photo angle, free-entry windows, the line behind the line)
- **Get there** (transit from the previous stop, with line numbers and walking time)
- **Nearest washroom** (free vs paid, where, currency for paid WCs)
- **Quick bite nearby** (2–3 specific named options at different price points)
- **Image** (locally hosted — see Phase 6 on assets)

For the exact template and worked examples, see [references/per-stop-template.md](references/per-stop-template.md).

### Phase 6 — Companion documents & asset localization

Decide which companion documents to produce. Defaults:

- Trip ≥ 2 days → **food guide** (cuisine intro, dishes, where to find them, comparison table)
- Trip ≥ 3 days OR foreign language destination → **phrasebook** (10–20 useful phrases with phonetics)
- User flagged "first international trip" or asked "what to bring" → **packing list**
- User mentioned budget concern → **budget tracker** with daily targets

Always offer the user the choice — don't generate companion docs they didn't ask for unless they're trivially small.

For each companion doc's exact structure, see [references/companion-docs.md](references/companion-docs.md).

**Asset localization** — images:

- Markdown previewers often refuse remote URLs. Always download images to a local `images/` folder and reference them with relative paths (`images/01_parliament.jpg`).
- Wikimedia/Wikipedia thumbnails block automated downloads and return HTML errors with a 200 status — they look successful but are not images. Use Pexels via `scripts/fetch_images_pexels.py` instead. The script handles UA spoofing and binary download.
- Verify with `file <path>` after download — proper images show `JPEG image data ...`. If you see `HTML document`, the download failed silently.

**Cross-linking** — the itinerary references companion docs; companion docs back-link to the itinerary. Use relative paths.

## Output structure

The user's workspace folder should end up with this layout:

```
trip_folder/
├── <Destination>_<N>_Day_Itinerary.md   # the primary doc
├── food.md                              # if applicable
├── phrasebook.md                        # if applicable
├── packing_list.md                      # if applicable
├── budget.md                            # if applicable
└── images/
    ├── 01_*.jpg                         # one per major stop
    └── food_*.jpg                       # if food guide produced
```

Save the primary itinerary first, then companion docs, then download all images last (so the doc structure is reviewable even if downloads fail).

## Invocation hygiene

- **Don't dump the candidate list** — the user gave you sources to be processed, not echoed back.
- **Don't ask permission for every action** — Phase 2 is the only mandatory user touch-point. Plan, generate, download, save, then present.
- **Quote prices in local currency** with a rough USD/EUR equivalent if the destination is unfamiliar.
- **Times in 24h format** — less ambiguous on a tired phone screen.
- **Validate before claiming** — if you say "Mon closed", confirm via web search; if you assert a price, mark it "approx" or year-tag it. Bad facts are worse than no facts.
- **Leave breadcrumbs** — at the top of the itinerary, note the source playlist/URLs you used so the user can verify.

## Reference index

When you reach a phase that needs depth, read the corresponding reference file:

- [references/source-extraction.md](references/source-extraction.md) — Phase 1: extracting from playlists, URLs, uploads
- [references/elicitation.md](references/elicitation.md) — Phase 2: clarifying questions and when to skip them
- [references/methodology.md](references/methodology.md) — Phase 3: pacing math, clustering, anchor scoring (research-grounded)
- [references/per-stop-template.md](references/per-stop-template.md) — Phase 5: the exact stop block format with examples
- [references/companion-docs.md](references/companion-docs.md) — Phase 6: food guide, phrasebook, packing list, budget templates

Bundled scripts:

- [scripts/extract_youtube_playlist.py](scripts/extract_youtube_playlist.py) — playlist URL → JSON list of videos
- [scripts/fetch_images_pexels.py](scripts/fetch_images_pexels.py) — landmark name → downloaded JPEG in your images folder
