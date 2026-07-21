# Homepage Carousel Hover-Scope Fix + Autoplay/Hover-Slowdown Toggles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the homepage carousel's hover-slowdown effect to the actual image box (not the full grid row), and add two Theme Editor toggles: one to disable autoplay entirely (falling back to native scroll), one to disable the hover-slowdown effect.

**Architecture:** Two files change together and must land in one commit: `sections/beconcept-homecarousel.liquid` (moves the hover ref/listeners onto the image box div, adds two schema checkboxes plus `visible_if` gating on the existing speed/direction settings, and threads two new `data-*` attributes onto the custom element) and `assets/beconcept-homecarousel.js` (reads the two new `data-*` attributes to skip building the GSAP loop when autoplay is off, and to no-op the hover handlers when hover-slowdown is off).

**Tech Stack:** Shopify Liquid, GSAP (vendored, no bundler), native custom elements via `@theme/component`.

## Global Constraints

- No JS bundler — `assets/*.js` are hand-written ES modules; imports across files must go through the `@theme/*` import map in `snippets/scripts.liquid` (not needed for this change — no new shared imports).
- No automated JS test runner exists in this repo. Verification is: `node --check` for syntax, `npx shopify theme check --path .` for Liquid/theme-check lint, and manual verification via `npm run dev` (live store connection) in a browser.
- Always run `npx shopify theme check --path .` after touching any `.liquid` file.
- Reduced-motion handling must keep taking precedence: `gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', ...)` must still gate the loop even when autoplay is enabled.

---

### Task 1: Move hover target and add schema toggles + data attributes

**Files:**
- Modify: `sections/beconcept-homecarousel.liquid:1-11` (root custom element attributes)
- Modify: `sections/beconcept-homecarousel.liquid:62-77` (item markup — move hover ref/listeners)
- Modify: `sections/beconcept-homecarousel.liquid:102-146` (schema settings)

**Interfaces:**
- Produces: on the `<beconcept-homecarousel-component>` root element — `data-autoplay="{{ section.settings.enable_autoplay }}"` and `data-hover-slowdown="{{ section.settings.enable_hover_slowdown }}"` (string `"true"`/`"false"`, same pattern as the existing `data-speed`/`data-direction`). Task 2 reads these via `this.dataset.autoplay` / `this.dataset.hoverSlowdown`.
- Produces: `ref="items[]"`, `on:pointerenter="/onItemEnter"`, `on:pointerleave="/onItemLeave"` now live on the inner image-box `<div>` instead of the outer grid-row `<div>`. Task 2's `onItemEnter`/`onItemLeave` methods are unaffected by this move (the `Component` event system dispatches to the closest ancestor `Component` instance regardless of which descendant carries the `on:*` attribute).

- [ ] **Step 1: Add `data-autoplay` and `data-hover-slowdown` attributes to the root element**

In `sections/beconcept-homecarousel.liquid`, change:

```liquid
<beconcept-homecarousel-component
  class="min-h-screen h-screen overflow-auto relative"
  data-speed="{{ section.settings.scroll_speed }}"
  data-direction="{{ section.settings.scroll_direction }}"
>
```

to:

```liquid
<beconcept-homecarousel-component
  class="min-h-screen h-screen overflow-auto relative"
  data-speed="{{ section.settings.scroll_speed }}"
  data-direction="{{ section.settings.scroll_direction }}"
  data-autoplay="{{ section.settings.enable_autoplay }}"
  data-hover-slowdown="{{ section.settings.enable_hover_slowdown }}"
>
```

- [ ] **Step 2: Move the hover ref/listeners from the row div to the image-box div**

In the same file, change:

```liquid
            <div
              ref="items[]"
              on:pointerenter="/onItemEnter"
              on:pointerleave="/onItemLeave"
              data-element="{{ mod_index }}"
              class="grid grid-cols-24 gap-8 relative {{ gridmargintop }}"
            >
              <div class="{{ custom_classes }} overflow-hidden bg-gray-50 relative group">
```

to:

```liquid
            <div
              data-element="{{ mod_index }}"
              class="grid grid-cols-24 gap-8 relative {{ gridmargintop }}"
            >
              <div
                ref="items[]"
                on:pointerenter="/onItemEnter"
                on:pointerleave="/onItemLeave"
                class="{{ custom_classes }} overflow-hidden bg-gray-50 relative group"
              >
```

- [ ] **Step 3: Add the two new schema settings and gate the autoplay-dependent ones with `visible_if`**

In the same file's `{% schema %}` block, change the `settings` array from:

```json
  "settings": [
    {
      "type": "text",
      "id": "home_carousel_text",
      "label": "Text in overlay",
      "default": "Ceramics for gatherings"
    },
    {
      "type": "metaobject",
      "id": "home_carousel",
      "label": "Select gallery to show",
      "metaobject_type": "homepage_carousel"
    },
    {
      "type": "range",
      "id": "scroll_speed",
      "label": "Scroll speed (px per second)",
      "min": 10,
      "max": 200,
      "step": 5,
      "unit": "px",
      "default": 40
    },
    {
      "type": "select",
      "id": "scroll_direction",
      "label": "Scroll direction",
      "options": [
        { "value": "up", "label": "Bottom to top" },
        { "value": "down", "label": "Top to bottom" }
      ],
      "default": "up"
    }
  ],
```

to:

```json
  "settings": [
    {
      "type": "text",
      "id": "home_carousel_text",
      "label": "Text in overlay",
      "default": "Ceramics for gatherings"
    },
    {
      "type": "metaobject",
      "id": "home_carousel",
      "label": "Select gallery to show",
      "metaobject_type": "homepage_carousel"
    },
    {
      "type": "checkbox",
      "id": "enable_autoplay",
      "label": "Enable autoplay",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "enable_hover_slowdown",
      "label": "Slow down on hover",
      "default": true,
      "visible_if": "{{ section.settings.enable_autoplay == true }}"
    },
    {
      "type": "range",
      "id": "scroll_speed",
      "label": "Scroll speed (px per second)",
      "min": 10,
      "max": 200,
      "step": 5,
      "unit": "px",
      "default": 40,
      "visible_if": "{{ section.settings.enable_autoplay == true }}"
    },
    {
      "type": "select",
      "id": "scroll_direction",
      "label": "Scroll direction",
      "options": [
        { "value": "up", "label": "Bottom to top" },
        { "value": "down", "label": "Top to bottom" }
      ],
      "default": "up",
      "visible_if": "{{ section.settings.enable_autoplay == true }}"
    }
  ],
```

- [ ] **Step 4: Lint the Liquid changes**

Run: `npx shopify theme check --path .`
Expected: no new errors/warnings introduced by `sections/beconcept-homecarousel.liquid` (pre-existing unrelated warnings elsewhere in the theme, if any, are not in scope).

- [ ] **Step 5: Commit**

```bash
git add sections/beconcept-homecarousel.liquid
git commit -m "Scope carousel hover-slowdown to image box, add autoplay/hover-slowdown toggles"
```

---

### Task 2: Read the new data attributes in the component

**Files:**
- Modify: `assets/beconcept-homecarousel.js:34-65`

**Interfaces:**
- Consumes: `this.dataset.autoplay` and `this.dataset.hoverSlowdown` (string `"true"`/`"false"`) produced by Task 1's `data-autoplay`/`data-hover-slowdown` attributes.
- Produces: no new public methods; `onItemEnter()`/`onItemLeave()` keep their existing names and no-arg signatures (already wired via `on:pointerenter`/`on:pointerleave` from Task 1's markup).

- [ ] **Step 1: Skip building the loop when autoplay is disabled**

In `assets/beconcept-homecarousel.js`, change:

```js
  connectedCallback() {
    super.connectedCallback();

    this.#mm = gsap.matchMedia();
    this.#mm.add('(prefers-reduced-motion: no-preference)', () => {
```

to:

```js
  connectedCallback() {
    super.connectedCallback();

    if (this.dataset.autoplay === 'false') return;

    this.#mm = gsap.matchMedia();
    this.#mm.add('(prefers-reduced-motion: no-preference)', () => {
```

- [ ] **Step 2: No-op the hover handlers when hover-slowdown is disabled**

In the same file, change:

```js
  onItemEnter() {
    if (!this.#tween) return;
    gsap.to(this.#tween, { timeScale: HOVER_TIME_SCALE, duration: HOVER_TRANSITION_DURATION, overwrite: true });
  }

  onItemLeave() {
    if (!this.#tween) return;
    gsap.to(this.#tween, { timeScale: 1, duration: HOVER_TRANSITION_DURATION, overwrite: true });
  }
```

to:

```js
  onItemEnter() {
    if (!this.#tween || this.dataset.hoverSlowdown === 'false') return;
    gsap.to(this.#tween, { timeScale: HOVER_TIME_SCALE, duration: HOVER_TRANSITION_DURATION, overwrite: true });
  }

  onItemLeave() {
    if (!this.#tween || this.dataset.hoverSlowdown === 'false') return;
    gsap.to(this.#tween, { timeScale: 1, duration: HOVER_TRANSITION_DURATION, overwrite: true });
  }
```

- [ ] **Step 3: Check JS syntax**

Run: `node --check assets/beconcept-homecarousel.js`
Expected: no output (exit code 0).

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev` (connects to the live `umbraceramics.myshopify.com` store; requires the store password already hardcoded in the script).

In the Theme Editor, on the Homepage Carousel section:
1. With "Enable autoplay" on and "Slow down on hover" on (defaults): confirm the carousel scrolls continuously, hovering an image slows it down, and hovering the empty grid gutter between images does *not* slow it down.
2. Turn "Slow down on hover" off: confirm the carousel keeps scrolling at constant speed even while hovering an image.
3. Turn "Enable autoplay" off: confirm "Slow down on hover" disappears from the settings panel, the carousel stops auto-scrolling, and the container can be scrolled manually (native scroll/scrollbar).
4. Turn "Enable autoplay" back on: confirm the loop resumes.

- [ ] **Step 5: Commit**

```bash
git add assets/beconcept-homecarousel.js
git commit -m "Respect autoplay/hover-slowdown toggles in homecarousel component"
```
