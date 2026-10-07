/* THEME 9 — "Warm Community" front-end behaviours.
   Lead capture and form persistence handled via Supabase API backend. */

function initNavbar() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-links");
  const closeBtn = menu && menu.querySelector(".nav-close");
  if (!toggle || !menu) return;
  const isMobile = () => window.matchMedia("(max-width: 900px)").matches;
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("open", open);
    document.body.classList.toggle("menu-open", open);
    if (!open) menu.querySelectorAll(".nav-dd.open").forEach((d) => d.classList.remove("open"));
  };
  const closeMenu = () => setMenu(false);

  toggle.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
  if (closeBtn) closeBtn.addEventListener("click", closeMenu);

  // Services / Areas: on mobile, tapping the top-level item EXPANDS its submenu
  // (accordion) instead of navigating away — so submenus start collapsed.
  menu.querySelectorAll(".nav-dd > a").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!isMobile()) return;
      event.preventDefault();
      const dd = link.parentElement;
      const wasOpen = dd.classList.contains("open");
      menu.querySelectorAll(".nav-dd.open").forEach((d) => d !== dd && d.classList.remove("open"));
      dd.classList.toggle("open", !wasOpen);
    });
  });

  // Real navigation links close the whole menu; the submenu toggles above do not.
  menu.querySelectorAll("a").forEach((link) => {
    if (link.parentElement && link.parentElement.classList.contains("nav-dd")) return;
    link.addEventListener("click", () => { if (isMobile()) closeMenu(); });
  });
  document.addEventListener("keydown", (event) => event.key === "Escape" && closeMenu());

  // --- Sticky Header Logic ---
  const header = document.querySelector(".site-header");
  const navbarContainer = document.getElementById("navbar-container");
  if (header && navbarContainer) {
    // Create spacer element to prevent content jump
    let spacer = navbarContainer.querySelector(".header-spacer");
    if (!spacer) {
      spacer = document.createElement("div");
      spacer.className = "header-spacer";
      navbarContainer.appendChild(spacer);
    }

    const utilityBar = header.querySelector(".utility-bar");
    let lastScroll = 0;
    let ticking = false;

    const updateSticky = () => {
      const scrollY = window.scrollY;
      const triggerPoint = utilityBar ? utilityBar.offsetHeight : 40;

      if (scrollY > triggerPoint) {
        if (!header.classList.contains("is-sticky")) {
          header.classList.add("is-sticky");
          const navHeight = header.querySelector(".main-nav")?.offsetHeight || 72;
          spacer.style.height = (triggerPoint + navHeight) + "px";
          spacer.classList.add("active");
        }
      } else {
        if (header.classList.contains("is-sticky")) {
          header.classList.remove("is-sticky");
          spacer.classList.remove("active");
          spacer.style.height = "0";
        }
      }
      ticking = false;
    };

    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(updateSticky);
        ticking = true;
      }
    }, { passive: true });

    // Run once on load in case page is already scrolled
    updateSticky();
  }
}

function initAccordions() {
  document.querySelectorAll(".accordion article").forEach((item) => {
    const button = item.querySelector("button");
    if (!button) return;
    button.addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      document.querySelectorAll(".accordion article").forEach((other) => {
        other.classList.remove("open");
        other.querySelector("button")?.setAttribute("aria-expanded", "false");
        const s = other.querySelector("button b");
        if (s) s.textContent = "+";
      });
      if (!wasOpen) {
        item.classList.add("open");
        button.setAttribute("aria-expanded", "true");
        const s = button.querySelector("b");
        if (s) s.textContent = "−";
      }
    });
  });
}

/* Interactive process stepper — reads step content from the clicked article's
   data attributes so it stays niche-driven (no hardcoded copy). */
function initProcess() {
  const title = document.getElementById("process-title");
  const description = document.getElementById("process-description");
  const label = document.getElementById("process-step");
  const meter = document.querySelector(".process-meter span");
  const buttons = document.querySelectorAll("[data-process]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.getAttribute("data-process"));
      document.querySelectorAll(".process-list article").forEach((item) => item.classList.remove("active"));
      button.closest("article")?.classList.add("active");
      if (label) label.textContent = "STEP " + String(index + 1).padStart(2, "0");
      if (title) title.textContent = button.getAttribute("data-title") || "";
      if (description) description.textContent = button.getAttribute("data-desc") || "";
      if (meter) meter.style.width = ((index + 1) / buttons.length) * 100 + "%";
    });
  });
}

/* Scroll-reveal without any external library (replaces sal.js). Adds
   `.sal-animate` as each [data-sal] element scrolls into view; honours
   data-sal-delay and prefers-reduced-motion, and degrades to "show all"
   when IntersectionObserver is unavailable. */
function initReveal() {
  var els = document.querySelectorAll("[data-sal]");
  if (!els.length) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    els.forEach(function (el) { el.classList.add("sal-animate"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var delay = parseInt(el.getAttribute("data-sal-delay") || "0", 10);
      if (delay) el.style.transitionDelay = delay + "ms";
      el.classList.add("sal-animate");
      io.unobserve(el);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
  els.forEach(function (el) { io.observe(el); });
}

function initLeadForms() {
  document.querySelectorAll('form.contact-form, form.request-card').forEach(form => {
    if (form.__leadHandlerBound) return; // guard against double-registration
    form.__leadHandlerBound = true;

    form.addEventListener('submit', async (e) => {
      e.preventDefault(); // CRITICAL — stop page reload

      const submit = form.querySelector('button[type="submit"]');
      const success = form.querySelector('.form-success');
      const hp = form.querySelector('[name="_hp"]');

      // Honeypot — silently succeed for bots
      if (hp && hp.value) {
        if (success) success.classList.add('visible');
        return;
      }

      const get = name => (form.querySelector(`[name="${name}"]`)?.value || '').trim();

      const leadData = {
        name:    get('name'),
        phone:   get('phone'),
        email:   get('email'),
        zip:     get('zip'),
        service: get('service') || 'Attic Insulation',
        message: get('message'),
        pageUrl: window.location.href,
        type:    'Form Submission',
        _hp:     hp ? hp.value : ''
      };

      if (!leadData.name && !leadData.phone) return; // nothing to submit

      // Disable button + show loading
      if (submit) {
        submit.disabled = true;
        submit.dataset.origText = submit.innerHTML;
        submit.innerHTML = 'Sending… <span>⏳</span>';
      }

      try {
        if (window.USA_SUPABASE && typeof window.USA_SUPABASE.saveLead === 'function') {
          await window.USA_SUPABASE.saveLead(leadData);
        }
        // Show success state
        if (success) success.classList.add('visible');
        if (submit) {
          submit.innerHTML = 'Request received <span>✓</span>';
        }
      } catch (err) {
        if (submit) {
          submit.disabled = false;
          submit.innerHTML = submit.dataset.origText || 'Request Free Quote →';
        }
        const errDiv = form.querySelector('.form-error') || (() => {
          const d = document.createElement('p');
          d.className = 'form-error';
          d.style.cssText = 'color:#ef4444;font-size:13px;margin-top:8px;';
          form.appendChild(d);
          return d;
        })();
        errDiv.textContent = 'Something went wrong — please call us directly at +1 409-996-4620.';
      }
    });
  });
}

/* Newsletter is a presentational-only sign-up */
function initNewsletter() {
  document.getElementById("newsletter-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    if (button) {
      button.textContent = "Thanks! We'll keep you posted.";
      button.disabled = true;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  initAccordions();
  initProcess();
  initNewsletter();
  initLeadForms();
  initReveal();
  initFaqStack();
});

function initFaqStack() {
  const stack = document.getElementById("faq-accordion");
  if (!stack) return;
  const articles = stack.querySelectorAll("article");
  // Open first item by default
  if (articles[0]) {
    articles[0].classList.add("open");
    const btn = articles[0].querySelector("button");
    if (btn) btn.setAttribute("aria-expanded", "true");
  }
  articles.forEach((article) => {
    const btn = article.querySelector("button");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const isOpen = article.classList.contains("open");
      // Close all
      articles.forEach((a) => {
        a.classList.remove("open");
        const b = a.querySelector("button");
        if (b) b.setAttribute("aria-expanded", "false");
      });
      // Toggle clicked
      if (!isOpen) {
        article.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
}

