# Architect Brief — Step 4: KG-6 + KG-7 + KG-2

---

## Step 4 — Three bundled fixes

### 4.1 — KG-6: race on `+`/`−` day double-tap

**Goal:** disable button during in-flight request; re-enable on response (success or error).

**Frontend only.** In `addDay()` and `removeLastDay()`:
- Take the triggering button (find via `.dsm-end button[onclick*="addDay"]` and `[onclick*="removeLastDay"]`).
- Set `btn.disabled = true` at start; `btn.disabled = false` in a `finally` block.
- Wrap the fetch in `try/finally`.

### 4.2 — KG-7: auto-sort `"HH:MM +N"` parser

**Goal:** Recognize next-day timestamps. `"00:24 +1"` should sort AFTER `23:42`, not before `09:00`.

**Frontend only.** In `autoSortCurrentDay()`, replace the `toMinutes` parser with:
```js
const toMinutes = (t) => {
  if (!t) return Infinity;
  const m = /^(\d{1,2}):(\d{2})(?:\s*\+(\d+))?/.exec(t);
  if (!m) return Infinity;
  const dayOffset = m[3] ? parseInt(m[3], 10) : 0;
  return dayOffset * 1440 + parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};
```

### 4.3 — KG-2: Stop.promo field + frontend rendering

**Goal:** Render the orange promo banner per DESIGN-SPEC §3.5.1 inside `.plan-stop-card-m` when a stop carries promo data.

**Data shape (decision locked):**
```python
# JSON column, nullable
promo = {
    "label": str,    # "Vienna eSIM", "Fiaker tour", etc.
    "price": str,    # "NT$69", "€1,200" — string keeps currency symbol flexible
    "url": str,      # optional click-through URL
}
```

**Backend tasks:**
1. Add `promo: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)` to `Stop` in `app/models.py`. Use `JSON` from `sqlalchemy` (SQLite supports JSON via TEXT under the hood — confirm by grepping for existing JSON-typed columns; e.g. `highlights` is `JSON`).
2. Add `promo` field to `StopOut` schema in `app/schemas.py` — `Optional[dict]`.
3. Update `_stop_to_out()` in `routes/trips.py` to pass through `s.promo`.
4. Alembic migration: `cd server && ./migrate.sh revision --autogenerate -m "add stop.promo"`. Inspect the generated file — it should add one column. If migrate.sh autogen doesn't produce anything useful (autogen with SQLite + JSON sometimes fails), hand-write the migration body: `op.add_column('stops', sa.Column('promo', sa.JSON, nullable=True))`. Then `./migrate.sh upgrade head`.
5. Seed one demo promo: in `app/seed_data/budapest.py` or `vienna_budapest.py`, on **one** stop (e.g. Day 1 stop 1 of vienna_budapest), set `promo={"label": "Vienna eSIM (demo)", "price": "€19", "url": "https://example.com/esim"}`. Just so the UI renders something on the demo. Document this in your revision note.

**Frontend tasks:**
6. In `renderPlanDayContent()`'s mobile-card emit, after the `.plan-stop-card-m` block (and before the `.plan-transit-row-m` block), emit a `.plan-promo-m` banner row when `s.promo` is truthy:
   ```html
   <a class="plan-promo-m" href="${url}" target="_blank" rel="noopener">
     <span class="ppm-deal">DEAL</span>
     <span class="ppm-label">${label}</span>
     <span class="ppm-price">${price}</span>
     <span class="ppm-chev">›</span>
   </a>
   ```
7. Add CSS for `.plan-promo-m` and children inside the mobile media block. Per DESIGN-SPEC §3.5.1 promo-banner section:
   - Container: `margin: 6px 16px 0 76px` (indent under thumb), `background: var(--c-promo)`, `border-radius: 10px`, `padding: 8px 12px`, flex row, gap 8, `text-decoration: none`.
   - `.ppm-deal`: 11px 800 `--c-promo-text`, white pill background `padding: 2px 6px`, `border-radius: 4px`.
   - `.ppm-label`: 13px 600 `--c-promo-text`, `flex: 1`, truncate (`text-overflow: ellipsis`, `white-space: nowrap`, `overflow: hidden`).
   - `.ppm-price`: 14px 800 `--c-promo-text`.
   - `.ppm-chev`: 14px `--c-promo-text`.

### Flags / decisions

- **JSON column on SQLite.** `JSON` type works via SQLAlchemy's `JSON` cross-DB type. Just import `from sqlalchemy import JSON`.
- **Migration must run automatically on next boot** — `app/main.py` already runs `alembic upgrade head` on lifespan; no manual step needed after the migration file is in place.
- **Seed promo on a stop owned by the demo user only.** Don't pollute every stop.
- **HTML-escape promo content.** Use the existing `htmlEsc()` or whatever the codebase uses (grep). Promo `label` is user-typed; don't trust it.
- **Don't touch existing `<details>` desktop markup.** Promo is mobile-only for this step.

### Definition of Done

- [ ] `addDay`/`removeLastDay` disable triggering button during request, re-enable after.
- [ ] Auto-sort parser handles `"HH:MM +N"` — write a quick assert in a comment if helpful.
- [ ] `Stop.promo` column added + migration generated + applied.
- [ ] `StopOut.promo` passes through API.
- [ ] One demo stop carries a promo; banner renders in the mobile sheet on that stop.
- [ ] No new console errors. No new backend test failures (server reloads cleanly).
- [ ] Desktop pixel-frozen (promo banner is mobile-only).
- [ ] `handoff/REVIEW-REQUEST.md` updated with Revision 5.

---

## Builder Plan
Architect pre-approval: [x] Pre-approved. Plan + build in one round.
