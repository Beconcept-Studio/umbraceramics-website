import { onDocumentLoaded, lockScroll, unlockScroll } from "@theme/utilities";

onDocumentLoaded(() => {
  const colophonFooterOpener = document.querySelector(
    'footer a[href="#colophon-opener-desktop"]',
  );
  const colophonFooterCloser = document.querySelector(
    'footer a[href="#colophon-closer-desktop"]',
  );
  const footerSection = document.querySelector(
    ".shopify-section-group-footer-group",
  );
  const colophonFooterWrapper = document.querySelector(
    ".colophon-footer-wrapper",
  );
  if (
    !footerSection ||
    !colophonFooterOpener ||
    !colophonFooterCloser ||
    !colophonFooterWrapper
  ) {
    return;
  }
  colophonFooterOpener.addEventListener("click", (event) => {
    event.preventDefault();
    colophonFooterOpener.classList.add("hidden");
    colophonFooterCloser.classList.remove("hidden");
    footerSection.classList.add("translated-footer");
    lockScroll(colophonFooterWrapper);
  });

  colophonFooterCloser.addEventListener("click", (event) => {
    event.preventDefault();
    colophonFooterCloser.classList.add("hidden");
    colophonFooterOpener.classList.remove("hidden");
    footerSection.classList.remove("translated-footer");
    unlockScroll(colophonFooterWrapper);
  });
});
