// api/auth.js - Supabase auth proxy (the secret key stays server-side)
export const config = { runtime: 'edge' };

const DEFAULT_SUPABASE_URL = 'https://dqpmyxqpssnpsxrbdysw.supabase.co';
// The publishable key is public by design (browsers use it too), so it is safe to keep in code.
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_xOnT1E3Wlzw1liNEyS3E6w_fCOq8FVy';

const RATE_BUCKETS = new Map();
const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 60_000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// New-style keys (sb_secret_...) go in the apikey header only. Old JWT keys (eyJ...) also need Authorization.
function keyHeaders(key) {
  const headers = { 'apikey': key };
  if (key.startsWith('eyJ')) headers['Authorization'] = `Bearer ${key}`;
  return headers;
}

function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || process.env.LEAD_ALERT_EMAIL || '';
  return raw.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function isAllowedAdmin(email) {
  const list = getAdminEmails();
  if (!list.length) {
    console.warn('[auth] ADMIN_EMAILS is not set — any signed-in user can access admin. Set ADMIN_EMAILS in Vercel.');
    return true;
  }
  return !!(email && list.includes(String(email).trim().toLowerCase()));
}

function clientIp(req) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

function allowRequest(ip) {
  const now = Date.now();
  let bucket = RATE_BUCKETS.get(ip);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    RATE_BUCKETS.set(ip, bucket);
  }
  bucket.count += 1;
  if (RATE_BUCKETS.size > 2000) {
    for (const [key, val] of RATE_BUCKETS) {
      if (now > val.resetAt) RATE_BUCKETS.delete(key);
    }
  }
  return bucket.count <= RATE_LIMIT;
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { action } = body;

  if (action === 'signIn') {
    if (!allowRequest(clientIp(req))) {
      return json({ error: 'Too many sign-in attempts. Please wait a minute.' }, 429);
    }
    const { email, password } = body;
    if (!email || !password) return json({ error: 'Email and password required' }, 400);
    const cleanEmail = String(email).trim().toLowerCase();

    // Reject non-admin emails before hitting Supabase when an allowlist is configured
    if (!isAllowedAdmin(cleanEmail)) {
      return json({ error: 'Invalid credentials' }, 401);
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password })
    });
    const data = await res.json();
    if (!res.ok) {
      let errorMsg = data.error_description || data.msg || data.message || (typeof data.error === 'string' ? data.error : null) || 'Invalid credentials';
      // A key error means the server is talking to a different Supabase project than the key belongs to.
      // Name the project host (not a secret) so the setting that is wrong is easy to find.
      if (/api key/i.test(errorMsg)) {
        let host = SUPABASE_URL;
        try { host = new URL(SUPABASE_URL).host; } catch { /* keep the raw value */ }
        errorMsg += ` (this server is using ${host}; check SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in its environment)`;
      }
      return json({ error: errorMsg }, res.status || 401);
    }

    const sessionEmail = (data.user && data.user.email) ? String(data.user.email).toLowerCase() : cleanEmail;
    if (!isAllowedAdmin(sessionEmail)) {
      return json({ error: 'Invalid credentials' }, 401);
    }

    return json({ session: { access_token: data.access_token, user: data.user } });
  }

  if (action === 'getUser') {
    const { token } = body;
    if (!token) return json({ user: null });
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': PUBLISHABLE_KEY, 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return json({ user: null });
    const user = await res.json();
    if (!isAllowedAdmin(user && user.email)) return json({ user: null });
    return json({ user });
  }

  // Change the admin login email and/or password. Needs a valid session AND the current password.
  if (action === 'updateAccount') {
    const { token, currentPassword, newEmail, newPassword } = body;
    if (!SERVICE_KEY) return json({ error: 'The server secret key (SUPABASE_SERVICE_KEY) is not set in Vercel.' }, 503);
    if (!token) return json({ error: 'Session expired. Sign in again.' }, 401);
    if (!currentPassword) return json({ error: 'Enter your current password.' }, 400);

    const cleanNewEmail = newEmail ? String(newEmail).trim().toLowerCase() : '';
    const cleanNewPassword = newPassword ? String(newPassword) : '';
    if (!cleanNewEmail && !cleanNewPassword) return json({ error: 'Enter a new email, a new password, or both.' }, 400);
    if (cleanNewEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanNewEmail)) return json({ error: 'Enter a valid email address.' }, 400);
    if (cleanNewPassword && cleanNewPassword.length < 10) return json({ error: 'The new password must be at least 10 characters.' }, 400);

    // New login email must already be on the allowlist (add it in Vercel ADMIN_EMAILS first)
    if (cleanNewEmail && !isAllowedAdmin(cleanNewEmail)) {
      return json({ error: 'Add this email to ADMIN_EMAILS in Vercel before switching to it.' }, 400);
    }

    // 1. Find out who is signed in
    const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': PUBLISHABLE_KEY, 'Authorization': `Bearer ${token}` }
    });
    if (!meRes.ok) return json({ error: 'Session expired. Sign in again.' }, 401);
    const me = await meRes.json();
    if (!me || !me.id || !me.email) return json({ error: 'Session expired. Sign in again.' }, 401);
    if (!isAllowedAdmin(me.email)) return json({ error: 'Unauthorized' }, 401);

    // 2. Re-check the current password
    const checkRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: me.email, password: String(currentPassword) })
    });
    if (!checkRes.ok) return json({ error: 'The current password is incorrect.' }, 403);

    // 3. Apply the change through the admin endpoint, so no confirmation email is needed
    const patch = {};
    if (cleanNewEmail) { patch.email = cleanNewEmail; patch.email_confirm = true; }
    if (cleanNewPassword) patch.password = cleanNewPassword;
    const updRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(me.id)}`, {
      method: 'PUT',
      headers: { ...keyHeaders(SERVICE_KEY), 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (!updRes.ok) {
      const d = await updRes.json().catch(() => ({}));
      return json({ error: d.msg || d.message || d.error_description || 'Could not update the login.' }, updRes.status || 400);
    }
    return json({ success: true });
  }

  if (action === 'signOut') {
    const { token } = body;
    if (token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': PUBLISHABLE_KEY, 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }
    return json({ success: true });
  }

  return json({ error: 'Unknown action' }, 400);
}
