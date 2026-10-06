/* BUNDLED BRAND MARKS, behaviour.

   Until 2026-10-06 every logo came from logo.clearbit.com, which was shut down
   in December 2025, so every row showed a category icon. These pin the
   replacement: which names get a mark, which must not, that every mark is
   legible on the ground it is drawn on, and what the first-run tiles offer. */
import { brandMarkFor, marksFirst, monogramFor } from "../lib/brand-marks";
import { BRAND_MARKS } from "../lib/brand-mark-data";
import { getRegionalPopularTemplates, SERVICE_TEMPLATES } from "../lib/service-templates";

const slug = (name: string) => brandMarkFor(name)?.slug ?? null;

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("brandMarkFor", () => {
  it("matches the catalogue names people actually pick", () => {
    expect(slug("Netflix Standard")).toBe("netflix");
    expect(slug("Netflix Basis m. Werbung")).toBe("netflix");
    expect(slug("Spotify Premium")).toBe("spotify");
    expect(slug("YouTube Premium")).toBe("youtube");
    expect(slug("iCloud+ 50GB")).toBe("icloud");
    expect(slug("DAZN")).toBe("dazn");
    expect(slug("Telekom MagentaMobil M")).toBe("deutschetelekom");
    expect(slug("MagentaTV S")).toBe("deutschetelekom");
    expect(slug("O2 Blue M")).toBe("o2");
  });

  it("is case and whitespace blind, as a typed name is", () => {
    expect(slug("  NETFLIX  ")).toBe("netflix");
    expect(slug("spotify   family")).toBe("spotify");
  });

  it("takes the most specific mark first", () => {
    expect(slug("YouTube Music")).toBe("youtubemusic");
    expect(slug("Apple Music")).toBe("applemusic");
    expect(slug("Apple TV+")).toBe("appletv");
    expect(slug("YouTube TV")).toBe("youtube");
  });

  it("never matches inside a longer word", () => {
    for (const n of ["Skype", "Skyrim", "Netflixer", "Googleplex", "Nordsee", "o2x", "Applebee"]) {
      expect(slug(n)).toBeNull();
    }
  });

  it("leaves ordinary words and illegible wordmarks out", () => {
    for (const n of ["Max", "EA", "Zoom Pro", "RTL+ Basic", "Garmin Connect+", "", "   "]) {
      expect(slug(n)).toBeNull();
    }
    expect(brandMarkFor(null)).toBeUndefined();
    expect(brandMarkFor(undefined)).toBeUndefined();
  });

  it("restores the brands the current release dropped, from the release that last carried them", () => {
    expect(slug("Amazon Prime")).toBe("amazon");
    expect(slug("Amazon Music Unlimited")).toBe("amazonmusic");
    expect(slug("Kindle Unlimited")).toBe("amazon");
    expect(slug("Xbox Game Pass Ultimate")).toBe("xbox");
    expect(slug("Microsoft 365 Family")).toBe("microsoft");
    expect(slug("OneDrive 100GB")).toBe("microsoftonedrive");
    expect(slug("Adobe Foto-Abo")).toBe("adobelightroom");
    expect(slug("Adobe Creative Cloud")).toBe("adobecreativecloud");
    expect(slug("LinkedIn Premium Career")).toBe("linkedin");
    expect(slug("Nintendo Switch Online")).toBe("nintendoswitch");
    expect(slug("Amazonas Reisen")).toBeNull();
    for (const s of ["amazon", "xbox", "microsoft", "linkedin", "canva", "slack"]) {
      expect(BRAND_MARKS.find((m) => m.slug === s)!.from).toBeTruthy();
    }
  });

  it("covers the popular rows that have a mark at all", () => {
    for (const n of ["Netflix Standard", "Spotify Premium", "YouTube Premium", "iCloud+ 50GB", "DAZN", "Amazon Prime", "Xbox Game Pass Ultimate", "Microsoft 365 Personal"]) {
      expect(slug(n)).not.toBeNull();
    }
  });
});

describe("the marks are drawn legibly", () => {
  it("every mark reaches 3:1 against the ground it sits on", () => {
    for (const m of BRAND_MARKS) {
      expect(["#FFFFFF", "#142B3A"]).toContain(m.ground);
      const fills = m.parts ? m.parts.map((p) => p.fill) : [m.hex];
      expect(Math.max(...fills.map((f) => ratio(f, m.ground)))).toBeGreaterThanOrEqual(3);
    }
  });

  it("Microsoft keeps its four real colours, one per square, in order", () => {
    const ms = BRAND_MARKS.find((m) => m.slug === "microsoft")!;
    expect(ms.parts!.map((p) => p.fill)).toEqual(["#F25022", "#7FBA00", "#00A4EF", "#FFB900"]);
    // Every square starts with an absolute moveto, so each draws where it belongs.
    expect(ms.parts!.map((p) => p.d.slice(0, 1))).toEqual(["M", "M", "M", "M"]);
    expect(ms.parts![3].d.startsWith("M12.594 12.594")).toBe(true);
  });

  it("a mark that fails on white is moved to navy, not drawn faintly", () => {
    const spotify = BRAND_MARKS.find((m) => m.slug === "spotify")!;
    expect(ratio(spotify.hex, "#FFFFFF")).toBeLessThan(3);
    expect(spotify.ground).toBe("#142B3A");
  });

  it("every path is drawable data, not empty", () => {
    for (const m of BRAND_MARKS) expect(m.path).toMatch(/^[Mm][-\d.]/);
  });
});

describe("tiles", () => {
  it("marksFirst keeps every row and both groups' order", () => {
    const list = [{ name: "Disney+" }, { name: "Netflix Standard" }, { name: "Hulu (No Ads)" }, { name: "Spotify Premium" }];
    expect(marksFirst(list).map((x) => x.name)).toEqual(["Netflix Standard", "Spotify Premium", "Disney+", "Hulu (No Ads)"]);
  });

  it("a US reader is never offered a DACH-only row", () => {
    for (const t of getRegionalPopularTemplates(false)) expect(["GLOBAL", "US"]).toContain(t.region);
    expect(getRegionalPopularTemplates(false).map((t) => t.name)).not.toContain("DAZN");
  });

  it("a DACH reader gets euro rows only", () => {
    for (const t of getRegionalPopularTemplates(true)) expect(t.currency).toBe("EUR");
  });

  it("YouTube Premium is popular in both catalogues at a verified price", () => {
    const yt = SERVICE_TEMPLATES.filter((t) => t.name === "YouTube Premium");
    expect(yt.map((t) => [t.currency, t.defaultPrice, t.popular, t.verified]).sort()).toEqual([
      ["EUR", 14.99, true, "2026-10-06"],
      ["USD", 15.99, true, "2026-10-06"],
    ]);
  });
});

describe("monogramFor, the letter a service without a mark gets", () => {
  it("takes the first letter, upper cased", () => {
    expect(monogramFor("Disney+")).toBe("D");
    expect(monogramFor("amazon prime")).toBe("A");
    expect(monogramFor("  xbox")).toBe("X");
  });

  it("skips leading symbols to the first letter or digit", () => {
    expect(monogramFor("+Plus")).toBe("P");
    expect(monogramFor("(Gym) Nord")).toBe("G");
    expect(monogramFor("1Password")).toBe("1");
  });

  it("upper cases beyond ASCII", () => {
    expect(monogramFor("ärztekammer")).toBe("Ä");
    expect(monogramFor("ßpezial")).toBe("S");
  });

  it("falls back to the first visible character in a script without case", () => {
    expect(monogramFor("网飞")).toBe("网");
  });

  it("is null only when nothing is visible, so the category icon stays", () => {
    expect(monogramFor("")).toBeNull();
    expect(monogramFor("   ")).toBeNull();
    expect(monogramFor(null)).toBeNull();
    expect(monogramFor(undefined)).toBeNull();
  });
});
