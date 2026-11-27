/* AttendPro PTC Manawan — requested UI-only enhancements.
 * 1) Show Password + eye toggle
 * 2) Back button on every portal screen
 * 3) 2-second, no-crop hero campus gallery
 * No API, auth, Supabase, backend, or attendance logic is changed.
 */
(function () {
  "use strict";

  if (window.__ATTENDPRO_PTC_UI_ENHANCEMENTS__) return;
  window.__ATTENDPRO_PTC_UI_ENHANCEMENTS__ = true;

  const GALLERY_IMAGES = [
    { src: "/assets/ptc-main-hero-01.webp", alt: "Police Training College Manawan campus walkway", title: "Campus Walkway" },
    { src: "/assets/ptc-main-hero-02.webp", alt: "Police Training College Manawan Commandant Office", title: "Commandant Office" },
    { src: "/assets/ptc-main-hero-03.webp", alt: "Police Training College Manawan campus at night", title: "Manawan Campus at Night" },
    { src: "/assets/ptc-main-hero-04.webp", alt: "Police Training College Manawan training parade", title: "Training Parade" },
    { src: "/assets/ptc-main-hero-05.webp", alt: "Police Training College Manawan passing out parade", title: "Passing Out Parade" },
    { src: "/assets/ptc-main-hero-06.webp", alt: "Police Training College Manawan flag ceremony", title: "Flag Ceremony" },
    { src: "/assets/ptc-main-hero-07.webp", alt: "Police Training College Manawan police training formation", title: "Police Training Formation" }
  ];

  const EYE_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_CLOSED = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1.2 0 2.3-.2 3.3-.6"/></svg>';

  function installPasswordToggle() {
    const input = document.getElementById("loginPassword");
    if (!input || input.dataset.apShowPasswordReady === "1") return;

    input.dataset.apShowPasswordReady = "1";
    input.type = "password";
    input.autocomplete = "current-password";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "ap-ui-password-toggle";
    toggle.setAttribute("aria-pressed", "false");
    toggle.setAttribute("aria-label", "Show password");
    toggle.innerHTML = '<span class="ap-ui-password-toggle-text">Show Password</span>' + EYE_OPEN;
    input.insertAdjacentElement("afterend", toggle);

    function setVisible(visible) {
      input.type = visible ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(visible));
      toggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
      const text = toggle.querySelector(".ap-ui-password-toggle-text");
      if (text) text.textContent = visible ? "Hide Password" : "Show Password";
      const oldIcon = toggle.querySelector("svg");
      if (oldIcon) oldIcon.outerHTML = visible ? EYE_CLOSED : EYE_OPEN;
    }

    toggle.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      setVisible(input.type === "password");
    });

    const overlay = document.getElementById("loginOverlay");
    if (overlay && !overlay.dataset.apPasswordObserverReady) {
      overlay.dataset.apPasswordObserverReady = "1";
      new MutationObserver(function () {
        if (overlay.classList.contains("open")) setVisible(false);
      }).observe(overlay, { attributes: true, attributeFilter: ["class"] });
    }
  }

  function activeScreenName() {
    const active = document.querySelector(".screen.active");
    return active && active.id ? active.id.replace(/^screen-/, "") : "";
  }

  const screenHistory = [];
  let originalShowScreen = null;
  let wrappedShowScreen = false;

  function portalIsVisible() {
    const overlay = document.getElementById("loginOverlay");
    const isPortalHash = /^#portal(?:=|$)/i.test(window.location.hash || "");
    return isPortalHash &&
      !document.body.classList.contains("aplp-landing-mode") &&
      !(overlay && overlay.classList.contains("open")) &&
      !!activeScreenName();
  }

  function syncBackButtonVisibility() {
    const visible = portalIsVisible();
    document.body.classList.toggle("ap-ui-portal-active", visible);
  }

  function returnToPreviousScreen() {
    const current = activeScreenName();
    let previous = "";

    while (screenHistory.length && !previous) {
      const candidate = screenHistory.pop();
      if (candidate && candidate !== current && document.getElementById("screen-" + candidate)) {
        previous = candidate;
      }
    }

    if (!previous && current !== "dashboard" && document.getElementById("screen-dashboard")) {
      previous = "dashboard";
    }

    if (previous && typeof originalShowScreen === "function") {
      const nav = document.querySelector('.nav-item[data-screen="' + previous + '"]') ||
        document.querySelector('[data-screen="' + previous + '"]');
      originalShowScreen.call(window, previous, nav || null);
    } else if (current === "dashboard" && typeof window.returnToPublicLanding === "function") {
      window.returnToPublicLanding();
    } else if (typeof window.returnToPublicLanding === "function") {
      window.returnToPublicLanding();
    }

    syncBackButtonVisibility();
  }

  function addBackButtons() {
    document.querySelectorAll(".screen").forEach(function (screen) {
      if (screen.querySelector(":scope > .ap-ui-back-row")) return;

      const row = document.createElement("div");
      row.className = "ap-ui-back-row";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "ap-ui-back-button";
      button.innerHTML = '<span aria-hidden="true">←</span><span>Back</span>';
      button.setAttribute("aria-label", "Go back to the previous page");
      button.addEventListener("click", returnToPreviousScreen);

      row.appendChild(button);
      const pageHeader = screen.querySelector(":scope > .page-hdr, .page-hdr");
      if (pageHeader && pageHeader.parentNode === screen) {
        screen.insertBefore(row, pageHeader);
      } else {
        screen.insertBefore(row, screen.firstChild);
      }
    });
  }

  function installShowScreenHistory() {
    if (wrappedShowScreen || typeof window.showScreen !== "function") return false;

    originalShowScreen = window.showScreen;
    const wrapped = function (name, element) {
      const current = activeScreenName();
      const next = String(name || "");
      if (current && next && current !== next) {
        screenHistory.push(current);
        if (screenHistory.length > 60) screenHistory.shift();
      }
      const result = originalShowScreen.apply(this, arguments);
      syncBackButtonVisibility();
      return result;
    };
    wrapped.__attendProBackWrapped = true;
    window.showScreen = wrapped;
    wrappedShowScreen = true;
    return true;
  }

  function installBackNavigation() {
    addBackButtons();
    installShowScreenHistory();

    // Keep the per-screen controls available if the app toggles between landing and portal.
    const observer = new MutationObserver(function () {
      syncBackButtonVisibility();
      addBackButtons();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    const loginOverlay = document.getElementById("loginOverlay");
    if (loginOverlay) {
      observer.observe(loginOverlay, { attributes: true, attributeFilter: ["class"] });
    }

    window.addEventListener("hashchange", syncBackButtonVisibility);
    window.addEventListener("pageshow", syncBackButtonVisibility);
    syncBackButtonVisibility();

    // Some existing builds register the portal functions just after DOM ready.
    if (!wrappedShowScreen) {
      let attempts = 0;
      const retry = window.setInterval(function () {
        attempts += 1;
        if (installShowScreenHistory() || attempts >= 20) {
          window.clearInterval(retry);
          syncBackButtonVisibility();
        }
      }, 250);
    }
  }

  function installHeroGallery() {
    const visual = document.querySelector(".aplp-hero-visual");
    if (!visual) {
      console.warn("[AttendPro UI] Main landing hero visual was not found.");
      return;
    }

    const frame = visual.querySelector(".aplp-campus-art");
    if (!frame || frame.dataset.apHeroGalleryReady === "1") return;
    frame.dataset.apHeroGalleryReady = "1";
    frame.innerHTML = "";
    frame.classList.add("ap-ui-hero-gallery");
    frame.setAttribute("role", "region");
    frame.setAttribute("aria-roledescription", "carousel");
    frame.setAttribute("aria-label", "Police Training College Manawan campus photo gallery");
    frame.setAttribute("tabindex", "0");

    const slides = document.createElement("div");
    slides.className = "ap-ui-hero-slides";

    GALLERY_IMAGES.forEach(function (item, index) {
      const slide = document.createElement("div");
      slide.className = "ap-ui-hero-slide" + (index === 0 ? " is-active" : "");
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      slide.setAttribute("aria-label", (index + 1) + " of " + GALLERY_IMAGES.length);
      slide.setAttribute("aria-hidden", index === 0 ? "false" : "true");

      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt;
      img.width = 2048;
      img.height = 1364;
      img.loading = "eager";
      img.decoding = "async";
      slide.appendChild(img);
      slides.appendChild(slide);
    });

    const count = document.createElement("div");
    count.className = "ap-ui-hero-count";
    count.setAttribute("aria-live", "polite");
    count.textContent = "01 / " + String(GALLERY_IMAGES.length).padStart(2, "0");

    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "ap-ui-hero-arrow ap-ui-hero-prev";
    previous.setAttribute("aria-label", "Previous campus photo");
    previous.innerHTML = "&#8249;";

    const next = document.createElement("button");
    next.type = "button";
    next.className = "ap-ui-hero-arrow ap-ui-hero-next";
    next.setAttribute("aria-label", "Next campus photo");
    next.innerHTML = "&#8250;";

    const dots = document.createElement("div");
    dots.className = "ap-ui-hero-dots";
    dots.setAttribute("role", "tablist");
    dots.setAttribute("aria-label", "Choose campus photo");

    const dotButtons = [];
    GALLERY_IMAGES.forEach(function (item, index) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "ap-ui-hero-dot" + (index === 0 ? " is-active" : "");
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", "Show " + item.title);
      dot.setAttribute("aria-selected", index === 0 ? "true" : "false");
      dot.addEventListener("click", function () { show(index); restartTimer(); });
      dots.appendChild(dot);
      dotButtons.push(dot);
    });

    frame.appendChild(slides);
    frame.appendChild(count);
    frame.appendChild(previous);
    frame.appendChild(next);
    frame.appendChild(dots);

    const slideNodes = Array.from(slides.children);
    let activeIndex = 0;
    let timer = null;

    function show(index) {
      activeIndex = (index + GALLERY_IMAGES.length) % GALLERY_IMAGES.length;
      slideNodes.forEach(function (slide, i) {
        const active = i === activeIndex;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", active ? "false" : "true");
      });
      dotButtons.forEach(function (dot, i) {
        const active = i === activeIndex;
        dot.classList.toggle("is-active", active);
        dot.setAttribute("aria-selected", active ? "true" : "false");
      });
      count.textContent = String(activeIndex + 1).padStart(2, "0") +
        " / " + String(GALLERY_IMAGES.length).padStart(2, "0");
    }

    function restartTimer() {
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(function () { show(activeIndex + 1); }, 2000);
    }

    previous.addEventListener("click", function () { show(activeIndex - 1); restartTimer(); });
    next.addEventListener("click", function () { show(activeIndex + 1); restartTimer(); });
    frame.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") { event.preventDefault(); show(activeIndex - 1); restartTimer(); }
      if (event.key === "ArrowRight") { event.preventDefault(); show(activeIndex + 1); restartTimer(); }
    });

    show(0);
    restartTimer();
  }

  function boot() {
    installPasswordToggle();
    installBackNavigation();
    installHeroGallery();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
