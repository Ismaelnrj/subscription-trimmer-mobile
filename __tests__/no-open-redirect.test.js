/* NO OPEN REDIRECTS, 2026-11-12, from a reel the owner sent about OAuth
   redirect attacks ("exact redirect allowlist, never trust the request, use a
   state parameter, test it yourself, review your OAuth settings").

   None of it has anything to hit today, measured rather than read:
   - Trimio has NO browser OAuth flow. Google sign in is the native ID token
     exchange in /api/auth/google, checked by google-auth-library with the
     audience pinned to GOOGLE_CLIENT_IDS and email_verified required. No
     callback URL, so no redirect allowlist and no state parameter to get
     wrong.
   - The server redirects NOWHERE. Booted on PostgreSQL 16 and sent 14 probes
     (?next=, ?redirect=, ?returnTo=, //host, %2F%2Fhost, a fake OAuth
     callback, path traversal under /fonts and the guide routes): 0 Location
     headers, 0 files served from outside their folder.
   - The app opens no URL that came from a link, a notification or a route
     parameter.

   This keeps all three true. A redirect built from the request, or a URL the
   app opens from outside data, fails here and has to argue for its place. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* Comments blanked out, newlines kept so line numbers stay true. A "//"
   right after a colon is a URL, not a comment. */
function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, (m, pre) => pre + " ".repeat(m.length - pre.length));
}

// The text of the first argument of a call whose "(" is at `open`, counting
// brackets rather than matching them.
function firstArg(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return src.slice(open + 1, i).trim();
    } else if (ch === "," && depth === 1) return src.slice(open + 1, i).trim();
  }
  return null;
}

function calls(src, re) {
  const out = [];
  for (const m of src.matchAll(re)) {
    const open = m.index + m[0].length - 1;
    out.push({ arg: firstArg(src, open), line: src.slice(0, m.index).split("\n").length });
  }
  return out;
}

const isPlainString = (a) => /^(["'])[^"'`]*\1$/.test(a) || /^`[^`$]*`$/.test(a);

function files(dir, ext) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return files(rel, ext);
    return ext.test(e.name) ? [rel] : [];
  });
}

describe("the server redirects nowhere it was told to by the request", () => {
  const BACKEND = files("backend", /\.js$/).filter((f) => !f.includes("node_modules"));

  it("scans the backend it is meant to scan", () => {
    expect(BACKEND).toEqual(expect.arrayContaining(["backend/server.js"]));
  });

  it("every redirect goes to a fixed path on this site", () => {
    const bad = [];
    for (const f of BACKEND) {
      const src = code(read(f));
      for (const { arg, line } of calls(src, /\.redirect\(/g)) {
        if (arg && /^\d+$/.test(arg)) continue; // (status, url): checked below
        if (!/^(["'`])\/(?!\/)[^"'`$]*\1$/.test(arg || "")) bad.push(`${f}:${line}: redirect(${arg})`);
      }
      // Two argument form: redirect(301, x) puts the URL second.
      for (const m of src.matchAll(/\.redirect\(\s*\d+\s*,\s*([^)]*)\)/g)) {
        if (!/^(["'`])\/(?!\/)[^"'`$]*\1$/.test(m[1].trim())) {
          bad.push(`${f}:${src.slice(0, m.index).split("\n").length}: redirect(…, ${m[1].trim()})`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("no Location header is set from anything but a fixed path", () => {
    const bad = [];
    for (const f of BACKEND) {
      const src = code(read(f));
      for (const m of src.matchAll(/(?:setHeader|header|set)\(\s*['"]location['"]\s*,\s*([^)]*)\)|\.location\(([^)]*)\)/gi)) {
        const value = (m[1] ?? m[2]).trim();
        if (!/^(["'`])\/(?!\/)[^"'`$]*\1$/.test(value)) {
          bad.push(`${f}:${src.slice(0, m.index).split("\n").length}: ${m[0]}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("Google sign in stays a pinned ID token check, not a redirect flow", () => {
    const src = read("backend/server.js");
    expect(src).toMatch(/verifyIdToken\(\{\s*idToken,\s*audience:\s*GOOGLE_CLIENT_IDS\s*\}\)/);
    expect(src).toMatch(/if \(!payload\?\.email_verified\)/);
    expect(src).not.toMatch(/redirect_uri|oauth2callback|generateAuthUrl/);
  });
});

/* Each URL the app opens that is not a plain string, with where it comes
   from. None may come from a route parameter, a deep link or a notification. */
const ALLOWED_OPEN = {
  "app/cancel-guide.tsx": {
    "guide.url": "the bundled guide catalogue, looked up by subscription name; the route never carries a URL",
  },
  "app/help-support.tsx": {
    "PRIVACY_URL(i18n.language)": "a fixed address on www.subtrimio.com, picked by language",
  },
  "app/(tabs)/subscriptions.tsx": {
    market: "the Play listing, a literal two lines above",
    web: "the Play listing, a literal two lines above",
  },
  "components/UpdateAvailableModal.tsx": {
    updateUrl: "starts as the Play listing; only Trimio's own server can change it, and it sends a constant",
  },
};

describe("the app opens no URL it was handed from outside", () => {
  const APP = [...files("app", /\.tsx?$/), ...files("components", /\.tsx?$/), ...files("lib", /\.tsx?$/)];

  it("every Linking.openURL is a fixed string or listed with its source", () => {
    const used = new Set();
    const stray = [];
    for (const f of APP) {
      const src = code(read(f));
      for (const { arg, line } of calls(src, /Linking\.openURL\(/g)) {
        if (isPlainString(arg)) continue;
        const reason = (ALLOWED_OPEN[f] || {})[arg];
        if (reason) used.add(`${f} :: ${arg}`);
        else stray.push(`${f}:${line}: Linking.openURL(${arg})`);
      }
      if (/WebBrowser\.open|openBrowserAsync|openAuthSessionAsync/.test(src)) stray.push(`${f}: opens an in-app browser`);
    }
    expect(stray).toEqual([]);
    const listed = Object.entries(ALLOWED_OPEN).flatMap(([f, m]) => Object.keys(m).map((k) => `${f} :: ${k}`));
    expect(listed.filter((k) => !used.has(k))).toEqual([]);
  });

  it("no screen navigates to a route held in a variable", () => {
    const bad = [];
    for (const f of APP) {
      const src = code(read(f));
      for (const m of src.matchAll(/router\.(push|replace|navigate)\(\s*([A-Za-z_][\w.]*)\s*(?:as [^)]*)?\)/g)) {
        bad.push(`${f}:${src.slice(0, m.index).split("\n").length}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("the update URL the server sends is a constant, so the modal cannot be pointed elsewhere", () => {
    const src = read("backend/server.js");
    const a = src.indexOf("app.get('/api/trpc/appVersion.check'");
    const block = src.slice(a, src.indexOf("});", a));
    expect(block).toMatch(/updateUrl:\s*'https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.trimio\.app'/);
  });
});
