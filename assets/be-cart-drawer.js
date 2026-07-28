import { Component } from "@theme/component";
import { CartLinesUpdateEvent } from "@shopify/events";

class BeconceptCartDrawer extends Component {
  connectedCallback() {
    super.connectedCallback();
    this.bindEvents();
  }

  /**
   * Collega i listener in modo diretto a ogni singolo pulsante.
   * Viene invocato all'avvio e ad ogni re-render AJAX del DOM interno.
   */
  bindEvents() {
    // 1. TASTO CLOSE
    const closeBtn = this.querySelector("[data-close]");
    if (closeBtn && !closeBtn.hasAttribute("data-bound")) {
      closeBtn.setAttribute("data-bound", "true");
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.close();
      });
    }

    // 2. TASTI QUANTITY (+ e -)
    const qtyButtons = this.querySelectorAll("[data-qty-btn]");
    qtyButtons.forEach((btn) => {
      if (!btn.hasAttribute("data-bound")) {
        btn.setAttribute("data-bound", "true");
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const key = btn.getAttribute("data-key");
          const newQty = parseInt(btn.getAttribute("data-qty"), 10);
          this.changeItemQuantity(key, newQty, btn);
        });
      }
    });

    // 3. TASTI REMOVE
    const removeButtons = this.querySelectorAll("[data-remove-btn]");
    removeButtons.forEach((btn) => {
      if (!btn.hasAttribute("data-bound")) {
        btn.setAttribute("data-bound", "true");
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const key = btn.getAttribute("data-key");
          this.changeItemQuantity(key, 0, btn);
        });
      }
    });

    // 4. TASTO CLEAR CART (Svuota carrello)
    const clearBtn = this.querySelector("[data-clear-cart]");
    if (clearBtn && !clearBtn.hasAttribute("data-bound")) {
      clearBtn.setAttribute("data-bound", "true");
      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.clearCart(clearBtn);
      });
    }
  }

  open() {
    this.classList.remove("opacity-0", "pointer-events-none");
    this.classList.add("opacity-100", "pointer-events-auto");
  }

  close() {
    this.classList.remove("opacity-100", "pointer-events-auto");
    this.classList.add("opacity-0", "pointer-events-none");
  }

  toggle() {
    if (this.classList.contains("opacity-0")) {
      this.open();
    } else {
      this.close();
    }
  }

  /**
   * Modifica quantità o rimuove articolo via AJAX (Section Rendering API)
   */
  changeItemQuantity(key, quantity, triggerElement) {
    if (triggerElement) {
      triggerElement.style.opacity = "0.3";
      triggerElement.style.pointerEvents = "none";
    }

    const sectionId = this.getAttribute("data-section-id");

    const body = JSON.stringify({
      id: key,
      quantity: quantity,
      sections: sectionId ? [sectionId] : [],
      sections_url: window.location.pathname,
    });

    const deferredUpdatePromise = CartLinesUpdateEvent.createPromise();
    this.dispatchEvent(
      new CartLinesUpdateEvent({
        action: quantity > 0 ? "update" : "remove",
        context: "cart",
        lines: [{ id: key, quantity }],
        promise: deferredUpdatePromise.promise,
      }),
    );

    fetch("/cart/change.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: body,
    })
      .then((response) => {
        if (!response.ok)
          throw new Error("Errore nell'aggiornamento del carrello");
        return response.json();
      })
      .then((state) => {
        this.updateGlobalCartCounters(state.item_count);
        deferredUpdatePromise.resolve({
          cart: CartLinesUpdateEvent.createCartFromAjaxResponse(state),
          detail: { itemCount: state.item_count },
        });

        const htmlContent =
          state.sections?.[sectionId] ||
          (state.sections ? Object.values(state.sections)[0] : null);

        if (htmlContent) {
          this.renderNewHTML(htmlContent);
        } else {
          this.refreshDrawerAJAX();
        }
      })
      .catch((error) => {
        console.error("Errore cart/change:", error);
        deferredUpdatePromise.reject(error);
        if (triggerElement) {
          triggerElement.style.opacity = "1";
          triggerElement.style.pointerEvents = "auto";
        }
      });
  }

  /**
   * Svuota completamente il carrello via AJAX
   */
  clearCart(buttonElement) {
    const originalText = buttonElement.innerText;
    buttonElement.innerText = "Clearing...";
    buttonElement.disabled = true;

    const sectionId = this.getAttribute("data-section-id");

    const deferredUpdatePromise = CartLinesUpdateEvent.createPromise();
    this.dispatchEvent(
      new CartLinesUpdateEvent({
        action: "remove",
        context: "cart",
        lines: [],
        promise: deferredUpdatePromise.promise,
      }),
    );

    fetch("/cart/clear.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        sections: sectionId ? [sectionId] : [],
        sections_url: window.location.pathname,
      }),
    })
      .then((response) => response.json())
      .then((state) => {
        this.updateGlobalCartCounters(0);
        deferredUpdatePromise.resolve({
          cart: CartLinesUpdateEvent.createCartFromAjaxResponse(state),
          detail: { itemCount: 0 },
        });

        const htmlContent =
          state.sections?.[sectionId] ||
          (state.sections ? Object.values(state.sections)[0] : null);

        if (htmlContent) {
          this.renderNewHTML(htmlContent);
        } else {
          this.refreshDrawerAJAX();
        }
      })
      .catch((err) => {
        console.error("Errore clear cart:", err);
        deferredUpdatePromise.reject(err);
      });
  }

  /**
   * Salvataggio AJAX fail-safe in caso di mancato ritorno della sezione
   */
  refreshDrawerAJAX() {
    const sectionId = this.getAttribute("data-section-id");
    if (!sectionId) return;

    fetch(`/cart.js?sections=${sectionId}`)
      .then((res) => res.json())
      .then((state) => {
        const htmlContent =
          state.sections?.[sectionId] ||
          (state.sections ? Object.values(state.sections)[0] : null);
        if (htmlContent) this.renderNewHTML(htmlContent);
      })
      .catch((e) => console.error("Errore refreshDrawerAJAX:", e));
  }

  /**
   * Aggiorna i contatori carrello nella pagina
   */
  updateGlobalCartCounters(itemCount) {
    const cartCounters = document.querySelectorAll(
      "#cart-count, .cart-count, [data-cart-count], [data-cart-count-label]",
    );
    cartCounters.forEach((counter) => {
      counter.textContent = itemCount;
    });
  }

  /**
   * Sostituisce il DOM interno con l'HTML aggiornato e ricollega gli eventi
   */
  renderNewHTML(sectionHTML) {
    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(sectionHTML, "text/html");

    const newContent = parsedDocument.querySelector("#cart-drawer-content");
    const currentContent = this.querySelector("#cart-drawer-content");

    if (newContent && currentContent) {
      currentContent.innerHTML = newContent.innerHTML;
      this.bindEvents(); // Ricollega istantaneamente gli eventi ai nuovi bottoni
    }
  }
}

if (!customElements.get("beconcept-cart-drawer")) {
  customElements.define("beconcept-cart-drawer", BeconceptCartDrawer);
}
