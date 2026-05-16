// plan-handler — Step 15. Replaces the Step 14 503 stub for /api/plan/ingest.
//
// Reads the OpenAI key from TCSettings (Keychain on-device). If absent, returns
// 401 missing_openai_key so the frontend can surface the Settings modal. With a
// key in hand we construct an LLMClient (default: OpenAIClient), run planTrip
// against the user's request, persist the resulting TripPlan via the iOS
// TripStore, and return the same response shape FastAPI's
// /api/plan/ingest emits — so the existing inline submitIngest handler in
// packages/web/public/index.html works unchanged.
//
// clientFactory is injectable for tests; default newOpenAI builds a real
// OpenAIClient. Tests pass a factory returning MockLLMClient to avoid network.

import {
  OpenAIClient,
  planTrip,
  type LLMClient,
  type TripStore,
  type TCSettings,
  type TripPlan,
} from "@tourcompanion/core";

interface RouteResult {
  status: number;
  body: unknown;
}

export type LLMClientFactory = (opts: { apiKey: string; model: string }) => LLMClient;

const defaultClientFactory: LLMClientFactory = (opts) => new OpenAIClient(opts);

export async function handlePlanIngest(
  body: Record<string, unknown> | null,
  store: TripStore,
  settings: TCSettings,
  clientFactory: LLMClientFactory = defaultClientFactory,
): Promise<RouteResult> {
  const destination = String(body?.destination ?? "").trim();
  const days = Number(body?.days ?? 0);
  const style = String(body?.style ?? "");
  const sourceUrl = String(body?.source_url ?? "");

  if (!destination) {
    return {
      status: 400,
      body: { error: "invalid_destination", message: "Destination is required." },
    };
  }
  if (!Number.isInteger(days) || days < 1 || days > 14) {
    return {
      status: 400,
      body: { error: "invalid_days", message: "Days must be between 1 and 14." },
    };
  }

  const apiKey = await settings.getOpenAIKey();
  if (!apiKey) {
    return {
      status: 401,
      body: { error: "missing_openai_key", message: "Add your OpenAI key in Settings." },
    };
  }
  const model = await settings.getOpenAIModel();
  const client = clientFactory({ apiKey, model });

  let plan: TripPlan;
  try {
    plan = await planTrip(client, { destination, days, sourceUrl, style });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 502, body: { error: "ingest_failed", message: msg } };
  }

  // planTrip guarantees start_date / end_date are populated.
  const trip = await store.createTrip({
    name: plan.name,
    destination: plan.destination,
    start_date: plan.start_date!,
    end_date: plan.end_date!,
    season: plan.season,
    style: plan.style,
    pace: plan.pace,
    source_url: plan.source_url ?? "",
    hotel_name: plan.hotel_name,
    hotel_lat: plan.hotel_lat ?? null,
    hotel_lng: plan.hotel_lng ?? null,
    hotel_address: plan.hotel_address,
    days: plan.days.map((d) => ({
      n: d.n,
      date_label: d.date_label,
      theme: d.theme,
      mode: d.mode,
      stops: d.stops.map((s, idx) => ({
        order_idx: idx,
        time_label: s.time_label,
        name: s.name,
        address: s.address,
        lat: s.lat ?? null,
        lng: s.lng ?? null,
        hours: s.hours,
        tickets: s.tickets,
        intro: s.intro,
        highlights: s.highlights,
        transit: s.transit,
        washroom: s.washroom,
        food: s.food,
        note: "",
        promo: null,
      })),
    })),
    bookings: plan.bookings.map((b) => ({
      label: b.label,
      url: b.url ?? "",
      done: b.done ?? false,
    })),
  });

  const jobId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now());

  return {
    status: 200,
    body: {
      job_id: jobId,
      trip_id: trip.id,
      status: "done",
      message: `Created trip '${trip.name}' with ${plan.days.length} days.`,
      backend: "openai",
    },
  };
}
