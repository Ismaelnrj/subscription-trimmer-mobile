"""Turns the design handoff into the pages the server actually serves.

The handoff is frontend complete and backend neutral. This applies the
four things it cannot know: the real endpoint names, this backend's error
shape, the fact that there is no web app to redirect into, and that its
logo is a 1.5MB PNG embedded five times.

It emits two pages from one source: backend/landing.html (English, served at
/) and backend/landing-de.html (German, served at /de), paired with hreflang
and a switch in the nav. Two URLs rather than a client side toggle, because a
toggle leaves Google with one page and half the content invisible to it.
"""
import json, re, pathlib

# The handoff originally arrived as a session upload, which does not survive
# the container. tools/landing-source.html is a committed copy with the five
# inlined PNGs already stripped, so this stays runnable. The upload path is
# still honoured when present, so a fresh handoff can be dropped in.
UPLOAD = "/root/.claude/uploads/572e8a57-90e7-50e4-9543-30207f74f2cf/0064f5a7-trimiopremiumauthready.html"
COMMITTED = "tools/landing-source.html"

if pathlib.Path(UPLOAD).exists():
    SRC = UPLOAD
elif pathlib.Path(COMMITTED).exists():
    SRC = COMMITTED
else:
    raise SystemExit(
        f"No handoff found. Expected {COMMITTED} in the repo, or a fresh "
        f"upload at {UPLOAD}.")
print(f"source: {SRC}")
s = pathlib.Path(SRC).read_text(encoding="utf-8")
before = len(s)

CANON = "https://www.subtrimio.com"   # www is what the CNAME actually serves;
                                      # the bare domain 301s to it, so pointing
                                      # canonicals at the bare host published a
                                      # redirect as the preferred URL

# 1. one cached vector instead of the same PNG inlined five times
s, n = re.subn(r'data:image/png;base64,[A-Za-z0-9+/=]+', '/mark.svg', s)
print(f"replaced {n} embedded PNGs with /mark.svg")

# 2. search and share plumbing the handoff has no way to know about
# __CANON_PATH__ and the og/schema strings are swapped per language further
# down, so this block is written once and specialised twice.
head = f'''  <link rel="canonical" href="{CANON}__CANON_PATH__" />
  <link rel="alternate" hreflang="en" href="{CANON}/" />
  <link rel="alternate" hreflang="de" href="{CANON}/de" />
  <link rel="alternate" hreflang="x-default" href="{CANON}/" />
  <link rel="icon" type="image/svg+xml" href="/mark.svg" />
  <link rel="apple-touch-icon" href="/icon.png?v=3" />
  <meta property="og:title" content="__OG_TITLE__" />
  <meta property="og:description" content="__OG_DESC__" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="__OG_LOCALE__" />
  <meta property="og:url" content="{CANON}__CANON_PATH__" />
  <meta property="og:image" content="{CANON}/og.png?v=3" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="__OG_TITLE__" />
  <meta name="twitter:description" content="__TW_DESC__" />
  <meta name="twitter:image" content="{CANON}/og.png?v=3" />
  <script type="application/ld+json">
  {{"@context":"https://schema.org","@type":"SoftwareApplication","name":"Trimio",
   "operatingSystem":"Android","applicationCategory":"FinanceApplication",
   "url":"{CANON}__CANON_PATH__",
   "inLanguage":"__LANG__",
   "description":"__SCHEMA_DESC__",
   "offers":{{"@type":"Offer","price":"0","priceCurrency":"EUR"}},
   "author":{{"@type":"Person","name":"Ismael Naranjo"}},
   "installUrl":"https://play.google.com/store/apps/details?id=com.trimio.app"}}
  </script>
'''
s = s.replace("  <title>Trimio | Know before you pay</title>\n",
              "  <title>Trimio | Know before you pay</title>\n" + head, 1)

# 3. this backend's real routes and error shape
s = s.replace("    signup: '/api/auth/signup',", "    signup: '/api/auth/register',")
s = s.replace("    session: '/api/auth/session'", "    session: '/api/auth/me'")
s = s.replace("if (!response.ok) throw new Error(data.message || 'Something went wrong. Please try again.');",
              "// this backend returns { error }, the handoff assumed { message }\n"
              "    if (!response.ok) throw new Error(data.error || data.message || 'Something went wrong. Please try again.');")

# 4. there is no web app behind /account, so signing in lands on the same
#    panel the signup flow uses rather than a 404
s = s.replace("""      const data = await request(API.login, { method: 'POST', body: JSON.stringify(body) });
      window.location.href = data.redirect || '/account';""",
"""      const data = await request(API.login, { method: 'POST', body: JSON.stringify(body) });
      const name = data.user && data.user.name;
      successTitle.textContent = name ? 'Welcome back, ' + name + '.' : 'Welcome back.';
      successBody.textContent = 'Your account is ready. Open Trimio on Android and sign in with this same email.';
      authView.hidden = true;
      authSuccess.hidden = false;""")

# signup success names the verification step, which the account genuinely has
s = s.replace("""      await request(API.signup, { method: 'POST', body: JSON.stringify(body) });
      authView.hidden = true;
      authSuccess.hidden = false;""",
"""      await request(API.signup, { method: 'POST', body: JSON.stringify(body) });
      successTitle.textContent = 'Your account is ready';
      successBody.textContent = 'A verification code is on its way to ' + body.email +
        '. Install Trimio, sign in with this email, and enter the code there.';
      authView.hidden = true;
      authSuccess.hidden = false;""")

s = s.replace("  const authSuccess = document.getElementById('authSuccess');",
              "  const authSuccess = document.getElementById('authSuccess');\n"
              "  const successTitle = authSuccess.querySelector('h2');\n"
              "  const successBody = authSuccess.querySelector('p');")

# 5. Google sign in needs a browser OAuth client this backend does not have,
#    so the button is removed rather than shipped as a dead link
s, g = re.subn(r'\s*<button class="auth-google"[^>]*>.*?</button>\s*<div class="auth-divider">or use email</div>',
               '', s, flags=re.S)
print(f"removed {g} Google buttons (no browser OAuth client configured)")
s = s.replace("""  document.querySelectorAll('[data-google-auth]').forEach((button) => {
    button.addEventListener('click', () => {
      const intent = button.dataset.googleAuth;
      window.location.href = API.google + '?intent=' + encodeURIComponent(intent);
    });
  });

""", "")
s = s.replace("    google: '/api/auth/google',\n", "")

# the divider's rules are left with nothing to style once the Google
# button goes, so drop them rather than ship dead CSS
s = re.sub(r'\.auth-divider \{[^}]*\}\n', '', s)
s = re.sub(r'\.auth-divider::before[^}]*\}\n', '', s)
s = s.replace('.auth-brand img { width: 34px; height: 34px; border-radius: 10px; }\n', '')

# 6. flat tabs with an underline, instead of the grey segmented pill
s = s.replace(
    ".auth-tabs { display: grid; grid-template-columns: 1fr 1fr; padding: 4px; "
    "background: #ECEBE6; border-radius: 999px; margin-bottom: 22px; }",
    ".auth-tabs { display: grid; grid-template-columns: 1fr 1fr; "
    "border-bottom: 1px solid var(--line); margin-bottom: 22px; }")
s = s.replace(
    ".auth-tab { border: 0; border-radius: 999px; padding: 11px 14px; "
    "background: transparent; color: var(--slate); font-weight: 800; cursor: pointer; }",
    ".auth-tab { border: 0; border-bottom: 3px solid transparent; margin-bottom: -1px; "
    "padding: 12px 8px; background: transparent; color: var(--slate); font-weight: 800; "
    "cursor: pointer; transition: color .18s ease, border-color .18s ease; }\n"
    ".auth-tab:hover { color: var(--navy); }")
s = s.replace(
    ".auth-tab.is-active { background: white; color: var(--navy); "
    "box-shadow: 0 5px 14px rgba(20,43,58,.08); }",
    ".auth-tab.is-active { color: var(--navy); border-bottom-color: var(--mint); }")

# 7. the password rule the backend actually enforces. The handoff asked for
#    8 characters; validatePassword also wants an uppercase and a digit, so
#    "password" passed here and then bounced off the server.
s = s.replace("<div class=\"password-note\">Use at least 8 characters.</div>",
              "<div class=\"password-note\">At least 8 characters, with one uppercase "
              "letter and one number.</div>")
s = s.replace('placeholder="At least 8 characters"',
              'placeholder="At least 8 characters, one capital, one number"')
s = s.replace("""  function setMode(mode) {""",
"""  // mirrors validatePassword in backend/server.js, so the rule is enforced
  // before a round trip rather than coming back as a server error
  function passwordProblem(pw) {
    if (!pw || pw.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
    return null;
  }

  function setMode(mode) {""")
s = s.replace("""      await request(API.signup, { method: 'POST', body: JSON.stringify(body) });""",
"""      const pwProblem = passwordProblem(body.password);
      if (pwProblem) throw new Error(pwProblem);
      await request(API.signup, { method: 'POST', body: JSON.stringify(body) });""")

# 8. reveal control on both password fields. Typing a password that has to
#    carry a capital and a digit, blind, on a phone, is where signups die.
PW_CSS = """.pw-wrap { position: relative; display: block; }
.pw-wrap input { padding-right: 48px; }
.pw-toggle {
  position: absolute; top: 50%; right: 7px; transform: translateY(-50%);
  display: grid; place-items: center; width: 34px; height: 34px; padding: 0;
  border: 0; border-radius: 10px; background: transparent; color: #7B888F; cursor: pointer;
  transition: color .15s ease, background .15s ease;
}
.pw-toggle:hover { color: var(--navy); background: rgba(20,43,58,.06); }
.pw-toggle:focus-visible { outline: 2px solid var(--mint); outline-offset: 2px; }
.pw-toggle svg { width: 19px; height: 19px; }
.pw-toggle svg[hidden] { display: none; }
.password-note {"""
s = s.replace(".password-note {", PW_CSS, 1)

EYE = '<svg class="pw-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
EYE_OFF = '<svg class="pw-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><path d="M3 3l18 18"/><path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.6 4.4"/><path d="M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'

for fid in ("signupPassword", "loginPassword"):
    start = s.index('<input id="' + fid + '"')
    end = s.index("/>", start) + 2
    s = (s[:start]
         + '<span class="pw-wrap">' + s[start:end]
         + '<button class="pw-toggle" type="button" data-pw-toggle="' + fid + '" '
           'aria-pressed="false" aria-label="Show password" title="Show password">'
         + EYE + EYE_OFF + '</button></span>'
         + s[end:])

s = s.replace("  function setMode(mode) {",
"""  document.querySelectorAll('[data-pw-toggle]').forEach((btn) => {
    const input = document.getElementById(btn.dataset.pwToggle);
    if (!input) return;
    btn.addEventListener('click', () => {
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      btn.setAttribute('aria-pressed', reveal ? 'true' : 'false');
      const label = reveal ? 'Hide password' : 'Show password';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      // `hidden` is an HTMLElement property; assigning it on an SVG element
      // sets a plain JS property and changes nothing, so set the attribute.
      btn.querySelector('.pw-on').toggleAttribute('hidden', reveal);
      btn.querySelector('.pw-off').toggleAttribute('hidden', !reveal);
      input.focus();
      const end = input.value.length;
      try { input.setSelectionRange(end, end); } catch (_) {}
    });
  });

  function setMode(mode) {""", 1)

# 9. the reveal animation must not be load bearing. Everything below the
#    hero starts at opacity 0 and only appears when an observer fires, so
#    without JS, without IntersectionObserver, or for a reader who asked
#    for less motion, the page was blank past the fold.
s = s.replace(
    ".reveal { opacity: 0; transform: translateY(24px); transition: opacity .8s ease, transform .8s ease; }",
    ".reveal { opacity: 0; transform: translateY(24px); transition: opacity .8s ease, transform .8s ease; }\n"
    "@media (prefers-reduced-motion: reduce) {\n"
    "  .reveal { opacity: 1; transform: none; transition: none; }\n"
    "}")
s = s.replace("</style>",
    "</style>\n"
    "<noscript><style>.reveal { opacity: 1 !important; transform: none !important; }</style></noscript>", 1)
s = s.replace("""const revealItems = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {""",
"""const revealItems = document.querySelectorAll('.reveal');
const prefersLessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersLessMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('visible'));
}
const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {""")
s = s.replace("""}, { threshold: 0.12 });
revealItems.forEach((item) => revealObserver.observe(item));""",
"""}, { threshold: 0.12 }) : null;
if (revealObserver && !prefersLessMotion) {
  revealItems.forEach((item) => revealObserver.observe(item));
}""")

# 10. the footer pointed at /privacy, which this server does not serve. It
#     serves /privacy-policy. Relative so it works on any host.
s = s.replace('<a href="https://www.subtrimio.com/privacy">Privacy</a>',
              '<a href="/terms">Terms</a><a href="/privacy-policy">Privacy</a>')

# 11. the consent asked people to agree to a Terms document that does not
#     exist, and to a policy they could not open. Link the policy that is
#     real, drop the reference to the one that is not.
s = s.replace("<span>I agree to the Terms and Privacy Policy.</span>",
              '<span>I agree to the <a href="/terms" target="_blank" rel="noopener">Terms</a>'
              ' and the <a href="/privacy-policy" target="_blank" rel="noopener">'
              'Privacy Policy</a>.</span>')
s = s.replace(".password-note {",
              ".check-row a { color: var(--navy); text-decoration: underline; "
              "text-underline-offset: 2px; }\n.password-note {", 1)

# 12. footer links were 15px tall, under any reasonable touch target
s = s.replace(".footer div a", ".footer div a")
s = s.replace(".password-note {",
              ".footer div a { display: inline-block; padding: 14px 2px; }\n.password-note {", 1)

# 13. the hero must be whole at rest. Its phone mockup carried .reveal and
#     sits just past the fold on a phone, so first paint showed the copy
#     above 570px of blank space until the reader happened to scroll. The
#     first screen is not the place for a scroll triggered entrance.
s = re.sub(r'(<div class="hero-copy)[^"]*(")', r'\1\2', s)
s = re.sub(r'(<div class="hero-visual)[^"]*(")', r'\1\2', s)

# 14. Google sign in lives in the app, not here. Strip the rules its button
#     left behind.
s = re.sub(r'\.auth-google \{[^}]*\}\n', '', s)
s = re.sub(r'\.auth-google:hover[^}]*\}\n', '', s)
s = re.sub(r'\.google-dot \{[^}]*\}\n', '', s)

# 15. an account created with Google in the app has no password, so signing
#     in here returns "Invalid email or password", which is true but
#     misleading. The backend must keep that generic wording or it would
#     reveal which addresses exist, so the hint goes on the page instead.
s = s.replace("""    } catch (error) {
      loginMessage.className = 'auth-message error';
      loginMessage.textContent = error.message;""",
"""    } catch (error) {
      loginMessage.className = 'auth-message error';
      loginMessage.textContent = error.message;
      const hint = document.createElement('div');
      hint.className = 'auth-hint';
      hint.textContent = 'If you created your account with Google, open Trimio on Android and sign in there instead.';
      loginMessage.appendChild(hint);""")
s = s.replace(".password-note {",
              ".auth-hint { margin-top: 7px; color: var(--slate); font-size: 12px; "
              "font-weight: 500; line-height: 1.5; }\n.password-note {", 1)

# 16. the page had no analytics at all, so the moment content starts pointing
#     at subtrimio.com the funnel goes dark at its own front door: installs
#     could be counted in Play Console and in app events in PostHog, with
#     nothing in between saying whether this page converts.
#
#     It is deliberately the smallest thing that answers that question, and
#     it is built to match what the app already promises rather than to
#     collect what a marketing page usually would:
#       - autocapture off and session recording off, the same two switches
#         lib/analytics.ts turns off for the same reason
#       - persistence in memory, so no cookie and nothing in localStorage.
#         That costs returning visitor identity, a visitor on Tuesday and the
#         same visitor on Friday are two people here, but it keeps the page
#         free of a consent banner, and the question being asked is answered
#         inside one session anyway: did this visit reach a signup
#       - Do Not Track honoured before the script is even fetched
#       - no email, no name, no form contents ever sent
#     If richer attribution is wanted later that is a cookie, and a cookie
#     is a consent banner, and that is a product decision rather than a
#     build step.
analytics = '''  <script>
  (function () {
    var KEY = 'phc_wFoqNGYxoY64mxQ5TMrJbME5KP3xii7GvTkvp7hs4q6P';
    // Same EU project as the app. PostHog's EU and US regions are separate
    // ingest endpoints, so this host has to match where the project lives
    // or events are accepted by nothing and fail silently.
    var HOST = 'https://eu.i.posthog.com';
    // Every call site goes through this, so the page behaves identically
    // whether or not the library ever loads.
    window.trimioTrack = function () {};
    try {
      if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
    } catch (e) { return; }
    var s = document.createElement('script');
    s.src = 'https://eu-assets.i.posthog.com/static/array.js';
    s.async = true;
    s.onload = function () {
      if (!window.posthog || !window.posthog.init) return;
      window.posthog.init(KEY, {
        api_host: HOST,
        autocapture: false,
        disable_session_recording: true,
        capture_pageview: true,
        persistence: 'memory',
        respect_dnt: true
      });
      window.trimioTrack = function (event, props) {
        try { window.posthog.capture(event, props); } catch (e) {}
      };
    };
    // Analytics is never allowed to be the reason the page misbehaves.
    s.onerror = function () {};
    document.head.appendChild(s);
  })();
  </script>
'''
assert s.count("</head>") == 1
s = s.replace("</head>", analytics + "</head>", 1)

# the two things worth knowing about this page: did a visit become an
# account, and did a visit leave for the Play Store instead. Neither event
# carries anything the visitor typed.
s = s.replace("""        '. Install Trimio, sign in with this email, and enter the code there.';""",
"""        '. Install Trimio, sign in with this email, and enter the code there.';
      window.trimioTrack('landing_signup_completed');""")

s = s.replace("""  signupForm.addEventListener('submit', async (event) => {""",
"""  // Delegated, so it covers all four store links and any added later. The
  // section id says which one was tapped without naming anything personal.
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href*="play.google.com"]');
    if (!link) return;
    var section = link.closest('section');
    window.trimioTrack('landing_play_store_click', { section: (section && section.id) || 'unknown' });
  });

  signupForm.addEventListener('submit', async (event) => {""")

# 12. language switch, and the two pages it moves between.
#
# It is a pair of links, not a JS toggle that swaps text in place. A toggle
# would leave one URL carrying both languages, which means Google indexes one
# of them and the German copy is effectively invisible, which defeats the
# reason for translating at all. Two URLs, paired by hreflang, each indexable.
LANG_CSS = """.lang-switch { display: inline-flex; align-items: center; gap: 2px; margin-left: 14px;
  border: 1px solid var(--line); border-radius: 999px; padding: 3px; }
.lang-switch a { display: block; padding: 4px 10px; border-radius: 999px; font-size: 13px;
  font-weight: 800; color: var(--slate); text-decoration: none; line-height: 1.4;
  transition: color .15s ease, background .15s ease; }
.lang-switch a:hover { color: var(--navy); }
.lang-switch a[aria-current="true"] { background: var(--navy); color: #fff; }
@media (max-width: 720px) { .lang-switch { margin-left: 8px; } }
.nav-cta {"""
assert s.count(".nav-cta {") >= 1
s = s.replace(".nav-cta {", LANG_CSS, 1)

SWITCH = ('<div class="lang-switch">'
          '<a href="/" hreflang="en" aria-current="__EN_CUR__" lang="en">EN</a>'
          '<a href="/de" hreflang="de" aria-current="__DE_CUR__" lang="de">DE</a>'
          '</div>\n        ')
s = s.replace('<button class="button button-dark nav-cta"', SWITCH +
              '<button class="button button-dark nav-cta"', 1)

# ---------------------------------------------------------------- two pages

EN_META = {
    "__CANON_PATH__": "/",
    "__LANG__": "en",
    "__OG_LOCALE__": "en_US",
    "__OG_TITLE__": "Trimio: know before you pay",
    "__OG_DESC__": "Trimio keeps every renewal visible and gives you time to decide, without ever asking for your bank login.",
    "__TW_DESC__": "The subscription reminder that arrives before the charge, not after.",
    "__SCHEMA_DESC__": "Trimio tells you what a subscription is about to charge before it does, without ever asking for your bank login.",
    "__EN_CUR__": "true",
    "__DE_CUR__": "false",
}
DE_META = {
    "__CANON_PATH__": "/de",
    "__LANG__": "de",
    "__OG_LOCALE__": "de_DE",
    "__OG_TITLE__": "Trimio: wissen, bevor abgebucht wird",
    "__OG_DESC__": "Trimio hält jede Verlängerung sichtbar und lässt dir Zeit zu entscheiden, ohne je nach deinem Bankzugang zu fragen.",
    "__TW_DESC__": "Die Abo-Erinnerung, die vor der Abbuchung kommt, nicht danach.",
    "__SCHEMA_DESC__": "Trimio sagt dir, was ein Abo gleich abbuchen wird, bevor es passiert, ohne je nach deinem Bankzugang zu fragen.",
    "__EN_CUR__": "false",
    "__DE_CUR__": "true",
}


def fill(page, meta):
    for k, v in meta.items():
        page = page.replace(k, v)
    assert "__" not in re.sub(r'__\w+__', lambda m: '' if m.group(0) in meta else m.group(0), page) or True
    leftover = set(re.findall(r'__[A-Z_]+__', page))
    assert not leftover, f"unfilled placeholders: {leftover}"
    return page


def germanise(page, table):
    """Longest first, so a short entry cannot eat a substring of a long one.

    "Cancel" is a substring of nothing here, but "Create account" and "Create
    your account" overlap, and replacing the short one first would leave
    "Konto erstellen your account". Sorting by length removes that whole class
    of bug rather than requiring every entry to be checked by hand.
    """
    hits = 0
    for en in sorted(table, key=len, reverse=True):
        if en.startswith("_"):
            continue
        if en in page:
            page = page.replace(en, table[en])
            hits += 1
    return page, hits


en_page = fill(s, EN_META)
out = pathlib.Path("backend/landing.html")
out.write_text(en_page, encoding="utf-8")
# Only the raw upload is meaningfully larger than the output; the committed
# source already has the PNGs stripped, so reporting a reduction against it
# prints a negative percentage and reads as a bug.
delta = (f" ({100 - len(en_page) * 100 // before}% smaller)"
         if len(en_page) < before else "")
print(f"wrote {out}: {before:,} -> {len(en_page):,} bytes{delta}")

table = json.loads(pathlib.Path("tools/landing-de.json").read_text(encoding="utf-8"))
de_page = fill(s, DE_META)
de_page, hits = germanise(de_page, table)
de_page = de_page.replace('<html lang="en"', '<html lang="de"', 1)
de_page = de_page.replace("<title>Trimio | Know before you pay</title>",
                          "<title>Trimio | Wissen, bevor abgebucht wird</title>", 1)
# German writes a decimal comma. The mockup prices are the only numbers on the
# page, and 17.99 reads as a thousands separator to a German eye.
de_page = re.sub(r'€(\d+)\.(\d\d)\b', r'€\1,\2', de_page)
de_out = pathlib.Path("backend/landing-de.html")
de_out.write_text(de_page, encoding="utf-8")
print(f"wrote {de_out}: {len(de_page):,} bytes, {hits} strings translated")

s = en_page  # the assertions below check the page that is actually served at /
for probe in ("data:image/png", "/api/auth/signup", '<button class="auth-google"',
              "data-google-auth", "|| '/account'"):
    assert probe not in s, f"leftover: {probe}"
assert s.count("/mark.svg") >= 5
print("checks passed: no embedded PNG, no signup route, no Google button or handler,")
print("no /account redirect, mark referenced as a shared file")

for probe in ("eu-assets.i.posthog.com/static/array.js",
              "landing_signup_completed",
              "landing_play_store_click",
              "persistence: 'memory'",
              "respect_dnt: true",
              "autocapture: false"):
    assert probe in s, f"analytics not wired: {probe}"
assert "disable_session_recording: true" in s
print("checks passed: analytics present, cookieless, autocapture and replay off")
