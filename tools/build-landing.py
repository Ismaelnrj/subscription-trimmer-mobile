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

out = pathlib.Path("backend/landing.html")
out.write_text(s, encoding="utf-8")
print(f"wrote {out}: {before:,} -> {len(s):,} bytes ({100 - len(s) * 100 // before}% smaller)")
for probe in ("data:image/png", "/api/auth/signup", '<button class="auth-google"',
              "data-google-auth", "|| '/account'"):
    assert probe not in s, f"leftover: {probe}"
assert s.count("/mark.svg") >= 5
print("checks passed: no embedded PNG, no signup route, no Google button or handler,")
print("no /account redirect, mark referenced as a shared file")
