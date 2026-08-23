/* ===================================================================
   KEIGOED — animaties: scroll-reveal, parallax, 3D-tilt, cursor,
   fly-to-cart, brush-dividers, preloader, confetti
=================================================================== */

(function () {
  "use strict";
  const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- preloader (alleen op index) ---------- */
  function initPreloader() {
    const pre = document.querySelector("[data-preloader]");
    if (!pre) return;
    window.addEventListener("load", () => {
      setTimeout(() => {
        pre.classList.add("is-done");
        setTimeout(() => pre.remove(), 900);
      }, 500);
    });
  }

  /* ---------- nav shrink on scroll ---------- */
  function initNavScroll() {
    const nav = document.querySelector("[data-nav]");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const menuBtn = document.querySelector("[data-menu-toggle]");
    const menu = document.querySelector("[data-menu]");
    if (menuBtn && menu) {
      menuBtn.addEventListener("click", () => {
        const open = menu.classList.toggle("is-open");
        menuBtn.classList.toggle("is-open", open);
        menuBtn.setAttribute("aria-expanded", String(open));
      });
      menu.querySelectorAll("a").forEach((a) =>
        a.addEventListener("click", () => {
          menu.classList.remove("is-open");
          menuBtn.classList.remove("is-open");
        })
      );
    }
  }

  /* ---------- scroll reveal ---------- */
  function initReveal() {
    const els = document.querySelectorAll(".reveal, .mask-heading");
    if (!els.length) return;
    if (reduceMotion) {
      els.forEach((el) => el.classList.add("in-view"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
  }

  /* ---------- brush-stroke dividers laten "tekenen" ---------- */
  function initBrushDividers() {
    const paths = document.querySelectorAll(".brush-divider path");
    if (!paths.length || reduceMotion) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-drawn");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    paths.forEach((p) => io.observe(p));
  }

  /* ---------- hero parallax (mousemove) ---------- */
  function initHeroParallax() {
    const hero = document.querySelector("[data-parallax-hero]");
    if (!hero || isTouch || reduceMotion) return;
    const layers = hero.querySelectorAll("[data-depth]");
    let raf = null;
    hero.addEventListener("mousemove", (e) => {
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        layers.forEach((layer) => {
          const depth = parseFloat(layer.dataset.depth) || 0;
          layer.style.transform = `translate3d(${x * depth}px, ${y * depth}px, 0)`;
        });
      });
    });
    hero.addEventListener("mouseleave", () => {
      layers.forEach((layer) => (layer.style.transform = "translate3d(0,0,0)"));
    });
  }

  /* ---------- 3D tilt op productkaarten ---------- */
  function initTiltCards() {
    if (isTouch || reduceMotion) return;
    document.querySelectorAll(".product-card__image").forEach((el) => {
      const card = el.closest(".product-card");
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(600px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) scale(1.04)`;
        card && card.classList.add("is-tilting");
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "";
        card && card.classList.remove("is-tilting");
      });
    });
  }

  /* ---------- custom cursor met vertraagd volgpuntje + hover-labels ---------- */
  function initCustomCursor() {
    if (isTouch || reduceMotion) return;
    const dot = document.createElement("div");
    const ring = document.createElement("div");
    const label = document.createElement("span");
    label.className = "cursor-ring__label";
    dot.className = "cursor-dot";
    ring.className = "cursor-ring";
    ring.appendChild(label);
    document.body.append(dot, ring);
    let mx = 0, my = 0, rx = 0, ry = 0;
    window.addEventListener("mousemove", (e) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      document.body.classList.add("has-cursor");
    });
    document.addEventListener("mouseleave", () => document.body.classList.remove("has-cursor"));
    (function loop() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(loop);
    })();

    /* event-delegatie: werkt ook voor kaarten/knoppen die pas later worden gerenderd */
    document.body.addEventListener("mouseover", (e) => {
      const labelTarget = e.target.closest("[data-cursor-text]");
      if (labelTarget) {
        label.textContent = labelTarget.dataset.cursorText;
        ring.classList.add("has-label");
        ring.classList.remove("is-active");
        return;
      }
      if (e.target.closest("a, button, .product-card")) ring.classList.add("is-active");
    });
    document.body.addEventListener("mouseout", (e) => {
      const related = e.relatedTarget;
      if (!related || !related.closest || !related.closest("[data-cursor-text]")) {
        if (e.target.closest("[data-cursor-text]")) ring.classList.remove("has-label");
      }
      if (!related || !related.closest || !related.closest("a, button, .product-card")) {
        ring.classList.remove("is-active");
      }
    });
  }

  /* ---------- magnetische knoppen ---------- */
  function initMagnetic() {
    if (isTouch || reduceMotion) return;
    document.querySelectorAll(".magnetic").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = Math.max(-14, Math.min(14, (e.clientX - r.left - r.width / 2) * 0.22));
        const y = Math.max(-10, Math.min(10, (e.clientY - r.top - r.height / 2) * 0.22));
        el.style.transition = "transform .1s linear";
        el.style.transform = `translate(${x}px, ${y}px) scale(1.04)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transition = "transform .5s var(--ease-bounce)";
        el.style.transform = "translate(0,0) scale(1)";
      });
    });
  }

  /* ---------- filmkorrel-textuur ---------- */
  function initGrain() {
    if (document.querySelector(".grain-overlay")) return;
    const grain = document.createElement("div");
    grain.className = "grain-overlay";
    grain.setAttribute("aria-hidden", "true");
    document.body.appendChild(grain);
  }

  /* ---------- zachte "momentum" scroll op desktop (muiswiel) ---------- */
  function initSmoothScroll() {
    if (isTouch || reduceMotion) return;
    let current = window.scrollY;
    let target = current;
    let raf = null;

    function clampTarget(v) {
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
      return Math.min(Math.max(v, 0), max);
    }
    function loop() {
      current += (target - current) * 0.12;
      if (Math.abs(target - current) < 0.4) {
        current = target;
        window.scrollTo(0, current);
        raf = null;
        return;
      }
      window.scrollTo(0, current);
      raf = requestAnimationFrame(loop);
    }
    window.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey || e.target.closest(".cart-drawer__list, select")) return;
        e.preventDefault();
        target = clampTarget(target + e.deltaY);
        if (!raf) raf = requestAnimationFrame(loop);
      },
      { passive: false }
    );

    /* volg scroll die niet van onszelf komt (toetsenbord, scrollbar, ankerlinks) */
    window.addEventListener(
      "scroll",
      () => {
        if (raf) return;
        current = window.scrollY;
        target = current;
      },
      { passive: true }
    );
  }

  /* ---------- fly-to-cart animatie ---------- */
  function flyToCart(sourceEl) {
    const target = document.querySelector("[data-cart-toggle]");
    if (!target || !sourceEl) return;
    const srcRect = sourceEl.getBoundingClientRect();
    const tgtRect = target.getBoundingClientRect();
    const clone = sourceEl.cloneNode(true);
    clone.classList.add("fly-clone");
    Object.assign(clone.style, {
      position: "fixed",
      left: srcRect.left + "px",
      top: srcRect.top + "px",
      width: srcRect.width + "px",
      height: srcRect.height + "px",
      margin: "0",
      zIndex: "9999",
      pointerEvents: "none"
    });
    document.body.appendChild(clone);
    const dx = tgtRect.left + tgtRect.width / 2 - (srcRect.left + srcRect.width / 2);
    const dy = tgtRect.top + tgtRect.height / 2 - (srcRect.top + srcRect.height / 2);
    requestAnimationFrame(() => {
      clone.style.transition = "transform 0.7s cubic-bezier(.3,.9,.4,1.15), opacity 0.7s ease";
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.15) rotate(25deg)`;
      clone.style.opacity = "0.4";
    });
    clone.addEventListener("transitionend", () => clone.remove(), { once: true });
    setTimeout(() => {
      target.classList.remove("bump");
      void target.offsetWidth;
      target.classList.add("bump");
    }, 550);
  }

  /* ---------- toast notificatie ---------- */
  function showToast(message) {
    let wrap = document.querySelector(".toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    wrap.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-in"));
    setTimeout(() => {
      toast.classList.remove("is-in");
      setTimeout(() => toast.remove(), 400);
    }, 2600);
  }

  /* ---------- verf-confetti (bij bestelling geplaatst) ---------- */
  function paintConfetti(originEl) {
    const colors = ["#e2704a", "#8ba888", "#6fa8c9", "#f4c95d", "#a06cae"];
    const rect = originEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 28; i++) {
      const b = document.createElement("span");
      b.className = "confetti-blob";
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 180;
      b.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      b.style.setProperty("--dy", `${Math.sin(angle) * dist - 60}px`);
      b.style.setProperty("--rot", `${Math.random() * 360}deg`);
      b.style.background = colors[i % colors.length];
      b.style.left = cx + "px";
      b.style.top = cy + "px";
      document.body.appendChild(b);
      b.addEventListener("animationend", () => b.remove());
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initPreloader();
    initNavScroll();
    initReveal();
    initBrushDividers();
    initHeroParallax();
    initTiltCards();
    initCustomCursor();
    initMagnetic();
    initGrain();
    initSmoothScroll();
  });

  window.KEIGOED = window.KEIGOED || {};
  window.KEIGOED.anim = { flyToCart, showToast, paintConfetti, initTiltCards };
})();
