# SEO On-Page & Technical Fix Report
**Branch:** `seo/onpage-technical-fixes-2026-11-18`  
**Date:** 2026-11-18  
**Against:** `master`

---

## Task 1 — Homepage Title + Service Card Reorder + R-Value Blog Link

### index.html

| Element | Before | After |
|---|---|---|
| `<title>` | `Attic Insulation Houston TX \| Free Inspection` | `Attic Insulation Houston \| Insulation Contractor Houston` |

**Service card reorder** (`<div class="sv-grid">`):

| Position | Before | After |
|---|---|---|
| 1 | blown-in (sv-feature) | spray-foam (sv-feature) |
| 2 | spray-foam (sv-feature) | blown-in (sv-feature) |
| 3 | insulation-removal (sv-wide) | attic-fan (sv-wide) |
| 4 | injection-foam (sv-compact) | insulation-removal (sv-compact) |
| 5 | air-sealing (sv-compact) | air-sealing (sv-compact) |
| 6 | attic-fan (sv-compact) | injection-foam (sv-compact) |
| 7 | commercial (sv-compact) | commercial (sv-compact) |

**R-value blog link added** after `.sv-lead` paragraph:
```html
<p class="sv-lead" style="margin-top:8px;"><a href="/blog/houston-attic-r-value-guide">What R-Value Does a Houston Attic Need?</a></p>
```

---

## Task 2 — Spray Foam, Injection Foam, Attic Fan: Cypress → Houston Retarget

### spray-foam-insulation.html

| Element | Before | After |
|---|---|---|
| `<title>` | `Spray Foam Insulation Houston TX \| Open & Closed-Cell` | `Spray Foam Insulation Houston \| Open & Closed-Cell` |
| H1 | `Spray Foam Insulation in Houston, TX — …` | `Spray Foam Insulation Houston — Closed-Cell Rated for Gulf Coast Humidity and Heat` |
| Cost heading | `…in Cypress, TX` | `…in Houston, TX` |
| Attic encapsulation h2 | `…Cypress, TX` | `…Houston, TX` |
| Safe removal h3 | `…in Cypress, TX` | `…in Houston, TX` |
| Common problems h2 | `…Cypress, TX` | `…Houston, TX` |
| CTA h2 | `…Cypress, TX` | `…Houston, TX` |
| Service area — Bridgeland block | `Bridgeland & Towne Lake` | `Spring & Klein` |
| Service area — Fairfield block | `Fairfield & Coles Crossing` | `Cypress & Northwest Houston` |
| Service area — Rock Creek block | `Rock Creek & Cypress Creek Lakes` | `Tomball, Conroe & The Woodlands` |

### injection-foam-insulation.html

| Element | Before | After |
|---|---|---|
| `<title>` | `Injection Foam Insulation Houston TX — …` | `Injection Foam Insulation Houston — …` |
| H1 | `Injection Foam Insulation Houston TX — Retrofit Walls Without Removing Drywall` | `Injection Foam Insulation Houston — Retrofit Walls Without Removing Drywall` |
| Understanding h2 | `…in Cypress, TX` | `…in Houston, TX` |
| Cost h2 | `…in Cypress, TX` | `…in Houston, TX` |
| CTA h2 + p | `…in Cypress, TX` | `…in Houston, TX` |

### attic-fan-installation.html

| Element | Before | After |
|---|---|---|
| `<title>` | `Attic Fan Installation in Houston, TX — …` | `Attic Fan Installation Houston — …` |
| H1 | `Attic Fan Installation in Houston, TX — …` | `Attic Fan Installation Houston — Paired With Soffit Vents for Real Airflow` |
| Upstairs rooms h2 | `…in Cypress, TX` | `…in Houston, TX` |
| Solar vs electric h2 | `…in Cypress, TX` | `…in Houston, TX` |
| Cost h2 | `…in Cypress, TX` | `…in Houston, TX` |
| Why pair h2 | `…in Cypress, TX` | `…in Houston, TX` |
| FAQ h2 | `…in Cypress, TX` | `…in Houston, TX` |
| Neighboring communities h2 | `…in Cypress, TX` | `…in Houston, TX` |
| Free inspection h2 | `…in Cypress, TX` | `…in Houston, TX` |
| R-value blog link | *(not present)* | `<a href="/blog/houston-attic-r-value-guide">Houston Attic R-Value Guide</a>` added in R-38 pairing content |

---

## Task 3 — insulation-removal.html + commercial-insulation.html Content Expansion (~1,500 words)

### insulation-removal.html

| Element | Before | After |
|---|---|---|
| `<title>` | `Insulation Removal Houston TX \| Free Inspection` | `Insulation Removal Houston \| Free Inspection` |
| H1 | `Insulation Removal & Replacement in Greater Houston` | `Insulation Removal Houston — Removal & Replacement Across Greater Houston` |

**New sections added:**
- **Signs Your Attic Insulation Needs to Be Removed** — 6 bullet points (pest contamination, wet/discolored insulation, depth under 4 inches, failed spray foam, mold on deck, post-flood)
- **What Affects Insulation Removal Cost in Houston** — 6 bullet points (sq footage, depth/material type, pest contamination, access/height, air sealing, reinstallation material)

**New FAQ accordions (items 05–07):**
- Item 05: Can spray foam insulation be removed?
- Item 06: How soon can new insulation be installed after removal?
- Item 07: What R-value should I target after reinstallation?

**FAQPage JSON-LD:** 3 new Question/Answer entries added.

**Blog link:** `<a href="/blog/houston-attic-r-value-guide">Houston Attic R-Value Guide</a>` added in top-off paragraph.

### commercial-insulation.html

| Element | Before | After |
|---|---|---|
| `<title>` | `Commercial Insulation Houston TX \| Metal Buildings` | `Commercial Insulation Houston \| Metal Buildings` |
| H1 | `Commercial Insulation for Greater Houston Businesses` | `Commercial Insulation Houston — Metal Buildings, Warehouses & Offices` |

**New sections added:**
- **Our Commercial Insulation Process** — 6 steps (free assessment, written quote, scheduling, ignition barrier, application, post-job walkthrough)
- **What Affects Commercial Insulation Cost in Houston** — 6 bullets (building footprint, insulation system/thickness, existing condition, roof height/access, occupied vs vacant, ignition barrier requirement)

**New FAQ accordions (items 05–07):**
- Item 05: Do metal buildings need an ignition barrier over spray foam?
- Item 06: What R-value is recommended for metal buildings in Houston?
- Item 07: How long does commercial insulation installation take?

**FAQPage JSON-LD:** 3 new Question/Answer entries added.

---

## Task 4 — Location Page H1s + Card Reorders + Conroe Title/Meta

### spring-tx-insulation.html

| Element | Before | After |
|---|---|---|
| H1 | `Attic Insulation in Spring, TX — Serving Klein Homes Running AC 12 Hours a Day` | `Attic Insulation Spring TX \| Serving Klein Homes Running AC 12 Hours a Day` |
| Card order | Blown-In, Spray Foam, Injection Foam, Air Sealing, Attic Fan, Insulation Removal | Spray Foam, Insulation Removal, Blown-In, Attic Fan, Air Sealing, Injection Foam |

### conroe-tx-insulation.html

| Element | Before | After |
|---|---|---|
| `<title>` | `Attic Insulation Conroe TX \| Free Attic Walkthrough` | `Spray Foam Insulation Conroe TX \| Free Attic Walkthrough` |
| H1 | `Attic Insulation in Conroe, TX — Where Lake Humidity Makes Insulation Fail Faster` | `Spray Foam Insulation Conroe TX \| Where Lake Humidity Makes Insulation Fail Faster` |
| `<meta name="description">` | *(previous generic description)* | `Spray foam insulation company in Conroe TX — blown-in and attic insulation for Montgomery County homes. Free attic walkthrough included.` |
| Card order | Blown-In, Spray Foam, Injection Foam, Air Sealing, Attic Fan, Insulation Removal | Spray Foam, Insulation Removal, Blown-In, Injection Foam, Air Sealing, Attic Fan |

### kingwood-tx-insulation.html

| Element | Before | After |
|---|---|---|
| H1 | `Attic Insulation in Kingwood, TX — Moisture From Lake Houston Compresses Old Insulation` | `Attic Insulation Kingwood TX \| Moisture From Lake Houston Compresses Old Insulation` |

### the-woodlands-tx-insulation.html

| Element | Before | After |
|---|---|---|
| H1 | `Attic Insulation in The Woodlands, TX — Original Builds With No Air Sealing Still Losing Cool Air` | `Attic Insulation The Woodlands TX \| Original Builds With No Air Sealing Still Losing Cool Air` |
| Blog link | *(not present)* | `<a href="/blog/houston-attic-r-value-guide">Houston Attic R-Value Guide</a>` added in blown-in service card |

### humble-tx-insulation.html

| Element | Before | After |
|---|---|---|
| H1 | `Attic Insulation in Humble, TX — Atascocita Homes Where Post-Harvey Moisture Damaged Old Insulation` | `Attic Insulation Humble TX \| Atascocita Homes Where Post-Harvey Moisture Damaged Old Insulation` |
| Card order | Blown-In, Air Sealing, Spray Foam, Injection Foam, Attic Fan, Insulation Removal | Attic Fan, Blown-In, Air Sealing, Spray Foam, Injection Foam, Insulation Removal |

### tomball-tx-insulation.html

| Element | Before | After |
|---|---|---|
| H1 | `Attic Insulation in Tomball, TX — Older Builds Running Hot Through June, July, and August` | `Attic Insulation Tomball TX \| Older Builds Running Hot Through June, July, and August` |

### cypress-tx-insulation.html

| Element | Before | After |
|---|---|---|
| H1 | `Attic Insulation in Cypress, TX — Where Summer Humidity Keeps AC Bills High` | `Attic Insulation Cypress TX \| Where Summer Humidity Keeps AC Bills High` |
| Card order | Blown-In, Spray Foam, Injection Foam, Air Sealing, Attic Fan, Insulation Removal | Attic Fan, Blown-In, Spray Foam, Injection Foam, Air Sealing, Insulation Removal |
| Blog link | *(not present)* | `<a href="/blog/blown-in-vs-fiberglass-insulation-cypress-tx">Blown-In vs Fiberglass Insulation in Cypress TX</a>` added in FAQ answer |

---

## Task 5 — Internal Blog Links

| File | Link Added | Anchor Text |
|---|---|---|
| `blown-in-insulation.html` | `/blog/houston-attic-r-value-guide` | Houston Attic R-Value Guide |
| `attic-fan-installation.html` | `/blog/houston-attic-r-value-guide` | Houston Attic R-Value Guide |
| `insulation-removal.html` | `/blog/houston-attic-r-value-guide` | Houston Attic R-Value Guide |
| `the-woodlands-tx-insulation.html` | `/blog/houston-attic-r-value-guide` | Houston Attic R-Value Guide |
| `cypress-tx-insulation.html` | `/blog/blown-in-vs-fiberglass-insulation-cypress-tx` | Blown-In vs Fiberglass Insulation in Cypress TX |
| `index.html` | `/blog/houston-attic-r-value-guide` | What R-Value Does a Houston Attic Need? |

---

## Task 6 — Sitemap: Privacy Policy + Terms of Service

**sitemap.xml** — Two `<url>` entries added under `<!-- Legal pages -->` comment:

```xml
<url>
  <loc>https://insulationcontractorhouston.com/privacy-policy</loc>
  <lastmod>2026-11-18</lastmod>
  <changefreq>yearly</changefreq>
  <priority>0.3</priority>
</url>
<url>
  <loc>https://insulationcontractorhouston.com/terms-of-service</loc>
  <lastmod>2026-11-18</lastmod>
  <changefreq>yearly</changefreq>
  <priority>0.3</priority>
</url>
```

---

## Task 7 — Schema Fixes

### attic-fan-installation.html

| Element | Before | After |
|---|---|---|
| JSON-LD `@type` | `"LocalBusiness"` | `"HomeAndConstructionBusiness"` |

### blog/index.html

**New ItemList JSON-LD block added** (after existing BreadcrumbList):

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Insulation Blog — Houston Homeowner Guides",
  "url": "https://insulationcontractorhouston.com/blog",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "url": "…/houston-attic-r-value-guide", "name": "What R-Value Does a Houston Attic Need?"},
    {"@type": "ListItem", "position": 2, "url": "…/blown-in-vs-fiberglass-insulation-cypress-tx", "name": "Blown-In vs Fiberglass Insulation in Cypress TX"},
    {"@type": "ListItem", "position": 3, "url": "…/attic-insulation-spring-tx", "name": "Attic Insulation in Spring TX"},
    {"@type": "ListItem", "position": 4, "url": "…/insulation-contractor-conroe-tx", "name": "Insulation Contractor in Conroe TX"},
    {"@type": "ListItem", "position": 5, "url": "…/attic-insulation-kingwood-tx", "name": "Attic Insulation in Kingwood TX"}
  ]
}
```

---

## Task 8 — vercel.json www→non-www Redirect

**New file: `vercel.json`** at repo root.

```json
{
  "redirects": [
    {
      "source": "/:path*",
      "has": [{ "type": "host", "value": "www.insulationcontractorhouston.com" }],
      "destination": "https://insulationcontractorhouston.com/:path*",
      "permanent": true
    }
  ]
}
```

Redirect type: `301 Permanent`. Covers all paths including root.

---

## Flagged Items

- **No prices changed.** All pricing references ($1.00–$2.50/sqft blown-in, $2.00–$4.50/sqft spray foam, etc.) left exactly as found.
- **No images or CSS changed.**
- **Meta descriptions not changed** except `conroe-tx-insulation.html` as explicitly specified.
- **Cellulose references:** Only existing context retained (removal of pre-existing cellulose); never presented as a product offered.
- **City counts:** Not modified; no city-count claims added to new content.
- **Business address:** Not modified. `9310 Central Park Vista Ln, Houston, TX 77080` as per AGENTS.md.
