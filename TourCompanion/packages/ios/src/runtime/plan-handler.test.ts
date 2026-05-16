// plan-handler tests — exercise the request-validation, missing-key, and
// persistence paths without touching network or SQLite. The OpenAI client is
// stubbed via the clientFactory injection; the store + settings are minimal
// fakes that capture inputs for assertions.

import { describe, it, expect } from "vitest";
import type {
  CheckInInput,
  JournalUpdate,
  StopCreateInput,
  TCSettings,
  TripCreateInput,
  TripDetail,
  TripStore,
  TripSummary,
  VoiceNoteInput,
  LLMClient,
} from "@tourcompanion/core";
import { handlePlanIngest } from "./plan-handler.js";

class FakeSettings implements TCSettings {
  constructor(private key: string | null, private model = "gpt-4o") {}
  async getOpenAIKey() {
    return this.key;
  }
  async setOpenAIKey(k: string) {
    this.key = k;
  }
  async clearOpenAIKey() {
    this.key = null;
  }
  async getOpenAIModel() {
    return this.model;
  }
  async setOpenAIModel(m: string) {
    this.model = m;
  }
}

// Minimal TripStore — only createTrip is exercised in this suite. The rest
// throw so any accidental call surfaces loudly in tests.
class FakeStore implements TripStore {
  public lastInput: TripCreateInput | null = null;
  public nextId = 42;

  async listTrips(): Promise<TripSummary[]> {
    throw new Error("listTrips not used in plan-handler tests");
  }
  async getTrip(_id: number): Promise<TripDetail | null> {
    throw new Error("getTrip not used in plan-handler tests");
  }
  async createTrip(input: TripCreateInput): Promise<TripDetail> {
    this.lastInput = input;
    return {
      id: this.nextId,
      name: input.name,
      destination: input.destination,
      start_date: input.start_date,
      end_date: input.end_date,
      status: "planning",
      season: input.season ?? "",
      style: input.style ?? "",
      pace: input.pace ?? "",
      source_url: input.source_url ?? "",
      hotel_name: input.hotel_name ?? "",
      hotel_lat: input.hotel_lat ?? null,
      hotel_lng: input.hotel_lng ?? null,
      hotel_address: input.hotel_address ?? "",
      journal: "",
      published_slug: null,
      days: [],
      bookings: [],
      companion_docs: [],
      routes: [],
      street_food: [],
    };
  }
  async deleteTrip(_id: number): Promise<void> {
    throw new Error("deleteTrip not used");
  }
  async addDay(_tripId: number): Promise<TripDetail> {
    throw new Error("addDay not used");
  }
  async removeDay(_tripId: number, _dayN: number): Promise<TripDetail> {
    throw new Error("removeDay not used");
  }
  async addStop(_input: StopCreateInput): Promise<TripDetail> {
    throw new Error("addStop not used");
  }
  async reorderStops(_dayId: number, _stopIds: number[]): Promise<TripDetail> {
    throw new Error("reorderStops not used");
  }
  async deleteStop(_stopId: number): Promise<TripDetail> {
    throw new Error("deleteStop not used");
  }
  async checkIn(_input: CheckInInput): Promise<void> {
    throw new Error("checkIn not used");
  }
  async updateJournal(_input: JournalUpdate): Promise<void> {
    throw new Error("updateJournal not used");
  }
  async addVoiceNote(_input: VoiceNoteInput): Promise<void> {
    throw new Error("addVoiceNote not used");
  }
  async addPhoto(_stopId: number, _path: string, _caption?: string): Promise<void> {
    throw new Error("addPhoto not used");
  }
}

// Deterministic LLM stub — returns a hand-built TripPlan JSON regardless of input.
function makeFakeClient(planJson: string): LLMClient {
  return {
    provider: "mock" as const,
    async complete() {
      return planJson;
    },
  };
}

function validPlanJson(destination: string, days: number): string {
  const dayArr = [];
  for (let i = 0; i < days; i++) {
    dayArr.push({
      n: i + 1,
      date_label: `Day ${i + 1}`,
      theme: `Theme ${i + 1}`,
      mode: "Walking",
      stops: [
        {
          time_label: "09:00",
          name: `Stop ${i + 1}`,
          lat: 0,
          lng: 0,
          address: destination,
          hours: "9-18",
          tickets: "Free",
          intro: "intro",
          highlights: ["h1"],
          transit: "Walk",
          washroom: "Cafe",
          food: ["bite"],
        },
      ],
    });
  }
  return JSON.stringify({
    name: `${destination} trip`,
    destination,
    season: "spring",
    style: "mixed",
    pace: "Moderate",
    hotel_name: "Hotel",
    hotel_lat: 0,
    hotel_lng: 0,
    hotel_address: destination,
    bookings: [{ label: "Museum", url: "https://example.com", done: false }],
    days: dayArr,
  });
}

describe("handlePlanIngest", () => {
  it("returns 401 missing_openai_key when settings has no key", async () => {
    const store = new FakeStore();
    const settings = new FakeSettings(null);
    const res = await handlePlanIngest(
      { destination: "Vienna", days: 3 },
      store,
      settings,
      () => makeFakeClient(validPlanJson("Vienna", 3)),
    );
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: "missing_openai_key",
      message: "Add your OpenAI key in Settings.",
    });
    expect(store.lastInput).toBeNull();
  });

  it("returns 400 invalid_days for days = 0", async () => {
    const res = await handlePlanIngest(
      { destination: "Vienna", days: 0 },
      new FakeStore(),
      new FakeSettings("sk-test"),
      () => makeFakeClient(validPlanJson("Vienna", 1)),
    );
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("invalid_days");
  });

  it("returns 400 invalid_days for days = 15", async () => {
    const res = await handlePlanIngest(
      { destination: "Vienna", days: 15 },
      new FakeStore(),
      new FakeSettings("sk-test"),
      () => makeFakeClient(validPlanJson("Vienna", 1)),
    );
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("invalid_days");
  });

  it("returns 400 invalid_destination for empty destination", async () => {
    const res = await handlePlanIngest(
      { destination: "   ", days: 3 },
      new FakeStore(),
      new FakeSettings("sk-test"),
      () => makeFakeClient(validPlanJson("Vienna", 3)),
    );
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("invalid_destination");
  });

  it("returns 502 ingest_failed when the LLM client throws", async () => {
    const failing: LLMClient = {
      provider: "mock" as const,
      async complete() {
        throw new Error("upstream blew up");
      },
    };
    const res = await handlePlanIngest(
      { destination: "Vienna", days: 3 },
      new FakeStore(),
      new FakeSettings("sk-test"),
      () => failing,
    );
    expect(res.status).toBe(502);
    expect((res.body as { error: string; message: string })).toEqual({
      error: "ingest_failed",
      message: "upstream blew up",
    });
  });

  it("persists the plan and returns 200 with the openai backend marker", async () => {
    const store = new FakeStore();
    store.nextId = 99;
    const settings = new FakeSettings("sk-test", "gpt-5-test");

    let factoryArgs: { apiKey: string; model: string } | null = null;
    const res = await handlePlanIngest(
      { destination: "Vienna", days: 2, style: "foodie", source_url: "https://src" },
      store,
      settings,
      (opts) => {
        factoryArgs = opts;
        return makeFakeClient(validPlanJson("Vienna", 2));
      },
    );

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.trip_id).toBe(99);
    expect(body.status).toBe("done");
    expect(body.backend).toBe("openai");
    expect(typeof body.job_id).toBe("string");
    expect((body.job_id as string).length).toBeGreaterThan(0);
    expect(body.message).toBe("Created trip 'Vienna trip' with 2 days.");

    // clientFactory received the key + model from settings.
    expect(factoryArgs).toEqual({ apiKey: "sk-test", model: "gpt-5-test" });

    // Plan was persisted via createTrip with mapped days + bookings.
    expect(store.lastInput).not.toBeNull();
    const input = store.lastInput!;
    expect(input.destination).toBe("Vienna");
    expect(input.days).toHaveLength(2);
    expect(input.days![0].stops).toHaveLength(1);
    expect(input.days![0].stops![0].name).toBe("Stop 1");
    expect(input.bookings).toEqual([
      { label: "Museum", url: "https://example.com", done: false },
    ]);
  });
});
