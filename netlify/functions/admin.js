// api/admin.js - Admin data operations proxy (service key stays server-side)
export const config = { runtime: 'edge' };

const LEADS_TABLE = 'leads';
const SETTINGS_TABLE = 'site_settings';
const ALLOWED_STATUSES = ['new', 'contacted', 'scheduled', 'completed', 'cancelled'];
const SETTINGS_FIELDS = ['phone', 'email', 'address', 'hours'];

const DEFAULT_SUPABASE_URL = 'https://dqpmyxqpssnpsxrbdysw.supabase.co';
// The publishable key is public by design (browsers use it too), so it is safe to keep in code.
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_xOnT1E3Wlzw1liNEyS3E6w_fCOq8FVy';

// New-style keys (sb_secret_...) go in the apikey header only. Old JWT keys (eyJ...) also need Authorization.
function keyHeaders(key) {
  const headers = { 'apikey': key };
  if (key.startsWith('eyJ')) headers['Authorization'] = `Bearer ${key}`;
  return headers;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || process.env.LEAD_ALERT_EMAIL || '';
  return raw.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function isAllowedAdmin(email) {
  const list = getAdminEmails();
  if (!list.length) {
    console.warn('[admin api] ADMIN_EMAILS is not set — any signed-in Supabase user can use admin. Set ADMIN_EMAILS in Vercel.');
    return true;
  }
  return !!(email && list.includes(String(email).trim().toLowerCase()));
}

async function verifyAdmin(supabaseUrl, publishableKey, token) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'apikey': publishableKey,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user || !user.email) return null;
  if (!isAllowedAdmin(user.email)) return null;
  return user;
}

async function dbFetch(supabaseUrl, serviceKey, path, method = 'GET', body, prefer) {
  const headers = {
    ...keyHeaders(serviceKey),
    'Content-Type': 'application/json'
  };
  if (prefer) headers['Prefer'] = prefer;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${supabaseUrl}/rest/v1/${path}`, opts);
}

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
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
    const user = await verifyAdmin(SUPABASE_URL, PUBLISHABLE_KEY, token).catch(() => null);
    if (!user) return json({ error: 'Unauthorized' }, 401);
  }

  try {
    // GET /api/admin?action=leads
    if (action === 'leads' && req.method === 'GET') {
      // The database returns at most 1000 rows per request. Read the first page with a total count,
      // then read the remaining pages at the same time. Ordering by ID as well keeps paging stable
      // when several leads are saved in the same millisecond.
      const PAGE = 1000;
      const MAX_PAGES = 20;
      const pagePath = (page) => `${LEADS_TABLE}?order=submitted_at.desc,id.desc&limit=${PAGE}&offset=${page * PAGE}`;
      const readPage = async (page, prefer) => {
        const res = await dbFetch(SUPABASE_URL, SUPABASE_SERVICE_KEY, pagePath(page), 'GET', undefined, prefer);
        if (!res.ok) throw new Error('page ' + page + ' failed');
        const rows = await res.json();
        if (!Array.isArray(rows)) throw new Error('page ' + page + ' invalid');
        return { rows, range: res.headers.get('content-range') };
      };
      try {
        const first = await readPage(0, 'count=exact');
        const all = first.rows.slice();
        const match = first.range ? /\/(\d+)$/.exec(first.range) : null;
        if (match) {
          const pages = Math.min(MAX_PAGES, Math.ceil(Number(match[1]) / PAGE));
          const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => readPage(i + 1)));
          rest.forEach((r) => all.push(...r.rows));
        } else if (first.rows.length === PAGE) {
          // No total was reported: read page after page until a short page arrives
          for (let page = 1; page < MAX_PAGES; page++) {
            const next = await readPage(page);
            all.push(...next.rows);
            if (next.rows.length < PAGE) break;
          }
        }
        return json(all);
      } catch (e) {
        return json({ error: 'Could not load leads' }, 502);
      }
    }

    // POST /api/admin?action=updateStatus  { leadId, status }
    if (action === 'updateStatus' && req.method === 'POST') {
      const { leadId, status } = await req.json();
      if (!leadId || typeof leadId !== 'string') return json({ error: 'Invalid lead id' }, 400);
      if (!ALLOWED_STATUSES.includes(status)) return json({ error: 'Invalid status' }, 400);
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
      if (!leadId || typeof leadId !== 'string') return json({ error: 'Invalid lead id' }, 400);
      const cleanNotes = String(notes ?? '').slice(0, 5000);
      const res = await dbFetch(
        SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `${LEADS_TABLE}?lead_id=eq.${encodeURIComponent(leadId)}`,
        'PATCH', { notes: cleanNotes }, 'return=representation'
      );
      return json({ success: res.ok });
    }

    // POST /api/admin?action=updateValue  { leadId, value }
    if (action === 'updateValue' && req.method === 'POST') {
      const { leadId, value } = await req.json();
      if (!leadId || typeof leadId !== 'string') return json({ error: 'Invalid lead id' }, 400);
      const num = Number(value);
      const safeValue = Number.isFinite(num) ? Math.max(0, Math.min(num, 1_000_000_000)) : 0;
      const res = await dbFetch(
        SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `${LEADS_TABLE}?lead_id=eq.${encodeURIComponent(leadId)}`,
        'PATCH', { value: safeValue }, 'return=representation'
      );
      return json({ success: res.ok });
    }

    // POST /api/admin?action=deleteLead  { leadId }
    if (action === 'deleteLead' && req.method === 'POST') {
      const { leadId } = await req.json();
      if (!leadId || typeof leadId !== 'string') return json({ error: 'Invalid lead id' }, 400);
      const res = await dbFetch(
        SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `${LEADS_TABLE}?lead_id=eq.${encodeURIComponent(leadId)}`,
        'DELETE', null, 'return=representation'
      );
      return json({ success: res.ok });
    }

    // GET /api/admin?action=settings
    if (action === 'settings' && req.method === 'GET') {
      const res = await dbFetch(SUPABASE_URL, SUPABASE_SERVICE_KEY, `${SETTINGS_TABLE}?id=eq.1&select=id,phone,email,address,hours,updated_at`);
      const data = await res.json();
      return json(Array.isArray(data) && data.length ? data[0] : null);
    }

    // POST /api/admin?action=saveSettings  { phone, email, address, hours }
    if (action === 'saveSettings' && req.method === 'POST') {
      const settings = await req.json();
      const safe = { id: 1 };
      for (const key of SETTINGS_FIELDS) {
        if (settings[key] !== undefined) {
          safe[key] = String(settings[key] ?? '').trim().slice(0, 500);
        }
      }
      const res = await dbFetch(
        SUPABASE_URL, SUPABASE_SERVICE_KEY,
        SETTINGS_TABLE, 'POST',
        safe, 'resolution=merge-duplicates'
      );
      return json({ success: res.ok });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('[admin api]', err);
    return json({ error: 'Internal error' }, 500);
  }
}
