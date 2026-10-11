/* The Impressum (ECG section 5, MedienG section 25). An Austrian business
   website must say who runs it and where, and must link to that from every
   page a visitor can land on. Renders the real legalPage() with the real
   IMPRESSUM data lifted out of server.js, then checks the links. */

const fs = require("fs");
const path = require("path");

const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
const SERVER = read("backend", "server.js");

function slice(start, end) {
  const a = SERVER.indexOf(start);
  const b = SERVER.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`could not find ${start}`);
  return SERVER.slice(a, b);
}

const render = new Function(
  slice("function escapeHtml", "\n}\n") + "\n}\n"
  + slice("function legalPage", "\n}\n") + "\n}\n"
  + slice("const IMPRESSUM", "\napp.get('/impressum'")
  + "\nreturn { legalPage, IMPRESSUM };",
)();

describe("Impressum", () => {
  it("names the operator with a full postal address in both languages", () => {
    const de = render.IMPRESSUM.de;
    const html = render.legalPage(de.title, de.updated, de.intro, de.sections, "de");
    expect(html).toMatch(/<html lang="de">/);
    expect(html).toContain("Ismael Naranjo, Grassigasse 7, 1140 Wien, Österreich");
    expect(html).toContain("trimio@subtrimio.com");
    expect(html).toMatch(/§ 5 ECG/);
    expect(html).toMatch(/§ 25 MedienG/);
    const en = render.IMPRESSUM.en;
    expect(render.legalPage(en.title, en.updated, en.intro, en.sections, "en")).toContain("Grassigasse 7, 1140 Vienna, Austria");
  });

  it("is served in both languages and listed in the sitemap", () => {
    expect(SERVER).toMatch(/app\.get\('\/impressum'/);
    expect(SERVER).toMatch(/app\.get\('\/legal-notice'/);
    expect(SERVER).toMatch(/\$\{SITE\}\/impressum<\/loc>/);
  });

  it("is linked from every landing and guide page", () => {
    expect(read("backend", "landing-de.html")).toContain('href="/impressum">Impressum<');
    expect(read("backend", "landing.html")).toContain('href="/legal-notice">Legal notice<');
    for (const lang of ["de", "en"]) {
      const dir = path.join(__dirname, "..", "backend", "guides", lang);
      for (const f of fs.readdirSync(dir)) {
        const html = fs.readFileSync(path.join(dir, f), "utf8");
        expect(html).toContain(lang === "de" ? 'href="/impressum"' : 'href="/legal-notice"');
      }
    }
  });
});

describe("terms no longer point to the closed EU ODR platform", () => {
  /* The EU shut the online dispute resolution platform on 20 July 2025
     (Regulation (EU) 2024/3228), and the duty to link to it ended with it.
     A dead link in the governing law section of the terms reads as terms
     nobody maintains. All three copies are checked, since they must agree. */
  it("in the served English, the in-app copy and the German", () => {
    for (const f of [["backend", "server.js"], ["app", "terms-of-service.tsx"], ["backend", "legal-de.json"]]) {
      expect(read(...f)).not.toMatch(/consumers\/odr/);
    }
  });
});
