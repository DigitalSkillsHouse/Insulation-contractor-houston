# Insulation Contractor Houston

Static website for Insulation Contractor Houston (insulationcontractorhouston.com).

## Hosting and local checks

- **Production:** Vercel. Redirects, clean URLs and security headers live in `vercel.json`. `.vercelignore` keeps internal files out of the deploy.
- **Local checks:** Netlify CLI (`netlify dev`) using `netlify.toml`, `_redirects` and `netlify/functions/`.
- **API routes:** `api/` (Vercel edge functions) for lead submission and the admin panel. `netlify/functions/` mirrors them for local runs.

## Structure

- `*.html` — pages (services, city pages, calculator, contact, legal); `blog/` — blog posts
- `assets/` — `global.css`, `js/main.js`, `js/supabase-client.js`, images
- `admin/` — lead admin panel (noindex)
- `sitemap.xml`, `robots.txt`, `llms.txt`

## Shared header and footer

The header, footer and sticky call button are identical on every page. Edit the pieces in
`scripts/layout/` and run:

```
python scripts/sync-layout.py          # apply to every page
python scripts/sync-layout.py --check  # report pages that drifted
```

## Notes

- Main phone number: (832) 291-2738.
- Prices on pages and in the calculator follow one verified table; change them everywhere together.
