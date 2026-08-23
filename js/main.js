/* ===================================================================
   KEIGOED — pagina-logica: productgrids, filters, productdetail,
   winkelwagenpagina, checkout, contactformulier, FAQ
=================================================================== */

(function () {
  "use strict";
  const K = window.KEIGOED;

  function productCard(p, i) {
    const badgeHtml = p.badge
      ? `<span class="product-card__badge product-card__badge--${p.badge}">${
          { bestseller: "Bestseller", nieuw: "Nieuw", set: "Set" }[p.badge] || p.badge
        }</span>`
      : "";
    return `
      <article class="product-card reveal" style="--i:${i % 8}">
        ${badgeHtml}
        <a href="product.html?id=${p.id}" class="product-card__link">
          <div class="product-card__image">${p.svg}</div>
          <div class="product-card__body">
            <span class="product-card__category">${p.category}</span>
            <h3 class="product-card__title">${p.name}</h3>
            <div class="product-card__meta">
              <span class="product-card__price">${K.formatPrice(p.price)}</span>
              <span class="product-card__rating">★ ${p.rating}</span>
            </div>
          </div>
        </a>
        <button type="button" class="btn btn--add" data-add-id="${p.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          In winkelwagen
        </button>
      </article>`;
  }

  function bindAddButtons(root = document) {
    root.querySelectorAll("[data-add-id]").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.dataset.addId;
        const card = btn.closest(".product-card, .product-detail");
        const img = card ? card.querySelector(".product-card__image, .product-detail__image") : null;
        K.cart.add(id, 1);
        if (img) K.anim.flyToCart(img);
        const p = K.getProductById(id);
        K.anim.showToast(`${p.name} toegevoegd aan je winkelwagen`);
      });
    });
  }

  /* ---------- home: uitgelichte producten ---------- */
  function renderFeatured() {
    const el = document.querySelector("[data-featured-products]");
    if (!el) return;
    const featured = K.PRODUCTS.filter((p) => p.badge === "bestseller").slice(0, 4);
    const list = featured.length >= 4 ? featured : K.PRODUCTS.slice(0, 4);
    el.innerHTML = list.map(productCard).join("");
    bindAddButtons(el);
    K.anim.initTiltCards();
  }

  /* ---------- shop: volledige grid + filters ---------- */
  function initShopGrid() {
    const grid = document.querySelector("[data-shop-grid]");
    if (!grid) return;

    const params = new URLSearchParams(location.search);
    const state = {
      category: params.get("categorie") || "Alles",
      search: "",
      sort: "populair"
    };

    const filterBar = document.querySelector("[data-category-filters]");
    if (filterBar) {
      const cats = ["Alles", ...K.CATEGORIES];
      filterBar.innerHTML = cats
        .map((c) => `<button type="button" class="chip${c === state.category ? " is-active" : ""}" data-cat="${c}">${c}</button>`)
        .join("");
      filterBar.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-cat]");
        if (!btn) return;
        state.category = btn.dataset.cat;
        filterBar.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c === btn));
        update();
      });
    }

    const searchInput = document.querySelector("[data-shop-search]");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.search = searchInput.value.trim().toLowerCase();
        update();
      });
    }

    const sortSelect = document.querySelector("[data-shop-sort]");
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        state.sort = sortSelect.value;
        update();
      });
    }

    const countEl = document.querySelector("[data-shop-count]");

    function update() {
      let items = K.PRODUCTS.filter((p) => state.category === "Alles" || p.category === state.category);
      if (state.search) items = items.filter((p) => p.name.toLowerCase().includes(state.search) || p.category.toLowerCase().includes(state.search));
      if (state.sort === "prijs-laag") items = items.slice().sort((a, b) => a.price - b.price);
      else if (state.sort === "prijs-hoog") items = items.slice().sort((a, b) => b.price - a.price);
      else if (state.sort === "nieuw") items = items.slice().sort((a, b) => (b.badge === "nieuw") - (a.badge === "nieuw"));
      else items = items.slice().sort((a, b) => b.rating * b.reviews - a.rating * a.reviews);

      grid.innerHTML = items.length
        ? items.map(productCard).join("")
        : `<p class="shop-empty">Geen stenen gevonden. Probeer een andere zoekterm of categorie.</p>`;
      if (countEl) countEl.textContent = items.length;
      bindAddButtons(grid);
      K.anim.initTiltCards();
      requestAnimationFrame(() => grid.querySelectorAll(".reveal").forEach((el) => el.classList.add("in-view")));
    }

    update();
  }

  /* ---------- productdetail ---------- */
  function renderProductDetail() {
    const wrap = document.querySelector("[data-product-detail]");
    if (!wrap) return;
    const id = new URLSearchParams(location.search).get("id");
    const p = K.getProductById(id) || K.PRODUCTS[0];

    document.title = `${p.name} — KEIGOED`;
    wrap.innerHTML = `
      <div class="product-detail__image reveal">${p.svg}</div>
      <div class="product-detail__info reveal">
        <span class="product-card__category">${p.category}</span>
        <h1>${p.name}</h1>
        <div class="product-detail__rating">★★★★★ <span>${p.rating} (${p.reviews} reviews)</span></div>
        <p class="product-detail__price">${K.formatPrice(p.price)}</p>
        <p class="product-detail__desc">${p.desc}</p>
        <ul class="product-detail__facts">
          <li><strong>Materiaal:</strong> ${p.material}</li>
          <li><strong>Afmeting:</strong> ${p.size}</li>
          <li><strong>Verzending:</strong> binnen 2–4 werkdagen, plasticvrij verpakt</li>
        </ul>
        <div class="product-detail__actions">
          <div class="qty-stepper" data-detail-qty>
            <button type="button" class="qty-btn" data-action="detail-dec">−</button>
            <span class="qty-value" data-detail-qty-value>1</span>
            <button type="button" class="qty-btn" data-action="detail-inc">+</button>
          </div>
          <button type="button" class="btn btn--primary btn--add" data-add-id="${p.id}">
            In winkelwagen — ${K.formatPrice(p.price)}
          </button>
        </div>
      </div>`;

    let qty = 1;
    const qtyValue = wrap.querySelector("[data-detail-qty-value]");
    wrap.querySelector('[data-action="detail-dec"]').addEventListener("click", () => {
      qty = Math.max(1, qty - 1);
      qtyValue.textContent = qty;
    });
    wrap.querySelector('[data-action="detail-inc"]').addEventListener("click", () => {
      qty += 1;
      qtyValue.textContent = qty;
    });
    const addBtn = wrap.querySelector("[data-add-id]");
    addBtn.dataset.bound = "1";
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      K.cart.add(p.id, qty);
      K.anim.flyToCart(wrap.querySelector(".product-detail__image"));
      K.anim.showToast(`${qty}× ${p.name} toegevoegd`);
    });

    requestAnimationFrame(() => wrap.querySelectorAll(".reveal").forEach((el) => el.classList.add("in-view")));

    const relatedEl = document.querySelector("[data-related-products]");
    if (relatedEl) {
      const related = K.PRODUCTS.filter((r) => r.category === p.category && r.id !== p.id).slice(0, 4);
      relatedEl.innerHTML = related.map(productCard).join("");
      bindAddButtons(relatedEl);
      K.anim.initTiltCards();
    }
  }

  /* ---------- winkelwagenpagina + checkout ---------- */
  function initCartPage() {
    const page = document.querySelector("[data-cart-page]");
    if (!page) return;

    function refreshSummary() {
      const subtotal = K.cart.total();
      const shipping = subtotal === 0 || subtotal >= 35 ? 0 : 4.95;
      const total = subtotal + shipping;
      const subtotalEl = document.querySelector("[data-summary-subtotal]");
      const shippingEl = document.querySelector("[data-summary-shipping]");
      const totalEl = document.querySelector("[data-summary-total]");
      if (subtotalEl) subtotalEl.textContent = K.formatPrice(subtotal);
      if (shippingEl) shippingEl.textContent = shipping === 0 ? "Gratis" : K.formatPrice(shipping);
      if (totalEl) totalEl.textContent = K.formatPrice(total);
      const checkoutBtn = document.querySelector("[data-checkout-btn]");
      if (checkoutBtn) checkoutBtn.disabled = K.cart.get().length === 0;
    }

    refreshSummary();
    window.addEventListener("cart:changed", refreshSummary);

    const checkoutBtn = document.querySelector("[data-checkout-btn]");
    const checkoutForm = document.querySelector("[data-checkout-form]");
    const cartView = document.querySelector("[data-cart-view]");
    if (checkoutBtn && checkoutForm) {
      checkoutBtn.addEventListener("click", () => {
        cartView.hidden = true;
        checkoutForm.hidden = false;
        checkoutForm.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      checkoutForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const successEl = document.querySelector("[data-order-success]");
        checkoutForm.hidden = true;
        successEl.hidden = false;
        K.anim.paintConfetti(successEl.querySelector(".success-icon"));
        K.cart.clear();
        successEl.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }

  /* ---------- FAQ accordion ---------- */
  function initFAQ() {
    document.querySelectorAll("[data-faq-item]").forEach((item) => {
      const question = item.querySelector("[data-faq-question]");
      question?.addEventListener("click", () => {
        const isOpen = item.classList.contains("is-open");
        item.parentElement.querySelectorAll("[data-faq-item]").forEach((i) => i.classList.remove("is-open"));
        if (!isOpen) item.classList.add("is-open");
      });
    });
  }

  /* ---------- contactformulier ---------- */
  function initContactForm() {
    const form = document.querySelector("[data-contact-form]");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const successEl = document.querySelector("[data-contact-success]");
      form.hidden = true;
      if (successEl) {
        successEl.hidden = false;
        K.anim.paintConfetti(successEl);
      }
    });
  }

  /* ---------- nieuwsbrief ---------- */
  function initNewsletter() {
    document.querySelectorAll("[data-newsletter-form]").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const msg = form.querySelector("[data-newsletter-msg]");
        form.querySelector("input")?.setAttribute("disabled", "true");
        form.querySelector("button")?.setAttribute("disabled", "true");
        if (msg) msg.hidden = false;
      });
    });
  }

  /* ---------- galerij lightbox (over.html) ---------- */
  function initLightbox() {
    const items = document.querySelectorAll("[data-lightbox-item]");
    const overlay = document.querySelector("[data-lightbox-overlay]");
    if (!items.length || !overlay) return;
    const content = overlay.querySelector("[data-lightbox-content]");
    items.forEach((item) => {
      item.addEventListener("click", () => {
        content.innerHTML = item.innerHTML;
        overlay.classList.add("is-open");
      });
    });
    overlay.addEventListener("click", () => overlay.classList.remove("is-open"));
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderFeatured();
    initShopGrid();
    renderProductDetail();
    initCartPage();
    initFAQ();
    initContactForm();
    initNewsletter();
    initLightbox();
    bindAddButtons();

    document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  });
})();
