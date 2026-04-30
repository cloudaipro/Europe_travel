# Source Extraction

How to ingest each source type into a candidate list of stops.

## YouTube playlist

Run the bundled extractor:

```bash
python3 scripts/extract_youtube_playlist.py "<playlist URL>"
```

It outputs JSON to stdout:

```json
[
  {"videoId": "Ae7v5j1r-I8", "title": "Hungarian Parliament Building Travel Tips"},
  {"videoId": "O1bfcTIT2SM", "title": "St. Stephen's Basilica - Liberty Square"},
  ...
]
```

The script handles:

- Resolving short URLs (`youtu.be/...`) and various playlist URL formats
- The `playlistVideoRenderer` JSON pattern in YouTube's HTML response
- A reasonable User-Agent so YouTube doesn't return a stripped page

After extraction, parse the titles. Most playlists have noisy titles with hashtags, channel branding, and language tags. You want the **landmark name** in each title. A simple heuristic:

- Strip leading/trailing emoji and `【...】` brackets
- Strip hashtag clusters (`#abc #def #ghi`)
- Strip the channel/series tag (often the last `｜...` segment)
- Strip city/country tags that repeat across every video

What's left is usually the landmark name. If a title is in two languages, prefer the local-language form for non-Latin scripts (it's more discoverable on Google Maps).

For the Hungary playlist that motivated this skill, 50 video titles produced ~30 unique landmark names plus practical guides (transport, scams, food streets) — exactly the candidate list you want.

## List of URLs

Use `web_fetch` per URL in parallel where possible. For each:

- If the response is HTML > 100 KB, save to a temp file and parse via `python3 -c` or `grep`. Don't try to read 1 MB of HTML into context.
- Extract: page title (`<title>`, `og:title`), meta description, any `<h1>` / `<h2>` headings, and embedded landmark names.
- For travel-blog URLs, the landmark names are usually the headings.
- For booking-site URLs (TripAdvisor, GetYourGuide), the page title is usually the landmark name.

If a fetch fails (403, 404, blocked domain), don't retry the same URL — drop it and continue. Note in the breadcrumb at the top of the itinerary which sources fed in vs which failed.

## Uploaded files

PDF, DOCX, MD, TXT — read with the file tool. For PDFs > 10 pages, paginate (use the `pages` parameter on Read).

Extract:

- Headings (these are usually landmark names)
- Boldfaced names in body text
- Address lines (regex: street + number + postal-code pattern)
- Any explicit "must-see / top X" lists

Cross-reference what the user wrote in chat ("here's the guide my friend gave me") with the file content. The friend's annotations carry weight — these are personally vetted recommendations.

## Just a destination name

If the user only said "3 days in Budapest" with no source, you have two paths:

1. **Use your training knowledge** to populate candidates. This is faster but ungrounded.
2. **Search** for "must-see in <destination>" via WebSearch and parse the top 1–2 results for candidate names. Slower, more current.

Default to #1 unless the destination is small / niche / your training data is thin (a Romanian regional city, a Polynesian island). Then fall back to #2.

Be transparent in the breadcrumb: "Built from my own knowledge of <city>" vs "Built from <playlist URL>" vs "Built from your uploaded <file name>".

## Mixed sources

If the user gives a playlist *and* a list of URLs *and* uploads a guide, treat all three as input. Deduplicate by name. Where sources disagree (one calls a place a must-see, another doesn't mention it), keep it — the user can drop it later.

## What to do with the candidate list

Do *not* show the raw candidate list to the user. They gave you these sources to be processed, not echoed back. Move directly to Phase 2 (elicitation) and let the final itinerary be the surface they review.

Exceptions:

- If the source contained 50+ candidates (the Hungary playlist had 50), include a 1-line breadcrumb: "From your 50-video playlist, this plan uses 14 named stops; the rest are referenced as alternative options at the bottom."
- If a stop the user explicitly named in chat doesn't make the final cut, mention why in a footnote (closures, cluster mismatch, redundancy).
