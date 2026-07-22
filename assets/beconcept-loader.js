import { Component } from '@theme/component';

const STORAGE_KEY = 'beconcept:loader-shown';

class BeconceptPageLoader extends Component {
  connectedCallback() {
    super.connectedCallback();

    if (sessionStorage.getItem(STORAGE_KEY)) {
      this.remove();
      return;
    }

    const loaderTime = Number(this.dataset.loaderTime) || 3;
    this.timeoutId = setTimeout(() => this.hide(), loaderTime * 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.timeoutId);
  }

  hide() {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    this.addEventListener('transitionend', () => this.remove(), { once: true });
    this.classList.add('opacity-0');
  }
}

if (!customElements.get('beconcept-page-loader')) {
  customElements.define('beconcept-page-loader', BeconceptPageLoader);
}
