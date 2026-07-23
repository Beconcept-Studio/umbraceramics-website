import { Component } from '@theme/component';
import { mediaQueryLarge } from '@theme/utilities';

const STORAGE_KEY = 'beconcept:loader-shown';

class BeconceptPageLoader extends Component {
  connectedCallback() {
    super.connectedCallback();

    if (sessionStorage.getItem(STORAGE_KEY)) {
      this.remove();
      return;
    }

    this.#lockMobileHeight();
    mediaQueryLarge.addEventListener('change', this.#lockMobileHeight);

    const loaderTime = Number(this.dataset.loaderTime) || 3;
    this.timeoutId = setTimeout(() => this.hide(), loaderTime * 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.timeoutId);
    mediaQueryLarge.removeEventListener('change', this.#lockMobileHeight);
  }

  /**
   * On mobile/tablet, `100vh`/`h-screen` jumps around as the browser chrome
   * shows/hides on scroll. Lock the loader to the viewport height measured
   * once at load instead. Desktop keeps the CSS `h-screen` sizing.
   */
  #lockMobileHeight = () => {
    if (mediaQueryLarge.matches) {
      this.style.removeProperty('height');
      this.style.removeProperty('min-height');
      return;
    }
    const height = `${window.innerHeight}px`;
    this.style.height = height;
    this.style.minHeight = height;
  };

  hide() {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    this.addEventListener('transitionend', () => this.remove(), { once: true });
    this.classList.add('opacity-0');
  }
}

if (!customElements.get('beconcept-page-loader')) {
  customElements.define('beconcept-page-loader', BeconceptPageLoader);
}
