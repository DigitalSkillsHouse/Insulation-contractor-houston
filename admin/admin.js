/**
 * Insulation contractor houston Admin Dashboard Core Application Engine
 */

(function () {
  'use strict';

  // Initial leads array (starts empty - populated from Supabase database)
  const INITIAL_LEADS = [];

  // Shared Constants
  const SUPPORTED_SERVICES = [
    'Attic Insulation',
    'Spray Foam Insulation',
    'Injection Foam Insulation',
    'Air Sealing',
    'Attic Fan & Ventilation'
  ];

  // State Management
  const State = {
    leads: [],
    currentFilter: 'all',
    currentServiceFilter: 'all',
    searchQuery: '',
    selectedLead: null,
    isAuthenticated: false
  };

  const DUMMY_IDS = new Set(['USA-1094', 'USA-1093', 'USA-1092', 'USA-1091', 'USA-1090', 'USA-1089', 'USA-1088']);

  // Initialize Data & Supabase Database Connection
  async function initData() {
    // Purge cached dummy leads from LocalStorage
    let saved = [];
    try {
      const raw = localStorage.getItem('usa_admin_leads');
      if (raw) {
        saved = JSON.parse(raw).filter(l => !DUMMY_IDS.has(l.id) && l.name !== 'Robert Miller' && l.name !== 'Sarah Jenkins');
      }
    } catch (e) { }

    State.leads = saved;
    saveLeads();

    // Fetch live leads strictly from Supabase Database
    if (window.USA_SUPABASE && typeof window.USA_SUPABASE.getLeads === 'function') {
      try {
        const dbLeads = await window.USA_SUPABASE.getLeads();
        if (Array.isArray(dbLeads)) {
          const dbIds = new Set(dbLeads.map(l => l.id));
          const localOnly = saved.filter(l => !dbIds.has(l.id));
          State.leads = [...dbLeads, ...localOnly];
          saveLeads();
          renderAll();
          console.log('[Admin] Synced with Supabase database:', dbLeads.length, 'leads');
        } else if (dbLeads === null) {
          showToast('Notice: Unable to reach database. Displaying cached lead data.', 'warning');
        }
      } catch (e) {
        console.warn('[Admin] Supabase initial sync notice:', e.message);
        showToast('Notice: Database sync warning. Displaying cached lead data.', 'warning');
      }
    }
  }

  function saveLeads() {
    localStorage.setItem('usa_admin_leads', JSON.stringify(State.leads));
  }

  // DOM Elements
  const DOM = {};

  function cacheDOM() {
    DOM.loginScreen = document.getElementById('login-screen');
    DOM.loginForm = document.getElementById('login-form');
    DOM.loginError = document.getElementById('login-error');

    DOM.sidebarNav = document.getElementById('sidebar-nav');
    DOM.navItems = document.querySelectorAll('.nav-item[data-view]');
    DOM.views = document.querySelectorAll('.view-container');

    DOM.searchInput = document.getElementById('global-search');
    DOM.filterButtons = document.querySelectorAll('.filter-btn');
    DOM.serviceFilter = document.getElementById('service-filter');

    DOM.leadsTableBody = document.getElementById('leads-table-body');
    DOM.recentLeadsBody = document.getElementById('recent-leads-body');
    DOM.callsTableBody = document.getElementById('calls-table-body');

    DOM.sidebarToggle = document.getElementById('sidebar-toggle');
    DOM.headerSidebarToggle = document.getElementById('header-sidebar-toggle');

    DOM.drawerBackdrop = document.getElementById('drawer-backdrop');
    DOM.drawer = document.getElementById('lead-drawer');
    DOM.drawerClose = document.getElementById('drawer-close');

    DOM.btnExport = document.getElementById('btn-export-csv');
    DOM.themeToggle = document.getElementById('theme-toggle');
    DOM.btnLogout = document.getElementById('btn-logout');

    DOM.toastContainer = document.getElementById('toast-container');
  }

  // Sidebar Toggle & Collapse Mechanics
  function initSidebarState() {
    const isCollapsed = localStorage.getItem('usa_admin_sidebar_collapsed') === 'true';
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }

  function toggleSidebar() {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    const sidebar = document.querySelector('.admin-sidebar');
    if (sidebar) {
      sidebar.classList.toggle('open', !isCollapsed);
    }
    localStorage.setItem('usa_admin_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  }

  // Bind Events
  function bindEvents() {
    // Sidebar Toggle Buttons
    if (DOM.sidebarToggle) {
      DOM.sidebarToggle.addEventListener('click', toggleSidebar);
    }
    if (DOM.headerSidebarToggle) {
      DOM.headerSidebarToggle.addEventListener('click', toggleSidebar);
    }
    // Authentication
    if (DOM.loginForm) {
      DOM.loginForm.addEventListener('submit', handleLogin);
    }
    if (DOM.btnLogout) {
      DOM.btnLogout.addEventListener('click', handleLogout);
    }

    // Navigation Switch
    DOM.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        switchView(view);
      });
    });

    // Filtering & Search
    if (DOM.searchInput) {
      DOM.searchInput.addEventListener('input', (e) => {
        State.searchQuery = e.target.value.toLowerCase();
        renderLeadsTable();
      });
    }

    DOM.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        State.currentFilter = btn.getAttribute('data-filter');
        renderLeadsTable();
      });
    });

    if (DOM.serviceFilter) {
      DOM.serviceFilter.addEventListener('change', (e) => {
        State.currentServiceFilter = e.target.value;
        renderLeadsTable();
      });
    }

    // Drawer Controls
    if (DOM.drawerClose) {
      DOM.drawerClose.addEventListener('click', closeDrawer);
    }
    if (DOM.drawerBackdrop) {
      DOM.drawerBackdrop.addEventListener('click', closeDrawer);
    }

    // CSV Export
    if (DOM.btnExport) {
      DOM.btnExport.addEventListener('click', exportToCSV);
    }

    // Theme Toggle
    if (DOM.themeToggle) {
      DOM.themeToggle.addEventListener('click', toggleTheme);
    }

    // Site Settings Form Submit Handler
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
      // Pre-populate settings form inputs from saved storage
      if (window.USA_SUPABASE && typeof window.USA_SUPABASE.getSettings === 'function') {
        const currentSettings = window.USA_SUPABASE.getSettings();
        const phoneIn = document.getElementById('setting-phone');
        const emailIn = document.getElementById('setting-email');
        const addrIn = document.getElementById('setting-address');
        const hoursIn = document.getElementById('setting-hours');

        if (phoneIn) phoneIn.value = currentSettings.phone || '';
        if (emailIn) emailIn.value = currentSettings.email || '';
        if (addrIn) addrIn.value = currentSettings.address || '';
        if (hoursIn) hoursIn.value = currentSettings.hours || '';
      }

      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('setting-phone').value.trim();
        const email = document.getElementById('setting-email').value.trim();
        const address = document.getElementById('setting-address').value.trim();
        const hours = document.getElementById('setting-hours').value.trim();

        const newSettings = { phone, email, address, hours };

        if (window.USA_SUPABASE && typeof window.USA_SUPABASE.saveSettings === 'function') {
          await window.USA_SUPABASE.saveSettings(newSettings);
        } else {
          localStorage.setItem('usa_site_settings', JSON.stringify(newSettings));
        }

        showToast('Site Settings saved and applied across the website!', 'success');
      });
    }

    // Service Rows Click to Filter
    document.querySelectorAll('.service-row-interactive').forEach(row => {
      row.addEventListener('click', () => {
        const service = row.getAttribute('data-service');
        if (service) {
          State.currentServiceFilter = service;
          if (DOM.serviceFilter) DOM.serviceFilter.value = service;
          switchView('leads', { keepServiceFilter: true });
          renderLeadsTable();
          showToast(`Filtered leads by ${service}`);
        }
      });
    });

    // Event Delegation for Table Row Actions (Survives Re-renders)
    if (DOM.leadsTableBody) {
      DOM.leadsTableBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('[data-action="delete"], .btn-delete-lead');
        if (deleteBtn) {
          const leadId = deleteBtn.getAttribute('data-id');
          if (leadId) deleteLead(leadId);
          return;
        }
        const viewBtn = e.target.closest('.btn-view-lead');
        if (viewBtn) {
          const leadId = viewBtn.getAttribute('data-id');
          if (leadId) openLeadDrawer(leadId);
        }
      });
    }

    // Lead Drawer Delete Button Listener
    const drawerDeleteBtn = document.getElementById('drawer-delete-lead');
    if (drawerDeleteBtn) {
      drawerDeleteBtn.addEventListener('click', () => {
        if (State.selectedLead && State.selectedLead.id) {
          deleteLead(State.selectedLead.id);
        }
      });
    }

    // Confirmation Modal Event Listeners
    const modalConfirm = document.getElementById('modal-confirm');
    const proceedBtn = document.getElementById('confirm-modal-proceed');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    const closeBtn = document.getElementById('confirm-modal-close');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeConfirmModal);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeConfirmModal);
    }

    if (modalConfirm) {
      modalConfirm.addEventListener('click', (e) => {
        if (e.target === modalConfirm) {
          closeConfirmModal();
        }
      });
    }

    // Global Keydown Handler (Close Modals & Drawers on Escape Key)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeConfirmModal();
        closeDrawer();
      }
    });
  }

  // Auth Functions using Supabase Auth
  async function checkAuth() {
    try {
      const sb = window.USA_SUPABASE ? window.USA_SUPABASE.getClient() : null;
      if (sb && sb.auth) {
        const { data: { session }, error } = await sb.auth.getSession();
        if (session && !error) {
          State.isAuthenticated = true;
          if (DOM.loginScreen) DOM.loginScreen.style.display = 'none';
          return true;
        }
      }
    } catch (e) {
      console.warn('[Auth Check Error]:', e.message);
    }
    State.isAuthenticated = false;
    if (DOM.loginScreen) DOM.loginScreen.style.display = 'flex';
    return false;
  }

  async function handleLogin(e) {
    e.preventDefault();
    const emailInput = document.getElementById('login-user');
    const passInput = document.getElementById('login-pass');
    const submitBtn = DOM.loginForm ? DOM.loginForm.querySelector('button[type="submit"]') : null;

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value : '';

    if (!email || !password) {
      if (DOM.loginError) {
        DOM.loginError.style.display = 'block';
        DOM.loginError.textContent = 'Please enter both email address and password.';
      }
      return;
    }

    if (DOM.loginError) DOM.loginError.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';
    }

    try {
      const sb = window.USA_SUPABASE ? window.USA_SUPABASE.getClient() : null;
      if (!sb || !sb.auth) {
        throw new Error('Supabase authentication client is uninitialized.');
      }

      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;

      State.isAuthenticated = true;
      if (DOM.loginScreen) DOM.loginScreen.style.display = 'none';
      showToast('Welcome back! Admin session authenticated.', 'success');
      await initData();
      renderAll();
    } catch (err) {
      if (DOM.loginError) {
        DOM.loginError.style.display = 'block';
        DOM.loginError.textContent = err.message || 'Invalid email or password.';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Dashboard';
      }
    }
  }

  async function handleLogout(e) {
    if (e) e.preventDefault();
    try {
      const sb = window.USA_SUPABASE ? window.USA_SUPABASE.getClient() : null;
      if (sb && sb.auth) {
        await sb.auth.signOut();
      }
    } catch (err) {
      console.warn('[Logout Error]:', err.message);
    }
    State.isAuthenticated = false;
    if (DOM.loginScreen) DOM.loginScreen.style.display = 'flex';
    showToast('Signed out successfully.');
  }

  // View Switcher
  function switchView(viewId, options = {}) {
    if (viewId !== 'leads' || !options.keepServiceFilter) {
      State.currentServiceFilter = 'all';
      if (DOM.serviceFilter) DOM.serviceFilter.value = 'all';
    }

    DOM.navItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewId);
    });

    if (viewId === 'recycle') {
      DOM.views.forEach(v => {
        v.classList.toggle('active', v.id === 'view-leads');
      });
      State.currentFilter = 'cancelled';
      DOM.filterButtons.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-filter') === 'cancelled');
      });
      renderLeadsTable();
    } else {
      DOM.views.forEach(v => {
        v.classList.toggle('active', v.id === `view-${viewId}`);
      });
    }

    const pageTitle = document.getElementById('header-page-title');
    if (pageTitle) {
      const titles = {
        dashboard: 'Dashboard Overview',
        leads: 'Form Leads & Service Requests',
        calls: 'Phone Call Tracking Log',
        recycle: 'Recycle Bin & Cancelled Leads',
        settings: 'Admin & Contact Settings'
      };
      pageTitle.textContent = titles[viewId] || 'Admin Console';
    }
  }

  // Render Core UI
  function renderAll() {
    updateSidebarProfile();
    renderStats();
    renderLeadsTable();
    renderRecentLeads();
    renderCallsTable();
    renderServicesBreakdown();
    renderCharts();
    updateBadgeCounters();
  }

  async function updateSidebarProfile() {
    try {
      const sb = window.USA_SUPABASE ? window.USA_SUPABASE.getClient() : null;
      if (sb && sb.auth) {
        const { data: { user } } = await sb.auth.getUser();
        if (user && user.email) {
          const emailEl = document.getElementById('sidebar-user-email');
          const roleEl = document.getElementById('sidebar-user-role');
          const avatarEl = document.getElementById('sidebar-user-avatar');
          if (emailEl) {
            emailEl.textContent = user.email;
            emailEl.title = user.email;
          }
          if (roleEl) roleEl.textContent = 'Authenticated Admin';
          if (avatarEl) avatarEl.textContent = user.email.slice(0, 2).toUpperCase();
        }
      }
    } catch (e) { }
  }

  // Calculate & Render Stats
  function renderStats() {
    const totalLeads = State.leads.length;
    const phoneCalls = State.leads.filter(l => l.type === 'Phone Call Click').length;

    const scheduled = State.leads.filter(l => l.status === 'scheduled' || l.status === 'completed').length;
    const conversionRate = totalLeads ? Math.round((scheduled / totalLeads) * 100) : 0;

    document.getElementById('stat-total-leads').textContent = totalLeads;
    document.getElementById('stat-phone-calls').textContent = phoneCalls;
    document.getElementById('stat-conversion-rate').textContent = `${conversionRate}%`;

    // Compute period comparison (7d vs prior 7d)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const curr7d = State.leads.filter(l => new Date(l.submitted_at || l.date) >= sevenDaysAgo);
    const prior7d = State.leads.filter(l => {
      const d = new Date(l.submitted_at || l.date);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    });

    updateTrendBadge('stat-footer-total-leads', curr7d.length, prior7d.length, 'vs last week');

    const currCalls = curr7d.filter(l => l.type === 'Phone Call Click').length;
    const priorCalls = prior7d.filter(l => l.type === 'Phone Call Click').length;
    updateTrendBadge('stat-footer-phone-calls', currCalls, priorCalls, 'vs last week');

    const currConv = curr7d.length ? Math.round((curr7d.filter(l => l.status === 'scheduled' || l.status === 'completed').length / curr7d.length) * 100) : 0;
    const priorConv = prior7d.length ? Math.round((prior7d.filter(l => l.status === 'scheduled' || l.status === 'completed').length / prior7d.length) * 100) : 0;
    updateTrendBadge('stat-footer-conversion', currConv, priorConv, 'vs last week', '%');
  }

  function updateTrendBadge(containerId, curr, prior, labelText, suffix = '%') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!prior || prior === 0) {
      container.innerHTML = `<span class="trend-badge trend-neutral" style="background:rgba(255,255,255,0.08); color:var(--text-muted);">n/a</span> <span style="color:var(--text-dim);">${labelText}</span>`;
      return;
    }

    const diffPct = Math.round(((curr - prior) / prior) * 100);
    if (diffPct >= 0) {
      container.innerHTML = `<span class="trend-badge trend-up">↑ +${diffPct}${suffix}</span> <span style="color:var(--text-dim);">${labelText}</span>`;
    } else {
      container.innerHTML = `<span class="trend-badge trend-down">↓ ${diffPct}${suffix}</span> <span style="color:var(--text-dim);">${labelText}</span>`;
    }
  }

  function renderServicesBreakdown() {
    const container = document.getElementById('services-breakdown-body');
    if (!container) return;

    const totalLeads = State.leads.length;
    const counts = {};
    SUPPORTED_SERVICES.forEach(s => counts[s] = 0);

    State.leads.forEach(l => {
      const svc = (l.service === 'Air Sealing & Draft Control' || l.service === 'Air Sealing & Drafts') ? 'Air Sealing' : l.service;
      if (counts[svc] !== undefined) counts[svc]++;
      else counts[svc] = 1;
    });

    const sorted = Object.keys(counts)
      .map(svc => ({
        service: svc,
        count: counts[svc],
        pct: totalLeads ? Math.round((counts[svc] / totalLeads) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const colors = ['var(--primary)', 'var(--secondary)', 'var(--purple)', 'var(--success)'];

    if (totalLeads === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:24px; color:var(--text-dim); font-size:13px;">
          No service inquiries recorded yet.
        </div>
      `;
      return;
    }

    container.innerHTML = sorted.map((item, idx) => `
      <div class="service-row-interactive" data-service="${escapeHTML(item.service)}" title="Click to filter by ${escapeHTML(item.service)}">
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
          <span>${escapeHTML(item.service)}</span>
          <strong>${item.pct}% <small style="color:var(--text-dim);">(${item.count})</small></strong>
        </div>
        <div style="height:8px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden;">
          <div style="width:${item.pct}%; height:100%; background:${colors[idx % colors.length]}; transition:width 0.3s ease;"></div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.service-row-interactive').forEach(row => {
      row.addEventListener('click', () => {
        const service = row.getAttribute('data-service');
        if (service) {
          State.currentServiceFilter = service;
          if (DOM.serviceFilter) DOM.serviceFilter.value = service;
          switchView('leads', { keepServiceFilter: true });
          renderLeadsTable();
          showToast(`Filtered leads by ${service}`);
        }
      });
    });
  }

  function updateBadgeCounters() {
    const formLeadsCount = State.leads.filter(l => l.type !== 'Phone Call Click' && l.status !== 'cancelled').length;
    const phoneCallsCount = State.leads.filter(l => l.type === 'Phone Call Click').length;
    const recycleBinCount = State.leads.filter(l => l.status === 'cancelled').length;

    const formBadge = document.getElementById('form-leads-badge');
    const phoneBadge = document.getElementById('phone-clicks-badge');
    const recycleBadge = document.getElementById('recycle-bin-badge');
    const legacyBadge = document.getElementById('new-leads-count');

    if (formBadge) formBadge.textContent = formLeadsCount;
    if (phoneBadge) phoneBadge.textContent = phoneCallsCount;
    if (recycleBadge) recycleBadge.textContent = recycleBinCount;
    if (legacyBadge) legacyBadge.textContent = State.leads.filter(l => l.status === 'new').length;
  }

  // Filter Leads
  function getFilteredLeads() {
    return State.leads.filter(l => {
      // Status Filter
      if (State.currentFilter !== 'all' && l.status !== State.currentFilter) {
        return false;
      }
      // Service Filter
      if (State.currentServiceFilter !== 'all' && l.service !== State.currentServiceFilter) {
        return false;
      }
      // Search Query
      if (State.searchQuery) {
        const q = State.searchQuery;
        const text = `${l.name} ${l.phone} ${l.email} ${l.zip} ${l.city} ${l.service} ${l.id}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }

  // Render Main Leads Table
  function renderLeadsTable() {
    if (!DOM.leadsTableBody) return;
    const leads = getFilteredLeads();

    if (leads.length === 0) {
      DOM.leadsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No leads found matching your current filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    DOM.leadsTableBody.innerHTML = leads.map(l => `
      <tr>
        <td><strong>${escapeHTML(l.id)}</strong></td>
        <td>
          <div style="font-weight:700;">${escapeHTML(l.name)}</div>
          <small style="color:var(--text-dim);">${escapeHTML(l.email || 'No email')}</small>
        </td>
        <td>
          <a href="tel:${escapeHTML(l.phone)}" style="color:var(--secondary); text-decoration:none; font-weight:600;">
            ${escapeHTML(l.phone)}
          </a>
        </td>
        <td>
          <span style="font-weight:600; font-size:12px; background:rgba(255,255,255,0.06); padding:4px 8px; border-radius:6px;">
            ${escapeHTML(l.service)}
          </span>
        </td>
        <td>
          <div>${escapeHTML(l.city || 'Spring Area')}</div>
          <small style="color:var(--text-dim);">${escapeHTML(l.zip)}</small>
        </td>
        <td>
          ${getStatusBadge(l.status)}
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-icon btn-view-lead" data-id="${escapeHTML(l.id)}" title="View Details">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn btn-icon btn-delete-lead" data-action="delete" data-id="${escapeHTML(l.id)}" title="Delete Lead" style="color:var(--danger);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Render Recent Leads (Dashboard Widget)
  function renderRecentLeads() {
    if (!DOM.recentLeadsBody) return;
    const recent = State.leads.slice(0, 5);

    DOM.recentLeadsBody.innerHTML = recent.map(l => `
      <tr>
        <td>
          <div style="font-weight:700;">${escapeHTML(l.name)}</div>
          <small style="color:var(--text-dim);">${escapeHTML(l.date)}</small>
        </td>
        <td>${escapeHTML(l.service)}</td>
        <td>${getStatusBadge(l.status)}</td>
        <td>
          <button class="btn btn-icon btn-view-lead" data-id="${escapeHTML(l.id)}" title="Quick View">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </td>
      </tr>
    `).join('');

    DOM.recentLeadsBody.querySelectorAll('.btn-view-lead').forEach(btn => {
      btn.addEventListener('click', () => openLeadDrawer(btn.getAttribute('data-id')));
    });
  }

  // Render Calls Table
  function renderCallsTable() {
    if (!DOM.callsTableBody) return;
    const calls = State.leads.filter(l => l.type === 'Phone Call Click');

    if (calls.length === 0) {
      DOM.callsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">
            No phone call click events recorded yet.
          </td>
        </tr>`;
      return;
    }

    DOM.callsTableBody.innerHTML = calls.map(c => `
      <tr>
        <td><strong>${escapeHTML(c.id)}</strong></td>
        <td>${escapeHTML(c.date)}</td>
        <td><a href="tel:${escapeHTML(c.phone)}" style="color:var(--primary); font-weight:700; text-decoration:none;">${escapeHTML(c.phone)}</a></td>
        <td>${escapeHTML(c.name)}</td>
        <td>${escapeHTML(c.zip)} (${escapeHTML(c.city)})</td>
        <td><span class="badge badge-new"><span class="badge-dot"></span> Call Click</span></td>
      </tr>
    `).join('');
  }

  // Status Badge Helper
  function getStatusBadge(status) {
    const maps = {
      new: '<span class="badge badge-new"><span class="badge-dot"></span> New Lead</span>',
      contacted: '<span class="badge badge-contact"><span class="badge-dot"></span> Contacted</span>',
      scheduled: '<span class="badge badge-scheduled"><span class="badge-dot"></span> Scheduled</span>',
      completed: '<span class="badge badge-completed"><span class="badge-dot"></span> Completed</span>',
      cancelled: '<span class="badge badge-cancelled"><span class="badge-dot"></span> Cancelled</span>'
    };
    return maps[status] || `<span class="badge badge-cancelled"><span class="badge-dot"></span> ${escapeHTML(status || 'Unknown')}</span>`;
  }

  // Open Lead Details Drawer
  function openLeadDrawer(leadId) {
    const lead = State.leads.find(l => l.id === leadId);
    if (!lead) return;

    State.selectedLead = lead;

    const cleanPhone = (lead.phone || '').replace(/[^\d+\-() ]/g, '');
    document.getElementById('drawer-lead-id').textContent = lead.id;
    document.getElementById('drawer-name').textContent = lead.name;
    document.getElementById('drawer-phone').textContent = lead.phone;
    document.getElementById('drawer-phone-link').href = `tel:${cleanPhone}`;
    document.getElementById('drawer-email').textContent = lead.email || 'N/A';
    document.getElementById('drawer-email-link').href = lead.email ? `mailto:${lead.email}` : '#';
    document.getElementById('drawer-zip').textContent = `${lead.zip} (${lead.city})`;
    document.getElementById('drawer-service').textContent = lead.service;
    document.getElementById('drawer-date').textContent = lead.date;

    const notesArea = document.getElementById('drawer-notes');
    if (notesArea) notesArea.value = lead.notes || '';

    const valueInput = document.getElementById('drawer-value-input');
    if (valueInput) {
      valueInput.value = lead.value || '';
      valueInput.onchange = async () => {
        const newValue = Number(valueInput.value) || 0;
        if (window.USA_SUPABASE && typeof window.USA_SUPABASE.updateValue === 'function') {
          const ok = await window.USA_SUPABASE.updateValue(lead.id, newValue);
          if (ok) {
            lead.value = newValue;
            saveLeads();
            showToast(`Updated value for ${lead.id} → $${newValue}`, 'success');
          } else {
            showToast(`Failed to update value for ${lead.id}`, 'error');
          }
        }
      };
    }

    const statusSelect = document.getElementById('drawer-status-select');
    if (statusSelect) {
      statusSelect.value = lead.status;

      statusSelect.onchange = async (e) => {
        const oldStatus = lead.status;
        const newStatus = e.target.value;
        statusSelect.disabled = true;

        let success = false;
        if (window.USA_SUPABASE && typeof window.USA_SUPABASE.updateStatus === 'function') {
          success = await window.USA_SUPABASE.updateStatus(lead.id, newStatus);
        } else {
          success = true;
        }

        statusSelect.disabled = false;

        if (success) {
          lead.status = newStatus;
          saveLeads();
          renderAll();
          showToast(`Updated lead ${lead.id} status to ${newStatus}`, 'success');
        } else {
          statusSelect.value = oldStatus;
          showToast(`Failed to update status for ${lead.id}`, 'error');
        }
      };
    }

    const saveNotesBtn = document.getElementById('drawer-save-notes');
    if (saveNotesBtn && notesArea) {
      saveNotesBtn.onclick = async () => {
        const oldNotes = lead.notes || '';
        const newNotes = notesArea.value;
        saveNotesBtn.disabled = true;
        const origText = saveNotesBtn.textContent;
        saveNotesBtn.textContent = 'Saving...';

        let success = false;
        if (window.USA_SUPABASE && typeof window.USA_SUPABASE.updateNotes === 'function') {
          success = await window.USA_SUPABASE.updateNotes(lead.id, newNotes);
        } else {
          success = true;
        }

        saveNotesBtn.disabled = false;
        saveNotesBtn.textContent = origText;

        if (success) {
          lead.notes = newNotes;
          saveLeads();
          showToast(`Saved notes for ${lead.id}`, 'success');
        } else {
          notesArea.value = oldNotes;
          showToast(`Failed to save notes for ${lead.id}`, 'error');
        }
      };
    }

    const drawerDeleteBtn = document.getElementById('drawer-delete-lead');
    if (drawerDeleteBtn) {
      drawerDeleteBtn.onclick = () => {
        deleteLead(lead.id);
      };
    }

    DOM.drawerBackdrop.classList.add('active');
    DOM.drawer.classList.add('active');
  }

  function closeDrawer() {
    DOM.drawerBackdrop.classList.remove('active');
    DOM.drawer.classList.remove('active');
    State.selectedLead = null;
  }

  // Custom Modal Confirmation Popup System
  function openConfirmModal(title, text, actionBtnText, onConfirm) {
    const modal = document.getElementById('modal-confirm');
    const titleEl = document.getElementById('confirm-modal-title');
    const textEl = document.getElementById('confirm-modal-text');
    const proceedBtn = document.getElementById('confirm-modal-proceed');

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    if (proceedBtn) {
      proceedBtn.textContent = actionBtnText || 'Delete Lead';
      proceedBtn.onclick = async () => {
        if (typeof onConfirm === 'function') await onConfirm();
        else closeConfirmModal();
      };
    }

    if (modal) modal.classList.add('active');
  }

  function closeConfirmModal() {
    const modal = document.getElementById('modal-confirm');
    if (modal) modal.classList.remove('active');
  }

  // Delete Lead using Custom Modal
  function deleteLead(leadId) {
    if (!leadId) return;
    const lead = State.leads.find(l => l.id === leadId);
    const name = lead ? lead.name : leadId;
    openConfirmModal(
      `Delete Lead ${leadId}?`,
      `Are you sure you want to remove ${name} from your estimate leads database? This action cannot be undone.`,
      'Delete Lead',
      async () => {
        const proceedBtn = document.getElementById('confirm-modal-proceed');
        if (proceedBtn) {
          proceedBtn.disabled = true;
          proceedBtn.textContent = 'Deleting...';
        }

        let success = false;
        try {
          if (window.USA_SUPABASE && typeof window.USA_SUPABASE.deleteLead === 'function') {
            success = await window.USA_SUPABASE.deleteLead(leadId);
          } else {
            success = true;
          }

          if (!success) {
            throw new Error(`Supabase DB deletion failed for lead ${leadId}`);
          }

          State.leads = State.leads.filter(l => l.id !== leadId);
          saveLeads();
          closeConfirmModal();
          closeDrawer();
          renderAll();
          showToast(`Deleted lead ${leadId}`, 'success');
        } catch (err) {
          console.error('[Delete Lead Error]:', err);
          showToast(`Failed to delete lead ${leadId} from database`, 'error');
        } finally {
          if (proceedBtn) {
            proceedBtn.disabled = false;
            proceedBtn.textContent = 'Delete Lead';
          }
        }
      }
    );
  }

  // Dynamic Date-Bucket Calculation for Chart (7D, 30D, 90D)
  let currentChartRange = '7d';

  function getChartBuckets(range) {
    const now = new Date();
    const points = [];

    if (range === '7d') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayStr = d.toISOString().substring(0, 10);
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const count = State.leads.filter(l => {
          const lDate = (l.submitted_at || l.date || '').substring(0, 10);
          return lDate === dayStr;
        }).length;

        points.push({ day: dayLabel, date: dateLabel, count: count });
      }
    } else if (range === '30d') {
      for (let i = 5; i >= 0; i--) {
        const endD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 5) + 1);
        const startD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((i + 1) * 5) + 1);

        const count = State.leads.filter(l => {
          const d = new Date(l.submitted_at || l.date);
          return d >= startD && d < endD;
        }).length;

        points.push({
          day: `P${6 - i}`,
          date: `${startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endD.getDate()}`,
          count: count
        });
      }
    } else if (range === '90d') {
      for (let i = 11; i >= 0; i--) {
        const endD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 7) + 1);
        const startD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((i + 1) * 7) + 1);

        const count = State.leads.filter(l => {
          const d = new Date(l.submitted_at || l.date);
          return d >= startD && d < endD;
        }).length;

        points.push({
          day: `W${12 - i}`,
          date: startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count: count
        });
      }
    }
    return points;
  }

  // SVG Chart Renderer with Tooltips & Dynamic Range Selection
  function renderCharts() {
    const chartEl = document.getElementById('leads-chart');
    const tooltipEl = document.getElementById('chart-tooltip');
    if (!chartEl) return;

    // Bind range button listeners
    document.querySelectorAll('.chart-range-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.chart-range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentChartRange = btn.getAttribute('data-range');
        renderCharts();
      };
    });

    const points = getChartBuckets(currentChartRange);

    if (State.leads.length === 0 || points.every(p => p.count === 0)) {
      chartEl.innerHTML = `
        <div style="height:100%; min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-dim); gap:10px;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
          <span style="font-size:13px; font-weight:600;">No lead volume recorded for this timeframe</span>
        </div>
      `;
      return;
    }

    const width = 600;
    const height = 220;
    const padding = 35;

    const maxVal = Math.max(...points.map(p => p.count), 5);
    const stepX = (width - padding * 2) / (points.length - 1 || 1);

    const coords = points.map((p, i) => {
      const x = points.length === 1 ? width / 2 : padding + i * stepX;
      const y = height - padding - (p.count / maxVal) * (height - padding * 2);
      return { x, y, ...p };
    });

    const pathD = coords.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = arr[i - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }, '');

    const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;

    chartEl.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:100%; overflow:visible;">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FF5E15" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#FF5E15" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        
        <!-- Grid lines -->
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
        <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

        <!-- Area fill -->
        <path d="${areaD}" fill="url(#chartGradient)"/>
        
        <!-- Curve line -->
        <path d="${pathD}" fill="none" stroke="#FF5E15" stroke-width="3.5" stroke-linecap="round"/>

        <!-- Data points -->
        ${coords.map((pt, index) => `
          <g class="chart-point-group" data-index="${index}" style="cursor:pointer;">
            <circle cx="${pt.x}" cy="${pt.y}" r="12" fill="transparent" class="hit-area"/>
            <circle cx="${pt.x}" cy="${pt.y}" r="5.5" fill="var(--bg-card)" stroke="#FF5E15" stroke-width="3" class="dot"/>
            <text x="${pt.x}" y="${height - 10}" fill="var(--text-muted)" font-size="11" text-anchor="middle" font-weight="600">${pt.day}</text>
          </g>
        `).join('')}
      </svg>
    `;

    // Attach Interactivity & Tooltips
    chartEl.querySelectorAll('.chart-point-group').forEach(group => {
      const idx = group.getAttribute('data-index');
      const pt = coords[idx];

      group.addEventListener('mouseenter', (e) => {
        const dot = group.querySelector('.dot');
        if (dot) {
          dot.setAttribute('r', '8');
          dot.setAttribute('fill', '#FF5E15');
        }

        if (tooltipEl) {
          tooltipEl.style.display = 'block';
          tooltipEl.innerHTML = `<strong>${pt.date} (${pt.day})</strong>: ${pt.count} Leads`;

          const rect = chartEl.getBoundingClientRect();
          const leftPercent = (pt.x / width) * 100;
          const topPercent = (pt.y / height) * 100;

          tooltipEl.style.left = `${leftPercent}%`;
          tooltipEl.style.top = `${topPercent - 10}%`;
        }
      });

      group.addEventListener('mouseleave', () => {
        const dot = group.querySelector('.dot');
        if (dot) {
          dot.setAttribute('r', '5.5');
          dot.setAttribute('fill', 'var(--bg-card)');
        }

        if (tooltipEl) {
          tooltipEl.style.display = 'none';
        }
      });
    });
  }

  // Helper to sanitize CSV values against spreadsheet formula injection.
  function sanitizeCSV(val) {
    let str = String(val === null || val === undefined ? '' : val);

    // Remove leading control/whitespace characters before checking
    // for spreadsheet formula-triggering characters.
    const normalized = str.replace(/^[\s\u0000-\u001F\u007F]+/, '');

    if (/^[=+\-@]/.test(normalized)) {
      str = "'" + str;
    }

    // Escape double quotes according to CSV rules.
    str = str.replace(/"/g, '""');

    return `"${str}"`;
  }

  // Export to CSV using Blob instead of a data URI.
  function exportToCSV() {
    const headers = [
      'ID',
      'Name',
      'Phone',
      'Email',
      'ZIP',
      'City',
      'Service',
      'Type',
      'Status',
      'Date',
      'Value'
    ];

    const rows = State.leads.map(l => [
      sanitizeCSV(l.id),
      sanitizeCSV(l.name),
      sanitizeCSV(l.phone),
      sanitizeCSV(l.email),
      sanitizeCSV(l.zip),
      sanitizeCSV(l.city),
      sanitizeCSV(l.service),
      sanitizeCSV(l.type),
      sanitizeCSV(l.status),
      sanitizeCSV(l.date),
      sanitizeCSV(l.value || 0)
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `USA_Insulation_Leads_${new Date()
      .toISOString()
      .substring(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    // Release the temporary object URL after the download has been initiated.
    setTimeout(() => URL.revokeObjectURL(url), 0);

    showToast('Leads exported to CSV file successfully!');
  }

  function updateLogos() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const logoSrc = currentTheme === 'light'
      ? '/assets/images/logo-admin-transparent.webp'
      : '/assets/images/logo-footer.webp';

    document.querySelectorAll('.sidebar-logo, .login-logo').forEach(img => {
      img.src = logoSrc;
    });
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('adminTheme', next);
    updateLogos();
    showToast(`Switched to ${next} theme.`);
  }

  function showToast(message, type = 'info') {
    if (!DOM.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      <span>${escapeHTML(message)}</span>
    `;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHTML(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // App Initialization Entry
  document.addEventListener('DOMContentLoaded', async () => {
    cacheDOM();
    initSidebarState();
    bindEvents();
    updateLogos();

    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
      await initData();
      renderAll();
    }

    // Subscribe to real-time authentication state changes from Supabase Auth
    const sb = window.USA_SUPABASE ? window.USA_SUPABASE.getClient() : null;
    if (sb && sb.auth && typeof sb.auth.onAuthStateChange === 'function') {
      sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          State.isAuthenticated = false;
          if (DOM.loginScreen) DOM.loginScreen.style.display = 'flex';
        } else if (event === 'SIGNED_IN' && session) {
          State.isAuthenticated = true;
          if (DOM.loginScreen) DOM.loginScreen.style.display = 'none';
          initData().then(() => renderAll());
        }
      });
    }
  });

})();
