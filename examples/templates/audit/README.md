# Audit · the React studio's 67 built-in templates

Done 23 Oct 2026 against `miraiclip-react-template` main (`8e302b7`). Each template was hydrated with its defaults, opened in the studio, and captured at 30 %, 60 % and 90 % of its length (`sheets/sheet-01…09.png`). Motion and design are scored 1–5 against the launch film (example 1, motion 5).

## Findings

- **They are scenes, not videos.** All 67 run 4–12 s in one format; only two (Product explainer, Feature reel) have more than one scene. None has a 16:9 and 9:16 pair from one source.
- **Two families, very different motion.** The 29 *motion* templates (showcases, product demos, social overlays) animate inside their HTML and progress through the shot: average motion 3.6. The 38 *SaaS and classic* templates have no animated HTML at all; one keyframe entrance, then the frame holds, so their 30/60/90 % frames are identical: average motion 2.2.
- **Design is solid across the board** (mostly 3–4), with a consistent fictional brand (Northwind), so upgrades are about motion, not redesign.
- **Duplicates:** four stats, four review/quote cards, three pricing, two "Trusted by", two "Launch countdown" (same name), several phone promos. Eight are marked Merge.
- **Naming:** `outfit-showcase` is called "App walkthrough", next to "App walkthrough (taps)".

## Verdicts

| Verdict | Count | What it means |
| --- | --- | --- |
| Keep | 33 | Good enough as scenes and building blocks; all product demos and most showcases and overlays |
| Upgrade | 25 | Good layout, static motion: apply example 1's motion kit (spring/expo, exits, camera push, sequential reveals) |
| Merge | 8 | Duplicate of a stronger template; fold its useful fields into that one and drop it |
| Rename | 1 | `outfit-showcase` |

## Backlog coverage

| # | Backlog example | Built-ins that cover it | Status |
| --- | --- | --- | --- |
| 1 | Launch film | Example 1 (done); Kinetic launch, Product launch, Launch countdown as scenes | Done |
| 3 | Feature drop | Bento features, Feature spotlight, Feature trio, Integrations, Feature reel | Assemble from upgraded scenes |
| 4 | What's new / changelog | What's new (static) | Upgrade, then build the film |
| 5 | Product tour | Spotlight tour, Feature hotspots, Automation run, App walkthrough (taps) | Strong already: assemble |
| 6 | AI agent demo | AI assistant demo, Command palette | Strong already: assemble |
| 7 | Terminal / CLI | Code to deploy | Strong already: extend |
| 8 | Talking head + karaoke captions | — | Gap: build new |
| 9 | Metrics reel | Stats that count, Live dashboard, Growth chart | Assemble; merge the weaker stats |
| 10 | Testimonial wall | Review wall, Trusted by (marquee), Customer story | Assemble; merge duplicates |
| 11 | Startup pitch | — | Gap: build new |
| 12 | Logo sting + end card | Brand intro, Free trial end card, End screen | Upgrade end cards |

## Full table

| Template (id) | Name | Category | Format | Length | Fields | Motion | Design | Verdict | Note | Backlog slot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `end-screen` | End screen | ending | 16:9 | 6 s | 6 | 2 | 3 | Upgrade | Static | 12 End card |
| `saas-free-trial` | Free trial end card | ending | 16:9 | 5 s | 10 | 2 | 3 | Upgrade | Static end card | 12 End card |
| `saas-event-square` | Event announcement | events | 1:1 | 6 s | 12 | 2 | 3 | Upgrade | Static | — |
| `saas-webinar` | Webinar promo | events | 16:9 | 7 s | 13 | 2 | 3 | Upgrade | Static | — |
| `saas-explainer` | Product explainer | features | 16:9 | 12 s | 15 | 3 | 3 | Upgrade | Only multi-scene template (12 s, 2 transitions); scenes hold | 1 Launch |
| `saas-feature-spotlight` | Feature spotlight | features | 16:9 | 7 s | 11 | 2 | 4 | Upgrade | Static after entrance | 3 Feature drop |
| `saas-feature-trio` | Feature trio | features | 16:9 | 6 s | 11 | 2 | 3 | Upgrade | Static after entrance | 3 Feature drop |
| `saas-how-it-works` | How it works | features | 16:9 | 6 s | 14 | 2 | 3 | Upgrade | Static after entrance; steps could draw in sequence | 5 Product tour |
| `saas-integrations` | Integrations | features | 16:9 | 6 s | 8 | 2 | 4 | Upgrade | Static; orbit should rotate | 3 Feature drop |
| `saas-changelog` | What's new | launch | 16:9 | 6 s | 7 | 2 | 3 | Upgrade | Static list; the reference's changelog template is its headline Pro item | 4 What's new |
| `saas-product-launch` | Product launch | launch | 16:9 | 8 s | 13 | 2 | 4 | Upgrade | Static after entrance; good layout | 1 Launch |
| `saas-growth-chart` | Growth chart | metrics | 16:9 | 6 s | 19 | 2 | 4 | Upgrade | Bars appear at once; should grow in sequence | 9 Metrics reel |
| `product-promo` | Product promo | pricing | 16:9 | 8 s | 11 | 2 | 3 | Upgrade | Static sale card | — |
| `saas-pricing-card` | Plan spotlight | pricing | 9:16 | 6 s | 17 | 2 | 3 | Upgrade | Static 9:16 plan card | — |
| `saas-promo-code` | Promo code | pricing | 1:1 | 5 s | 10 | 2 | 3 | Upgrade | Static; code could type/flip | — |
| `saas-case-study` | Case study | proof | 1:1 | 6 s | 8 | 2 | 3 | Upgrade | Static; 3× could count | 10 Testimonial wall |
| `saas-comparison` | Us vs them | proof | 16:9 | 6 s | 12 | 2 | 3 | Upgrade | Static; ticks could land row by row | — |
| `saas-testimonial` | Customer story | proof | 16:9 | 7 s | 7 | 2 | 3 | Upgrade | Static quote card | 10 Testimonial wall |
| `show-kinetic-launch` | Kinetic launch | showcases | 16:9 | 8 s | 14 | 3 | 4 | Upgrade | Holds still after 2 s; same idea as example 1's hook | 1 Launch |
| `show-kinetic-vertical` | Kinetic headline | showcases | 9:16 | 5.5 s | 12 | 3 | 4 | Upgrade | 9:16 twin of Kinetic launch; holds after entrance | 1 Launch |
| `reel-hook` | Reel hook | social | 9:16 | 6 s | 6 | 2 | 3 | Upgrade | Static after hook | 3 Feature drop |
| `saas-feature-reel` | Feature reel | social | 9:16 | 12 s | 14 | 3 | 3 | Upgrade | Multi-scene 9:16 reel; phones hold | 3 Feature drop |
| `saas-hiring` | We're hiring | social | 1:1 | 6 s | 11 | 2 | 3 | Upgrade | Static | — |
| `saas-social-ad` | Product ad | social | 1:1 | 7 s | 9 | 2 | 3 | Upgrade | Static | 1 Launch |
| `tips-list` | 3 tips | social | 9:16 | 8 s | 9 | 2 | 3 | Upgrade | Static list | — |
| `saas-app-promo` | App promo | launch | 9:16 | 7 s | 7 | 2 | 3 | Merge | Same as App showcase, static | 5 Product tour |
| `saas-launch-countdown` | Launch countdown | launch | 9:16 | 6 s | 16 | 2 | 3 | Merge | Same name and job as Launch countdown (showcase); digits don't tick | 1 Launch |
| `saas-metrics` | KPI highlights | metrics | 16:9 | 6 s | 14 | 2 | 3 | Merge | Same job as Stats that count, numbers don't count | 9 Metrics reel |
| `stat-highlight` | Stat highlight | metrics | 16:9 | 5 s | 5 | 2 | 2 | Merge | Number doesn't count; fourth stats template | 9 Metrics reel |
| `saas-pricing-tiers` | Pricing tiers | pricing | 16:9 | 6 s | 14 | 2 | 3 | Merge | Same job as Pricing toggle, weaker; placeholder lines | — |
| `quote-card` | Quote card | proof | 1:1 | 6 s | 4 | 2 | 3 | Merge | Fourth quote/review card | 10 Testimonial wall |
| `saas-logo-wall` | Trusted by | proof | 16:9 | 5 s | 15 | 2 | 3 | Merge | Same job as Trusted by (marquee), static | 10 Testimonial wall |
| `testimonial` | Review card | proof | 1:1 | 6 s | 8 | 2 | 3 | Merge | Third review card | 10 Testimonial wall |
| `outfit-showcase` | App walkthrough | social | 9:16 | 10 s | 13 | 3 | 3 | Rename | Id says outfit, name says App walkthrough, clashing with App walkthrough (taps) | 5 Product tour |
| `brand-intro` | Brand intro | intro | 16:9 | 6 s | 6 | 3 | 4 | Keep | Logo and wordmark animate and fade | 12 Logo sting |
| `chapter-card` | Chapter card | intro | 16:9 | 4 s | 5 | 2 | 3 | Keep | Simple, does its job | — |
| `news-bulletin` | News bulletin | intro | 16:9 | 6 s | 5 | 2 | 3 | Keep | Lower-third style; simple | Lower thirds |
| `interview-lower-third` | Interview lower third | lower-third | 16:9 | 6 s | 4 | 3 | 3 | Keep | In and out | Lower thirds |
| `webinar-lower-third` | Speaker card | lower-third | 16:9 | 6 s | 5 | 3 | 3 | Keep | In and out | Lower thirds |
| `demo-ai-assistant` | AI assistant demo | product-demos | 16:9 | 8 s | 12 | 4 | 4 | Keep | Typed prompt → streamed answer → chart | 6 AI agent demo |
| `demo-code-deploy` | Code to deploy | product-demos | 16:9 | 7.5 s | 8 | 4 | 4 | Keep | Code types, deploy log runs, URL pops | 7 Terminal / CLI |
| `demo-command-palette` | Command palette | product-demos | 16:9 | 6 s | 9 | 4 | 4 | Keep | Typed command → result toast | 6 AI agent demo |
| `demo-dashboard-build` | Live dashboard | product-demos | 16:9 | 6.5 s | 14 | 4 | 4 | Keep | Numbers and chart build live | 9 Metrics reel |
| `demo-hotspots` | Feature hotspots | product-demos | 16:9 | 6.5 s | 7 | 4 | 4 | Keep | Hotspots appear one by one | 5 Product tour |
| `demo-phone-taps` | App walkthrough (taps) | product-demos | 9:16 | 7 s | 11 | 4 | 4 | Keep | Taps walk an app screen | 5 Product tour |
| `demo-spotlight-tour` | Spotlight tour | product-demos | 16:9 | 8 s | 6 | 4 | 4 | Keep | Spotlight walks three regions with captions | 5 Product tour |
| `demo-workflow` | Automation run | product-demos | 16:9 | 6.5 s | 9 | 4 | 4 | Keep | Steps tick through, run completes | 5 Product tour |
| `show-app-card` | App showcase | showcases | 1:1 | 6 s | 10 | 3 | 4 | Keep | Callouts settle, then holds | 5 Product tour |
| `show-bento` | Bento features | showcases | 16:9 | 6.5 s | 18 | 3 | 4 | Keep | Strong layout; counters and ring tick, rest holds | 3 Feature drop |
| `show-countdown` | Launch countdown | showcases | 9:16 | 7.2 s | 10 | 4 | 4 | Keep | Countdown ring → Now live | 1 Launch |
| `show-logo-marquee` | Trusted by | showcases | 16:9 | 6 s | 6 | 4 | 4 | Keep | Two marquee rows scroll | 10 Testimonial wall |
| `show-pricing-toggle` | Pricing toggle | showcases | 16:9 | 6.5 s | 14 | 4 | 4 | Keep | Toggle flips every price: real progression | — |
| `show-review-wall` | Review wall | showcases | 16:9 | 7 s | 6 | 4 | 4 | Keep | Tilted wall drifts the whole time | 10 Testimonial wall |
| `show-stats` | Stats that count | showcases | 16:9 | 6 s | 16 | 4 | 4 | Keep | Rings fill and numbers count | 9 Metrics reel |
| `saas-notifications` | Sales notifications | social | 9:16 | 6 s | 13 | 3 | 3 | Keep | Cards stack in | — |
| `overlay-channel-lower-third` | Subscribe lower third | social-overlays | 16:9 | 5.5 s | 5 | 4 | 3 | Keep | Cursor clicks Subscribe → Subscribed | Overlays |
| `overlay-chat-thread` | Message thread | social-overlays | 9:16 | 6.5 s | 7 | 4 | 3 | Keep | Messages arrive one by one | Overlays |
| `overlay-comment-stack` | Comment stack | social-overlays | 9:16 | 5.5 s | 13 | 3 | 3 | Keep | Overlay; comments stack | Overlays |
| `overlay-desktop-notification` | Desktop notification | social-overlays | 16:9 | 4.5 s | 6 | 3 | 3 | Keep | Overlay; slides in, holds | Overlays |
| `overlay-editorial-flash` | Editorial flash | social-overlays | 16:9 | 5 s | 7 | 3 | 4 | Keep | Bold type; holds after entrance | Overlays |
| `overlay-follow-card` | Follow card | social-overlays | 9:16 | 4.5 s | 6 | 3 | 3 | Keep | Overlay for footage; small card | Overlays |
| `overlay-forum-post` | Forum post | social-overlays | 9:16 | 6 s | 10 | 3 | 3 | Keep | Overlay; vote count ticks | Overlays |
| `overlay-live` | Live stream | social-overlays | 9:16 | 8 s | 7 | 4 | 3 | Keep | Viewer count and chat keep moving | Overlays |
| `overlay-now-playing` | Now playing | social-overlays | 9:16 | 6 s | 8 | 3 | 3 | Keep | Overlay; progress bar moves | Overlays |
| `overlay-post-card` | Post card | social-overlays | 9:16 | 5.5 s | 10 | 3 | 3 | Keep | Overlay; like count changes | Overlays |
| `overlay-post-card-dark` | Post card (dark) | social-overlays | 16:9 | 5.5 s | 10 | 3 | 3 | Keep | 16:9 twin of Post card | Overlays |
| `overlay-short-follow` | Follow prompt | social-overlays | 9:16 | 5 s | 7 | 3 | 3 | Keep | Overlay; follower count ticks | Overlays |