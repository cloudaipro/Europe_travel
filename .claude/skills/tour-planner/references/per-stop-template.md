# Per-Stop Template

Every stop in the final itinerary uses this exact block. Skipping any field breaks the doc on a phone screen in the rain — which is the actual deployment environment.

## The template

```markdown
### <Time-of-day> · <Stop Name> (<Local Name in Local Script if non-English>)

![<Stop Name>](images/NN_short_slug.jpg)

- **Address:** <street, postal code, city>
- **Map:** [Open in Google Maps](https://maps.google.com/?q=<URL-encoded query>)
- **Hours:** <day ranges and times, mention seasonal variation if relevant>
- **Tickets:** <price in local currency>; <booking notes if needed>

<2–4 sentence intro — the "why", not the "what". Lead with what makes this place specifically meaningful at this destination, in this season, for this kind of traveler. Pull from the user's source if possible.>

**Highlights & tips**
- <3–5 bullets, each one non-obvious. Best photo angle, free-entry windows, the line behind the line.>

**Practical info**
- **Get there:** <transit from previous stop — line numbers, walking time, or "walk N min from previous stop">
- **Nearest washroom:** <free vs paid, where; coin amount for paid WCs>
- **Quick bite nearby:** <2–3 specific named options at different price points or styles>
```

## Worked example (Budapest)

```markdown
### Morning · Hungarian Parliament Building (Országház)

![Hungarian Parliament](images/01_parliament.jpg)

- **Address:** Kossuth Lajos tér 1-3, 1055 Budapest
- **Map:** [Open in Google Maps](https://maps.google.com/?q=Hungarian+Parliament+Building+Budapest)
- **Hours:** Daily 8:00–18:00 (tour times vary by language)
- **Tickets:** ~10,000 HUF for non-EU visitors; book at jegymester.hu/parlament 1–2 weeks ahead

The third-largest parliament in the world and Budapest's defining silhouette — 691 rooms, 88 statues, and the Holy Crown of Hungary on display. The 50-minute guided interior tour walks you through the Grand Staircase, the dome hall (where the crown sits under armed guard), and the old Upper House Chamber.

**Highlights & tips**
- Arrive 30 min early for the changing of the guard outside the crown room (every hour on the hour).
- Best photo spot is across the river on the Buda side at Batthyány tér — come back for sunset.
- Don't miss the Kossuth Memorial and the Shoes on the Danube memorial just south along the embankment.

**Practical info**
- **Get there:** Metro M2 (red line) → Kossuth Lajos tér station — the exit lifts you up directly under the building.
- **Nearest washroom:** Free, clean toilets inside the Visitor Centre once you've passed security with your tour ticket. Outside: paid public WC (200 HUF) on the south side of Kossuth tér near the tram stop.
- **Quick bite nearby:** Kávézó in the Visitor Centre for coffee + sandwiches. For sit-down breakfast, Buja Disznók (Hold u. 13) — a 6-min walk south, serves langos for breakfast.
```

## Field-by-field rules

### Title line

`### <Time-of-day> · <Stop Name> (<Local Name>)`

Include the local-language name in parentheses for non-English destinations. It helps the user point at signs.

### Image

Always a relative path to `images/`. Number-prefix the filename so directory listings are sorted by visit order. Example: `images/05_new_york_cafe.jpg`.

If the image download failed, leave the markdown link in but note in the post-flight summary so the user knows to swap. Don't omit it — the alt-text still helps.

### Address

Full address including postal code where the country uses one. This is what they'll paste into a navigation app if Google Maps fails.

### Map link

`https://maps.google.com/?q=<URL-encoded landmark name + city>` works reliably across countries. Don't use coordinates — they're brittle if Google updates.

### Hours

State the open hours including the day-of-week pattern. If hours vary by season, write the relevant season's hours and parenthetically note the change. **Always note Monday closures** — they're the #1 closure trap.

### Tickets

Price in local currency, then booking guidance. If booking is required, include the URL. If a free-entry trick exists (Fisherman's Bastion before 9 AM), call it out here, not buried in tips.

### Intro

2–4 sentences. Lead with the *why*, not "this is X". Include one fact most travelers don't know — that's what justifies including the stop over a competitor. Don't over-write — the user will read this once.

### Highlights & tips

3–5 bullets max. Each bullet should pass this test: "Could a first-time guidebook reader figure this out themselves?" If yes, cut it. The value is in non-obvious tactics: free-entry windows, the lower turret being free 24/7, the "Kolodko diver" hidden in the basement window.

### Get there (transit)

Specify mode + line number/name + stop. Examples:

- "Metro **M2 (red line)** → Kossuth Lajos tér station"
- "**Tram 4/6** to **Oktogon**, then 4-min walk on Erzsébet körút"
- "Walk **15 min south down Váci utca** — pedestrian, no transit needed"
- "**Funicular** (Budavári Sikló) up the hill — or **Bus 16** from Deák tér to Dísz tér (5 min, included in your travel card; the funicular is extra and queues 30+ min in spring)"

When the line numbers are local-language characters, transliterate. When stops have unique names, prefer the unique name over generic "next stop".

### Nearest washroom

This is the field most guidebooks skip and travelers desperately need. Cover:

- Free WC if there is one (museums you've already paid for, restaurants you're a customer at, malls)
- Paid public WC and the coin amount expected
- The reliable-fallback workaround (any McDonald's, the metro station)

### Quick bite nearby

Two or three specifically named options at different price points. Avoid generic "lots of cafés on the street". Good shape:

- "**Lángos Sarok** at the upstairs corner of the Market Hall (1,800–3,500 HUF)"
- "**First Strudel House of Pest** (Október 6 u. 22) for handmade rétes"
- "Cheaper: any **Molnár's Kürtőskalács** stall on Váci utca for a chimney cake to walk with"

If the stop *is* a meal stop (a market hall, a restaurant), the "quick bite" line becomes "what to order here" instead.

## Multi-stop visits at the same location

For a complex location like Castle Hill (Royal Palace, Sándor Palace, Matthias Church, Fisherman's Bastion, Hospital in the Rock), use one transit-and-washroom block for the area, then individual stop blocks for the named sights. The transit block sits at the top of the area's day-section.

## Lunch and dinner stops

Treat these as full stops — they need the same fields. Address, hours, price range, what to order. Don't relegate restaurants to a footnote; they're often the most memorable part of the trip.

## Optional / weather-backup stops

Mark with a leading "Optional · " or "If raining · " prefix on the stop title. Use the same block format. The user reads from top to bottom on the day they need it.
