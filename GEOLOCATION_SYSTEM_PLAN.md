# Geolocation Capture System Plan
**Project:** Insulation Contractor Houston (`usa-insulation-of-north-houston`)  
**Target:** Form Submissions & Phone Click Events (`tel:` links)  
**Author:** Senior Full-Stack Engineering  
**Status:** Architecture & Implementation Plan  

---

## 1. Executive Summary & Objective

Implement an advanced, resilient location-capture system that records the real-time physical coordinates (**Latitude, Longitude, Altitude, Accuracy ±X m, and City/Region**) whenever a visitor:
1. Submits an estimate request form (`contact.html`, home hero form, etc.)
2. Clicks any phone call button / link (`tel:+14099964620`) across the entire website

The captured data will be displayed in the **Admin Console Lead Drawer** matching the exact target design:
```text
VISITOR LOCATION
Houston, Texas, United States (GPS)
±12 m · Alt: 18 m
29.52526, -95.67179  [Open in Google Maps ↗]
```

---

## 2. Technical Architecture: Two-Tier Resilient Geolocation

Browsers require explicit permission for device GPS, and visitors may reject permissions or browse on desktops without GPS chips. To guarantee **100% capture rate without breaking conversion rates or stalling form submissions**, we use a **Two-Tier Hybrid Strategy**:

```
                  ┌──────────────────────────────┐
                  │ Visitor Interacts with Site   │
                  │ (Form focus or Call click)   │
                  └──────────────┬───────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
    [Tier 1: Device GPS (HTML5)]     [Tier 2: Edge IP Geolocation]
    - navigator.geolocation          - Vercel Edge Server Headers:
    - High accuracy GPS               * x-vercel-ip-latitude
    - Exact lat, lng, altitude        * x-vercel-ip-longitude
    - Real accuracy (e.g. ±12m)       * x-vercel-ip-city
                 │                    * x-vercel-ip-country-region
                 │                               │
                 ▼                               ▼
           GPS Granted?                     Fallback if
          /            \                    Denied/Timeout
        YES             NO                         │
         │               └─────────────────────────┘
         ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ Unified Payload sent to /api/submit-lead                     │
 │ { lat, lng, alt, accuracy, source: "GPS"|"IP", city, region }│
 └──────────────────────────────┬───────────────────────────────┘
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ Supabase `leads` Table -> Admin Drawer UI with Google Maps   │
 └──────────────────────────────────────────────────────────────┘
```

### Tier 1: Hardware-Level GPS (Primary)
- **API:** `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: true`.
- **Pre-warming:** As soon as the visitor interacts with a form input or hovers on a phone button, we warm up the position cache with a 3-second timeout limit.
- **Fields Captured:**
  - `latitude` (e.g. `29.52526`)
  - `longitude` (e.g. `-95.67179`)
  - `altitude` (meters above sea level, if device sensor is available)
  - `accuracy` (radius of certainty in meters, e.g. `12` -> `±12 m`)
  - `altitudeAccuracy` (if available)
  - `source`: `"GPS"`

### Tier 2: Zero-Permission Server Edge Fallback (100% Reliable)
- If the user denies GPS permissions, is on a browser that blocks geolocation, or the 3-second timeout lapses:
  - **Zero latency, zero external API cost**: Vercel Edge automatically injects geo headers into incoming requests:
    - `x-vercel-ip-latitude`
    - `x-vercel-ip-longitude`
    - `x-vercel-ip-city`
    - `x-vercel-ip-country-region` (State)
    - `x-vercel-ip-country`
  - The server marks this as `source: "IP Geolocation"` with nominal accuracy `±5,000m`.
  - **Zero conversion friction**: Form submission is never blocked waiting for permission dialogs.

---

## 3. Database Schema Migration (Supabase)

We store geolocation in a dedicated, flexible `location_data` JSONB column in the `leads` table. This prevents schema lock-in and avoids altering multiple columns.

### SQL Migration to run in Supabase SQL Editor:
```sql
-- Add JSONB location column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS location_data JSONB DEFAULT '{}'::jsonb;

-- Optional: Add GIN index for rapid spatial queries if filtering by city/region in admin
CREATE INDEX IF NOT EXISTS idx_leads_location_data ON leads USING gin (location_data);
```

### Stored JSON Structure:
```json
{
  "latitude": 29.52526,
  "longitude": -95.67179,
  "altitude": 18.5,
  "accuracy": 12,
  "altitudeAccuracy": 4,
  "source": "GPS",
  "city": "Houston",
  "region": "Texas",
  "country": "United States",
  "maps_url": "https://www.google.com/maps?q=29.52526,-95.67179",
  "captured_at": "2026-10-21T11:30:00.000Z"
}
```

---

## 4. Frontend Implementation Breakdown

### 4.1 Lightweight Location Manager (`assets/js/geo-capture.js` or inside `supabase-client.js`)
- Maintain a non-blocking in-memory geo cache `window._ICH_GEO_CACHE`.
- Pre-request on input focus (e.g., `focusin` on form elements):
```javascript
let _cachedGeo = null;

function captureUserLocation(callback) {
  if (_cachedGeo && (Date.now() - _cachedGeo.timestamp < 300000)) {
    if (callback) callback(_cachedGeo);
    return;
  }
  if (!navigator.geolocation) {
    if (callback) callback(null);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      _cachedGeo = {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        alt: pos.coords.altitude !== null ? Number(pos.coords.altitude.toFixed(1)) : null,
        accuracy: Math.round(pos.coords.accuracy),
        source: 'GPS',
        timestamp: Date.now()
      };
      if (callback) callback(_cachedGeo);
    },
    () => { if (callback) callback(null); },
    { enableHighAccuracy: true, timeout: 3500, maximumAge: 60000 }
  );
}
```

### 4.2 Form Capture Integration
In `assets/js/main.js` and `assets/js/supabase-client.js`:
- Attach `location_data: _cachedGeo || {}` to the payload submitted to `/api/submit-lead`.

### 4.3 Click-to-Call Capture Integration
When a user clicks any `tel:` link:
- Before or concurrently with opening the dialer, attach `_cachedGeo` to `USA_SUPABASE.saveLead(callLead)`.

---

## 5. Backend Serverless Edge API (`api/submit-lead.js`)

Enhance `api/submit-lead.js`:
1. Read `body.location_data` (Tier 1 GPS data sent by client).
2. If `latitude` is missing from client, read Vercel Edge Headers (Tier 2 Fallback):
   ```javascript
   const ipLat = req.headers.get('x-vercel-ip-latitude');
   const ipLng = req.headers.get('x-vercel-ip-longitude');
   const ipCity = decodeURIComponent(req.headers.get('x-vercel-ip-city') || '');
   const ipRegion = req.headers.get('x-vercel-ip-country-region') || 'TX';
   const ipCountry = req.headers.get('x-vercel-ip-country') || 'US';
   ```
3. Formulate the unified `location_data` object:
   - Sets `maps_url: "https://www.google.com/maps?q=${lat},${lng}"`
4. Write to Supabase `leads` table.

---

## 6. Admin Dashboard UI (`admin/index.html` & `admin/admin.js`)

In the Lead Details Drawer (`openLeadDrawer`):

### 6.1 UI Markup (Styled Card)
```html
<div class="drawer-section location-section" id="drawer-location-card" style="margin-top:16px; background:#141b2d; border:1px solid #1f2a48; border-radius:10px; padding:16px;">
  <div style="font-size:11px; font-weight:700; letter-spacing:1px; color:#8ba3cc; text-transform:uppercase; margin-bottom:8px;">
    Visitor Location
  </div>
  <div id="drawer-loc-label" style="font-size:15px; font-weight:600; color:#ffffff; margin-bottom:4px;">
    Houston, Texas, United States (GPS)
  </div>
  <div id="drawer-loc-meta" style="font-size:12px; color:#38bdf8; font-weight:500; margin-bottom:6px;">
    ±12 m · Alt: 18 m
  </div>
  <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#94a3b8; font-family:monospace;">
    <span id="drawer-loc-coords">29.52526, -95.67179</span>
    <a id="drawer-loc-maps" href="#" target="_blank" style="color:#60a5fa; text-decoration:none; font-family:sans-serif; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
      Google Maps ↗
    </a>
  </div>
</div>
```

### 6.2 Admin Drawer Population (`admin.js`)
- If lead has `location_data`:
  - Show formatted label: `${loc.city || lead.city}, ${loc.region || 'TX'}, ${loc.country || 'USA'} (${loc.source})`
  - Show accuracy & altitude: `±${loc.accuracy} m${loc.alt ? ` · Alt: ${loc.alt} m` : ''}`
  - Show coordinates with direct Google Maps link.
- If no coordinates available (older leads), display clean fallback: `"Approximate Area: Houston, TX (IP)"`.

---

## 7. Advanced Value-Add Ideas for this Feature

1. **Service Radius Distance Calculation:**
   - Automatically calculate the distance from your shop (`23407 Snook Ln, Tomball, TX 77375`, Coordinates: `30.0844, -95.6171`).
   - Display in admin: `"14.2 miles from shop · Inside service zone"` (or `"Outside standard service zone"` with a warning badge).
2. **Reverse Geocoded Street Address Lookup:**
   - When GPS accuracy is within ±20m, use a lightweight reverse lookup to display the estimated neighborhood or street name.
3. **Interactive Mini Static Map Preview:**
   - Embed a lightweight OpenStreetMap or static map pin directly in the drawer for instant visual verification of the customer's property.
4. **Local Timezone & Connection ISP:**
   - Vercel headers also expose `x-vercel-ip-timezone` — useful to know if someone is submitting requests from out-of-state or spam bot networks.

---

## 8. Implementation Steps & Checklist

| Step | Action Item | Target File | Status |
|:---:|---|---|:---:|
| **1** | Run SQL migration to add `location_data` JSONB column | Supabase SQL Editor | Pending |
| **2** | Add client-side high-accuracy geolocation helper & pre-warming | `assets/js/supabase-client.js` | Ready to build |
| **3** | Hook location capture into form submit handlers & call clicks | `assets/js/main.js` | Ready to build |
| **4** | Extract Vercel Edge geo headers as fallback in API | `api/submit-lead.js` | Ready to build |
| **5** | Add "Visitor Location" UI component to Admin Lead Drawer | `admin/index.html` & `admin/admin.css` | Ready to build |
| **6** | Wire location rendering & Google Maps link in `openLeadDrawer` | `admin/admin.js` | Ready to build |
| **7** | End-to-end verification & Git push to master | Local & GitHub | Ready to build |
