---
"@miraiclip/core": patch
---

Audio groundwork. Assets accept optional `name`, `source` (`{ provider, id, url? }`), `license` (`{ id, url?, commercial, attributionRequired }`) and `attribution`, editable with the new `asset/set-property` command (`null` clears). Video and audio clips accept `fadeInUs` / `fadeOutUs` (on `clip/add` and `clip/set-property`); `clip/split` keeps the fade-in on the left half and the fade-out on the right. New pure helpers `usedAssets`, `creditsFor` and `licenseReport`. `describeProject` shows asset names, licenses, clip volume and fades.
