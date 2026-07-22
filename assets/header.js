import { Component } from "@theme/component";
import { onDocumentLoaded } from "@theme/utilities";

/**
 * A custom element that manages the mobile menu drawer, toggled by the
 * header's hamburger button.
 *
 * @extends {Component}
 */
class MenuDrawer extends Component {
  toggle() {
    this.#setOpen(!this.hasAttribute("open"));
  }

  open() {
    this.#setOpen(true);
  }

  close() {
    this.#setOpen(false);
  }

  /** @param {boolean} open */
  #setOpen(open) {
    this.toggleAttribute("open", open);
    document
      .querySelector(`[aria-controls="${this.id}"]`)
      ?.setAttribute("aria-expanded", String(open));
  }
}

if (!customElements.get("menu-drawer")) {
  customElements.define("menu-drawer", MenuDrawer);
}

onDocumentLoaded(() => {
  const header = document.querySelector("header-component");
  const headerGroup = document.querySelector("#header-group");
  const colophonOpener = document.querySelector('a[href="#colophon-opener"]');
  const colophonCloser = document.querySelector("#hidecolophon");
  const colophonWrapper = document.querySelector("#colophonwrapper");
  const colophonContent = document.querySelector("#colophoncontent");

  // Note: Initial header heights are set via inline script in theme.liquid
  // This ResizeObserver handles dynamic updates after page load

  // Update header group height on resize of any child
  if (headerGroup) {
    const resizeObserver = new ResizeObserver((entries) => {
      const headerGroupHeight = entries.reduce((totalHeight, entry) => {
        if (
          entry.target !== header ||
          (header.hasAttribute("transparent") &&
            header.parentElement?.nextElementSibling)
        ) {
          return totalHeight + (entry.borderBoxSize[0]?.blockSize ?? 0);
        }
        return totalHeight;
      }, 0);
      // The initial height is calculated using the .offsetHeight property, which returns an integer.
      // We round to the nearest integer to avoid unnecessaary reflows.
      const roundedHeaderGroupHeight = Math.round(headerGroupHeight);
      document.body.style.setProperty(
        "--header-group-height",
        `${roundedHeaderGroupHeight}px`,
      );
    });

    if (header instanceof HTMLElement) {
      resizeObserver.observe(header);
    }

    // Observe all children of the header group
    const children = headerGroup.children;
    for (let i = 0; i < children.length; i++) {
      const element = children[i];
      if (element instanceof HTMLElement) {
        resizeObserver.observe(element);
      }
    }

    // Also observe the header group itself for child changes
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          // Re-observe all children when the list changes
          const children = headerGroup.children;
          for (let i = 0; i < children.length; i++) {
            const element = children[i];
            if (element instanceof HTMLElement) {
              resizeObserver.observe(element);
            }
          }
        }
      }
    });

    mutationObserver.observe(headerGroup, { childList: true });
  }

  if (colophonOpener && colophonCloser && colophonWrapper && colophonContent) {
    colophonOpener.addEventListener("click", (event) => {
      event.preventDefault();
      colophonWrapper.classList.add("colophon-open");
      setTimeout(() => {
        colophonContent.classList.add("colophon-slided");
      }, 100);
    });

    colophonCloser.addEventListener("click", () => {
      colophonContent.classList.remove("colophon-slided");
      setTimeout(() => {
        colophonWrapper.classList.remove("colophon-open");
      }, 100);
    });
  }
});
