# Changelog

## 1.0.0 (2026-10-26)

- First release.
- Native mode: cross-document view transitions, with shared elements named only for the link that was followed, direction detection for Back and Forward, and speculation rules to prerender hovered pages.
- Soft mode for other browsers: fetch, swap the main content, update title and history, restore scroll on Back, prefetch on hover, and fall back to a normal page load on any error.
- Shared elements with `data-alih="key"`, carried across pages so an element can land wherever its key appears.
- Slide, fade, or no page animation; respects reduced motion.
- Demo gallery of ten static pages and eight generated prints.
- 18 tests, covering both modes in a real browser.
