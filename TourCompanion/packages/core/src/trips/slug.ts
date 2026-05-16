// Public-trip slug generator.
//
// Mirrors the Python `secrets.token_urlsafe(8)[:10]` recipe used in
// server/app/routes/trips.py: 8 random bytes → base64url → first 10 chars.
// Uses Web Crypto (available globally in Node 20+, browsers, Capacitor WebView)
// rather than Node-only `crypto.randomBytes`.

const URLSAFE_RE = /^[A-Za-z0-9_-]+$/;

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // btoa is available in Node 20+ globally and in browsers.
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateSlug(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const slug = bytesToBase64Url(bytes).slice(0, 10);
  // Sanity check: every char should be urlsafe. base64url guarantees this.
  if (!URLSAFE_RE.test(slug) || slug.length !== 10) {
    throw new Error("generateSlug: produced invalid slug");
  }
  return slug;
}
