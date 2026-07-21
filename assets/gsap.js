// Vendored manually from node_modules/gsap@3.15.0/index.js — no bundler in this theme.
// To upgrade: bump the gsap dependency in package.json, npm install, then re-copy this file
// plus assets/gsap-core.js and assets/CSSPlugin.js from node_modules/gsap.
import { gsap, Power0, Power1, Power2, Power3, Power4, Linear, Quad, Cubic, Quart, Quint, Strong, Elastic, Back, SteppedEase, Bounce, Sine, Expo, Circ, TweenLite, TimelineLite, TimelineMax } from "./gsap-core.js";
import { CSSPlugin } from "./CSSPlugin.js";
var gsapWithCSS = gsap.registerPlugin(CSSPlugin) || gsap,
    // to protect from tree shaking
TweenMaxWithCSS = gsapWithCSS.core.Tween;
export { gsapWithCSS as gsap, gsapWithCSS as default, CSSPlugin, TweenMaxWithCSS as TweenMax, TweenLite, TimelineMax, TimelineLite, Power0, Power1, Power2, Power3, Power4, Linear, Quad, Cubic, Quart, Quint, Strong, Elastic, Back, SteppedEase, Bounce, Sine, Expo, Circ };