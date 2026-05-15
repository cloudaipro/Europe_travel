# Review Feedback — Step 4 (KG-6 + KG-7 + KG-2)
Date: 2026-05-14
Reviewer: Richard
Verdict: CONDITIONALLY CLEAR

## Tier 1 findings

- **(1) Migration idempotency — OK.** `op.execute` is guarded by `WHERE promo IS NULL AND id = (SELECT MIN(id) FROM stops WHERE name LIKE 'Vienna Airport%')`. Alembic version-table also prevents re-runs in practice. No change needed.
- **(2) `downgrade()` correctness — OK.** `batch_alter_table('stops')` + `drop_column('promo')`. Rollback safe.
- **(3) Cross-db JSON column — OK.** `sa.JSON()` in the migration and `JSON` from `sqlalchemy` in `models.py`. Portable across SQLite + Postgres. `Mapped[Optional[dict]]` typing is correct.
- **(4) HTML-escape on promo render — OK.** `esc()` is applied to `s.promo.label`, `s.promo.price`, and `s.promo.url`. The helper covers `< > & "` — sufficient for text content and for the one attribute context we use (`href`, double-quoted).
- **(5) `target="_blank"` + `rel="noopener"` — OK.** Present on the `.plan-promo-m` `<a>` at index.html:2234. (Also present on `.pscm-nav-arrow` from prior step.)
- **(6) Auto-sort regex — OK.** `/^(\d{1,2}):(\d{2})(?:\s*\+(\d+))?/` is left-anchored; empty/garbage falls through `if (!m) return Infinity;`. `parseInt` on captured groups is safe. Mental check confirms `"00:24 +1"` → 1464 sorts after `"23:42"` → 1422.
- **(7) Race fix: `finally` block — OK.** Both `addDay()` and `removeLastDay()` set `btn.disabled = true` synchronously before the `await`, with `finally { if (btn) btn.disabled = false; }`. `autoSortCurrentDay()` follows the same pattern with opacity restore. Double-tap window is closed.

## Tier 2 findings

- **(8) `promo.url` scheme — Must Fix (promoted from Tier 2).** `esc()` neutralises HTML metachars but does NOT block `javascript:`, `data:`, or `vbscript:` URL schemes. Today the only writer is the seed + migration, so the live attack surface is zero — but the `StopOut.promo` field is now a typed API contract that a future PUT/PATCH endpoint will populate. The fix is one of:
  - **Preferred (defense in depth):** in `renderPlanDayContent`, compute `pUrl` via `new URL(s.promo.url, location.href)` inside try/catch, then reject if `u.protocol !== 'https:' && u.protocol !== 'http:'` — fall back to omitting the `href` (render the banner as a non-link `<div>`) or to `"#"`.
  - **Or server-side:** validate `promo.url` scheme in the write path when one is added.
  Recommend doing the client-side gate now (5 lines, no backend change); revisit server-side validation when the write endpoint lands.
- **(9) Pydantic submodel — nice-to-have.** Keeping `dict | None` for now is acceptable. When the shape grows (expiry / image / CTA copy) promote to `PromoOut(BaseModel)` with `label: str | None`, `price: str | None`, `url: AnyHttpUrl | None`. Not a blocker.
- **(10) Seed-leak from `op.execute` — OK.** UPDATE runs *after* `add_column` (inside `upgrade()`, after the `batch_alter_table` block returns) and is guarded by `promo IS NULL`. Order is correct.

## Tier 3 findings

- **(11) `.ppm-*` naming — consistent with neighbour `.pscm-*` / `.pttrm-*` family. Fine.**
- **(12) Promo CSS scope — OK.** `.plan-promo-m` (line 568–602) sits inside the `@media (max-width: 767px)` block opened at line 201 and closed before the `@media (min-width: 768px)` at line 762. Desktop is not affected.
- **(13) Minor: stale button reference after re-render.** `renderPlan()` inside the `try` block rebuilds the DOM, so the `btn` captured before `await` is detached by the time `finally` runs. Setting `disabled = false` on a detached node is harmless. No fix required; flagging for the log.
- **(14) Minor: `if (s.promo && (s.promo.label || s.promo.price))` skips banners that only carry a `url`.** Probably intentional (a banner needs *something* to read), but worth a one-line comment for the next maintainer.

## Bob's open questions — Richard's answers

1. **URL allowlist (javascript: scheme) — YES, gate it now (client-side).** See Tier 2 #8. One-liner with `new URL()`, reject non-http(s), fall back to a non-link banner. Do this in this revision; it's cheap insurance and the typed `promo.url` field on `StopOut` is now visible from the API.
2. **Pydantic submodel vs dict for promo — NO, not now.** `dict | None` is fine until the shape stabilises. Re-open when a second consumer (write endpoint, analytics, …) appears.

## Summary for Arch

Step 4 is structurally sound. The migration is idempotent + reversible, the new `Stop.promo` column is cross-database, the `_stop_to_out` wiring is correct, and the frontend HTML escape + `rel="noopener"` are in place. The `+`/`−` double-tap race and the `HH:MM +N` parser both look correct. One outstanding concern: `promo.url` is rendered into an `href` without a scheme allowlist, so a future write path that lets users supply their own URLs would let a `javascript:` URL through `esc()`. Bob should add a short client-side scheme gate (parse via `new URL`, accept only `http:`/`https:`) before this clears. Everything else is green or nit-level.
