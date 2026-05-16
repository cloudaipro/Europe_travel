import { describe, it, expect } from "vitest";
import {
  cleanName,
  extractCity,
  buildQueries,
} from "../../src/geo/name.js";

describe("cleanName", () => {
  it("strips parenthetical suffix", () => {
    expect(cleanName("Belvedere Palace (Upper)")).toBe("Belvedere Palace");
  });

  it("strips leading verb phrase", () => {
    expect(cleanName("Lunch at Café Central")).toBe("Café Central");
    expect(cleanName("Tour of Schönbrunn")).toBe("Schönbrunn");
  });

  it("strips trailing suffix tokens", () => {
    expect(cleanName("St. Stephen's tour")).toBe("St. Stephen's");
    expect(cleanName("Naschmarkt (lunch)")).toBe("Naschmarkt");
  });

  it("handles empty / whitespace input", () => {
    expect(cleanName("")).toBe("");
    expect(cleanName("   ")).toBe("");
  });

  it("preserves unicode names", () => {
    expect(cleanName("Café Sacher")).toBe("Café Sacher");
    expect(cleanName("（朝食）築地市場")).toBe("築地市場");
  });
});

describe("extractCity", () => {
  it("returns empty for empty input", () => {
    expect(extractCity("")).toBe("");
  });

  it("uses the last comma segment", () => {
    expect(extractCity("Karlsplatz, 1010 Vienna")).toBe("Vienna");
  });

  it("trims a postal-code prefix", () => {
    expect(extractCity("Some St 1, 1010 Vienna")).toBe("Vienna");
    expect(extractCity("Praterstr 5, 1020 Wien")).toBe("Wien");
  });

  it("falls back to the whole segment when no postal pattern", () => {
    expect(extractCity("Just a city name")).toBe("Just a city name");
  });
});

describe("buildQueries", () => {
  it("emits cleaned+city, cleaned, cleaned+address, address — deduped", () => {
    const out = buildQueries(
      "Belvedere Palace (Upper)",
      "Prinz-Eugen-Str. 27, 1030 Vienna",
    );
    expect(out).toEqual([
      "Belvedere Palace, Vienna",
      "Belvedere Palace",
      "Belvedere Palace, Prinz-Eugen-Str. 27, 1030 Vienna",
      "Prinz-Eugen-Str. 27, 1030 Vienna",
    ]);
  });

  it("name only, no address", () => {
    expect(buildQueries("Schönbrunn", "")).toEqual(["Schönbrunn"]);
  });

  it("address only, blank name", () => {
    expect(buildQueries("", "1010 Vienna")).toEqual(["1010 Vienna"]);
  });

  it("returns empty when nothing usable", () => {
    expect(buildQueries("", "")).toEqual([]);
  });
});
