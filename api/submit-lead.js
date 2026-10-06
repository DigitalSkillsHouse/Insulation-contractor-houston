// api/submit-lead.js
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// Fail closed if required server configuration is missing.
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[submit-lead] Required Supabase environment variables are missing.');
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Never attempt a database request with missing credentials/configuration.
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: 'Service temporarily unavailable' }, 503);
  }

  let body;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  // Honeypot check
  if (body._hp) {
    return jsonResponse({ success: true }, 200);
  }

  // Required field validation
  if (!body.name?.trim() && !body.phone?.trim()) {
    return jsonResponse({ error: 'Name or phone required' }, 422);
  }

  const generateId = () =>
    'USA-' + Math.random().toString(36).slice(2, 10).toUpperCase();

  const payload = {
    lead_id:      generateId(),
    name:         (body.name || 'Anonymous').slice(0, 255),
    phone:        (body.phone || '').slice(0, 50),
    email:        (body.email || '').slice(0, 255),
    zip:          (body.zip || '').slice(0, 20),
    city:         (body.city || 'Spring Area, TX').slice(0, 100),
    service:      (body.service || 'Attic Insulation').slice(0, 100),
    type:         (body.type || 'Form Submission').slice(0, 50),
    status:       'new',
    notes:        (body.message || '').slice(0, 5000),
    page_url:     (body.pageUrl || '').slice(0, 2000),
    submitted_at: new Date().toISOString()
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[submit-lead] Supabase error:', res.status, text);

      return jsonResponse({ error: 'Database error' }, 500);
    }

    return jsonResponse({
      success: true,
      id: payload.lead_id
    }, 200);

  } catch (error) {
    console.error('[submit-lead] Request failed:', error);

    return jsonResponse({
      error: 'Database service unavailable'
    }, 503);
  }
}
