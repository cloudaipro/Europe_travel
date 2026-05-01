# Tour Companion — Application Design Plan

A unified travel app spanning the **three stages** of a trip:

1. **Planning** (before you go)
2. **Touring** (while you're there)
3. **Memory** (after you return)

Working name in this doc: **Tour Companion**. Final name TBD.

---

## 1. Why this app — and why nothing on the market quite does it

The 2026 market is fragmented across stages. Below is a distilled competitive scan.

### Planning stage incumbents

| App | Strength | Weakness |
|-----|----------|----------|
| **Wanderlog** | Collaborative day-by-day itinerary builder, drag-stops, map view, free for basics | Power features (offline, budget, email scan) paywalled at $40/yr; no in-trip nav/journal |
| **TripIt** | Forwarded-email booking parser, flight alerts (Pro $49/yr) | Bookings-only; doesn't help you decide *what* to do |
| **Roadtrippers** | Multi-stop road trips with offbeat attractions, fuel cost | US/Canada only; road-trip-shaped; no city travel |
| **Tripadvisor** | Reviews + booking aggregator | Crowded UX, ad-driven, weak itinerary tools |
| **AI planners (Tripstone, Layla)** | Conversational itinerary generation | Outputs become static lists; no live feedback loop |

### In-tour stage incumbents

| App | Strength | Weakness |
|-----|----------|----------|
| **Google Maps** | Best all-round; offline maps; place listings | **Offline mode kills public-transit routing** (massive in-trip pain) |
| **Citymapper** | Best transit experience in 80+ major cities | City-only; not built for itinerary or memory |
| **Maps.me / Organic Maps** | Offline OpenStreetMap, lightweight | No transit; UX dated; weak place data |
| **Rome2Rio** | "How do I get from A to B" across modes | One-shot lookup; no plan/journal |
| **Audio guides (Rick Steves, GuruWalk)** | Voice-guided walks at iconic sights | Per-walk, not whole-trip; not personalized |

### Memory stage incumbents

| App | Strength | Weakness |
|-----|----------|----------|
| **Polarsteps** | Automatic GPS route tracking, beautiful map of journey, printable book | Passive — no journaling depth; doesn't carry your *plan* in |
| **TripMemo** | Best balance: photos + map + journal + collaborative | Memory-first; planning module thin |
| **Day One** | Gold standard for long-form journaling | No travel-specific (no map, no auto-tag, no trip grouping) |
| **Journi / Travel Diaries** | Printable photo books | Manual entry; no carry-over from itinerary |

### The white space

**No mainstream app threads all three stages with one shared data model.** Travelers end up:

- Building a Wanderlog itinerary,
- Living in Google Maps + Citymapper + their phone camera roll mid-trip,
- Then re-entering everything into Polarsteps or a notebook to remember it,
- Losing 60–80% of the planning detail (which café, which tip, why this stop) along the way.

This app fixes that by making the **planning artifact the source of truth** that:
- Becomes the in-tour navigation script (your stops are already pinned, with offline fallback)
- Auto-collects in-tour artifacts (photos, GPS pings, voice notes) onto the right stop
- Hydrates a memory book at the end without any re-entry

---

## 2. The three stages — features and screens

### Stage 1 · Planning

**Job-to-be-done:** Turn loose intent ("3 days in Budapest, mixed style") into a confident, phone-ready plan.

**Core features:**
- **Source ingestion** — paste a YouTube playlist URL, drop in saved Maps lists, attach a guide PDF. (Powered by the `tour-planner` skill we already built.)
- **Conversational elicitation** — 4 quick questions: season, style, day-trip openness, output format/route generation.
- **Day-by-day itinerary** — generated as Markdown with the per-stop structure (address, hours, tickets, intro, highlights, transit, washroom, food).
- **Companion docs** — food guide, phrasebook, packing list, budget tracker (based on flags).
- **Google Maps routes** — one route per day, exported as a printable PDF with a QR code.
- **Booking flagging** — a checklist of items requiring advance reservation (Parliament, Hospital in the Rock, fine-dining).
- **Collaborative editing** — share an edit link, drag stops between days, comment.
- **Export** — Markdown, DOCX, PDF, single shareable link.

**Differentiator vs Wanderlog:** Built around Markdown-as-source so the plan is portable. AI ingest of source material (a playlist) instead of starting from blank.

### Stage 2 · Touring

**Job-to-be-done:** "Tell me where I am, what's next, and what I need to know — even if my phone is on 5%."

**Core features:**
- **Today view** — the current day's stops as a vertical timeline, with the current stop expanded.
- **One-tap navigate** — every stop has Navigate button → opens Google Maps with multi-stop directions pre-filled.
- **Offline first** — full itinerary + maps cached on first open; cell signal is a nice-to-have, not a requirement.
- **Stop check-in** — tap "I'm here" to log arrival; the app records GPS + timestamp + a tap-to-photo button.
- **Voice notes** — 30-second recordings tagged to the current stop.
- **Quick translate** — the phrasebook lives one tap away with TTS audio for ordering food, asking directions, emergency.
- **Live transit** — Citymapper-style next-train/bus surfacing for the current stop (when online).
- **Smart nudges** — "Parliament tour starts in 35 min — leave now (12 min walk)."
- **Companion screens** — washroom finder, currency converter, weather, tipping calculator.

**Differentiator vs Google Maps + Citymapper:** Knows your *plan*, not just your geography — the app proactively guides you through *your* itinerary, not just any nav query.

### Stage 3 · Memory

**Job-to-be-done:** "Without me having to type, give me a beautiful, accurate record of what I did."

**Core features:**
- **Auto-generated journey** — every check-in becomes a memory entry. Photos taken near each stop automatically attach.
- **Daily wrap** — at end of each day, a card auto-summarizes: stops visited, distance walked, photos taken, voice-note transcripts. User taps once to confirm or edit.
- **Map of the journey** — Polarsteps-style line showing every kilometer.
- **Stories view** — chronological photo grid with stop captions auto-filled from the itinerary.
- **Long-form journaling** — Day One-style for those who want to write more.
- **Print to book** — order a hardcover photo book (stretch goal — print-on-demand integration).
- **Searchable archive** — "what did I eat in Budapest" returns the right photos and notes.
- **Re-share** — public/friends-only link to the journey.

**Differentiator vs Polarsteps + Day One:** Zero re-entry. The plan + the in-tour check-ins build the memory automatically. Long-form journaling and printables are extras.

---

## 3. Data model — one shared schema across stages

The whole app runs on a single core schema:

```
Trip {
  id, name, destination, start_date, end_date, season, style, pace,
  source_links[], status: planning|touring|memory|archived,
  days[] -> Day,
  companion_docs[]: food | phrasebook | packing | budget
}

Day {
  id, trip_id, date, theme,
  stops[] -> Stop,
  route_url, route_pdf_path, route_mode,
  walked_km (touring), photos[] (touring)
}

Stop {
  id, day_id, order, time_of_day,
  name, local_name, address, postal_code, lat, lng,
  hours, tickets, intro, highlights[], tips[],
  transit_from_prev, washroom_note, food_nearby[], image_path,
  // touring data:
  visited_at, dwell_minutes, gps_pings[], photos[], voice_notes[],
  // memory data:
  user_caption, mood, rating
}
```

This schema is what the **tour-planner skill** already produces (mostly), so the planning → touring handoff is essentially free.

---

## 4. Tech stack

For the **prototype** (this engagement):

- **Single-file HTML SPA** — Vanilla JS + Tailwind CSS, all three stages in tabs.
- **State** — JavaScript object hydrated from JSON; uses memory-only state per Cowork constraint (no localStorage in artifacts).
- **Map view** — Leaflet.js with OpenStreetMap tiles (no API key needed).
- **Demo data** — Budapest 5-day itinerary, distilled from the markdown we already produced.
- **Mocked behaviors** — In-tour GPS, photo pickers, and voice notes are simulated; the demo shows the UI flow, not real device hardware.

For a **production version** (out of scope here, but informs design):

- React Native or Flutter (single codebase, iOS + Android, real GPS + camera)
- Firebase or Supabase for sync + auth + collaborative editing
- The tour-planner skill exposed as a backend service for AI planning
- Mapbox or Google Maps SDK for navigation
- Print-on-demand integration for memory books (Blurb, Mixbook, Photobook API)

---

## 5. Budapest demo data

The prototype uses your real Budapest 5-day trip (May 22–26, 2026):

- **Trip header:** "Budapest 5 Days — Spring 2026"
- **Days:** Day 1 arrival/cruise, Day 2 Parliament/Heroes/Bath, Day 3 Buda Castle/Gellért, Day 4 Market/Margaret Island, Day 5 Szentendre.
- **Stops:** ~30 named stops total, each with the full per-stop block (address, map, hours, tickets, transit, washroom, food).
- **Routes:** 5 Google Maps URLs + QR codes (already produced in `/routes/`).
- **Companion docs:** food.md, phrasebook.md, washrooms.md (already exist).
- **Mocked in-tour state:** Days 1–2 marked "completed" with sample photos; Day 3 marked "in progress" (current); Days 4–5 "upcoming".
- **Mocked memory state:** Auto-generated daily wrap cards for Days 1–2 with sample photos and a placeholder entry.

---

## 6. Screens to build (prototype scope)

**Header / nav** — three tabs: 📋 Plan · 🧭 Tour · 📔 Memory

**Plan tab**
- Trip card (title, dates, source playlist)
- Day-by-day accordion: each day expandable to show stops with the full per-stop block
- Side panel: companion docs links, route PDFs, booking checklist

**Tour tab**
- "Current day" header with a horizontal day-strip (Day 1 ✓, Day 2 ✓, Day 3 ●, Day 4 ⌛, Day 5 ⌛)
- Vertical timeline of today's stops with current one expanded
- Each stop has: Navigate, Check in, Photo, Voice note, Notes
- Floating quick-actions: phrasebook, washroom finder, currency

**Memory tab**
- Map of the journey (Leaflet, with the route line drawn)
- Daily wrap cards (one per completed day, photos + auto-caption)
- Long-form journal area (textarea, auto-saved to in-memory state)
- "Print to book" CTA (mocked — opens a confirmation modal)

---

## 7. Open questions (for you to answer before I build)

1. **Deliverable format** — Single-file HTML demo I can open in Chrome (Recommended), full design spec doc, both, or something else?
2. **Fidelity** — Functional prototype with real interactions on Budapest data (Recommended), or static screen mockups only?
3. **Scope of "build & test"** — Just the front-end UI flow, or include a working planning ingest that calls the tour-planner skill?
4. **Output location** — Save to your `Europe_travel/TourCompanion/` folder so it lives next to the Budapest data?

After your answers I'll build, test the demo with Claude in Chrome (walk through all three tabs, capture screenshots, fix issues), and hand back a single-file HTML you can open locally and share.

---

## Sources

- [Wanderlog vs TripIt 2026 — Tripstone](https://tripstone.app/blog/wanderlog-vs-tripit)
- [Wanderlog vs TripIt — Wanderlog blog](https://wanderlog.com/blog/2024/11/26/wanderlog-vs-tripit/)
- [Best Travel Apps 2026 — Polarsteps Stories](https://stories.polarsteps.com/stories/best-travel-apps)
- [Beyond Google Maps — offline transit, Medium 2026](https://medium.com/@tamirmelinek/beyond-google-maps-the-best-apps-for-offline-public-transport-navigation-in-2026-dbbcdf10b9bc)
- [12 Best Travel Journal Apps 2026 — TripMemo](https://tripmemo.app/best-travel-journal-apps)
- [Best Polarsteps Alternative 2026 — TripMemo](https://tripmemo.app/polarsteps-alternative)
- [Top 8 Roadtrippers Alternatives 2026 — Upper](https://www.upperinc.com/alternatives/roadtrippers/)
- [Tour Itinerary Methodology — JWU Pressbooks (used by tour-planner skill)](https://jwu.pressbooks.pub/responsibletourguiding/chapter/chapter-3-itinerary-planning-for-tour-guides/)
