/* ==========================================================================
   BROSEO BUSINESS STUDIO — V1 INTERACTION & MOTION ENGINE
   Pure Vanilla JS: CSS + IntersectionObserver + requestAnimationFrame
   ========================================================================== */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------------
     1. PENDING ASSET SLOT LOADER
     Automatically detects dropped hero (764x1024) and service images across
     .png / .jpg / .jpeg / .webp without showing broken image icons.
     ------------------------------------------------------------------------ */
  function initPendingAssetSlots() {
    const slots = document.querySelectorAll('img[data-asset-base]');
    const extensions = ['.png', '.jpg', '.jpeg', '.webp'];

    slots.forEach(function (img) {
      const base = img.getAttribute('data-asset-base');
      const container = img.closest('.media-slot');
      if (!base || !container) return;

      container.classList.add('is-awaiting-asset');
      let idx = 0;

      function tryNext() {
        if (idx >= extensions.length) {
          img.removeAttribute('src');
          return;
        }
        const candidate = base + extensions[idx];
        idx += 1;

        const probe = new Image();
        probe.onload = function () {
          if (probe.naturalWidth > 0) {
            img.src = candidate;
            container.classList.remove('is-awaiting-asset');
            container.classList.add('is-loaded');
          } else {
            tryNext();
          }
        };
        probe.onerror = tryNext;
        probe.src = candidate;
      }

      tryNext();
    });
  }

  /* ------------------------------------------------------------------------
     2. HERO LOAD CHOREOGRAPHY, CLOCK & SHARED DUAL-SPEED SCROLL PARALLAX
     ------------------------------------------------------------------------ */
  function initHeroMotion() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.classList.add('is-hero-ready');
      });
    });

    const clockEl = document.getElementById('studio-clock');
    function updateClock() {
      if (!clockEl) return;
      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }).format(now);
        clockEl.textContent = formatted.toUpperCase() + ' IST';
      } catch (e) {
        clockEl.textContent = 'BROSEO STUDIO';
      }
    }
    updateClock();
    window.setInterval(updateClock, 15000);

    const hero = document.getElementById('hero');
    const portraitEl = document.querySelector('[data-hero-parallax]');
    const wordmarkEl = document.querySelector('[data-wordmark-parallax]');
    if (!hero || !portraitEl || !wordmarkEl) return;

    if (prefersReducedMotion) {
      wordmarkEl.style.transform = 'none';
      portraitEl.style.transform = 'none';
      return;
    }

    let targetProgress = 0;
    let currentProgress = 0;
    let rafId = null;

    function getTravelDistances() {
      const vw = window.innerWidth || 1440;
      if (vw >= 1200) return { wordmark: 256, image: 36 };
      if (vw >= 1024) return { wordmark: 220, image: 30 };
      if (vw >= 768) return { wordmark: 168, image: 24 };
      return { wordmark: 104, image: 16 };
    }

    function computeTargetProgress() {
      const rect = hero.getBoundingClientRect();
      return Math.max(0, Math.min(1, -rect.top / Math.max(rect.height, 1)));
    }

    function applyTransforms(progress) {
      const travel = getTravelDistances();
      const wordmarkY = -travel.wordmark * progress;
      const imageY = -travel.image * progress;
      wordmarkEl.style.transform = 'translate3d(0, ' + wordmarkY.toFixed(2) + 'px, 0)';
      portraitEl.style.transform = 'translate3d(0, ' + imageY.toFixed(2) + 'px, 0)';
    }

    function tick() {
      const diff = targetProgress - currentProgress;
      if (Math.abs(diff) < 0.0004) {
        currentProgress = targetProgress;
        applyTransforms(currentProgress);
        rafId = null;
        return;
      }

      currentProgress += diff * 0.38;
      applyTransforms(currentProgress);
      rafId = requestAnimationFrame(tick);
    }

    function onScrollOrResize() {
      targetProgress = computeTargetProgress();
      if (!rafId) {
        rafId = requestAnimationFrame(tick);
      }
    }

    targetProgress = computeTargetProgress();
    currentProgress = targetProgress;
    applyTransforms(currentProgress);

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
  }

  /* ------------------------------------------------------------------------
     3. STICKY HEADER, HORIZONTAL HEADER BRAND SCROLL & NAVIGATION OVERLAY
     ------------------------------------------------------------------------ */
  function initHeaderBrandScroll() {
    const header = document.getElementById('site-header');
    const brand = document.getElementById('site-header-brand');
    const leftRail = document.querySelector('.site-header-left');
    const centerRail = document.querySelector('.site-header-center');
    const hero = document.getElementById('hero');
    if (!header || !brand || !hero) return;

    function clamp01(v) {
      return v < 0 ? 0 : (v > 1 ? 1 : v);
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function measureHeaderMetrics() {
      const headerRect = header.getBoundingClientRect();
      const brandRect = brand.getBoundingClientRect();
      const vw = window.innerWidth || headerRect.width || 1440;
      const isDesktop = vw >= 1024;

      let startX = isDesktop ? 36 : 30;
      const refRail = isDesktop ? leftRail : centerRail;
      if (refRail) {
        const railRect = refRail.getBoundingClientRect();
        const padLeft = parseFloat(window.getComputedStyle(refRail).paddingLeft) || 0;
        startX = railRect.left + padLeft - headerRect.left;
      }

      const centerX = Math.max(startX, (headerRect.width - brandRect.width) / 2);
      const showScrollY = isDesktop ? Math.max(0, hero.offsetTop + hero.offsetHeight - 80) : 0;

      return {
        isDesktop: isDesktop,
        startX: startX,
        centerX: centerX,
        showScrollY: showScrollY
      };
    }

    let metrics = measureHeaderMetrics();
    let targetP = 0;
    let currentP = 0;
    let rafId = null;

    function computeTargetProgress() {
      const y = window.scrollY || window.pageYOffset || 0;
      if (metrics.isDesktop) {
        return clamp01((y - metrics.showScrollY) / 360);
      }
      return clamp01(y / 280);
    }

    function applyHorizontalBrand(p) {
      const eased = prefersReducedMotion ? (p >= 0.5 ? 1 : 0) : easeInOutCubic(p);
      const x = lerp(metrics.startX, metrics.centerX, eased);
      brand.style.setProperty('--header-brand-x', x.toFixed(2) + 'px');
    }

    function tick() {
      const diff = targetP - currentP;
      if (prefersReducedMotion || Math.abs(diff) < 0.0005) {
        currentP = targetP;
        applyHorizontalBrand(currentP);
        rafId = null;
        return;
      }
      currentP += diff * 0.28;
      applyHorizontalBrand(currentP);
      rafId = window.requestAnimationFrame(tick);
    }

    function onScroll() {
      targetP = computeTargetProgress();
      if (prefersReducedMotion) {
        currentP = targetP;
        applyHorizontalBrand(currentP);
        return;
      }
      if (!rafId) {
        rafId = window.requestAnimationFrame(tick);
      }
    }

    function onRecalc() {
      metrics = measureHeaderMetrics();
      targetP = computeTargetProgress();
      currentP = targetP;
      applyHorizontalBrand(currentP);
    }

    targetP = computeTargetProgress();
    currentP = targetP;
    applyHorizontalBrand(currentP);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onRecalc, { passive: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(onRecalc);
    }
  }

  function initNavigation() {
    const header = document.getElementById('site-header');
    const hero = document.getElementById('hero');
    const overlay = document.getElementById('menu-overlay');
    const openBtns = document.querySelectorAll('[data-menu-open]');
    const closeBtn = document.getElementById('menu-close');
    const navLinks = document.querySelectorAll('[data-menu-link]');
    let lastFocused = null;

    if (header && hero) {
      function updateHeaderVisibility() {
        const rect = hero.getBoundingClientRect();
        if (rect.bottom <= 80) {
          header.classList.add('is-visible');
        } else {
          header.classList.remove('is-visible');
        }
      }

      window.addEventListener('scroll', updateHeaderVisibility, { passive: true });
      window.addEventListener('resize', updateHeaderVisibility, { passive: true });
      updateHeaderVisibility();
    }

    function openMenu() {
      if (!overlay) return;
      lastFocused = document.activeElement;
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-menu-open');
      openBtns.forEach(function (btn) {
        btn.setAttribute('aria-expanded', 'true');
      });
      if (closeBtn) closeBtn.focus();
    }

    function closeMenu() {
      if (!overlay) return;
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-menu-open');
      openBtns.forEach(function (btn) {
        btn.setAttribute('aria-expanded', 'false');
      });
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    }

    openBtns.forEach(function (btn) {
      btn.addEventListener('click', openMenu);
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', closeMenu);
    }

    navLinks.forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay && overlay.classList.contains('is-open')) {
        closeMenu();
      }
    });
  }

  /* ------------------------------------------------------------------------
     4. SCROLL-TRIGGERED EDITORIAL REVEALS
     ------------------------------------------------------------------------ */
  function initScrollReveals() {
    const targets = document.querySelectorAll('[data-reveal], [data-reveal-clip]');
    if (!targets.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) {
        el.classList.add('is-revealed');
      });
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: '0px 0px -4% 0px' }
    );

    targets.forEach(function (el) {
      observer.observe(el);
    });

    function revealVisibleFallback() {
      const vh = window.innerHeight || 900;
      targets.forEach(function (el) {
        if (el.classList.contains('is-revealed')) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < vh * 0.96 && rect.bottom > 0) {
          el.classList.add('is-revealed');
          observer.unobserve(el);
        }
      });
    }

    window.addEventListener('scroll', revealVisibleFallback, { passive: true });
    revealVisibleFallback();
  }

  /* ------------------------------------------------------------------------
     5. ABOUT SCROLL-SCRUBBED WORD ILLUMINATION
     ------------------------------------------------------------------------ */
  function initWordScrub() {
    const blocks = document.querySelectorAll('[data-word-scrub]');
    if (!blocks.length) return;

    const prepared = [];
    blocks.forEach(function (block) {
      const words = block.textContent.trim().split(/\s+/);
      block.textContent = '';
      const spans = words.map(function (word, index) {
        const span = document.createElement('span');
        span.className = 'scrub-word';
        span.textContent = word;
        block.appendChild(span);
        if (index < words.length - 1) {
          block.appendChild(document.createTextNode(' '));
        }
        return span;
      });
      prepared.push({ block: block, spans: spans });
    });

    if (prefersReducedMotion) {
      prepared.forEach(function (item) {
        item.spans.forEach(function (s) {
          s.style.opacity = '1';
        });
      });
      return;
    }

    let pending = false;
    function updateWords() {
      pending = false;
      const vh = window.innerHeight || 900;

      prepared.forEach(function (item) {
        const rect = item.block.getBoundingClientRect();
        const start = vh * 0.88;
        const end = vh * 0.34;
        const progress = Math.max(0, Math.min(1, (start - rect.top) / Math.max(start - end, 1)));
        const count = item.spans.length;

        item.spans.forEach(function (span, i) {
          const wordStart = i / count;
          const wordEnd = (i + 1.4) / count;
          const local = Math.max(0, Math.min(1, (progress - wordStart) / Math.max(wordEnd - wordStart, 0.01)));
          span.style.opacity = (0.22 + local * 0.78).toFixed(2);
        });
      });
    }

    function requestUpdate() {
      if (!pending) {
        pending = true;
        requestAnimationFrame(updateWords);
      }
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    updateWords();
  }

  /* ------------------------------------------------------------------------
     6. SERVICES INTERACTIVE DETAILS, SCROLL PROGRESS & MICRO-INTERACTIONS
     ------------------------------------------------------------------------ */
  function initServicesOverview() {
    const servicesList = document.querySelector('.services-list');
    const railRight = document.querySelector('.services-rail-right');
    const serviceItems = Array.from(document.querySelectorAll('[data-service-item]'));
    const toggleBtns = document.querySelectorAll('[data-service-toggle]');
    const jumpPills = Array.from(document.querySelectorAll('[data-service-jump]'));
    if (!serviceItems.length) return;

    function clamp01(v) {
      return v < 0 ? 0 : (v > 1 ? 1 : v);
    }

    function setActiveService(activeIdx) {
      const idxNum = Number(activeIdx);
      const idxStr = String(idxNum);
      serviceItems.forEach(function (item, idx) {
        item.classList.toggle('is-active', idx === idxNum);
        item.classList.toggle('is-passed', idx <= idxNum);
      });
      jumpPills.forEach(function (pill) {
        pill.classList.toggle('is-active', pill.getAttribute('data-service-jump') === idxStr);
      });
    }

    function setExpanded(item, expanded) {
      const btn = item.querySelector('[data-service-toggle]');
      const label = item.querySelector('.service-toggle-label');
      item.classList.toggle('is-expanded', expanded);
      if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (label) label.textContent = expanded ? 'Hide Details' : 'View Details';
    }

    toggleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const item = btn.closest('[data-service-item]');
        if (!item) return;
        const willExpand = !item.classList.contains('is-expanded');
        setExpanded(item, willExpand);
        setActiveService(item.getAttribute('data-service-item'));
        requestServicesSync();
      });
    });

    jumpPills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        const idx = pill.getAttribute('data-service-jump');
        const target = serviceItems[Number(idx)];
        if (!target) return;
        setExpanded(target, true);
        setActiveService(idx);
        target.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start'
        });
      });
    });

    let targetProgress = 0;
    let currentProgress = 0;
    let progressRaf = null;

    function computeTargetProgress() {
      if (!servicesList) return 0;
      const vh = window.innerHeight || 900;
      const rect = servicesList.getBoundingClientRect();
      return clamp01((vh * 0.55 - rect.top) / Math.max(rect.height * 0.85, 1));
    }

    function detectActiveServiceIndex() {
      const vh = window.innerHeight || 900;
      const anchorY = vh * 0.42;
      let activeIdx = 0;
      let closestDist = Infinity;

      serviceItems.forEach(function (item, idx) {
        const r = item.getBoundingClientRect();
        if (r.top <= anchorY && r.bottom >= anchorY) {
          activeIdx = idx;
          closestDist = 0;
          return;
        }
        const dist = Math.min(Math.abs(r.top - anchorY), Math.abs(r.bottom - anchorY));
        if (dist < closestDist) {
          closestDist = dist;
          activeIdx = idx;
        }
      });

      return activeIdx;
    }

    function applyServicesProgress(p) {
      const val = p.toFixed(4);
      if (servicesList) servicesList.style.setProperty('--services-progress', val);
      if (railRight) railRight.style.setProperty('--services-progress', val);
    }

    function tickServicesProgress() {
      const diff = targetProgress - currentProgress;
      if (prefersReducedMotion || Math.abs(diff) < 0.0005) {
        currentProgress = targetProgress;
        applyServicesProgress(currentProgress);
        progressRaf = null;
        return;
      }
      currentProgress += diff * 0.25;
      applyServicesProgress(currentProgress);
      progressRaf = window.requestAnimationFrame(tickServicesProgress);
    }

    function requestServicesSync() {
      targetProgress = computeTargetProgress();
      setActiveService(detectActiveServiceIndex());
      if (prefersReducedMotion) {
        currentProgress = targetProgress;
        applyServicesProgress(currentProgress);
        return;
      }
      if (!progressRaf) {
        progressRaf = window.requestAnimationFrame(tickServicesProgress);
      }
    }

    setActiveService(0);
    targetProgress = computeTargetProgress();
    currentProgress = targetProgress;
    applyServicesProgress(currentProgress);

    window.addEventListener('scroll', requestServicesSync, { passive: true });
    window.addEventListener('resize', requestServicesSync, { passive: true });

    // Service 01: subtle browser-interface cursor pan on desktop fine pointer
    if (!prefersReducedMotion && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const webFrame = document.querySelector('#service-web .service-media-frame');
      if (webFrame) {
        webFrame.addEventListener('mousemove', function (e) {
          const rect = webFrame.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
          const px = Math.max(-4, Math.min(4, -nx * 4));
          const py = Math.max(-4, Math.min(4, -ny * 4));
          webFrame.style.setProperty('--web-x', px.toFixed(2) + 'px');
          webFrame.style.setProperty('--web-y', py.toFixed(2) + 'px');
        });
        webFrame.addEventListener('mouseleave', function () {
          webFrame.style.removeProperty('--web-x');
          webFrame.style.removeProperty('--web-y');
        });
      }
    }
  }

  /* ------------------------------------------------------------------------
     7. PREVIOUS WORK SPOTLIGHT (3 REAL PROJECTS + KEYBOARD / CLICK CONTROLS)
     ------------------------------------------------------------------------ */
  function initWorkSpotlight() {
    const cards = Array.from(document.querySelectorAll('[data-work-index]'));
    const stage = document.getElementById('work-spotlight');
    const imgEl = document.getElementById('spotlight-img');
    const titleEl = document.getElementById('spotlight-title');
    const counterEl = document.getElementById('spotlight-counter');
    const prevBtn = document.getElementById('spotlight-prev');
    const nextBtn = document.getElementById('spotlight-next');

    if (!cards.length || !imgEl || !titleEl || !counterEl) return;

    let currentIndex = 0;

    function selectProject(nextIdx) {
      const total = cards.length;
      currentIndex = ((nextIdx % total) + total) % total;
      const activeCard = cards[currentIndex];

      const nextTitle = activeCard.getAttribute('data-work-title');
      const nextSrc = activeCard.getAttribute('data-work-src');
      const nextAlt = activeCard.getAttribute('data-work-alt');

      cards.forEach(function (card, idx) {
        card.classList.toggle('is-active', idx === currentIndex);
      });

      counterEl.textContent = '0' + (currentIndex + 1) + ' / 0' + total;
      titleEl.textContent = nextTitle;
      imgEl.src = nextSrc;
      imgEl.alt = nextAlt;

      if (!prefersReducedMotion) {
        imgEl.classList.remove('is-switching');
        titleEl.classList.remove('is-switching');
        void imgEl.offsetWidth;
        imgEl.classList.add('is-switching');
        titleEl.classList.add('is-switching');
      }
    }

    cards.forEach(function (card, idx) {
      card.addEventListener('click', function () {
        selectProject(idx);
      });
    });

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        selectProject(currentIndex - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        selectProject(currentIndex + 1);
      });
    }

    if (stage) {
      stage.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          selectProject(currentIndex - 1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          selectProject(currentIndex + 1);
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
     8. ENGAGEMENT ENQUIRY FORM (VALIDATION + LOCAL PREVIEW ACKNOWLEDGEMENT)
     ------------------------------------------------------------------------ */
  function initEngagementForm() {
    const form = document.getElementById('enquiry-form');
    const statusEl = document.getElementById('form-status');
    if (!form || !statusEl) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      const nameInput = document.getElementById('enquiry-name');
      const emailInput = document.getElementById('enquiry-email');
      const scopeInput = document.getElementById('enquiry-scope');

      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const scope = scopeInput ? scopeInput.value.trim() : '';

      if (!name || !email || !scope) {
        statusEl.textContent = 'Please complete all fields before submitting.';
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        statusEl.textContent = 'Please enter a valid email address.';
        return;
      }

      statusEl.textContent = 'Enquiry captured locally (V1 preview — delivery endpoint not yet connected).';
      form.reset();
    });
  }

  /* ------------------------------------------------------------------------
     4B. UNIFIED ABOUT & SERVICES IMAGE REVEAL
     ------------------------------------------------------------------------ */
  function initEditorialMediaReveal() {
    const aboutGroup = document.querySelector('[data-about-reveal]');
    const aboutItems = aboutGroup ? Array.from(aboutGroup.querySelectorAll('[data-media-reveal]')) : [];
    const standaloneMedia = Array.from(document.querySelectorAll('#services [data-media-reveal]'));

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      aboutItems.concat(standaloneMedia).forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    if (aboutGroup && aboutItems.length) {
      const aboutObserver = new IntersectionObserver(
        function (entries) {
          const entry = entries[0];
          if (entry.isIntersecting && entry.intersectionRatio >= 0.08) {
            aboutItems.forEach(function (el) {
              el.classList.add('is-visible');
            });
          } else if (!entry.isIntersecting) {
            aboutItems.forEach(function (el) {
              el.classList.remove('is-visible');
            });
          }
        },
        { threshold: [0, 0.08] }
      );
      aboutObserver.observe(aboutGroup);
    }

    if (standaloneMedia.length) {
      const serviceMediaObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              serviceMediaObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -3% 0px' }
      );

      const vh = window.innerHeight || 900;
      standaloneMedia.forEach(function (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top < vh * 0.96 && rect.bottom > 0) {
          el.classList.add('is-visible');
        } else {
          serviceMediaObserver.observe(el);
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
     BOOTSTRAP
     ------------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    initPendingAssetSlots();
    initHeroMotion();
    initHeaderBrandScroll();
    initNavigation();
    initScrollReveals();
    initEditorialMediaReveal();
    initWordScrub();
    initServicesOverview();
    initWorkSpotlight();
    initEngagementForm();
  });
})();
