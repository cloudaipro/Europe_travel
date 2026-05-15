# Architect Brief — Step 6: KG-3b Publish flow

---

## Step 6 — Wire the "Publish" pill to a real share-link flow

### Goal

Tapping the **Publish** pill in the mobile app bar (currently `disabled title="Coming soon"`) opens a small modal that generates a public read-only shareable URL for the current trip. Toggling Publish OFF revokes the slug. Public viewers see the trip on a no-auth route.

### Decisions (locked)

- **Slug.** 10-char URL-safe base62 random string (e.g. `aB3xK9pLq2`). Generated server-side, never reused. Stored on Trip as `published_slug` (nullable string, unique).
- **Public URL shape.** `GET /p/{slug}` returns the SPA shell (same index.html) with a query/state hint to load public mode; OR cleaner: `GET /api/public/trips/{slug}` returns a sanitized `TripDetail` (no `journal`, no `check_in_count`, no `photo_paths`, no `voice_transcript`). The SPA detects "public mode" from URL path and renders accordingly. **Pick:** simpler is a dedicated read-only public viewer page mounted at `/p/{slug}`, which serves a slimmed-down render. To minimize new code, **do this:**
  - Add backend route `GET /api/public/trips/{slug}` → returns sanitized TripDetail (or 404).
  - Add backend route `GET /p/{slug}` → serves the existing `index.html` (same as `/`). Frontend detects `location.pathname` starts with `/p/` and:
    - Skips login flow.
    - Fetches `/api/public/trips/${slug}` instead of `/api/trips/{id}`.
    - Hides edit affordances: Auto-sort CTA, `+`/`−` day controls, orange `+` FAB, Publish pill, drag handles.
- **Backend endpoints:**
  - `POST /api/trips/{trip_id}/publish` — generates slug if not present, returns `{slug, url}`. Requires auth + ownership.
  - `DELETE /api/trips/{trip_id}/publish` — sets `published_slug = NULL`. Requires auth + ownership.
  - `GET /api/public/trips/{slug}` — no auth; returns sanitized TripDetail; 404 if slug not found or trip's slug was revoked.
- **Sanitized public TripDetail.**
  - Drop fields: `journal`, `bookings` (might contain private notes), per-stop `note`, `tickets`, `hours` are fine to keep, `check_in_count`, `photo_paths`, `voice_transcript`.
  - Keep: trip name/destination/dates, days, stops (name/time/address/lat/lng/intro/highlights/transit/food), street_food.
  - Easiest implementation: reuse `_trip_to_detail()` then post-process to null out sensitive fields. Define a `_public_trip_to_detail(t)` helper.
- **Slug generation.** Use `secrets.token_urlsafe(8)` (Python stdlib) — returns ~11 char string, take first 10.
- **Migration.** Add `published_slug` column to `trips`. Nullable. Unique index.
- **Frontend modal.** Reuse the existing `#add-stop-modal` styles (`.modal-overlay`, `.modal-card`, etc.) — create a new `#publish-modal` with same CSS classes.
- **Publish modal contents:**
  - Title: "Publish trip"
  - If unpublished: a short paragraph + a primary "Generate share link" button.
  - If published: show the URL in a read-only `<input>`, a "Copy" button (`navigator.clipboard.writeText`), and a secondary "Unpublish" button.
- **Public-mode UI distinctions.**
  - Add `body.classList.add('is-public')` when path starts with `/p/`.
  - CSS: `body.is-public .plan-fab-cluster, body.is-public .plan-fab-add, body.is-public .pscr-cta, body.is-public .dsm-end, body.is-public .mab-publish, body.is-public .pscm-nav-arrow ~ * { display: none !important; }` (or similar — hide edit controls).
  - Skip the entire auth flow on public paths.

### Backend specifics

In `app/models.py`:
```python
published_slug: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, unique=True, index=True)
```

In `app/schemas.py`: extend `TripDetail` with `published_slug: Optional[str] = None`.

In `app/routes/trips.py`:
```python
import secrets

@router.post("/{trip_id}/publish")
def publish_trip(trip_id: int, user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    t = _owned(db, user, trip_id)
    if not t.published_slug:
        # Retry on rare slug collision
        for _ in range(5):
            slug = secrets.token_urlsafe(8)[:10]
            existing = db.query(Trip).filter_by(published_slug=slug).first()
            if not existing:
                t.published_slug = slug
                db.commit()
                break
        else:
            raise HTTPException(500, "could not generate unique slug")
    return {"slug": t.published_slug, "url": f"/p/{t.published_slug}"}

@router.delete("/{trip_id}/publish", status_code=204)
def unpublish_trip(trip_id: int, user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    t = _owned(db, user, trip_id)
    t.published_slug = None
    db.commit()
```

New file `app/routes/public.py` (or add to `trips.py`):
```python
@router.get("/api/public/trips/{slug}", response_model=schemas.TripDetail)
def get_public_trip(slug: str, db: Annotated[Session, Depends(get_db)]):
    t = db.query(Trip).filter_by(published_slug=slug).first()
    if not t:
        raise HTTPException(404, "not found")
    detail = _trip_to_detail(t)
    detail.journal = None
    detail.bookings = []
    for d in detail.days:
        for s in d.stops:
            s.note = None
            s.check_in_count = 0
            s.photo_paths = []
            s.voice_transcript = ""
    return detail
```

In `app/main.py` (or wherever static is mounted), add:
```python
@app.get("/p/{slug}")
def serve_public_spa(slug: str):
    return FileResponse(FRONTEND_DIR / "index.html")
```

Adapt to actual static-mount pattern — grep `main.py` for `StaticFiles` / `FileResponse`.

### Frontend specifics

1. Detect public mode at boot: `const PUBLIC_MODE = location.pathname.startsWith('/p/'); const PUBLIC_SLUG = PUBLIC_MODE ? location.pathname.slice(3) : null;`
2. If `PUBLIC_MODE`, skip login. Fetch `/api/public/trips/${PUBLIC_SLUG}` instead. Add `body.is-public` class.
3. Hide edit controls via CSS.
4. Add `#publish-modal` markup near `#add-stop-modal`.
5. Wire Publish pill `onclick="openPublishModal()"`. Remove `disabled title="Coming soon"`.
6. Functions:
   ```js
   async function openPublishModal() {
     // Refresh current trip to get latest slug
     await refreshTrip();
     document.getElementById('publish-modal').classList.remove('hidden');
     renderPublishModalBody();
   }
   function closePublishModal() {
     document.getElementById('publish-modal').classList.add('hidden');
   }
   function renderPublishModalBody() {
     const body = document.getElementById('pub-modal-body');
     const slug = TRIP_PUBLISHED_SLUG; // set by adaptTrip
     if (slug) {
       const url = location.origin + '/p/' + slug;
       body.innerHTML = `
         <p>Anyone with this link can view your trip (read-only):</p>
         <input id="pub-url" readonly value="${url}">
         <div class="modal-actions">
           <button onclick="copyPublishUrl()">Copy</button>
           <button onclick="unpublishTrip()" class="danger">Unpublish</button>
         </div>`;
     } else {
       body.innerHTML = `
         <p>Generate a shareable read-only link for this trip.</p>
         <div class="modal-actions">
           <button onclick="closePublishModal()">Cancel</button>
           <button onclick="publishTrip()" class="primary">Generate link</button>
         </div>`;
     }
   }
   async function publishTrip() {
     try {
       const resp = await apiCall(`/trips/${TRIP_ID}/publish`, { method: 'POST', body: '{}' });
       TRIP_PUBLISHED_SLUG = resp.slug;
       renderPublishModalBody();
     } catch (e) { showSnack('Publish failed'); }
   }
   async function unpublishTrip() {
     try {
       await apiCall(`/trips/${TRIP_ID}/publish`, { method: 'DELETE' });
       TRIP_PUBLISHED_SLUG = null;
       renderPublishModalBody();
     } catch (e) { showSnack('Unpublish failed'); }
   }
   async function copyPublishUrl() {
     const input = document.getElementById('pub-url');
     try {
       await navigator.clipboard.writeText(input.value);
       showSnack('Link copied');
     } catch {
       input.select(); document.execCommand('copy'); showSnack('Link copied');
     }
   }
   ```
7. In `adaptTrip()`, set `TRIP_PUBLISHED_SLUG = api.published_slug || null;`.

### Flags

- **No personal data in public view.** Sanitization is critical. Triple-check that `journal`, `bookings`, per-stop `note`/`check_in_count`/`photo_paths`/`voice_transcript` are all stripped.
- **Slug is opaque.** Don't expose `trip_id` in any public response. Public viewer never sees the internal trip id.
- **CORS / auth header.** Public fetch doesn't send Authorization. `apiCall` likely adds it automatically — for public fetch, use raw `fetch` without auth.
- **Public mode flag persists.** Once `PUBLIC_MODE` is true at boot, all subsequent renders skip edit affordances.

### Definition of Done

- [ ] `trips.published_slug` column + migration applied.
- [ ] `POST /api/trips/{id}/publish` returns `{slug, url}`.
- [ ] `DELETE /api/trips/{id}/publish` returns 204.
- [ ] `GET /api/public/trips/{slug}` returns sanitized TripDetail (no `journal`, no per-stop `note`/`check_in_count`/`photo_paths`/`voice_transcript`, no `bookings`).
- [ ] `GET /p/{slug}` serves index.html.
- [ ] Publish pill no longer disabled; opens modal showing Generate Link or Copy+Unpublish based on current state.
- [ ] Generated URL works in incognito (no auth required).
- [ ] Public-mode UI hides Auto-sort, +/-, orange +, Publish, nav arrow.
- [ ] No new console errors.
- [ ] Desktop pixel-frozen.
- [ ] `handoff/REVIEW-REQUEST.md` updated with Revision 7.

---

Architect approval: [x] Pre-approved.
