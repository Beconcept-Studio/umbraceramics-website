# Homepage Carousel: hover-scope fix + autoplay/hover-slowdown toggles

## Problem

In `sections/beconcept-homecarousel.liquid`, the pointer hover listeners that
slow down the autoplay loop (`onItemEnter`/`onItemLeave` in
`assets/beconcept-homecarousel.js`) are attached to the outer grid-row `<div>`
(`ref="items[]"`), which spans the full grid width/height including empty
gutter space. Hovering that gutter triggers the slowdown even when the cursor
isn't over an image. There is also no editor control to disable the
hover-slowdown effect or the autoplay loop itself.

## Design

### 1. Hover target fix

Move `ref="items[]"`, `on:pointerenter="/onItemEnter"`, and
`on:pointerleave="/onItemLeave"` from the outer row `<div>` down to the inner
image box `<div class="{{ custom_classes }} overflow-hidden bg-gray-50
relative group">`. The hover effect now only fires when the pointer is over
an actual image.

### 2. New schema settings (`sections/beconcept-homecarousel.liquid`)

- `enable_autoplay` — checkbox, default `true`. Master toggle for the
  scrolling loop.
- `enable_hover_slowdown` — checkbox, default `true`, `visible_if
  {{ section.settings.enable_autoplay == true }}`. Only meaningful (and only
  shown) when autoplay is on.
- `scroll_speed` and `scroll_direction` also get `visible_if
  {{ section.settings.enable_autoplay == true }}` since they have no effect
  otherwise.

Settings are passed to the component as `data-autoplay` and
`data-hover-slowdown` attributes (stringified booleans, same pattern as the
existing `data-speed`/`data-direction`).

### 3. JS behavior (`assets/beconcept-homecarousel.js`)

- `connectedCallback()`: if `this.dataset.autoplay === 'false'`, return
  immediately without calling `gsap.matchMedia()` or `#buildLoop()`. The
  element keeps its default `overflow-auto` and the user gets native browser
  scroll — the same end state already produced today by the
  `prefers-reduced-motion` branch.
- `onItemEnter()` / `onItemLeave()`: early-return (in addition to the
  existing `!this.#tween` guard) when `this.dataset.hoverSlowdown ===
  'false'`, so the loop keeps its constant speed regardless of hover.
- No change to `#buildLoop`/`#teardownLoop`/resize handling.

## Out of scope

- No changes to scroll speed/direction logic itself.
- No changes to reduced-motion handling (still takes precedence: reduced
  motion always disables the loop regardless of `enable_autoplay`).
