// api/admin.js - Admin data operations proxy (service key stays server-side)
export const config = { runtime: 'edge' };

const LEADS_TABLE = 'leads';
const SETTINGS_TABLE = 'site_settings';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function verifyToken(supabaseUrl, serviceKey, token) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${token}`
    }
  });
  return res.ok;
}

async function dbFetch(supabaseUrl, serviceKey, path, method = 'GET', body, prefer) {
  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  };
  if (prefer) headers['Prefer'] = prefer;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${supabaseUrl}/rest/v1/${path}`, opts);
}

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://obpvzwzttrzqjamaouzh.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_SERVICE_KEY) return json({ error: 'Service not configured' }, 503);

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  // Settings GET is public (phone/address are visible on the public website anyway)
  const isPublicAction = action === 'settings' && req.method === 'GET';

  if (!isPublicAction) {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const valid = await verifyToken(SUPABASE_URL, SUPABASE_SERVICE_KEY, token).catch(() => false);
    if (!valid) return json({ error: 'Unauthorized' }, 401);
  }

  try {
    // GET /api/admin?action=leads
    if (action === 'leads' && req.method === 'GET') {
      const res = await dbFetch(SUPABASE_URL, SUPABASE_SERVICE_KEY, `${LEADS_TABLE}?order=submitted_at.desc`);
      const data = await res.json();
      return json(data);
    }

    // POST /api/admin?action=updateStatus  { leadId, status }
    if (action === 'updateStatus' && req.method === 'POST') {
      const { leadId, status } = await req.json();
      const res = await dbFetch(
        SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `${LEADS_TABLE}?lead_id=eq.${encodeURIComponent(leadId)}`,
        'PATCH', { status }, 'return=representation'
      );
      return json({ success: res.ok });
    }

    // POST /api/admin?action=updateNotes  { leadId, notes }
    if (action === 'updateNotes' && req.method === 'POST') {
      const { leadId, notes } = await req.json();
      const res = await dbFetch(
        SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `${LEADS_TABLE}?lead_id=eq.${encodeURIComponent(leadId)}`,
        'PATCH', { notes }, 'return=representation'
      );
      return json({ success: res.ok });
    }

    // POST /api/admin?action=updateValue  { leadId, value }
    if (action === 'updateValue' && req.method === 'POST') {
      const { leadId, value } = await req.json();
      const res = await dbFetch(
        SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `${LEADS_TABLE}?lead_id=eq.${encodeURIComponent(leadId)}`,
        'PATCH', { value: Number(value) || 0 }, 'return=representation'
      );
      return json({ success: res.ok });
    }

    // POST /api/admin?action=deleteLead  { leadId }
    if (action === 'deleteLead' && req.method === 'POST') {
      const { leadId } = await req.json();
      const res = await dbFetch(
        SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `${LEADS_TABLE}?lead_id=eq.${encodeURIComponent(leadId)}`,
        'DELETE', null, 'return=representation'
      );
      return json({ success: res.ok });
    }

    // GET /api/admin?action=settings
    if (action === 'settings' && req.method === 'GET') {
      const res = await dbFetch(SUPABASE_URL, SUPABASE_SERVICE_KEY, `${SETTINGS_TABLE}?id=eq.1`);
      const data = await res.json();
      return json(Array.isArray(data) && data.length ? data[0] : null);
    }

    // POST /api/admin?action=saveSettings  { phone, email, address, hours }
    if (action === 'saveSettings' && req.method === 'POST') {
      const settings = await req.json();
      const res = await dbFetch(
        SUPABASE_URL, SUPABASE_SERVICE_KEY,
        SETTINGS_TABLE, 'POST',
        { id: 1, ...settings }, 'resolution=merge-duplicates'
      );
      return json({ success: res.ok });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('[admin api]', err);
    return json({ error: 'Internal error' }, 500);
  }
}
