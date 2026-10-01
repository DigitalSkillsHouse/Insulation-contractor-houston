/**
 * USA Insulation - Supabase Direct Database Integration Client
 * Handles real-time lead persistence, status updates, and retrieval.
 */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://nwafioovagseljmawgsm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_vnHTFMDCkSJoKADIXUSz2g_VFWVNGJZ';
  const TABLE_NAME = 'leads';

  let client = null;

  // Initialize Supabase SDK client if available
  function getClient() {
    if (client) return client;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      } catch (e) {
        console.warn('[Supabase] SDK Init Notice:', e.message);
      }
    }
    return client;
  }

  // REST API Fallback Helper using direct Fetch if SDK CDN is blocked
  async function restRequest(endpoint, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase REST Error ${res.status}: ${errText}`);
    }
    return res.json().catch(() => ({ success: true }));
  }

  // Global API Interface
  window.USA_SUPABASE = {
    url: SUPABASE_URL,
    key: SUPABASE_KEY,
    getClient: getClient,

    /**
     * Save a new estimate lead to Supabase database
     */
    async saveLead(leadData) {
      const generateCollisionSafeId = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return 'USA-' + crypto.randomUUID().slice(0, 8).toUpperCase();
        }
        return 'USA-' + String(Date.now()).slice(-6) + '-' + Math.floor(100 + Math.random() * 900);
      };

      const payload = {
        lead_id: leadData.id || generateCollisionSafeId(),
        name: leadData.name || 'Anonymous',
        phone: leadData.phone || '',
        email: leadData.email || '',
        zip: leadData.zip || '',
        city: leadData.city || 'Spring Area, TX',
        service: leadData.service || 'Attic Insulation',
        type: leadData.type || 'Form Submission',
        status: leadData.status || 'new',
        notes: leadData.message || leadData.notes || '',
        page_url: leadData.pageUrl || window.location.href,
        submitted_at: leadData.date || new Date().toISOString()
      };

      try {
        const sb = getClient();
        if (sb) {
          // Do NOT call .select() here so anon role can insert without needing SELECT RLS permission
          const { error } = await sb.from(TABLE_NAME).insert([payload]);
          if (error) throw error;
          console.log('[Supabase] Lead inserted via SDK:', payload);
          return payload;
        } else {
          const data = await restRequest(TABLE_NAME, {
            method: 'POST',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify(payload)
          });
          console.log('[Supabase] Lead inserted via REST:', payload);
          return payload;
        }
      } catch (err) {
        console.error('[Supabase Save Error]:', err.message);
        // Fallback: save to LocalStorage so no lead is ever lost!
        const existing = JSON.parse(localStorage.getItem('usa_admin_leads') || '[]');
        existing.unshift(payload);
        localStorage.setItem('usa_admin_leads', JSON.stringify(existing));
        return payload;
      }
    },

    /**
     * Fetch all leads from Supabase database
     */
    async getLeads() {
      try {
        const sb = getClient();
        if (sb) {
          const { data, error } = await sb.from(TABLE_NAME).select('*').order('submitted_at', { ascending: false });
          if (error) throw error;
          if (Array.isArray(data)) return mapSupabaseLeads(data);
        } else {
          const data = await restRequest(`${TABLE_NAME}?select=*&order=submitted_at.desc`);
          if (Array.isArray(data)) return mapSupabaseLeads(data);
        }
      } catch (err) {
        console.warn('[Supabase Fetch Warning]: Using local cached leads.', err.message);
      }
      return null;
    },

    /**
     * Update status of a lead in Supabase database
     */
    async updateStatus(leadId, status) {
      try {
        const sb = getClient();
        if (sb) {
          const { error } = await sb.from(TABLE_NAME).update({ status }).eq('lead_id', leadId);
          if (error) throw error;
        } else {
          await restRequest(`${TABLE_NAME}?lead_id=eq.${encodeURIComponent(leadId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
          });
        }
        console.log(`[Supabase] Updated status for ${leadId} -> ${status}`);
        return true;
      } catch (err) {
        console.error('[Supabase Update Status Error]:', err.message);
        return false;
      }
    },

    /**
     * Update dispatcher notes for a lead in Supabase
     */
    async updateNotes(leadId, notes) {
      try {
        const sb = getClient();
        if (sb) {
          const { error } = await sb.from(TABLE_NAME).update({ notes }).eq('lead_id', leadId);
          if (error) throw error;
        } else {
          await restRequest(`${TABLE_NAME}?lead_id=eq.${encodeURIComponent(leadId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ notes })
          });
        }
        console.log(`[Supabase] Updated notes for ${leadId}`);
        return true;
      } catch (err) {
        console.error('[Supabase Update Notes Error]:', err.message);
        return false;
      }
    },

    /**
     * Update estimated project value for a lead in Supabase
     */
    async updateValue(leadId, value) {
      const numValue = Number(value) || 0;
      try {
        const sb = getClient();
        if (sb) {
          const { error } = await sb.from(TABLE_NAME).update({ value: numValue }).eq('lead_id', leadId);
          if (error) throw error;
        } else {
          await restRequest(`${TABLE_NAME}?lead_id=eq.${encodeURIComponent(leadId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ value: numValue })
          });
        }
        console.log(`[Supabase] Updated value for ${leadId} -> $${numValue}`);
        return true;
      } catch (err) {
        console.error('[Supabase Update Value Error]:', err.message);
        return false;
      }
    },

    /**
     * Delete a lead from Supabase database
     */
    async deleteLead(leadId) {
      try {
        const sb = getClient();
        if (sb) {
          const { data, error } = await sb.from(TABLE_NAME).delete().eq('lead_id', leadId).select();
          if (error) throw error;
          if (!Array.isArray(data) || data.length === 0) {
            throw new Error(`Supabase delete query affected 0 rows for lead_id: ${leadId}`);
          }
        } else {
          const data = await restRequest(`${TABLE_NAME}?lead_id=eq.${encodeURIComponent(leadId)}`, {
            method: 'DELETE',
            headers: { 'Prefer': 'return=representation' }
          });
          if (!Array.isArray(data) || data.length === 0) {
            throw new Error(`REST delete query affected 0 rows for lead_id: ${leadId}`);
          }
        }
        console.log(`[Supabase] Successfully deleted lead ${leadId}`);
        return true;
      } catch (err) {
        console.error('[Supabase Delete Error]:', err.message);
        return false;
      }
    },

    /**
     * Get Site Settings (from LocalStorage & Supabase)
     */
    getSettings() {
      const DEFAULT_SETTINGS = {
        phone: '+1 409-996-4620',
        email: 'info@insulationcontractorhouston.com',
        address: '23407 Snook Ln Bldg 1, Tomball, TX 77375',
        hours: 'Mon–Fri 9am–6pm'
      };

      try {
        const saved = localStorage.getItem('usa_site_settings');
        if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {}

      return DEFAULT_SETTINGS;
    },

    /**
     * Save Site Settings to LocalStorage & Supabase
     */
    async saveSettings(newSettings) {
      const current = this.getSettings();
      const updated = { ...current, ...newSettings };
      localStorage.setItem('usa_site_settings', JSON.stringify(updated));

      try {
        const sb = getClient();
        if (sb) {
          await sb.from('site_settings').upsert([{ id: 1, ...updated }]);
        }
      } catch (e) {
        console.warn('[Supabase Settings Save Notice]:', e.message);
      }

      this.applySettingsToDOM(updated);
      return updated;
    },

    /**
     * Apply Settings dynamically across website DOM elements (Phone links, Email links, Address)
     */
    applySettingsToDOM(settings) {
      const cfg = settings || this.getSettings();
      if (!cfg) return;

      // Update All Phone Links
      if (cfg.phone) {
        const cleanPhone = cfg.phone.replace(/[^0-9+]/g, '');
        document.querySelectorAll('a[href^="tel:"]').forEach(el => {
          el.href = `tel:${cleanPhone}`;
          // Preserve inner icons/formatting if present, update text node
          if (el.classList.contains('nav-call') || el.classList.contains('sticky-call')) {
            const strong = el.querySelector('strong');
            if (strong) strong.textContent = cfg.phone;
            else {
              // replace text node
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

      // Update All Email Links
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

  // Helper to map DB columns to frontend lead structure
  function mapSupabaseLeads(dbLeads) {
    return dbLeads.map(l => ({
      id: l.lead_id || l.id || 'USA-0000',
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

  // Automatic Public Form Capture & Settings Binding
  document.addEventListener('DOMContentLoaded', () => {
    // Apply saved site settings across DOM (phone numbers, email, address)
    if (window.USA_SUPABASE && typeof window.USA_SUPABASE.applySettingsToDOM === 'function') {
      window.USA_SUPABASE.applySettingsToDOM();
    }

    // Automatic Phone Call Click Capture
    document.querySelectorAll('a[href^="tel:"]').forEach(link => {
      link.addEventListener('click', () => {
        const phone = link.href.replace('tel:', '');
        const callLead = {
          name: 'Phone Caller (Click-to-Call)',
          phone: phone || '+1 409-996-4620',
          email: '',
          zip: 'Spring Area',
          service: 'Phone Inquiry',
          message: `Click-to-call initiated from ${window.location.pathname}`,
          pageUrl: window.location.href,
          type: 'Phone Call Click',
          status: 'new'
        };
        console.log('[Call Capture] Saving phone call click event to Supabase:', callLead);
        window.USA_SUPABASE.saveLead(callLead);
      });
    });

    document.querySelectorAll('form[data-rl-lead], form.request-card, form.contact-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        // Collect lead input values
        const nameInput = form.querySelector('[name="name"]');
        const phoneInput = form.querySelector('[name="phone"]');
        const emailInput = form.querySelector('[name="email"]');
        const zipInput = form.querySelector('[name="zip"]');
        const serviceInput = form.querySelector('[name="service"]');
        const messageInput = form.querySelector('[name="message"]');

        const leadObj = {
          name: nameInput ? nameInput.value.trim() : '',
          phone: phoneInput ? phoneInput.value.trim() : '',
          email: emailInput ? emailInput.value.trim() : '',
          zip: zipInput ? zipInput.value.trim() : '',
          service: serviceInput ? serviceInput.value : 'Attic Insulation',
          message: messageInput ? messageInput.value.trim() : '',
          pageUrl: window.location.href,
          type: 'Form Submission',
          status: 'new'
        };

        if (leadObj.name || leadObj.phone) {
          console.log('[Form Handler] Submitting lead to Supabase:', leadObj);
          window.USA_SUPABASE.saveLead(leadObj);
        }
      });
    });
  });

})();
