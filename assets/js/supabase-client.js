/**
 * Insulation Contractor Houston - Supabase Database Integration Client
 * Handles lead persistence via edge API and admin panel data operations.
 */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://nwafioovagseljmawgsm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_vnHTFMDCkSJoKADIXUSz2g_VFWVNGJZ';
  const TABLE_NAME = 'leads';

  let client = null;

  // Initialize Supabase SDK client (used in Admin Panel)
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

  // Global API Interface
  window.ICH_SUPABASE = {
    getClient: getClient,

    /**
     * Save a new estimate lead via secure Vercel Edge API
     */
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

    /**
     * Fetch all leads from Supabase database (Admin only)
     */
    async getLeads() {
      try {
        const sb = getClient();
        if (sb) {
          const { data, error } = await sb.from(TABLE_NAME).select('*').order('submitted_at', { ascending: false });
          if (error) throw error;
          if (Array.isArray(data)) return mapSupabaseLeads(data);
        }
      } catch (err) {
        console.warn('[Supabase Fetch Warning]: Failed to fetch leads.', err.message);
      }
      return null;
    },

    /**
     * Update status of a lead in Supabase database (Admin only)
     */
    async updateStatus(leadId, status) {
      try {
        const sb = getClient();
        if (sb) {
          const { data, error } = await sb.from(TABLE_NAME).update({ status }).eq('lead_id', leadId).select();
          if (error) throw error;
          if (!Array.isArray(data) || data.length === 0) {
            throw new Error(`Supabase updateStatus affected 0 rows for lead_id: ${leadId}`);
          }
          console.log(`[Supabase] Updated status for ${leadId} -> ${status}`);
          return true;
        }
      } catch (err) {
        console.error('[Supabase Update Status Error]:', err.message);
      }
      return false;
    },

    /**
     * Update dispatcher notes for a lead in Supabase (Admin only)
     */
    async updateNotes(leadId, notes) {
      try {
        const sb = getClient();
        if (sb) {
          const { data, error } = await sb.from(TABLE_NAME).update({ notes }).eq('lead_id', leadId).select();
          if (error) throw error;
          if (!Array.isArray(data) || data.length === 0) {
            throw new Error(`Supabase updateNotes affected 0 rows for lead_id: ${leadId}`);
          }
          console.log(`[Supabase] Updated notes for ${leadId}`);
          return true;
        }
      } catch (err) {
        console.error('[Supabase Update Notes Error]:', err.message);
      }
      return false;
    },

    /**
     * Update estimated project value for a lead in Supabase (Admin only)
     */
    async updateValue(leadId, value) {
      const numValue = Number(value) || 0;
      try {
        const sb = getClient();
        if (sb) {
          const { data, error } = await sb.from(TABLE_NAME).update({ value: numValue }).eq('lead_id', leadId).select();
          if (error) throw error;
          if (!Array.isArray(data) || data.length === 0) {
            throw new Error(`Supabase updateValue affected 0 rows for lead_id: ${leadId}`);
          }
          console.log(`[Supabase] Updated value for ${leadId} -> $${numValue}`);
          return true;
        }
      } catch (err) {
        console.error('[Supabase Update Value Error]:', err.message);
      }
      return false;
    },

    /**
     * Delete a lead from Supabase database (Admin only)
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
          console.log(`[Supabase] Successfully deleted lead ${leadId}`);
          return true;
        }
      } catch (err) {
        console.error('[Supabase Delete Error]:', err.message);
      }
      return false;
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
        const saved = localStorage.getItem('ich_site_settings') || localStorage.getItem('usa_site_settings');
        if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {}

      return DEFAULT_SETTINGS;
    },

    /**
     * Fetch remote site settings from Supabase database (Asynchronous background sync)
     */
    async fetchSettings() {
      const current = this.getSettings();
      try {
        const sb = getClient();
        if (sb) {
          const { data, error } = await sb.from('site_settings').select('*').eq('id', 1).maybeSingle();
          if (!error && data) {
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
        }
      } catch (e) {
        console.warn('[Supabase Settings Fetch Notice]:', e.message);
      }
      return current;
    },

    /**
     * Save Site Settings to LocalStorage & Supabase
     */
    async saveSettings(newSettings) {
      const current = this.getSettings();
      const updated = { ...current, ...newSettings };
      localStorage.setItem('ich_site_settings', JSON.stringify(updated));

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

  // Backward compatibility alias for legacy scripts
  window.USA_SUPABASE = window.ICH_SUPABASE;

  // Helper to map DB columns to frontend lead structure
  function mapSupabaseLeads(dbLeads) {
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

  // DOM initialization
  document.addEventListener('DOMContentLoaded', () => {
    // Apply saved site settings across DOM
    if (window.ICH_SUPABASE && typeof window.ICH_SUPABASE.applySettingsToDOM === 'function') {
      window.ICH_SUPABASE.applySettingsToDOM();
      if (typeof window.ICH_SUPABASE.fetchSettings === 'function') {
        window.ICH_SUPABASE.fetchSettings();
      }
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
          notes: `Click-to-call initiated from ${window.location.pathname}`,
          pageUrl: window.location.href,
          type: 'Phone Call Click',
          status: 'new'
        };
        console.log('[Call Capture] Saving phone call click event via edge function:', callLead);
        window.ICH_SUPABASE.saveLead(callLead).catch(err => {
          console.warn('[Call Capture Error]:', err.message);
        });
      });
    });
  });

})();
