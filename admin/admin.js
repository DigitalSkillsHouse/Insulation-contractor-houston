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
    'Insulation Removal',
    'Air Sealing',
    'Attic Fan & Ventilation',
    'Commercial Insulation'
  ];

  // State Management
  const State = {
    leads: [],
    currentFilter: 'all',
    currentServiceFilter: 'all',
    currentTypeFilter: 'all',
    loaded: false,
    searchQuery: '',
    selectedLead: null,
    isAuthenticated: false
  };

  const getSupabase = () => window.ICH_SUPABASE || window.USA_SUPABASE;

  const HOUSTON_TZ = 'America/Chicago';
  // Phone taps are logged next to leads but are not leads. Totals and charts count real leads only.
  const isCallTap = (l) => l.type === 'Phone Call Click';
  const formLeads = () => State.leads.filter((l) => !isCallTap(l));
  const houstonDayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: HOUSTON_TZ }).format(d);

  function clearCachedLeads() {
    try {
      localStorage.removeItem('ich_admin_leads');
      localStorage.removeItem('usa_admin_leads');
    } catch (e) { /* storage blocked */ }
  }

  // Initialize Data & Supabase Database Connection
  async function initData() {
    // Lead details are never kept in the browser. Remove anything an older version stored.
    clearCachedLeads();
    State.leads = [];

    const sbClient = getSupabase();
    if (sbClient && typeof sbClient.getLeads === 'function') {
      try {
        const dbLeads = await sbClient.getLeads();
        if (Array.isArray(dbLeads)) {
          State.leads = dbLeads;
          renderAll();
        } else if (State.isAuthenticated) {
          showToast('Unable to load leads. Check your connection, or sign in again if your session expired.', 'warning');
        }
      } catch (e) {
        console.warn('[Admin] Lead load failed:', e.message);
        if (State.isAuthenticated) showToast('Unable to load leads. Check your connection, or sign in again.', 'warning');
      }
    }
    State.loaded = true;
    renderAll();
  }

  function saveLeads() {
    // Intentionally empty: names and phone numbers are not cached in the browser.
  }

  // Quiet refresh so new leads appear without reloading the page
  async function refreshLeadsQuietly() {
    if (!State.isAuthenticated || document.hidden) return;
    if (DOM.drawer && DOM.drawer.classList.contains('active')) return;
    const modal = document.getElementById('modal-confirm');
    if (modal && modal.classList.contains('active')) return;
    const sbClient = getSupabase();
    if (!sbClient || typeof sbClient.getLeads !== 'function') return;
    const fresh = await sbClient.getLeads();
    if (!Array.isArray(fresh)) return;
    if (JSON.stringify(fresh) === JSON.stringify(State.leads)) return;
    State.leads = fresh;
    renderAll();
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
    DOM.filterButtons = document.querySelectorAll('.filter-btn[data-filter]');
    DOM.serviceFilter = document.getElementById('service-filter');
    DOM.typeFilter = document.getElementById('type-filter');

    DOM.leadsTableBody = document.getElementById('leads-table-body');
    DOM.recentLeadsBody = document.getElementById('recent-leads-body');
    DOM.callsTableBody = document.getElementById('calls-table-body');

    DOM.sidebarToggle = document.getElementById('sidebar-toggle');
    DOM.headerSidebarToggle = document.getElementById('header-sidebar-toggle');

    DOM.drawerBackdrop = document.getElementById('drawer-backdrop');
    DOM.drawer = document.getElementById('lead-drawer');
    DOM.drawerClose = document.getElementById('drawer-close');

    DOM.btnExport = document.getElementById('btn-export-csv');
    DOM.btnBackup = document.getElementById('btn-export-json');
    DOM.themeToggle = document.getElementById('theme-toggle');
    DOM.btnLogout = document.getElementById('btn-logout');

    DOM.toastContainer = document.getElementById('toast-container');
  }

  // Sidebar Toggle & Collapse Mechanics
  function initSidebarState() {
    const isCollapsed = (localStorage.getItem('ich_admin_sidebar_collapsed') || localStorage.getItem('usa_admin_sidebar_collapsed')) === 'true';
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
    localStorage.setItem('ich_admin_sidebar_collapsed', isCollapsed ? 'true' : 'false');
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
    if (DOM.typeFilter) {
      DOM.typeFilter.addEventListener('change', (e) => {
        State.currentTypeFilter = e.target.value;
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
    if (DOM.btnBackup) {
      DOM.btnBackup.addEventListener('click', exportBackupJSON);
    }

    // Theme Toggle
    if (DOM.themeToggle) {
      DOM.themeToggle.addEventListener('click', toggleTheme);
    }

    // Site Settings Form Submit Handler
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
      // Pre-populate settings form inputs from saved storage
      const sbClient = getSupabase();
      if (sbClient && typeof sbClient.getSettings === 'function') {
        const currentSettings = sbClient.getSettings();
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
        const sbClient = getSupabase();

        let savedOnServer = false;
        if (sbClient && typeof sbClient.saveSettings === 'function') {
          const result = await sbClient.saveSettings(newSettings);
          savedOnServer = !!(result && result._saved !== false);
        } else {
          localStorage.setItem('ich_site_settings', JSON.stringify(newSettings));
        }

        if (savedOnServer) {
          showToast('Settings saved for the admin panel. Phone, address and hours on the public pages are edited in the site files.', 'success');
        } else {
          showToast('Saved on this device only. The server did not accept the change.', 'error');
        }
      });
    }

    // Change the admin login email and/or password
    const accountForm = document.getElementById('account-form');
    if (accountForm) {
      const accountMsg = document.getElementById('account-message');
      const setAccountMsg = (text, ok) => {
        if (!accountMsg) return;
        accountMsg.textContent = text;
        accountMsg.style.display = text ? 'block' : 'none';
        accountMsg.style.color = ok ? 'var(--success)' : 'var(--danger)';
      };
      accountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('account-current').value;
        const newEmail = document.getElementById('account-new-email').value.trim();
        const newPassword = document.getElementById('account-new-pass').value;
        const confirmPassword = document.getElementById('account-confirm-pass').value;

        if (!currentPassword) return setAccountMsg('Enter your current password.', false);
        if (!newEmail && !newPassword) return setAccountMsg('Enter a new email, a new password, or both.', false);
        if (newPassword && newPassword.length < 10) return setAccountMsg('The new password must be at least 10 characters.', false);
        if (newPassword && newPassword !== confirmPassword) return setAccountMsg('The new passwords do not match.', false);

        const btn = accountForm.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        setAccountMsg('Updating...', true);

        const sbClient = getSupabase();
        const result = sbClient && typeof sbClient.updateAccount === 'function'
          ? await sbClient.updateAccount({ currentPassword, newEmail, newPassword })
          : { ok: false, error: 'The admin service is not loaded. Refresh the page.' };

        if (btn) btn.disabled = false;
        if (!result.ok) return setAccountMsg(result.error, false);

        accountForm.reset();
        setAccountMsg('Login updated. Signing you out so you can sign in with the new details.', true);
        showToast('Admin login updated. Please sign in again.', 'success');
        setTimeout(() => handleLogout(), 1800);
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
      const sbClient = getSupabase();
      const sb = sbClient ? sbClient.getClient() : null;
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

    let authenticated = false;
    try {
      const sbClient = getSupabase();
      const sb = sbClient ? sbClient.getClient() : null;
      if (!sb || !sb.auth) {
        throw new Error('Supabase client is not loaded. Please refresh the page.');
      }

      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(error.message || 'Invalid email or password.');
      }
      if (!data?.session) {
        throw new Error('Authentication succeeded but no session was returned.');
      }

      authenticated = true;

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
      const sbClient = getSupabase();
      const sb = sbClient ? sbClient.getClient() : null;
      if (sb && sb.auth) {
        await sb.auth.signOut();
      }
    } catch (err) {
      console.warn('[Logout Error]:', err.message);
    }
    // Clear both current and legacy session keys, and any lead data
    sessionStorage.removeItem('ich_admin_auth');
    localStorage.removeItem('ich_admin_auth');
    clearCachedLeads();
    State.isAuthenticated = false;
    State.leads = [];
    State.loaded = false;
    renderAll();
    if (DOM.loginScreen) DOM.loginScreen.style.display = 'flex';
    showToast('Signed out successfully.');
  }

  // View Switcher
  function switchView(viewId, options = {}) {
    // Search belongs to the Leads list only, so clear it when moving between tabs
    State.searchQuery = '';
    if (DOM.searchInput) DOM.searchInput.value = '';
    if (viewId !== 'leads' || !options.keepServiceFilter) {
      State.currentServiceFilter = 'all';
      if (DOM.serviceFilter) DOM.serviceFilter.value = 'all';
      State.currentTypeFilter = 'all';
      if (DOM.typeFilter) DOM.typeFilter.value = 'all';
    }
    // Coming back from the Recycle Bin must not leave the list stuck on "cancelled"
    if (viewId === 'leads' && State.currentFilter === 'cancelled') {
      State.currentFilter = 'all';
      DOM.filterButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-filter') === 'all'));
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

    if (viewId === 'leads') renderLeadsTable();

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
          const acctEl = document.getElementById('account-current-email');
          if (acctEl) acctEl.textContent = user.email;
          if (avatarEl) avatarEl.textContent = user.email.slice(0, 2).toUpperCase();
        }
      }
    } catch (e) { }
  }

  // Calculate & Render Stats
  function renderStats() {
    // Until the first load finishes, show a loading marker instead of misleading zeros
    if (!State.loaded) {
      ['stat-total-leads', 'stat-phone-calls', 'stat-conversion-rate'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = '...';
      });
      return;
    }
    // Call taps are tracked on their own. Only real form and calculator leads count as leads.
    const formLeadList = formLeads();
    const totalLeads = formLeadList.length;
    const phoneCalls = State.leads.filter(isCallTap).length;

    const scheduled = formLeadList.filter(l => l.status === 'scheduled' || l.status === 'completed').length;
    const conversionRate = totalLeads ? Math.round((scheduled / totalLeads) * 100) : 0;

    document.getElementById('stat-total-leads').textContent = totalLeads;
    document.getElementById('stat-phone-calls').textContent = phoneCalls;
    document.getElementById('stat-conversion-rate').textContent = `${conversionRate}%`;

    // Compute period comparison (7d vs prior 7d)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const curr7d = formLeadList.filter(l => new Date(l.submitted_at || l.date) >= sevenDaysAgo);
    const prior7d = formLeadList.filter(l => {
      const d = new Date(l.submitted_at || l.date);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    });

    updateTrendBadge('stat-footer-total-leads', curr7d.length, prior7d.length, 'vs last week');

    const callTaps = State.leads.filter(isCallTap);
    const currCalls = callTaps.filter(l => new Date(l.submitted_at || l.date) >= sevenDaysAgo).length;
    const priorCalls = callTaps.filter(l => {
      const d = new Date(l.submitted_at || l.date);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    }).length;
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

    const serviceLeads = formLeads();
    const totalLeads = serviceLeads.length;
    const counts = {};
    SUPPORTED_SERVICES.forEach(s => counts[s] = 0);

    serviceLeads.forEach(l => {
      const svc = l.service;
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
    if (legacyBadge) legacyBadge.textContent = State.leads.filter(l => l.status === 'new' && !isCallTap(l)).length;
  }

  // Filter Leads
  function getFilteredLeads() {
    return State.leads.filter(l => {
      // Phone call clicks belong in the Phone Clicks tab only, never form leads
      if (l.type === 'Phone Call Click') return false;
      // Cancelled leads live in the Recycle Bin, not in the main list
      if (l.status === 'cancelled' && State.currentFilter !== 'cancelled') return false;
      if (State.currentTypeFilter !== 'all' && l.type !== State.currentTypeFilter) return false;
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
          <div>${escapeHTML(l.city || 'City not captured')}</div>
          <small style="color:var(--text-dim);">${escapeHTML(l.zip || 'No ZIP')}</small>
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
    const recent = formLeads().slice(0, 5);

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
        <td>${escapeHTML(c.city || 'Not captured')}</td>
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
    const isEmailValid = lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email);
    document.getElementById('drawer-email').textContent = lead.email || 'N/A';
    document.getElementById('drawer-email-link').href = isEmailValid ? `mailto:${lead.email}` : '#';
    document.getElementById('drawer-zip').textContent = [lead.zip, lead.city].filter(Boolean).join(' · ') || 'Not captured';
    document.getElementById('drawer-service').textContent = lead.service;
    document.getElementById('drawer-date').textContent = lead.date;

    // Populate Visitor Location Card
    const loc = lead.location_data;
    const locNameEl = document.getElementById('drawer-loc-name');
    const locAccEl = document.getElementById('drawer-loc-acc');
    const locCoordsEl = document.getElementById('drawer-loc-coords');
    const locMapLinkEl = document.getElementById('drawer-loc-maplink');

    const hasCoords = !!loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number';
    if (loc && (loc.city || hasCoords)) {
      const place = [loc.city || lead.city, loc.region, loc.country].filter(Boolean).join(', ') || 'Location not captured';
      if (locNameEl) locNameEl.textContent = `${place} (approximate)`;
      if (locAccEl) locAccEl.textContent = 'Estimated from the visitor IP address, can be several miles off';
      if (locCoordsEl) locCoordsEl.textContent = hasCoords ? `${loc.latitude}, ${loc.longitude}` : 'Coordinates not available';
      if (locMapLinkEl) {
        if (hasCoords) {
          locMapLinkEl.href = loc.maps_url || `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
          locMapLinkEl.style.display = 'inline';
        } else {
          locMapLinkEl.style.display = 'none';
        }
      }
    } else {
      if (locNameEl) locNameEl.textContent = 'Location not captured';
      if (locAccEl) locAccEl.textContent = 'No location was recorded for this lead';
      if (locCoordsEl) locCoordsEl.textContent = 'Coordinates not captured';
      if (locMapLinkEl) locMapLinkEl.style.display = 'none';
    }

    const notesArea = document.getElementById('drawer-notes');
    if (notesArea) notesArea.value = lead.notes || '';

    const valueInput = document.getElementById('drawer-value-input');
    if (valueInput) {
      valueInput.value = lead.value || '';
      valueInput.onchange = async () => {
        const newValue = Number(valueInput.value) || 0;
        const sbClient = getSupabase();
        if (sbClient && typeof sbClient.updateValue === 'function') {
          const ok = await sbClient.updateValue(lead.id, newValue);
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
        const sbClient = getSupabase();
        if (sbClient && typeof sbClient.updateStatus === 'function') {
          success = await sbClient.updateStatus(lead.id, newStatus);
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
        const sbClient = getSupabase();
        if (sbClient && typeof sbClient.updateNotes === 'function') {
          success = await sbClient.updateNotes(lead.id, newNotes);
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

    const drawerRestoreBtn = document.getElementById('drawer-restore-lead');
    if (drawerRestoreBtn) {
      drawerRestoreBtn.style.display = lead.status === 'cancelled' ? '' : 'none';
      drawerRestoreBtn.onclick = async () => {
        drawerRestoreBtn.disabled = true;
        const sbClient = getSupabase();
        const ok = sbClient && typeof sbClient.updateStatus === 'function' ? await sbClient.updateStatus(lead.id, 'new') : false;
        drawerRestoreBtn.disabled = false;
        if (ok) {
          lead.status = 'new';
          closeDrawer();
          renderAll();
          showToast(`Restored lead ${lead.id} to New`, 'success');
        } else {
          showToast(`Failed to restore ${lead.id}`, 'error');
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
  // If lead is already cancelled (in recycle bin), permanently delete it.
  // Otherwise move it to the recycle bin by setting status = 'cancelled'.
  function deleteLead(leadId) {
    if (!leadId) return;
    const lead = State.leads.find(l => l.id === leadId);
    if (!lead) return;
    const name = lead.name;
    const isInRecycleBin = lead.status === 'cancelled';

    if (isInRecycleBin) {
      openConfirmModal(
        `Permanently Delete ${leadId}?`,
        `Permanently remove ${name} from the database? This cannot be undone.`,
        'Permanently Delete',
        async () => {
          const proceedBtn = document.getElementById('confirm-modal-proceed');
          if (proceedBtn) { proceedBtn.disabled = true; proceedBtn.textContent = 'Deleting...'; }
          try {
            const sbClient = getSupabase();
            if (!sbClient || typeof sbClient.deleteLead !== 'function' || !(await sbClient.deleteLead(leadId))) {
              throw new Error('The server did not delete the lead');
            }
            State.leads = State.leads.filter(l => l.id !== leadId);
            saveLeads();
            closeConfirmModal();
            closeDrawer();
            renderAll();
            showToast(`Permanently deleted lead ${leadId}`, 'success');
          } catch (err) {
            console.error('[Delete Lead Error]:', err);
            showToast(`Failed to delete lead ${leadId} from database`, 'error');
          } finally {
            if (proceedBtn) { proceedBtn.disabled = false; proceedBtn.textContent = 'Permanently Delete'; }
          }
        }
      );
    } else {
      openConfirmModal(
        `Move ${leadId} to Recycle Bin?`,
        `Move ${name} to the recycle bin? You can permanently delete or restore it from there.`,
        'Move to Recycle Bin',
        async () => {
          const proceedBtn = document.getElementById('confirm-modal-proceed');
          if (proceedBtn) { proceedBtn.disabled = true; proceedBtn.textContent = 'Moving...'; }
          try {
            const sbClient = getSupabase();
            if (!sbClient || typeof sbClient.updateStatus !== 'function' || !(await sbClient.updateStatus(leadId, 'cancelled'))) {
              throw new Error('The server did not move the lead');
            }
            lead.status = 'cancelled';
            saveLeads();
            closeConfirmModal();
            closeDrawer();
            renderAll();
            showToast(`Moved lead ${leadId} to recycle bin`, 'success');
          } catch (err) {
            console.error('[Move to Recycle Bin Error]:', err);
            showToast(`Failed to move lead ${leadId} to recycle bin`, 'error');
          } finally {
            if (proceedBtn) { proceedBtn.disabled = false; proceedBtn.textContent = 'Move to Recycle Bin'; }
          }
        }
      );
    }
  }

  // Dynamic Date-Bucket Calculation for Chart (7D, 30D, 90D)
  let currentChartRange = '7d';

  function getChartBuckets(range) {
    const now = new Date();
    const points = [];

    if (range === '7d') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const dayStr = houstonDayKey(d);
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: HOUSTON_TZ });
        const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: HOUSTON_TZ });
        const count = formLeads().filter(l => houstonDayKey(new Date(l.submitted_at || l.date)) === dayStr).length;

        points.push({ day: dayLabel, date: dateLabel, count: count });
      }
    } else if (range === '30d') {
      for (let i = 5; i >= 0; i--) {
        const endD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 5) + 1);
        const startD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((i + 1) * 5) + 1);

        const count = formLeads().filter(l => {
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

        const count = formLeads().filter(l => {
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
            <text x="${pt.x}" y="${pt.y - 14}" fill="var(--text-main)" font-size="11" text-anchor="middle" font-weight="700">${pt.count}</text>
            <text x="${pt.x}" y="${height - 10}" fill="var(--text-muted)" font-size="11" text-anchor="middle" font-weight="600">${currentChartRange === '7d' ? pt.day : pt.date}</text>
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

    // Remove leading control/whitespace characters
    str = str.replace(/^[\s\u0000-\u001F\u007F]+/, '');

    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }

    // Escape double quotes according to CSV rules.
    str = str.replace(/"/g, '""');

    return `"${str}"`;
  }

  // Numbers (value, latitude, longitude) are written as plain numbers, not quoted text
  function numCSV(val) {
    const n = Number(val);
    return (val === null || val === undefined || val === '' || !isFinite(n)) ? '""' : String(n);
  }

  // Export to CSV using Blob instead of a data URI.
  function exportToCSV() {
    const headers = [
      'ID', 'Name', 'Phone', 'Email', 'ZIP', 'City', 'Service', 'Type', 'Status', 'Date (Houston time)', 'Value',
      'Notes', 'Page URL', 'Location Source', 'Location City', 'Location Region', 'Latitude', 'Longitude'
    ];

    const rows = State.leads.map(l => {
      const loc = l.location_data || {};
      return [
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
        numCSV(l.value || 0),
        sanitizeCSV(l.notes),
        sanitizeCSV(l.page_url),
        sanitizeCSV(loc.source),
        sanitizeCSV(loc.city),
        sanitizeCSV(loc.region),
        numCSV(loc.latitude),
        numCSV(loc.longitude)
      ];
    });

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `Insulation_Contractor_Houston_Leads_${new Date()
      .toISOString()
      .substring(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    // Release the temporary object URL after the download has been initiated.
    setTimeout(() => URL.revokeObjectURL(url), 0);

    showToast('Leads exported to CSV file successfully!');
  }

  // Full backup of every lead row exactly as stored. Use it before moving the database.
  async function exportBackupJSON() {
    const sbClient = getSupabase();
    const raw = sbClient && typeof sbClient.getRawLeads === 'function' ? await sbClient.getRawLeads() : null;
    if (!Array.isArray(raw)) {
      showToast('Could not download the backup. Sign in again and retry.', 'error');
      return;
    }
    const blob = new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Insulation_Contractor_Houston_Leads_Backup_${new Date().toISOString().substring(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast(`Backup downloaded: ${raw.length} lead records.`, 'success');
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
    renderStats();

    // An expired login shows the sign-in screen with a clear message
    window.addEventListener('ich-session-expired', () => {
      State.isAuthenticated = false;
      State.loaded = false;
      clearCachedLeads();
      if (DOM.loginScreen) DOM.loginScreen.style.display = 'flex';
      if (DOM.loginError) {
        DOM.loginError.style.display = 'block';
        DOM.loginError.textContent = 'Your session expired. Sign in again.';
      }
    });
    setInterval(refreshLeadsQuietly, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshLeadsQuietly(); });

    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
      await initData();
      renderAll();
    }

    // Subscribe to real-time authentication state changes from Supabase Auth
    const sbClient = getSupabase();
    const sb = sbClient ? sbClient.getClient() : null;
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
