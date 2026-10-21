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
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

  // Geolocation handling: client GPS or server-side Vercel edge IP fallback
  const clientLoc = (body.location_data && typeof body.location_data === 'object') ? body.location_data : {};
  const ipLat = req.headers.get('x-vercel-ip-latitude');
  const ipLng = req.headers.get('x-vercel-ip-longitude');
  const ipCity = req.headers.get('x-vercel-ip-city') ? decodeURIComponent(req.headers.get('x-vercel-ip-city')) : '';
  const ipRegion = req.headers.get('x-vercel-ip-country-region') || 'TX';
  const ipCountry = req.headers.get('x-vercel-ip-country') || 'US';

  const parseCoord = (val) => {
    if (!val) return null;
    const n = Number(val);
    return (!isNaN(n) && n !== 0) ? Number(n.toFixed(6)) : null;
  };

  const hasGps = typeof clientLoc.latitude === 'number' && typeof clientLoc.longitude === 'number' && !isNaN(clientLoc.latitude) && !isNaN(clientLoc.longitude);
  const finalLat = hasGps ? clientLoc.latitude : parseCoord(ipLat);
  const finalLng = hasGps ? clientLoc.longitude : parseCoord(ipLng);

  let locationObj = null;
  if (finalLat !== null && finalLng !== null) {
    locationObj = {
      latitude: finalLat,
      longitude: finalLng,
      altitude: hasGps && typeof clientLoc.altitude === 'number' ? clientLoc.altitude : null,
      accuracy: hasGps && typeof clientLoc.accuracy === 'number' ? clientLoc.accuracy : 5000,
      altitudeAccuracy: hasGps && typeof clientLoc.altitudeAccuracy === 'number' ? clientLoc.altitudeAccuracy : null,
      source: hasGps ? 'GPS' : 'IP Geolocation',
      city: clientLoc.city || ipCity || body.city || 'Houston Area',
      region: clientLoc.region || ipRegion || 'Texas',
      country: clientLoc.country || ipCountry || 'United States',
      maps_url: `https://www.google.com/maps?q=${finalLat},${finalLng}`,
      captured_at: new Date().toISOString()
    };
  }

  const generateId = () =>
    'ICH-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

  const payload = {
    lead_id:      generateId(),
    name:         (nameVal || 'Anonymous').slice(0, 255),
    phone:        phoneVal.slice(0, 50),
    email:        (typeof body.email === 'string' ? body.email : '').trim().slice(0, 255),
    zip:          (typeof body.zip === 'string' ? body.zip : '').trim().slice(0, 20),
    city:         (typeof body.city === 'string' ? body.city : (locationObj?.city || 'Spring Area, TX')).trim().slice(0, 100),
    service:      (typeof body.service === 'string' ? body.service : 'Attic Insulation').trim().slice(0, 100),
    type:         (typeof body.type === 'string' ? body.type : 'Form Submission').trim().slice(0, 50),
    status:       'new',
    notes:        (typeof body.notes === 'string' ? body.notes : typeof body.message === 'string' ? body.message : '').trim().slice(0, 5000),
    page_url:     (typeof body.pageUrl === 'string' ? body.pageUrl : '').trim().slice(0, 2000),
    submitted_at: new Date().toISOString()
  };

  if (locationObj) {
    payload.location_data = locationObj;
  }

  try {
    let res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
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
      let errText = await res.text();
      // If column location_data doesn't exist yet in Supabase schema, retry with notes fallback
      if (payload.location_data && errText.includes('location_data')) {
        const altStr = locationObj.altitude ? ` · Alt: ${locationObj.altitude}m` : '';
        const locNote = `\n[VISITOR LOCATION: ${locationObj.city}, ${locationObj.region}, ${locationObj.country} (${locationObj.source}) | ±${locationObj.accuracy}m${altStr} | ${locationObj.latitude}, ${locationObj.longitude}]`;
        delete payload.location_data;
        payload.notes = ((payload.notes || '') + locNote).slice(0, 5000);

        res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
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
          errText = await res.text();
        }
      }

      if (!res.ok) {
        console.error('[submit-lead] Supabase error:', res.status, errText);
        return jsonResponse({ error: 'Database error' }, 500);
      }
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

