// api/submit-lead.js
export const config = { runtime: 'edge' };

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Resolve environment variables per request in Edge runtime (with fallbacks)
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://obpvzwzttrzqjamaouzh.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9icHZ6d3p0dHJ6cWphbWFvdXpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTM1OTM0OCwiZXhwIjoyMTA2OTM1MzQ4fQ.7geqsygX_Ya2PDYIBjHkgz3yUc_vzTji_T7g-5UngqU';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[submit-lead] Required Supabase environment variables are missing.');
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

  // Safe string extraction & validation
  const nameVal = (typeof body.name === 'string' ? body.name : String(body.name || '')).trim();
  const phoneVal = (typeof body.phone === 'string' ? body.phone : String(body.phone || '')).trim();

  // Required field validation
  if (!nameVal && !phoneVal) {
    return jsonResponse({ error: 'Name or phone required' }, 422);
  }

  const generateId = () =>
    'ICH-' + Math.random().toString(36).slice(2, 10).toUpperCase();

  const payload = {
    lead_id:      generateId(),
    name:         (nameVal || 'Anonymous').slice(0, 255),
    phone:        phoneVal.slice(0, 50),
    email:        (typeof body.email === 'string' ? body.email : '').trim().slice(0, 255),
    zip:          (typeof body.zip === 'string' ? body.zip : '').trim().slice(0, 20),
    city:         (typeof body.city === 'string' ? body.city : 'Spring Area, TX').trim().slice(0, 100),
    service:      (typeof body.service === 'string' ? body.service : 'Attic Insulation').trim().slice(0, 100),
    type:         (typeof body.type === 'string' ? body.type : 'Form Submission').trim().slice(0, 50),
    status:       'new',
    notes:        (typeof body.notes === 'string' ? body.notes : typeof body.message === 'string' ? body.message : '').trim().slice(0, 5000),
    page_url:     (typeof body.pageUrl === 'string' ? body.pageUrl : '').trim().slice(0, 2000),
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

