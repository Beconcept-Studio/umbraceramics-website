import { Component } from '@theme/component';
import { debounce, ResizeNotifier, mediaQueryLarge } from '@theme/utilities';
import gsap from 'gsap';
import { createInfiniteLoop, setHoverTimeScale } from '@theme/gsap-animations';

const DEFAULT_SPEED = 40;
const HOVER_TIME_SCALE = 0.08;
const HOVER_TRANSITION_DURATION = 0.3;

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
  requiredRefs = ['track', 'content'];

  /** @type {gsap.core.Tween | null} */
  #tween = null;

  /** @type {HTMLElement | null} */
  #clone = null;

  /** @type {ResizeObserver | null} */
  #resizeObserver = null;

  /** @type {ReturnType<typeof gsap.matchMedia> | null} */
  #mm = null;

  get #autoplayEnabled() {
    return this.dataset.autoplay === 'true';
  }

  get #hoverSlowdownEnabled() {
    return this.dataset.hoverSlowdown === 'true';
  }

  connectedCallback() {
    super.connectedCallback();

    this.#lockMobileHeight();
    mediaQueryLarge.addEventListener('change', this.#lockMobileHeight);

    if (!this.#autoplayEnabled) return;

    this.#mm = gsap.matchMedia();
    this.#mm.add('(prefers-reduced-motion: no-preference)', () => {
      this.#buildLoop();
      this.#resizeObserver = new ResizeNotifier(this.#handleResize);
      this.#resizeObserver.observe(this.refs.content);

      return () => {
        this.#resizeObserver?.disconnect();
        this.#resizeObserver = null;
        this.#teardownLoop();
      };
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    mediaQueryLarge.removeEventListener('change', this.#lockMobileHeight);
    this.#mm?.revert();
    this.#mm = null;
  }

  /**
   * On mobile/tablet, `100vh`/`h-screen` jumps around as the browser chrome
   * shows/hides on scroll. Lock the section to the viewport height measured
   * once at load instead. Desktop keeps the CSS `h-screen` sizing.
   */
  #lockMobileHeight = () => {
    if (mediaQueryLarge.matches) {
      this.style.removeProperty('height');
      return;
    }
    this.style.height = `${window.innerHeight}px`;
  };

  onItemEnter() {
    if (!this.#tween || !this.#hoverSlowdownEnabled) return;
    setHoverTimeScale(this.#tween, HOVER_TIME_SCALE, HOVER_TRANSITION_DURATION);
  }

  onItemLeave() {
    if (!this.#tween || !this.#hoverSlowdownEnabled) return;
    setHoverTimeScale(this.#tween, 1, HOVER_TRANSITION_DURATION);
  }

  #handleResize = debounce(() => {
    this.#teardownLoop();
    this.#buildLoop();
  }, 250);

  #buildLoop() {
    const { track, content } = this.refs;

    const height = content.getBoundingClientRect().height;
    if (!height) return;

    this.#clone = /** @type {HTMLElement} */ (content.cloneNode(true));
    this.#clone.setAttribute('aria-hidden', 'true');
    this.#clone.removeAttribute('ref');
    for (const el of this.#clone.querySelectorAll('[ref]')) el.removeAttribute('ref');
    track.appendChild(this.#clone);

    const speed = Number(this.dataset.speed) || DEFAULT_SPEED;
    const direction = this.dataset.direction === 'down' ? 'down' : 'up';

    this.#tween = createInfiniteLoop(track, { height, speed, direction });

    this.setAttribute('data-loop-active', '');
  }

  #teardownLoop() {
    this.removeAttribute('data-loop-active');

    this.#tween?.kill();
    this.#tween = null;

    this.#clone?.remove();
    this.#clone = null;

    gsap.set(this.refs.track, { y: 0 });
  }
}

if (!customElements.get('beconcept-homecarousel-component')) {
  customElements.define('beconcept-homecarousel-component', BeconceptHomeCarouselComponent);
}
