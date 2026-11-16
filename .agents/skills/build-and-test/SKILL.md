---
name: build-and-test
description: Post-change verification checklist for Insulation Contractor Houston codebase
---

# Build & Test Verification Checklist

Run this checklist following every code or content change in this repository. Report each check as **PASS** or **FAIL**, citing the specific file and line number for any failure.

---

## 1. Syntax & Rendering Verification
- [ ] **HTML Syntax**: HTML is well-formed with closing tags and valid nesting.
- [ ] **No Console Errors**: Script tags load existing scripts (`assets/js/supabase-client.js`, `assets/js/main.js`). No missing global objects or syntax errors.
- [ ] **Asset References**: All referenced images exist in `assets/images/` or `assets/images/gen/`.

## 2. Shared Layout Integrity
- [ ] **No Page-Level Edits to Shared Blocks**: Header (`#navbar-container`), footer (`#footer-container`), and sticky call button (`#sticky-call-button-container`) match `scripts/layout/`.
- [ ] **Zero Layout Drift**: Run `python scripts/sync-layout.py --check` (or node layout checker) and verify that the touched page has zero drift against `scripts/layout/`.

## 3. Lead Forms & Anti-Spam
- [ ] **Honeypot Present**: Every lead capture `<form>` contains the hidden anti-spam field:
  ```html
  <input type="text" name="_hp" tabindex="-1" autocomplete="off" style="display:none;" aria-hidden="true" />
  ```
- [ ] **Form IDs & Action Handlers**: Forms have expected IDs (`hero-request-form`, `service-area-form`, etc.) that `main.js` binds to.
- [ ] **Success Message Guard**: `.form-success` block is hidden by default and only revealed upon confirmed HTTP response from backend.

## 4. Schema & Structured Data
- [ ] **Operating Hours**: `openingHoursSpecification` lists Monday through Saturday ONLY:
  - Days: `["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]`
  - Opens: `"08:00"`, Closes: `"18:00"`
  - Sunday must be closed / omitted.
- [ ] **Address**: Must reference `Central Park Vista Ln, Houston, TX 77080`. No street number. Never `Cypress Farms Ranch Rd`.
- [ ] **Telephone**: `(832) 291-2738` in text; telephone link `tel:+18322912738`.

## 5. Pricing & Verified Facts Compliance
- [ ] **Prices Match Verified File**: All prices on the page align exactly with `.agents/rules/facts-and-prices.md`:
  - Blown-in: $1.00 – $2.50 / sq ft
  - Spray foam: $2.00 – $4.50 / sq ft
  - Injection foam: $2.00 – $4.20 / sq ft wall
  - Attic fan: $299 – $718 / fan
  - Air sealing: $250 – $740 / attic (conditional on leaks)
  - Removal: $1.00 – $1.50 / sq ft
  - Full replacement: $2.00 – $4.00 / sq ft
- [ ] **Google Reviews Count**: Exactly "5.0 stars from 5 Google reviews" (or 5 reviews). No inflation.
- [ ] **Energy Savings**: EPA ENERGY STAR claims must be 15% heating/cooling, 11% total energy. Never 6% or 9%.
- [ ] **No Forbidden Claims**: Zero occurrences of "Licensed & insured". No fake warranties or rebates.
- [ ] **Target R-Value**: R38, approx 15 inches.

## 6. Functional Link & Anchor Checks
- [ ] **Phone Links**: All phone links use `tel:+18322912738`.
- [ ] **Internal Links**: All internal href paths exist and resolve to valid root pages (e.g. `/blown-in-insulation`, `/contact`).
