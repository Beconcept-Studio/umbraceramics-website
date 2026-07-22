import gsap from 'gsap';

/**
 * Builds an infinite, seamless vertical loop tween on `track`. Expects `track` to already
 * contain the original content plus a cloned copy appended after it (so the loop can wrap
 * without a visible seam), and `height` to be the height of the original (non-cloned) content.
 *
 * @param {HTMLElement} track
 * @param {{ height: number, speed: number, direction: 'up' | 'down' }} options
 * @returns {gsap.core.Tween}
 */
export function createInfiniteLoop(track, { height, speed, direction }) {
  const isUp = direction !== 'down';
  const wrapMin = isUp ? -height : 0;
  const wrapMax = isUp ? 0 : height;

  return gsap.to(track, {
    y: isUp ? `-=${height}` : `+=${height}`,
    duration: height / speed,
    ease: 'none',
    repeat: -1,
    modifiers: {
      y: gsap.utils.unitize(gsap.utils.wrap(wrapMin, wrapMax)),
    },
  });
}

/**
 * Eases a running tween's timeScale up or down, e.g. to slow a loop on hover.
 *
 * @param {gsap.core.Tween} tween
 * @param {number} timeScale
 * @param {number} duration
 */
export function setHoverTimeScale(tween, timeScale, duration) {
  gsap.to(tween, { timeScale, duration, overwrite: true });
}

/**
 * Wraps a `y` value into the same bounds `createInfiniteLoop` uses, so manual
 * panning (e.g. wheel/touch input) stays within the seamless loop range.
 *
 * @param {number} y
 * @param {number} height
 * @param {'up' | 'down'} direction
 * @returns {number}
 */
export function wrapLoopY(y, height, direction) {
  const isUp = direction !== 'down';
  const wrapMin = isUp ? -height : 0;
  const wrapMax = isUp ? 0 : height;
  return gsap.utils.wrap(wrapMin, wrapMax)(y);
}
