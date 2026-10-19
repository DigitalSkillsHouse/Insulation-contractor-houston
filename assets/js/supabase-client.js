/**
 * Insulation Contractor Houston - Supabase Integration Client
 * All database and auth operations are proxied through server-side edge functions.
 * No secret keys are stored in this file.
 */

(function () {
  'use strict';

  const TOKEN_KEY = 'ich_access_token';

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || null;
  }
  function setToken(t) {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  // All admin data operations go through /api/admin (server-side, auth-gated)
  async function adminFetch(action, method, body) {
    const token = getToken();
    const opts = {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    const res = await fetch(`/api/admin?action=${action}`, opts);
    if (!res.ok) throw new Error(`API ${action}: ${res.status}`);
    return res.json();
  }

  // Mock Supabase client — exposes auth interface, proxied through /api/auth
  const mockClient = {
    auth: {
      async signInWithPassword({ email, password }) {
        try {
          const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'signIn', email, password })
          });
          const data = await res.json();
          if (!res.ok || data.error) {
            return { data: null, error: { message: data.error || 'Invalid credentials' } };
          }
          setToken(data.session.access_token);
          return { data: { session: data.session }, error: null };
        } catch (e) {
          return { data: null, error: { message: e.message } };
        }
      },

      async getSession() {
        const token = getToken();
        if (!token) return { data: { session: null }, error: null };
        try {
          const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getUser', token })
          });
          const data = await res.json();
          if (!res.ok || !data.user) {
            setToken(null);
            return { data: { session: null }, error: null };
          }
          return { data: { session: { access_token: token, user: data.user } }, error: null };
        } catch (e) {
          return { data: { session: null }, error: { message: e.message } };
        }
      },

      async getUser() {
        const { data } = await mockClient.auth.getSession();
        return { data: { user: data?.session?.user || null } };
      },

      async signOut() {
        const token = getToken();
        if (token) {
          await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'signOut', token })
          }).catch(() => {});
        }
        setToken(null);
        return { error: null };
      },

      onAuthStateChange() {
        // Real-time not available without client SDK
        return { data: { subscription: { unsubscribe: () => {} } } };
      }
    }
  };

  window.ICH_SUPABASE = {
    getClient: () => mockClient,

    async saveLead(leadData) {
      const res = await fetch('/api/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
        keepalive: true
      });
      if (!res.ok) throw new Error('Lead submission failed');
      return res.json();
    },

    async getLeads() {
      try {
        const data = await adminFetch('leads', 'GET');
        if (Array.isArray(data)) return mapLeads(data);
      } catch (err) {
        console.warn('[Admin] getLeads:', err.message);
      }
      return null;
    },

    async updateStatus(leadId, status) {
      try {
        const r = await adminFetch('updateStatus', 'POST', { leadId, status });
        return r.success !== false;
      } catch (err) {
        console.error('[Admin] updateStatus:', err.message);
        return false;
      }
    },

    async updateNotes(leadId, notes) {
      try {
        const r = await adminFetch('updateNotes', 'POST', { leadId, notes });
        return r.success !== false;
      } catch (err) {
        console.error('[Admin] updateNotes:', err.message);
        return false;
      }
    },

    async updateValue(leadId, value) {
      try {
        const r = await adminFetch('updateValue', 'POST', { leadId, value });
        return r.success !== false;
      } catch (err) {
        console.error('[Admin] updateValue:', err.message);
        return false;
      }
    },

    async deleteLead(leadId) {
      try {
        const r = await adminFetch('deleteLead', 'POST', { leadId });
        return r.success !== false;
      } catch (err) {
        console.error('[Admin] deleteLead:', err.message);
        return false;
      }
    },

    getSettings() {
      const defaults = {
        phone: '(832) 291-2738',
        email: 'info@insulationcontractorhouston.com',
        address: 'Cypress Farms Ranch Rd, Houston, TX 77429',
        hours: 'Mon–Fri 9am–6pm'
      };
      try {
        const saved = localStorage.getItem('ich_site_settings') || localStorage.getItem('usa_site_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          // Purge stale cache containing the old incorrect phone number
          if (parsed.phone && parsed.phone.includes('409')) {
            localStorage.removeItem('ich_site_settings');
            localStorage.removeItem('usa_site_settings');
            return defaults;
          }
          return { ...defaults, ...parsed };
        }
      } catch (e) {}
      return defaults;
    },

    async fetchSettings() {
      const current = this.getSettings();
      try {
        const data = await adminFetch('settings', 'GET');
        if (data && data.phone) {
          const updated = {
            phone: data.phone || current.phone,
            email: data.email || current.email,
            address: data.address || current.address,
            hours: data.hours || current.hours
          };
          localStorage.setItem('ich_site_settings', JSON.stringify(updated));
          this.applySettingsToDOM(updated);
          return updated;
        }
      } catch (e) {
        console.warn('[Settings Fetch]:', e.message);
      }
      return current;
    },

    async saveSettings(newSettings) {
      const current = this.getSettings();
      const updated = { ...current, ...newSettings };
      localStorage.setItem('ich_site_settings', JSON.stringify(updated));
      try {
        await adminFetch('saveSettings', 'POST', updated);
      } catch (e) {
        console.warn('[Settings Save]:', e.message);
      }
      this.applySettingsToDOM(updated);
      return updated;
    },

    applySettingsToDOM(settings) {
      const cfg = settings || this.getSettings();
      if (!cfg) return;
      if (cfg.phone) {
        const cleanPhone = cfg.phone.replace(/[^0-9+]/g, '');
        document.querySelectorAll('a[href^="tel:"]').forEach(el => {
          el.href = `tel:${cleanPhone}`;
          if (el.classList.contains('nav-call') || el.classList.contains('sticky-call')) {
            const strong = el.querySelector('strong');
            if (strong) strong.textContent = cfg.phone;
            else {
              el.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length) {
                  node.nodeValue = ` ${cfg.phone}`;
                }
              });
            }
          } else if (el.querySelector('strong')) {
            el.querySelector('strong').textContent = cfg.phone;
          }
        });
      }
      if (cfg.email) {
        document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
          el.href = `mailto:${cfg.email}`;
          const strong = el.querySelector('strong');
          if (strong) strong.textContent = cfg.email;
          else el.textContent = cfg.email;
        });
      }
    }
  };

  window.USA_SUPABASE = window.ICH_SUPABASE;

  function mapLeads(dbLeads) {
    return dbLeads.map(l => ({
      id: l.lead_id || l.id || 'ICH-0000',
      name: l.name || 'Anonymous',
      phone: l.phone || '',
      email: l.email || '',
      zip: l.zip || '',
      city: l.city || 'Spring Area, TX',
      service: l.service || 'Attic Insulation',
      type: l.type || 'Form Submission',
      status: l.status || 'new',
      date: l.submitted_at ? l.submitted_at.substring(0, 16).replace('T', ' ') : new Date().toISOString().substring(0, 16),
      submitted_at: l.submitted_at || new Date().toISOString(),
      notes: l.notes || '',
      value: Number(l.value) || 0
    }));
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.ICH_SUPABASE.applySettingsToDOM();
    // Only fetch remote settings when authenticated (admin panel after login)
    if (getToken()) {
      window.ICH_SUPABASE.fetchSettings();
    }

    document.querySelectorAll('a[href^="tel:"]').forEach(link => {
      link.addEventListener('click', () => {
        const phone = link.href.replace('tel:', '');
        window.ICH_SUPABASE.saveLead({
          name: 'Phone Caller (Click-to-Call)',
          phone: phone || '+18322912738',
          email: '',
          zip: 'Spring Area',
          service: 'Phone Inquiry',
          notes: `Click-to-call from ${window.location.pathname}`,
          pageUrl: window.location.href,
          type: 'Phone Call Click',
          status: 'new'
        }).catch(err => console.warn('[Call Capture]:', err.message));
      });
    });
  });

})();
