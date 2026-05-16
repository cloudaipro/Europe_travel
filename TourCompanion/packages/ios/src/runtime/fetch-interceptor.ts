// Fetch interceptor — routes /api/* requests to the in-process TripStore
// instead of the FastAPI server. The web SPA's inline JS is unchanged; it
// keeps calling `fetch("/api/...")` and gets a synthetic Response back.
//
// Endpoints handled match server/app/routes/* one-for-one. Anything we
// don't recognise drops through to a 404. /api/plan/ingest is wired to
// the on-device OpenAI planner (Step 15) via handlePlanIngest. The matching
// /api/plan/jobs/{id} stays a 404 — ingest is synchronous, so the frontend
// never polls it.

import type { TripStore } from "@tourcompanion/core";
import { handlePlanIngest } from "./plan-handler.js";

type Json = unknown;
interface RouteResult {
  status: number;
  body: Json;
}

const STUB_USER = {
  id: 1,
  email: "",
  display_name: "local",
  email_verified_at: null as string | null,
  created_at: "",
};

const STUB_TOKEN_BODY = { access_token: "local" };

/** Pure pattern-match router. Returns the JSON body + status to send. */
async function route(
  pathname: string,
  method: string,
  body: Record<string, unknown> | null,
  store: TripStore,
): Promise<RouteResult> {
  // Strip a trailing slash so /api/health and /api/health/ both match.
  const path = pathname.replace(/\/+$/, "") || pathname;

  // ---------- Health / auth stubs ----------
  if (path === "/api/health" && method === "GET") {
    return { status: 200, body: { ok: true } };
  }
  if (path === "/api/auth/me" && method === "GET") {
    return { status: 200, body: STUB_USER };
  }
  if (
    method === "POST" &&
    (path === "/api/auth/signup" ||
      path === "/api/auth/login" ||
      path === "/api/auth/login-json")
  ) {
    return { status: 200, body: STUB_TOKEN_BODY };
  }

  // ---------- Trip CRUD ----------
  if (path === "/api/trips" && method === "GET") {
    return { status: 200, body: await store.listTrips() };
  }
  if (path === "/api/trips" && method === "POST") {
    if (!body) return { status: 400, body: { error: "missing_body" } };
    const trip = await store.createTrip(body as unknown as Parameters<TripStore["createTrip"]>[0]);
    return { status: 200, body: trip };
  }

  // /api/trips/{id}
  let m = path.match(/^\/api\/trips\/(\d+)$/);
  if (m) {
    const id = Number(m[1]);
    if (method === "GET") {
      const detail = await store.getTrip(id);
      return detail
        ? { status: 200, body: detail }
        : { status: 404, body: { error: "trip_not_found" } };
    }
    if (method === "DELETE") {
      await store.deleteTrip(id);
      return { status: 204, body: null };
    }
  }

  // /api/trips/{id}/days  (POST = addDay)
  m = path.match(/^\/api\/trips\/(\d+)\/days$/);
  if (m && method === "POST") {
    return { status: 200, body: await store.addDay(Number(m[1])) };
  }

  // /api/trips/{id}/days/{n}  (DELETE = removeDay)
  m = path.match(/^\/api\/trips\/(\d+)\/days\/(\d+)$/);
  if (m && method === "DELETE") {
    return {
      status: 200,
      body: await store.removeDay(Number(m[1]), Number(m[2])),
    };
  }

  // /api/trips/{id}/days/{n}/stops  (POST = addStop — resolve day_id)
  m = path.match(/^\/api\/trips\/(\d+)\/days\/(\d+)\/stops$/);
  if (m && method === "POST") {
    const tripId = Number(m[1]);
    const dayN = Number(m[2]);
    const trip = await store.getTrip(tripId);
    if (!trip) return { status: 404, body: { error: "trip_not_found" } };
    const day = trip.days?.find((d) => d.n === dayN);
    if (!day) return { status: 404, body: { error: "day_not_found" } };
    const payload = (body ?? {}) as Record<string, unknown>;
    const detail = await store.addStop({
      ...payload,
      day_id: day.id,
    } as unknown as Parameters<TripStore["addStop"]>[0]);
    return { status: 200, body: detail };
  }

  // /api/trips/days/{day_id}/stops/order  (PUT = reorderStops)
  m = path.match(/^\/api\/trips\/days\/(\d+)\/stops\/order$/);
  if (m && method === "PUT") {
    const dayId = Number(m[1]);
    const ids = (body?.stop_ids as number[] | undefined) ?? [];
    return { status: 200, body: await store.reorderStops(dayId, ids) };
  }

  // /api/stops/{id}/checkin  (POST)
  m = path.match(/^\/api\/stops\/(\d+)\/checkin$/);
  if (m && method === "POST") {
    const stopId = Number(m[1]);
    const payload = (body ?? {}) as Record<string, unknown>;
    await store.checkIn({
      stop_id: stopId,
      lat: (payload.lat as number | null | undefined) ?? null,
      lng: (payload.lng as number | null | undefined) ?? null,
    });
    return { status: 200, body: { ok: true } };
  }

  // /api/stops/{id}/photos and /photos-link  (POST)
  m = path.match(/^\/api\/stops\/(\d+)\/photos(?:-link)?$/);
  if (m && method === "POST") {
    const stopId = Number(m[1]);
    const payload = (body ?? {}) as Record<string, unknown>;
    const filePath =
      (payload.path as string | undefined) ??
      (payload.url as string | undefined) ??
      "";
    if (!filePath) return { status: 400, body: { error: "missing_path" } };
    await store.addPhoto(stopId, filePath, payload.caption as string | undefined);
    return { status: 200, body: { ok: true } };
  }

  // /api/stops/{id}/voice  (POST)
  m = path.match(/^\/api\/stops\/(\d+)\/voice$/);
  if (m && method === "POST") {
    const stopId = Number(m[1]);
    const payload = (body ?? {}) as Record<string, unknown>;
    await store.addVoiceNote({
      stop_id: stopId,
      transcript: (payload.transcript as string | undefined) ?? "",
      audio_path: payload.audio_path as string | undefined,
    });
    return { status: 200, body: { ok: true } };
  }

  // /api/trips/{id}/journal  (PUT)
  m = path.match(/^\/api\/trips\/(\d+)\/journal$/);
  if (m && method === "PUT") {
    const tripId = Number(m[1]);
    const journal = ((body?.journal as string | undefined) ?? "").toString();
    await store.updateJournal({ trip_id: tripId, journal });
    return { status: 200, body: { ok: true } };
  }

  // /api/trips/{id}/streetfood — v1 returns empty list.
  if (/^\/api\/trips\/\d+\/streetfood$/.test(path) && method === "GET") {
    return { status: 200, body: [] };
  }

  // Plan endpoints — Step 15 wires OpenAI through TCSettings + handlePlanIngest.
  if (path === "/api/plan/ingest" && method === "POST") {
    const settings = window.TCSettings;
    if (!settings) {
      return { status: 500, body: { error: "settings_unavailable" } };
    }
    return handlePlanIngest(body, store, settings);
  }
  if (/^\/api\/plan\/jobs\/\d+$/.test(path) && method === "GET") {
    return { status: 404, body: { error: "not_found" } };
  }

  return { status: 404, body: { error: "unsupported", path: pathname } };
}

/** Install the interceptor on `window.fetch`. Idempotent — second call is
 *  a no-op. Non-/api requests pass through to the original fetch verbatim.
 *
 *  `storeProvider` is awaited per-request so the interceptor can be installed
 *  synchronously at script load (before the SPA's inline scripts run) while
 *  the SQLite-backed TripStore is still being constructed asynchronously.
 *  The first /api/* request will simply wait the few extra ms for the store
 *  to be ready, which is fine — the SPA already awaits all its fetches. */
export function installFetchInterceptor(
  storeProvider: TripStore | (() => Promise<TripStore>),
): void {
  const w = window as Window & { __tcFetchPatched?: boolean };
  if (w.__tcFetchPatched) return;
  w.__tcFetchPatched = true;

  const getStore = (): Promise<TripStore> =>
    typeof storeProvider === "function"
      ? (storeProvider as () => Promise<TripStore>)()
      : Promise.resolve(storeProvider);

  const origFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    let method: string;
    if (typeof input === "string") {
      url = input;
      method = (init?.method ?? "GET").toUpperCase();
    } else if (input instanceof URL) {
      url = input.toString();
      method = (init?.method ?? "GET").toUpperCase();
    } else {
      url = input.url;
      method = (init?.method ?? input.method ?? "GET").toUpperCase();
    }

    let u: URL;
    try {
      u = new URL(url, location.origin);
    } catch {
      return origFetch(input as RequestInfo, init);
    }
    if (!u.pathname.startsWith("/api/")) {
      return origFetch(input as RequestInfo, init);
    }

    // Parse JSON body if present. Form-encoded login bodies (FormData /
    // URLSearchParams) hit the auth stubs which don't read the body, so
    // it's safe to skip parsing for those.
    let body: Record<string, unknown> | null = null;
    const raw = init?.body;
    if (raw && typeof raw === "string") {
      try {
        body = JSON.parse(raw);
      } catch {
        body = null;
      }
    }

    try {
      const store = await getStore();
      const result = await route(u.pathname, method, body, store);
      const status = result.status;
      const init204: ResponseInit = { status, headers: {} };
      if (status === 204) {
        return new Response(null, init204);
      }
      return new Response(JSON.stringify(result.body), {
        status,
        headers: { "content-type": "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "error";
      console.error("[TC iOS] fetch interceptor failed", u.pathname, err);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  };
}
