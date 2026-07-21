import { Component } from '@theme/component';
import { debounce, ResizeNotifier } from '@theme/utilities';
import gsap from 'gsap';

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

  connectedCallback() {
    super.connectedCallback();

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
    this.#mm?.revert();
    this.#mm = null;
  }

  onItemEnter() {
    if (!this.#tween) return;
    gsap.to(this.#tween, { timeScale: HOVER_TIME_SCALE, duration: HOVER_TRANSITION_DURATION, overwrite: true });
  }

  onItemLeave() {
    if (!this.#tween) return;
    gsap.to(this.#tween, { timeScale: 1, duration: HOVER_TRANSITION_DURATION, overwrite: true });
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
    const isUp = this.dataset.direction !== 'down';
    const wrapMin = isUp ? -height : 0;
    const wrapMax = isUp ? 0 : height;

    this.#tween = gsap.to(track, {
      y: isUp ? `-=${height}` : `+=${height}`,
      duration: height / speed,
      ease: 'none',
      repeat: -1,
      modifiers: {
        y: gsap.utils.unitize(gsap.utils.wrap(wrapMin, wrapMax)),
      },
    });

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
