/* The account deletion confirmation, pinned as source structure.

   Exercising the route needs a database and a Brevo key, so this reads the
   handler instead. Weaker, and worth stating: it would not catch an email that
   sent but arrived empty. What it DOES catch is the ordering and the
   fire-and-forget, which are the two properties that would turn a courtesy
   email into a failed deletion. */

const fs = require("fs");
const path = require("path");

const SERVER = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

function handlerSource(verb, route) {
  const start = SERVER.indexOf(`app.${verb}('${route}'`);
  if (start === -1) throw new Error(`route ${verb} ${route} not found`);
  const rest = SERVER.slice(start + 1);
  const next = rest.search(/\napp\.(get|post|put|delete|use)\(/);
  return next === -1 ? rest : rest.slice(0, next);
}

const DELETE_HANDLER = handlerSource("delete", "/api/auth/account");

describe("deleting an account tells the person it happened", () => {
  it("sends the confirmation", () => {
    expect(DELETE_HANDLER).toMatch(/sendAccountDeletedEmail\(/);
  });

  it("reads the address BEFORE the row is deleted", () => {
    /* After the DELETE there is nowhere left to look the address up, so
       capturing it late would send the confirmation to undefined. */
    const captured = DELETE_HANDLER.indexOf("const deletedEmail");
    const deleted = DELETE_HANDLER.indexOf("DELETE FROM users");
    expect(captured).toBeGreaterThan(-1);
    expect(deleted).toBeGreaterThan(-1);
    expect(captured).toBeLessThan(deleted);
  });

  it("never awaits the send into the response", () => {
    /* sendEmail retries three times with a backoff. Awaiting it would hold the
       response for seconds and could then fail a deletion that has already
       happened irreversibly, which is the worst of both. */
    expect(DELETE_HANDLER).not.toMatch(/await\s+sendAccountDeletedEmail/);
  });

  it("swallows a send failure rather than rejecting the request", () => {
    expect(DELETE_HANDLER).toMatch(/sendAccountDeletedEmail\([\s\S]*?\.catch\(/);
  });

  it("still answers success, and still erases the PostHog person", () => {
    expect(DELETE_HANDLER).toMatch(/res\.json\(\{ success: true \}\)/);
    expect(DELETE_HANDLER).toMatch(/deletePostHogPerson\(req\.userId\)/);
  });

  it("picks the language from the FIRST Accept-Language tag", () => {
    // Matching `de` anywhere would serve German to "en-GB,de;q=0.7", who asked
    // for English. Same rule the /delete-account page already uses.
    expect(DELETE_HANDLER).toMatch(/\/\^\\s\*de\\b\/i/);
  });
});

describe("the confirmation copy", () => {
  const BODY = SERVER.slice(
    SERVER.indexOf("const DELETED_EMAIL"),
    SERVER.indexOf("// crypto.randomInt")
  );

  it("exists in both languages", () => {
    expect(BODY).toMatch(/\ben:\s*\{/);
    expect(BODY).toMatch(/\bde:\s*\{/);
  });

  it("carries no unsubscribe footer", () => {
    /* Transactional, not bulk, so RFC 8058 does not apply. More to the point,
       unsubscribeUrlFor HMACs the user id, which by now names a row that no
       longer exists, so the link would resolve to nothing. */
    expect(BODY).not.toMatch(/emailFooter/);
  });

  it("uses no dash as clause punctuation, in either language", () => {
    const offenders = BODY.match(/\S\s+[-–—]\s+\S|—/g);
    expect(offenders).toBeNull();
  });

  it("keeps the German informal, matching every other Trimio surface", () => {
    const german = BODY.slice(BODY.indexOf("de: {"));
    expect(german).not.toMatch(/\bSie\b/);
    expect(german).toMatch(/\bdu\b|\bdein/i);
  });
});

describe("the client tells the server which language it is in", () => {
  const API = fs.readFileSync(path.join(__dirname, "..", "lib", "api.ts"), "utf8");

  it("sends Accept-Language", () => {
    // Without it the backend has no language signal at all: there is no
    // language column on the user, so every German user would get English.
    expect(API).toMatch(/Accept-Language/);
  });

  it("normalises to a bare tag the server's first-tag test can match", () => {
    expect(API).toMatch(/startsWith\("de"\)\s*\?\s*"de"\s*:\s*"en"/);
  });

  it("cannot break a request if i18n throws", () => {
    /* Anchored on the ASSIGNMENT, not on the first mention of the header name:
       the comment above it says "Accept-Language" too, so a bare indexOf lands
       in prose and the slice comes back without the code it is meant to check.
       That produced a false failure while these were being written. */
    const idx = API.indexOf('config.headers["Accept-Language"]');
    expect(idx).toBeGreaterThan(-1);
    const around = API.slice(idx - 60, idx + 200);
    expect(around).toMatch(/try\s*\{/);
    expect(around).toMatch(/catch/);
  });
});
