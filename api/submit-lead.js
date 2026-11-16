// api/submit-lead.js
export const config = { runtime: 'edge' };

const ALLOWED_TYPES = ['Form Submission', 'Calculator', 'Phone Call Click'];

const DEFAULT_SUPABASE_URL = 'https://dqpmyxqpssnpsxrbdysw.supabase.co';

// Best-effort per-isolate rate limit (Edge). Use Cloudflare/Vercel firewall for hard limits.
const RATE_BUCKETS = new Map();
const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60_000;

// New-style keys (sb_secret_...) go in the apikey header only. Old JWT keys (eyJ...) also need Authorization.
function keyHeaders(key) {
  const headers = { 'apikey': key };
  if (key.startsWith('eyJ')) headers['Authorization'] = `Bearer ${key}`;
  return headers;
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function cleanText(value, max) {
  return (typeof value === 'string' ? value : '').trim().slice(0, max);
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
  if (RATE_BUCKETS.size > 5000) {
    for (const [key, val] of RATE_BUCKETS) {
      if (now > val.resetAt) RATE_BUCKETS.delete(key);
    }
  }
  return bucket.count <= RATE_LIMIT;
}

function phoneLooksValid(phone) {
  if (!phone) return true;
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits[0] === '1');
}

function zipLooksValid(zip) {
  if (!zip) return true;
  return /^\d{5}$/.test(zip);
}

// Round to 2 decimals (about 1 km). IP lookups are only approximate, so more digits would be false precision.
function roundCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? Math.round(n * 100) / 100 : null;
}

// Emails the owner about a new lead. It stays off until RESEND_API_KEY and LEAD_ALERT_EMAIL are set.
// A failed or slow alert never blocks saving the lead.
async function sendLeadAlert(payload, locationObj) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.LEAD_ALERT_EMAIL || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!apiKey || !to.length) return;

  const from = process.env.LEAD_ALERT_FROM || 'Insulation Contractor Houston <onboarding@resend.dev>';
  const oneLine = (text) => String(text || '').replace(/[\r\n]+/g, ' ').trim();
  const place = locationObj ? [locationObj.city, locationObj.region].filter(Boolean).join(', ') : '';
  const lines = [
    `Name: ${oneLine(payload.name)}`,
    `Phone: ${oneLine(payload.phone)}`,
    `Email: ${oneLine(payload.email) || 'not given'}`,
    `ZIP: ${oneLine(payload.zip) || 'not given'}`,
    `Service: ${oneLine(payload.service)}`,
    `Type: ${oneLine(payload.type)}`,
    `Page: ${oneLine(payload.page_url) || 'unknown'}`,
    `Approximate location (from IP): ${place || 'not available'}`,
    '',
    'Notes:',
    String(payload.notes || '').slice(0, 1000) || '(none)',
    '',
    `Lead ID: ${payload.lead_id}`,
    'Open the admin: https://insulationcontractorhouston.com/admin'
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `New ${payload.type === 'Calculator' ? 'calculator' : 'website'} lead: ${oneLine(payload.name)} (${oneLine(payload.service)})`.slice(0, 200),
        text: lines.join('\n')
      }),
      signal: controller.signal
    });
  } catch (e) {
    console.error('[submit-lead] lead alert failed:', e && e.message);
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!allowRequest(clientIp(req))) {
    return jsonResponse({ error: 'Too many requests. Please try again in a minute.' }, 429);
  }

  // Resolve environment variables per request in Edge runtime (with fallbacks)
  const SUPABASE_URL = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  // Vercel may still use SUPABASE_KEY; prefer the documented SUPABASE_SERVICE_KEY name.
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

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
  const zipVal = cleanText(body.zip, 20);
  const requestedType = cleanText(body.type, 50);
  const leadType = ALLOWED_TYPES.includes(requestedType) ? requestedType : 'Form Submission';
  const isCallTap = leadType === 'Phone Call Click';

  // Required field validation
  if (!nameVal && !phoneVal && !isCallTap) {
    return jsonResponse({ error: 'Name or phone required' }, 422);
  }
  if (nameVal.length > 100) {
    return jsonResponse({ error: 'Name is too long. Please use 100 characters or fewer.' }, 422);
  }
  if (!isCallTap && !phoneLooksValid(phoneVal)) {
    return jsonResponse({ error: 'Enter a valid 10-digit phone number.' }, 422);
  }
  if (!zipLooksValid(zipVal)) {
    return jsonResponse({ error: 'Enter a valid 5-digit ZIP code.' }, 422);
  }

  // Approximate location from the visitor's IP address (Vercel edge headers).
  // The browser is never asked for GPS. Nothing here is hardcoded: a missing value stays empty.
  let ipCity = req.headers.get('x-vercel-ip-city') || '';
  try { ipCity = decodeURIComponent(ipCity); } catch { /* keep the raw header */ }
  const ipRegion = req.headers.get('x-vercel-ip-country-region') || '';
  const ipCountry = req.headers.get('x-vercel-ip-country') || '';
  const lat = roundCoord(req.headers.get('x-vercel-ip-latitude'));
  const lng = roundCoord(req.headers.get('x-vercel-ip-longitude'));

  let locationObj = null;
  if (ipCity || (lat !== null && lng !== null)) {
    locationObj = {
      source: 'IP (approximate)',
      city: ipCity || null,
      region: ipRegion || null,
      country: ipCountry || null,
      latitude: lat,
      longitude: lng,
      maps_url: (lat !== null && lng !== null) ? `https://www.google.com/maps?q=${lat},${lng}` : null,
      captured_at: new Date().toISOString()
    };
  }

  const generateId = () =>
    'ICH-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

  // Call taps do not know the visitor's number — do not store the business dialed number as "phone".
  const storedPhone = isCallTap ? '' : phoneVal.slice(0, 50);

  const payload = {
    lead_id:      generateId(),
    name:         (nameVal || (isCallTap ? 'Phone Caller (Click-to-Call)' : 'Anonymous')).slice(0, 255),
    phone:        storedPhone,
    email:        cleanText(body.email, 255),
    zip:          zipVal,
    city:         cleanText(body.city, 100) || (locationObj && locationObj.city) || '',
    service:      cleanText(body.service, 100) || (isCallTap ? 'Phone Inquiry' : 'Attic Insulation'),
    type:         leadType,
    status:       'new',
    notes:        (typeof body.notes === 'string' ? body.notes : typeof body.message === 'string' ? body.message : '').trim().slice(0, 5000),
    page_url:     cleanText(body.pageUrl, 2000),
    submitted_at: new Date().toISOString()
  };

  if (locationObj) {
    payload.location_data = locationObj;
  }

  try {
    let res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: { ...keyHeaders(SUPABASE_SERVICE_KEY), 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let errText = await res.text();
      // If the location_data column doesn't exist in the database yet, retry with the location written into notes
      if (payload.location_data && errText.includes('location_data')) {
        const place = [locationObj.city, locationObj.region, locationObj.country].filter(Boolean).join(', ') || 'Unknown';
        const coords = (lat !== null && lng !== null) ? ` | ${lat}, ${lng}` : '';
        const locNote = `\n[VISITOR LOCATION: ${place} (IP) | approximate${coords}]`;
        delete payload.location_data;
        payload.notes = ((payload.notes || '') + locNote).slice(0, 5000);

        res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
          method: 'POST',
          headers: { ...keyHeaders(SUPABASE_SERVICE_KEY), 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          errText = await res.text();
        }
      }

      if (!res.ok) {
        console.error('[submit-lead] Supabase error:', res.status, errText);
        return jsonResponse({ error: 'Database error' }, 500);
      }
    }

    // Phone taps are logged but never emailed
    if (payload.type !== 'Phone Call Click') await sendLeadAlert(payload, locationObj);

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
