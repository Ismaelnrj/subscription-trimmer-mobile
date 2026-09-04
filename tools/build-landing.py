"""Turns the design handoff into the page the server actually serves.

The handoff is frontend complete and backend neutral. This applies the
four things it cannot know: the real endpoint names, this backend's error
shape, the fact that there is no web app to redirect into, and that its
logo is a 1.5MB PNG embedded five times.
"""
import re, pathlib

SRC = "/root/.claude/uploads/572e8a57-90e7-50e4-9543-30207f74f2cf/0064f5a7-trimiopremiumauthready.html"
s = pathlib.Path(SRC).read_text(encoding="utf-8")
before = len(s)

# 1. one cached vector instead of the same PNG inlined five times
s, n = re.subn(r'data:image/png;base64,[A-Za-z0-9+/=]+', '/mark.svg', s)
print(f"replaced {n} embedded PNGs with /mark.svg")

# 2. search and share plumbing the handoff has no way to know about
head = '''  <link rel="canonical" href="https://subtrimio.com/" />
  <link rel="icon" type="image/svg+xml" href="/mark.svg" />
  <link rel="apple-touch-icon" href="/icon.png?v=3" />
  <meta property="og:title" content="Trimio: know before you pay" />
  <meta property="og:description" content="Trimio keeps every renewal visible and gives you time to decide, without ever asking for your bank login." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://subtrimio.com/" />
  <meta property="og:image" content="https://subtrimio.com/og.png?v=3" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Trimio: know before you pay" />
  <meta name="twitter:description" content="The subscription reminder that arrives before the charge, not after." />
  <meta name="twitter:image" content="https://subtrimio.com/og.png?v=3" />
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"SoftwareApplication","name":"Trimio",
   "operatingSystem":"Android","applicationCategory":"FinanceApplication",
   "url":"https://subtrimio.com/",
   "description":"Trimio tells you what a subscription is about to charge before it does, without ever asking for your bank login.",
   "offers":{"@type":"Offer","price":"0","priceCurrency":"EUR"},
   "author":{"@type":"Person","name":"Ismael Naranjo"},
   "installUrl":"https://play.google.com/store/apps/details?id=com.trimio.app"}
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

out = pathlib.Path("backend/landing.html")
out.write_text(s, encoding="utf-8")
print(f"wrote {out}: {before:,} -> {len(s):,} bytes ({100 - len(s) * 100 // before}% smaller)")
for probe in ("data:image/png", "/api/auth/signup", '<button class="auth-google"',
              "data-google-auth", "|| '/account'"):
    assert probe not in s, f"leftover: {probe}"
assert s.count("/mark.svg") >= 5
print("checks passed: no embedded PNG, no signup route, no Google button or handler,")
print("no /account redirect, mark referenced as a shared file")
