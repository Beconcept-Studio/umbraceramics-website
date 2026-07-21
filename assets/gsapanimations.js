import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm";
export function initAnimations() {
  gsap.to(".header__logo", {
    x: 100,
    duration: 1,
    repeat: -1,
    yoyo: true,
  });
}
