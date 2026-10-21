// api/auth.js - Supabase auth proxy (service key stays server-side)
export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://obpvzwzttrzqjamaouzh.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_SERVICE_KEY) {
    return json({ error: 'Supabase service key (SUPABASE_SERVICE_KEY) is not set in Vercel environment variables.' }, 503);
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { action } = body;

  if (action === 'signIn') {
    const { email, password } = body;
    if (!email || !password) return json({ error: 'Email and password required' }, 400);
    const cleanEmail = String(email).trim().toLowerCase();
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: cleanEmail, password })
    });
    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.error_description || data.msg || data.message || (typeof data.error === 'string' ? data.error : null) || 'Invalid credentials';
      return json({ error: errorMsg }, res.status || 401);
    }
    return json({ session: { access_token: data.access_token, user: data.user } });
  }

  if (action === 'getUser') {
    const { token } = body;
    if (!token) return json({ user: null });
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) return json({ user: null });
    const user = await res.json();
    return json({ user });
  }

  if (action === 'signOut') {
    const { token } = body;
    if (token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${token}`
        }
      }).catch(() => {});
    }
    return json({ success: true });
  }

  return json({ error: 'Unknown action' }, 400);
}
