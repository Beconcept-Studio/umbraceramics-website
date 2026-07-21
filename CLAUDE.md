# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Shopify theme for umbraceramics.myshopify.com, forked from Shopify's **Horizon** theme (the successor to Dawn — see the `dawn` CI badge left over in `package.json`). Custom sections/blocks/snippets/assets prefixed `beconcept-` are project-specific additions on top of the stock Horizon theme; everything else is theme boilerplate.

## Commands

```bash
npm run dev    # watches src/tailwind.css -> assets/tailwind.css AND runs `shopify theme dev` against the live store
npm run build  # one-off minified Tailwind build (src/tailwind.css -> assets/tailwind.css)
npm run pull   # shopify theme pull --store=umbraceramics.myshopify.com
npm run push   # shopify theme push --store=umbraceramics.myshopify.com
```

- `npm run dev` connects to `--store=umbraceramics.myshopify.com` with a hardcoded `--store-password`. There is no local/offline dev server — theme preview requires this live store connection.
- Lint/validate Liquid with `npx shopify theme check --path .` (Shopify CLI is a project devDependency-adjacent tool available via `npx`/global install). Always run this after touching any `.liquid` file — it catches things like missing `width`/`height` on `<img>`, orphaned snippets, and scoped-CSS-class issues.
- Check JS syntax quickly with `node --check assets/<file>.js` (there is no JS test runner, linter, or bundler configured in this repo).
- There are no automated tests in this repo.

## CSS build pipeline

CSS is the **only** asset with a build step:
- `src/tailwind.css` is the source (Tailwind v4, via `@tailwindcss/cli`) — this is the file to edit.
- `assets/tailwind.css` is the **compiled output** — do not hand-edit it, it will be overwritten by `npm run build`/`npm run dev`.
- `src/tailwind.css` also defines custom `@utility` extensions (e.g. `col-span-13..24`, `col-start-14..25`) needed because the homepage carousel grid uses a 24-column grid, beyond Tailwind's built-in 12-column max.

## JS architecture — no bundler

There is **no JS bundler** (no webpack/vite/esbuild/rollup config anywhere). All JS in `assets/*.js` is hand-written, unbundled ES modules served as-is from Shopify's asset CDN, wired together via a native browser **import map** declared in `snippets/scripts.liquid`. Bare specifiers like `@theme/component`, `@theme/utilities`, `gsap` resolve to `{{ 'file.js' | asset_url }}` entries in that import map — when adding a new shared module, register it there rather than using relative import paths across different asset files (relative imports only work reliably between files that are siblings in the flat `assets/` directory, which happens to be true here but is fragile — prefer the import map for anything meant to be reused).

Key shared modules (all under `assets/`, all imported via `@theme/*` specifiers):
- **`component.js`** — exports `Component`, the base class nearly every custom element in this theme extends. It auto-wires descendant elements with a `ref="name"` (or `ref="name[]"` for a collection) attribute into `this.refs`, throws if a name listed in `requiredRefs` is missing, and re-syncs refs via a `MutationObserver` when the DOM changes (including after Shopify's Section Rendering API morphs a section in place — see `updatedCallback()`). It also implements a **declarative event system**: any element with an `on:click="/methodName"` (or `on:pointerenter`, `on:change`, etc.) attribute has that event delegated via a single document-level listener to the named method on the closest ancestor `Component` instance (or on `document.querySelector(selector)` if the attribute value is `selector/methodName`). Prefer `on:*` attributes over manual `addEventListener` in new components, for consistency.
- **`utilities.js`** — grab-bag of shared helpers: `debounce`/`throttle`, `prefersReducedMotion()`, `mediaQueryLarge` (750px breakpoint) / `isMobileBreakpoint()` / `isDesktopBreakpoint()`, `ResizeNotifier` (a `ResizeObserver` subclass that skips the initial synchronous callback), scroll-lock helpers, View Transition helpers, and more. Check here before writing a new helper.
- **`section-renderer.js`** / **`section-hydration.js`** / **`morph.js`** — implement Shopify's Section Rendering API (fetching updated section HTML and morphing it into the DOM in place, e.g. on cart/variant changes) without a full page reload. Any custom element that needs to survive this must implement `updatedCallback()` correctly (handled for free if it just extends `Component` and doesn't hold stale references).
- Naming convention: JS files that implement a custom element are typically named after the tag they define (e.g. `marquee.js` defines `marquee-component`), and `customElements.define(...)` calls are guarded with `if (!customElements.get('tag-name'))`.

**GSAP**: `gsap` (v3, core only — no plugins) is vendored manually into `assets/gsap.js`, `assets/gsap-core.js`, `assets/CSSPlugin.js` (verbatim copies from `node_modules/gsap`, since there's no bundler to pull it in) and registered in the import map as the bare specifier `"gsap"`. To upgrade: bump the `gsap` version in `package.json`, `npm install`, then re-copy those three files from `node_modules/gsap` (filenames `gsap-core.js`/`CSSPlugin.js` must stay unchanged — `gsap.js`'s relative imports depend on them). Use `gsap.matchMedia()` for anything that must respect `prefers-reduced-motion` or a breakpoint, since it auto-reverts tweens/observers when the query stops matching.

`snippets/scripts.liquid` is the single place that declares the import map and most global `<script type="module">`/`modulepreload` tags for `layout/theme.liquid`. Section-specific scripts (e.g. a custom element used by only one section) are instead loaded directly inside that section's `.liquid` file via `<script src="{{ 'x.js' | asset_url }}" type="module" fetchpriority="low"></script>`.

## Liquid structure

Standard Shopify theme layout (`layout/`, `sections/`, `blocks/`, `snippets/`, `templates/`, `config/`, `locales/`). `sections/section.liquid` is the generic wrapper (background/spacing/border) most native-schema sections use — but not all; some sections (e.g. `beconcept-homecarousel.liquid`) are fully self-contained and skip it. Project-specific sections/blocks are prefixed `beconcept-` to distinguish them from stock Horizon files during future theme upgrades/merges.

Custom-element root tags in section markup carry their own `{% stylesheet %}` block setting `display: block` (custom elements default to `display: inline`), matching the pattern in `sections/marquee.liquid`.
