# Architect Brief — Step 5: KG-3a Add-stop FAB

---

## Step 5 — Wire orange `+` FAB to add-stop modal + endpoint

### Goal

Tapping the orange `+` FAB (in `.plan-fab-cluster .plan-fab-add`) opens a modal form. Submitting POSTs to a new endpoint and appends a stop to the currently-selected day. No lat/lng entry — backend geocodes from address if provided (Nominatim infrastructure already exists in the codebase).

### Decisions (locked)

- **Modal pattern.** Reuse the existing modal pattern (grep `openModal` and `closeModal` in `frontend/index.html` — Tour tab uses modals for Cheap eats / Phrasebook / Washroom / etc.). Add a new modal section `<dialog>` or `<div class="modal">` keyed to `add-stop`.
- **Fields.** name (required), time_label (optional, free-form "HH:MM"), address (optional). Three text inputs + Cancel + Save.
- **Backend.** `POST /api/trips/{trip_id}/days/{day_n}/stops` — body `{name, time_label?, address?}`. Returns full `TripDetail`. Auth + ownership via `_owned()`.
- **Backend geocode.** If `address` provided, call existing `geocoder.geocode()` (grep for it) synchronously inside the handler. Best-effort: if it fails or address is empty, store `lat=0, lng=0` and let the existing background-geocode infrastructure pick it up later (look at `plan.py` for the pattern).
- **order_idx.** New stop appended at the end: `order_idx = max(existing.order_idx) + 1`.
- **Promo, category, hours, tickets, etc.** All left empty/null on creation — user can fill via separate edits (out of scope here).
- **Frontend refresh.** Reuse `refreshTrip()` (or just call `adaptTrip(detail); renderPlan();`).
- **Validation.** Frontend: name non-empty before allowing Save. Backend: 400 if name missing.

### Backend implementation

In `app/routes/trips.py`:

```python
from pydantic import BaseModel

class StopCreateIn(BaseModel):
    name: str
    time_label: str = ""
    address: str = ""

@router.post("/{trip_id}/days/{day_n}/stops", response_model=schemas.TripDetail, status_code=201)
def add_stop(trip_id: int, day_n: int, payload: StopCreateIn,
             user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    t = _owned(db, user, trip_id)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "name is required")
    day = next((d for d in t.days if d.n == day_n), None)
    if not day:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "day not found")
    next_idx = max((s.order_idx for s in day.stops), default=-1) + 1
    lat, lng = 0.0, 0.0
    addr = payload.address.strip()
    if addr:
        try:
            from ..geocoder import geocode_query  # adapt to actual function name — grep first
            res = geocode_query(addr)  # may return (lat, lng) or None
            if res:
                lat, lng = res
        except Exception:
            pass  # swallow; existing background geocoder may retry later
    s = Stop(day_id=day.id, order_idx=next_idx, name=name,
             time_label=payload.time_label.strip(), address=addr,
             lat=lat, lng=lng)
    db.add(s)
    db.commit()
    db.refresh(t)
    return _trip_to_detail(t)
```

**Grep first** for the actual geocoder function name in `app/geocoder.py` — adapt the import line.

### Frontend implementation

1. Find orange + FAB markup. Remove `disabled` + `title="Coming soon"`. Add `onclick="openAddStopModal()"`.
2. Add modal markup. Place near existing modals or near end of body. Example structure:
   ```html
   <div id="add-stop-modal" class="modal-overlay hidden">
     <div class="modal-card">
       <h2>Add stop</h2>
       <label>Name <input id="as-name" type="text" required></label>
       <label>Time (HH:MM) <input id="as-time" type="text" placeholder="14:30"></label>
       <label>Address <input id="as-addr" type="text" placeholder="Street, City"></label>
       <div class="modal-actions">
         <button onclick="closeAddStopModal()">Cancel</button>
         <button id="as-save" onclick="submitAddStop()">Save</button>
       </div>
     </div>
   </div>
   ```
3. Add three JS functions:
   ```js
   function openAddStopModal() {
     document.getElementById('add-stop-modal').classList.remove('hidden');
     setTimeout(() => document.getElementById('as-name').focus(), 50);
   }
   function closeAddStopModal() {
     document.getElementById('add-stop-modal').classList.add('hidden');
     ['as-name','as-time','as-addr'].forEach(id => document.getElementById(id).value = '');
   }
   async function submitAddStop() {
     const name = document.getElementById('as-name').value.trim();
     if (!name) { showSnack('Name required'); return; }
     const time_label = document.getElementById('as-time').value.trim();
     const address = document.getElementById('as-addr').value.trim();
     const save = document.getElementById('as-save');
     save.disabled = true;
     try {
       const dayN = selectedPlanDay || 1;
       const detail = await apiCall(`/trips/${TRIP_ID}/days/${dayN}/stops`, {
         method: 'POST',
         body: JSON.stringify({name, time_label, address}),
       });
       adaptTrip(detail);
       renderPlan();
       closeAddStopModal();
     } catch (e) {
       console.warn('add stop failed', e.message);
       showSnack('Add stop failed');
     } finally {
       save.disabled = false;
     }
   }
   ```
4. CSS: minimal modal overlay (`.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; }`, `.modal-overlay.hidden { display: none; }`, `.modal-card { background: white; padding: 20px; border-radius: 16px; width: min(90vw, 400px); display: flex; flex-direction: column; gap: 12px; }`, label flex stack, button styling).
5. **Esc closes modal.** Add `keydown` listener that closes when modal is visible.

### Flags

- **Reuse existing modal pattern if it exists** (Tour tab modals). Grep for the existing modal CSS — if so, just add a new modal entry rather than inventing a new system.
- **`showSnack`** — already exists from prior steps. Reuse.
- **`apiCall`** — already exists. Reuse.
- **`selectedPlanDay`** — global. Reuse.
- **`TRIP_ID`** — global. Reuse.

### Definition of Done

- [ ] `POST /api/trips/{trip_id}/days/{day_n}/stops` added; returns 201 + TripDetail; 400 on empty name; 404 on missing trip/day.
- [ ] Orange `+` FAB no longer disabled; opens modal.
- [ ] Modal has 3 inputs + Cancel + Save.
- [ ] Save disabled when name empty.
- [ ] Submit appends stop to current day, refreshes UI, closes modal.
- [ ] Esc closes modal.
- [ ] Address-based geocode best-effort (no crash if Nominatim down).
- [ ] No new console errors.
- [ ] Desktop pixel-frozen (modal only triggers from mobile FAB).
- [ ] `handoff/REVIEW-REQUEST.md` updated with Revision 6.

---

Architect approval: [x] Pre-approved. Bob plan + build in one round.
