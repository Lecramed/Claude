/* ===================================================================
   KEIGOED — winkelwagen (localStorage) + mini-cart drawer
=================================================================== */

(function (global) {
  "use strict";
  const K = global.KEIGOED;
  const STORAGE_KEY = "keigoed-cart-v1";

  function readCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    renderCartUI();
    window.dispatchEvent(new CustomEvent("cart:changed", { detail: { items } }));
  }

  function getCart() {
    return readCart();
  }

  function addToCart(id, qty = 1) {
    const items = readCart();
    const existing = items.find((i) => i.id === id);
    if (existing) existing.qty += qty;
    else items.push({ id, qty });
    writeCart(items);
  }

  function setQty(id, qty) {
    let items = readCart();
    if (qty <= 0) {
      items = items.filter((i) => i.id !== id);
    } else {
      const it = items.find((i) => i.id === id);
      if (it) it.qty = qty;
    }
    writeCart(items);
  }

  function removeFromCart(id) {
    const items = readCart().filter((i) => i.id !== id);
    writeCart(items);
  }

  function clearCart() {
    writeCart([]);
  }

  function cartCount() {
    return readCart().reduce((sum, i) => sum + i.qty, 0);
  }

  function cartTotal() {
    return readCart().reduce((sum, i) => {
      const p = K.getProductById(i.id);
      return p ? sum + p.price * i.qty : sum;
    }, 0);
  }

  /* ---------- UI: badge + drawer, aanwezig op elke pagina ---------- */
  function renderCartUI() {
    const items = readCart();
    const count = items.reduce((s, i) => s + i.qty, 0);

    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = count;
      el.classList.toggle("is-visible", count > 0);
    });

    const lists = document.querySelectorAll("[data-cart-list]");
    const emptyEls = document.querySelectorAll("[data-cart-empty]");
    const totalEl = document.querySelector("[data-cart-total]");
    if (!lists.length) return;

    function rowHtml(item, p) {
      return `
        <div class="cart-row">
          <div class="cart-row__img">${p.svg}</div>
          <div class="cart-row__info">
            <a href="product.html?id=${p.id}" class="cart-row__name">${p.name}</a>
            <div class="cart-row__price">${K.formatPrice(p.price)}</div>
            <div class="qty-stepper" data-qty-for="${p.id}">
              <button type="button" class="qty-btn" data-action="dec" aria-label="Minder">−</button>
              <span class="qty-value">${item.qty}</span>
              <button type="button" class="qty-btn" data-action="inc" aria-label="Meer">+</button>
            </div>
          </div>
          <button type="button" class="cart-row__remove" data-remove="${p.id}" aria-label="Verwijderen">✕</button>
        </div>`;
    }

    lists.forEach((list) => {
      list.innerHTML = items
        .map((item) => {
          const p = K.getProductById(item.id);
          return p ? rowHtml(item, p) : "";
        })
        .join("");
    });
    emptyEls.forEach((el) => (el.hidden = items.length !== 0));
    if (totalEl) totalEl.textContent = K.formatPrice(cartTotal());
  }

  function bindCartEvents() {
    document.body.addEventListener("click", (e) => {
      const decBtn = e.target.closest('[data-action="dec"]');
      const incBtn = e.target.closest('[data-action="inc"]');
      const removeBtn = e.target.closest("[data-remove]");
      const toggleBtn = e.target.closest("[data-cart-toggle]");
      const closeBtn = e.target.closest("[data-cart-close]");

      if (decBtn) {
        const id = decBtn.closest("[data-qty-for]").dataset.qtyFor;
        const it = readCart().find((i) => i.id === id);
        if (it) setQty(id, it.qty - 1);
      }
      if (incBtn) {
        const id = incBtn.closest("[data-qty-for]").dataset.qtyFor;
        const it = readCart().find((i) => i.id === id);
        if (it) setQty(id, it.qty + 1);
      }
      if (removeBtn) removeFromCart(removeBtn.dataset.remove);
      if (toggleBtn) toggleDrawer();
      if (closeBtn || e.target.classList.contains("cart-drawer__backdrop")) closeDrawer();
    });
  }

  function openDrawer() {
    document.querySelector("[data-cart-drawer]")?.classList.add("is-open");
    document.documentElement.classList.add("no-scroll");
  }
  function closeDrawer() {
    document.querySelector("[data-cart-drawer]")?.classList.remove("is-open");
    document.documentElement.classList.remove("no-scroll");
  }
  function toggleDrawer() {
    const d = document.querySelector("[data-cart-drawer]");
    if (!d) return;
    d.classList.contains("is-open") ? closeDrawer() : openDrawer();
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderCartUI();
    bindCartEvents();
  });

  K.cart = {
    get: getCart,
    add: addToCart,
    setQty,
    remove: removeFromCart,
    clear: clearCart,
    count: cartCount,
    total: cartTotal,
    openDrawer,
    closeDrawer,
    render: renderCartUI
  };
})(window);
