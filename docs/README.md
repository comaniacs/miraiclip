# Miraiclip Docs

Documentation site built with [Hugo](https://gohugo.io/) and the [Hextra](https://imfing.github.io/hextra/) theme (via Hugo modules).

## Prerequisites

- Hugo **extended** v0.147+ (`brew install hugo`)
- Go (`brew install go`) — required for Hugo modules

## Develop

```bash
cd docs
hugo mod tidy   # first time only, downloads the Hextra theme
hugo server     # http://localhost:1313
```

## Build

```bash
hugo build      # outputs to docs/public/
```

To update the theme: `hugo mod get -u github.com/imfing/hextra`
