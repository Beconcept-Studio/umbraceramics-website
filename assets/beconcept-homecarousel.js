import { Component } from "@theme/component";
import {
  debounce,
  throttle,
  ResizeNotifier,
  mediaQueryLarge,
  isMobileBreakpoint,
  isTouchDevice,
} from "@theme/utilities";
import gsap from "gsap";
import {
  createInfiniteLoop,
  setHoverTimeScale,
  wrapLoopY,
} from "@theme/gsap-animations";

const DEFAULT_SPEED = 40;
const HOVER_TIME_SCALE = 0.08;
const HOVER_TRANSITION_DURATION = 0.3;
const MANUAL_PAN_RESUME_DELAY = 50;

/**
 * A custom element that scrolls a duplicated image stack in an infinite, seamless loop.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} track - The element translated by GSAP; contains the original content plus its clone.
 * @property {HTMLElement} content - The original (non-cloned) stack of image rows, used to measure loop height.
 * @property {HTMLElement[]} items - Individual image rows, hovering one slows the loop down.
 *
 * @extends Component<Refs>
 */
class BeconceptHomeCarouselComponent extends Component {
  requiredRefs = ["track", "content"];

  /** @type {gsap.core.Tween | null} */
  #tween = null;

  /** @type {HTMLElement | null} */
  #clone = null;

  /** @type {ResizeObserver | null} */
  #resizeObserver = null;

  /** @type {ReturnType<typeof gsap.matchMedia> | null} */
  #mm = null;

  /** @type {HTMLElement[] | null} */
  #manualClones = null;

  /** @type {number} */
  #manualHeight = 0;

  /** @type {number} */
  #loopHeight = 0;

  /** @type {number} */
  #loopSpeed = DEFAULT_SPEED;

  /** @type {'up' | 'down'} */
  #loopDirection = "up";

  /** @type {number} */
  #touchY = 0;

  /** @type {ReturnType<typeof setTimeout> | null} */
  #resumeTimer = null;

  get #autoplayEnabled() {
    return this.dataset.autoplay === "true";
  }

  get #hoverSlowdownEnabled() {
    return this.dataset.hoverSlowdown === "true";
  }

  connectedCallback() {
    super.connectedCallback();

    this.#lockMobileHeight();
    mediaQueryLarge.addEventListener("change", this.#lockMobileHeight);

    if (this.#autoplayEnabled) {
      this.#mm = gsap.matchMedia();
      this.#mm.add("(prefers-reduced-motion: no-preference)", () => {
        this.#buildLoop();
        this.#resizeObserver = new ResizeNotifier(this.#handleResize);
        this.#resizeObserver.observe(this.refs.content);

        return () => {
          this.#resizeObserver?.disconnect();
          this.#resizeObserver = null;
          this.#teardownLoop();
        };
      });
    } else {
      this.#buildManualLoop();
      this.#resizeObserver = new ResizeNotifier(this.#handleManualResize);
      this.#resizeObserver.observe(this.refs.content);
      this.addEventListener("scroll", this.#handleManualScroll);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    mediaQueryLarge.removeEventListener("change", this.#lockMobileHeight);
    this.#mm?.revert();
    this.#mm = null;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.removeEventListener("scroll", this.#handleManualScroll);
    this.#teardownManualLoop();
  }

  /**
   * On mobile/tablet, `100vh`/`h-screen` jumps around as the browser chrome
   * shows/hides on scroll. Lock the section to the viewport height measured
   * once at load instead. Desktop keeps the CSS `h-screen` sizing.
   */
  #lockMobileHeight = () => {
    if (mediaQueryLarge.matches) {
      this.style.removeProperty("height");
      this.style.removeProperty("min-height");
      return;
    }
    const height = `${window.innerHeight}px`;
    this.style.height = height;
    this.style.minHeight = height;
  };

  onItemEnter() {
    if (!this.#tween || !this.#hoverSlowdownEnabled) return;
    if (isMobileBreakpoint() || isTouchDevice()) return;
    setHoverTimeScale(this.#tween, HOVER_TIME_SCALE, HOVER_TRANSITION_DURATION);
  }

  onItemLeave() {
    if (!this.#tween || !this.#hoverSlowdownEnabled) return;
    if (isMobileBreakpoint() || isTouchDevice()) return;
    setHoverTimeScale(this.#tween, 1, HOVER_TRANSITION_DURATION);
  }

  #handleResize = debounce(() => {
    this.#teardownLoop();
    this.#buildLoop();
  }, 250);

  /** @returns {HTMLElement} a copy of `content` stripped of `ref` attributes, marked decorative. */
  #cloneContent() {
    const clone = /** @type {HTMLElement} */ (
      this.refs.content.cloneNode(true)
    );
    clone.setAttribute("aria-hidden", "true");
    clone.removeAttribute("ref");
    for (const el of clone.querySelectorAll("[ref]")) el.removeAttribute("ref");
    return clone;
  }

  #buildLoop() {
    const { track, content } = this.refs;

    const height = content.getBoundingClientRect().height;
    if (!height) return;

    this.#clone = this.#cloneContent();
    track.appendChild(this.#clone);

    this.#loopHeight = height;
    this.#loopSpeed = Number(this.dataset.speed) || DEFAULT_SPEED;
    this.#loopDirection = this.dataset.direction === "down" ? "down" : "up";

    this.#startTween();

    this.setAttribute("data-loop-active", "");

    this.addEventListener("wheel", this.#handleWheel, { passive: false });
    this.addEventListener("touchstart", this.#handleTouchStart, {
      passive: true,
    });
    this.addEventListener("touchmove", this.#handleTouchMove, {
      passive: false,
    });
  }

  #startTween() {
    this.#tween = createInfiniteLoop(this.refs.track, {
      height: this.#loopHeight,
      speed: this.#loopSpeed,
      direction: this.#loopDirection,
    });
  }

  #teardownLoop() {
    this.removeAttribute("data-loop-active");

    this.removeEventListener("wheel", this.#handleWheel);
    this.removeEventListener("touchstart", this.#handleTouchStart);
    this.removeEventListener("touchmove", this.#handleTouchMove);
    if (this.#resumeTimer) clearTimeout(this.#resumeTimer);
    this.#resumeTimer = null;

    this.#tween?.kill();
    this.#tween = null;

    this.#clone?.remove();
    this.#clone = null;
    this.#loopHeight = 0;

    gsap.set(this.refs.track, { y: 0 });
  }

  /**
   * Lets the user pan the loop with mouse wheel/trackpad scroll while
   * autoplay is running — pausing the tween and moving `track` directly,
   * then resuming autoplay from that position after a short idle delay.
   */
  /** @param {WheelEvent} event */
  #handleWheel = (event) => {
    if (!this.#loopHeight) return;
    event.preventDefault();
    this.#panBy(event.deltaY);
  };

  /** @param {TouchEvent} event */
  #handleTouchStart = (event) => {
    const touch = event.touches[0];
    if (touch) this.#touchY = touch.clientY;
  };

  /**
   * Same idea as `#handleWheel`, for touch drag on mobile.
   * @param {TouchEvent} event
   */
  #handleTouchMove = (event) => {
    if (!this.#loopHeight) return;
    const touch = event.touches[0];
    if (!touch) return;
    const delta = this.#touchY - touch.clientY;
    this.#touchY = touch.clientY;
    event.preventDefault();
    this.#panBy(delta);
  };

  /** @param {number} delta */
  #panBy(delta) {
    if (this.#tween) {
      this.#tween.kill();
      this.#tween = null;
    }

    const sign = this.#loopDirection === "down" ? 1 : -1;
    const track = this.refs.track;
    const current = Number(gsap.getProperty(track, "y")) || 0;
    const next = wrapLoopY(
      current + sign * delta,
      this.#loopHeight,
      this.#loopDirection,
    );
    gsap.set(track, { y: next });

    if (this.#resumeTimer) clearTimeout(this.#resumeTimer);
    this.#resumeTimer = setTimeout(() => {
      this.#resumeTimer = null;
      this.#startTween();
    }, MANUAL_PAN_RESUME_DELAY);
  }

  /**
   * When autoplay is off, the section still needs to loop endlessly under the
   * user's own mouse/touch scrolling. Stack a clone before and after the
   * original content, then silently jump `scrollTop` by one content-height
   * whenever the scroll position drifts into a cloned copy, so the wrap is
   * invisible.
   */
  #handleManualScroll = throttle(() => {
    const height = this.#manualHeight;
    if (!height) return;

    if (this.scrollTop <= 0) {
      this.scrollTop += height;
    } else if (this.scrollTop >= height * 2) {
      this.scrollTop -= height;
    }
  }, 100);

  #handleManualResize = debounce(() => {
    this.#teardownManualLoop();
    this.#buildManualLoop();
  }, 250);

  #buildManualLoop() {
    const { track, content } = this.refs;

    const height = content.getBoundingClientRect().height;
    if (!height) return;

    const before = this.#cloneContent();
    const after = this.#cloneContent();
    track.insertBefore(before, content);
    track.appendChild(after);
    this.#manualClones = [before, after];
    this.#manualHeight = height;

    this.scrollTop = height;
  }

  #teardownManualLoop() {
    this.#manualClones?.forEach((clone) => clone.remove());
    this.#manualClones = null;
    this.#manualHeight = 0;
  }
}

if (!customElements.get("beconcept-homecarousel-component")) {
  customElements.define(
    "beconcept-homecarousel-component",
    BeconceptHomeCarouselComponent,
  );
}
