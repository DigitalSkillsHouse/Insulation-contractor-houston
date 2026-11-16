# Your work (Supabase + Vercel) — do these manually

Code-side hardening is already in the repo. These steps need your dashboard access.

## 1. Lock Supabase (critical)

1. Open **Supabase** → project `dqpmyxqpssnpsxrbdysw`
2. Go to **SQL Editor** → paste and run `docs/supabase-lockdown.sql`
3. Go to **Authentication** → **Providers** → **Email**
4. Turn **off** “Enable sign ups” / public signup
5. Confirm only **your** admin user exists under **Authentication → Users**
6. In **Admin panel** (or SQL), delete any leftover row with `lead_id = PROBE-TEST`

### Quick verify (optional)

From a terminal, this POST should **fail** after lockdown (not return 201):

```
POST https://dqpmyxqpssnpsxrbdysw.supabase.co/rest/v1/leads
Headers: apikey + Authorization = your publishable key
Body: {"lead_id":"SHOULD-FAIL","name":"x","phone":"1"}
```

## 2. Set Vercel env vars (critical)

In **Vercel** → Project → **Settings** → **Environment Variables**:

| Variable | Example | Why |
|----------|---------|-----|
| `ADMIN_EMAILS` | `you@yourdomain.com` | Only these emails can sign into admin |
| `SUPABASE_SERVICE_KEY` | (already set) | Keep as-is |
| `SUPABASE_URL` | (already set) | Keep as-is |
| `SUPABASE_PUBLISHABLE_KEY` | (already set) | Keep as-is |
| `LEAD_ALERT_EMAIL` | same as admin (optional) | New-lead emails |
| `RESEND_API_KEY` | (optional) | Turns on email alerts |

Redeploy after saving env vars.

**Important:** Put your current admin login email in `ADMIN_EMAILS` **before** or **right after** deploy, or you may be locked out of `/admin`.

## 3. After deploy — smoke test

1. Submit a real quote form on the site → lead appears in admin
2. Sign into `/admin` with your allowlisted email
3. Confirm a random email cannot sign up / sign in
4. Confirm phone click still logs in **Phone Call Tracking** (phone field may be empty; dialed number is in notes)

## 4. Optional later

- Cloudflare / Vercel firewall rate limits (stronger than Edge in-memory limits)
- Cloudflare Turnstile on forms (needs site + secret keys)
- Rotate publishable key if you want extra hygiene
