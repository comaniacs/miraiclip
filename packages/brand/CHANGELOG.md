# @miraiclip/brand

## 0.2.0

### Minor Changes

- 63276db: `brandFromWebsite(url)`: a brand's identity from its public website, so a video can look and sound like the brand without anyone filling in a kit first. It reads the page and up to four of its stylesheets (fetch only, no DOM; run it on a server) and returns the name, tagline, description, colours (primary, secondary, accent, background and text, from CSS variables, `theme-color` and how often each colour is used), fonts with their role and, when they're on Google Fonts, a loadable woff2 `src`, the brand's own logo (scored by the brand's name and a place in the header; customers' logos from "trusted by" walls are skipped, and no logo is returned rather than a wrong one), the site's own images (share images and the photos and screenshots on the page, from `src`, lazy `data-src` and the largest `srcset` entry, with alt text and size; icons and tracking pixels skipped), `style` (light or dark look, button shape), samples of the site's own headlines, buttons and paragraphs for matching its voice, a ready `kit` when a primary colour was found, and `warnings` for what was missing (e.g. pages rendered by JavaScript). `publicUrl` refuses non-http(s) addresses, localhost, `.local`/`.internal` names and private or reserved IPs, also after redirects. `colorsIn` parses the colours in a CSS value.

### Patch Changes

- Updated dependencies [ba096e4]
- Updated dependencies [cdd6cf6]
- Updated dependencies [63276db]
- Updated dependencies [63276db]
- Updated dependencies [63276db]
- Updated dependencies [63276db]
  - @miraiclip/core@0.8.0
  - @miraiclip/registry@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [7477fe6]
  - @miraiclip/core@0.7.0
  - @miraiclip/registry@0.1.1

## 0.1.0

### Minor Changes

- fd07ee1: New packages: localization through any translator, and brand kits applied as commands.

### Patch Changes

- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
  - @miraiclip/registry@0.1.0
  - @miraiclip/core@0.6.0
