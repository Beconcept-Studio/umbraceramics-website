import { Component } from '@theme/component';
import { lockScroll, unlockScroll } from '@theme/utilities';

const DESKTOP_MEDIA_QUERY = '(min-width: 899px)';
const INTERSECTION_THRESHOLD = 0.6;
const SWIPER_READY_RETRY_MS = 50;
const SWIPER_READY_MAX_ATTEMPTS = 40; // ~2s

/**
 * Product gallery swiper. On desktop (>= 899px, the same breakpoint where the
 * underlying Swiper switches to vertical), scrolling the page while the
 * `.product-informations` section is in view steps through the gallery
 * instead of scrolling the page — using Swiper's own `freeMode` + native
 * `mousewheel` module for a fluid, momentum-driven feel (not discrete
 * one-notch-per-slide jumps). `mousewheel.releaseOnEdges` hands control back
 * to normal page scroll once the first/last slide is reached.
 */
class BeconceptProductSwiperComponent extends Component {
  requiredRefs = ['swiperEl', 'paginationItem'];

  #swiper;
  #observer;
  #mediaQuery = matchMedia(DESKTOP_MEDIA_QUERY);
  #isActive = false;
  #initAttempts = 0;
  #lockArmed = false;
  #scrollLocked = false;
  /** @type {HTMLElement} */
  #sectionEl = this;

  connectedCallback() {
    super.connectedCallback();
    const closestSection = this.closest('.product-informations');
    this.#sectionEl = closestSection instanceof HTMLElement ? closestSection : this;

    this.#initSwiper();

    this.#observer = new IntersectionObserver(this.#handleIntersect, {
      threshold: INTERSECTION_THRESHOLD,
    });
    // Observe the section container, not `this`: the wrapper renders with
    // `display: contents` (to stay transparent to the surrounding flex
    // layout) and therefore has no layout box of its own — IntersectionObserver
    // can never report an intersection for a boxless element.
    this.#observer.observe(this.#sectionEl);

    this.#mediaQuery.addEventListener('change', this.#handleBreakpointChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#mediaQuery.removeEventListener('change', this.#handleBreakpointChange);
    this.#releaseLockWatcher();
    this.#swiper?.destroy(true, true);
    this.#swiper = undefined;
  }

  /**
   * Declarative click handler for `.pagination-item` (wired via `on:click`).
   */
  handlePaginationClick(event) {
    const index = Number(event.target.dataset.index);
    if (!Number.isNaN(index)) this.#swiper?.slideTo(index);
  }

  #initSwiper() {
    if (typeof Swiper === 'undefined') {
      // The global Swiper bundle is loaded with `defer` in theme.liquid and may
      // not have executed yet when this component upgrades. Retry briefly
      // instead of silently giving up.
      if (this.#initAttempts++ >= SWIPER_READY_MAX_ATTEMPTS) return;
      setTimeout(() => this.#initSwiper(), SWIPER_READY_RETRY_MS);
      return;
    }

    const paginationItems = this.refs.paginationItem;
    /** @param {number} vh */
    const getHwInPx = (vh) => (window.innerHeight * vh) / 100;
    /** @param {number} vw */
    const getVwInPx = (vw) => (window.innerWidth * vw) / 100;

    this.#swiper = new Swiper(this.refs.swiperEl, {
      direction: 'horizontal',
      slidesPerView: 1,
      speed: 1000,
      // Mobile default: same idea as the desktop vh-based gap, but tied to
      // viewport width since the gap here is horizontal, not vertical.
      spaceBetween: getVwInPx(25),
      grabCursor: false,
      // Bound but disabled at init: only armed on desktop while the section
      // is in view (see #syncWheelCapture). `eventsTarget` scopes capture to
      // the whole product-info section, not just the swiper itself — Swiper
      // resolves it via `document.querySelector`, so it must be a selector
      // string, not an element reference.
      mousewheel: {
        enabled: false,
        eventsTarget: '.product-informations',
        forceToAxis: true,
        sensitivity: 1,
        // Lets the wheel event fall through to normal page scroll once the
        // first/last slide is reached in the scrolled direction, instead of
        // swallowing it — this is what hands control back to the page.
        releaseOnEdges: true,
      },
      on: {
        slideChange: function () {
          paginationItems.forEach((item, idx) => {
            if (idx === this.activeIndex) {
              item.classList.remove('opacity-30');
              item.classList.add('opacity-100');
            } else {
              item.classList.add('opacity-30');
              item.classList.remove('opacity-100');
            }
          });
        },
        resize: function () {
          if (window.innerWidth >= 899) {
            this.params.spaceBetween = getHwInPx(15);
          } else {
            this.params.spaceBetween = getVwInPx(20);
          }
          this.update();
        },
      },
      breakpoints: {
        899: {
          direction: 'vertical',
          spaceBetween: getHwInPx(20),
          // Fluid, momentum-driven movement; `sticky: false` lets it come to
          // rest wherever the momentum ends instead of snapping to a slide.
          freeMode: { enabled: true, sticky: false, momentumBounce: false },
        },
        1280: {
          direction: 'vertical',
          spaceBetween: getHwInPx(35),
          freeMode: { enabled: true, sticky: false, momentumBounce: false },
        },
      },
    });

    // Pick up whatever activity/breakpoint state was already latched while
    // Swiper was still initializing (or retrying for `window.Swiper`).
    this.#syncWheelCapture();
  }

  #handleIntersect = (entries) => {
    const entry = entries[entries.length - 1];
    this.#isActive = entry.isIntersecting;
    this.#syncWheelCapture();
  };

  #handleBreakpointChange = () => {
    this.#syncWheelCapture();
  };

  #syncWheelCapture() {
    if (!this.#swiper) return;
    if (this.#mediaQuery.matches && this.#isActive) {
      this.#swiper.mousewheel.enable();
      this.#armLockWatcher();
    } else {
      this.#swiper.mousewheel.disable();
      this.#releaseLockWatcher();
    }
  }

  /**
   * Swiper's own `mousewheel` module already calls `preventDefault()` while
   * mid-gallery and lets it through at `releaseOnEdges` — but trackpad
   * gestures with a diagonal component (or the exact tick that lands on an
   * edge) can occasionally slip a real, tiny `window` scroll through even
   * while mid-gallery. The theme's header reacts to *any* scroll event
   * (`assets/header.js`, `capture: true` on `window`) and hides itself on
   * the resulting delta, which is both the flicker and the unwanted header
   * movement. `lockScroll`/`unlockScroll` (`html[scroll-lock]` in
   * `assets/base.css`) is a hard `overflow: hidden` backstop: engaged only
   * while genuinely mid-gallery, released the moment the swiper reaches the
   * edge being scrolled toward, so it never blocks the page scroll that's
   * supposed to resume after the gallery is exhausted.
   */
  /** @param {WheelEvent} event */
  #handleLockWatcher = (event) => {
    const swiper = this.#swiper;
    if (!swiper) return;

    const goingDown = event.deltaY > 0;
    const atEdge = goingDown ? swiper.isEnd : swiper.isBeginning;

    if (atEdge) {
      this.#releaseScrollLock();
    } else {
      this.#ensureScrollLock();
    }
  };

  #armLockWatcher() {
    if (this.#lockArmed) return;
    this.#lockArmed = true;
    this.#sectionEl.addEventListener('wheel', this.#handleLockWatcher, { passive: true });
  }

  #releaseLockWatcher() {
    if (this.#lockArmed) {
      this.#sectionEl.removeEventListener('wheel', this.#handleLockWatcher);
      this.#lockArmed = false;
    }
    this.#releaseScrollLock();
  }

  #ensureScrollLock() {
    if (this.#scrollLocked) return;
    this.#scrollLocked = true;
    lockScroll(this);
  }

  #releaseScrollLock() {
    if (!this.#scrollLocked) return;
    this.#scrollLocked = false;
    unlockScroll(this);
  }
}

if (!customElements.get('beconcept-product-swiper-component')) {
  customElements.define('beconcept-product-swiper-component', BeconceptProductSwiperComponent);
}
