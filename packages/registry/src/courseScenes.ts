/**
 * Course scenes: for course, class, bootcamp, workshop and program promos.
 * They speak the language of learning rather than of a product launch: a
 * programme title with its level and length, a syllabus that ticks off
 * module by module, a lesson playing in a player frame, the projects you'll
 * build, the instructor, the skills and certificate you leave with, and an
 * enrolment card to close.
 *
 * Same fields as the other film scenes (brand / style tokens, `look`,
 * `display` for titles). The backdrop is a faint notebook grid instead of
 * the launch scenes' floating UI and colour blobs; the camera drifts slowly
 * and each scene ends with a short fade, so scenes join with a dissolve.
 */
import type { BlockField, BlockInput } from "./types.js";
import { imageField as image, SCENE_COMMON, SCENE_CSS, SCENE_ROOT_OPEN, SECOND as S, textField as text } from "./scenes.js";

/** Same as DISPLAY_FIELD in docScenes.ts (kept here to avoid an import cycle). */
const DISPLAY: BlockField = text("display", "Title font", "Playfair Display", "A font family name the project has (a font asset), used for titles.");
const COURSE_COMMON: BlockField[] = [...SCENE_COMMON, DISPLAY];

const COURSE_CSS = `@keyframes cs-fadeout{to{opacity:0}}
@keyframes cs-pan{from{transform:translate(0,0)}to{transform:translate(-6cqmin,-3cqmin)}}
@keyframes cs-in{from{opacity:0;transform:translateY(3cqmin)}}
@keyframes cs-left{from{opacity:0;transform:translateX(-6cqmin)}}
@keyframes cs-pop{0%{opacity:0;transform:scale(.6)}70%{opacity:1;transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes cs-draw{from{transform:scaleX(0)}}
@keyframes cs-drawy{from{transform:scaleY(0)}}
@keyframes cs-tick{from{stroke-dashoffset:24}to{stroke-dashoffset:0}}
.cs-grid{position:absolute;inset:-10cqmin;background-image:linear-gradient(var(--line) .12cqmin,transparent .12cqmin),linear-gradient(90deg,var(--line) .12cqmin,transparent .12cqmin);background-size:7cqmin 7cqmin;opacity:.55;-webkit-mask-image:radial-gradient(ellipse at 50% 45%,#000 20%,transparent 75%);mask-image:radial-gradient(ellipse at 50% 45%,#000 20%,transparent 75%);animation:cs-pan var(--T) linear both;--d:0s}
.cs-exit{position:absolute;inset:0;animation:cs-fadeout .4s ease-in both;--d:calc(var(--T) - .4s)}
.cs-cam{position:absolute;inset:0;animation:ls-push var(--T) cubic-bezier(.35,0,.25,1) both;--d:0s}
.cs-disp{font-family:'{{display}}','{{font}}',Georgia,serif}
.cs-kick{display:inline-flex;align-items:center;gap:1.2cqmin;font-size:3cqmin;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--p)}
.cs-kick::before{content:"";width:4cqmin;height:.4cqmin;background:var(--p);border-radius:1cqmin}
.cs-card{background:color-mix(in srgb,var(--bg) 82%,var(--ink) 4%);border:.15cqmin solid var(--line);border-radius:2.4cqmin;box-shadow:0 2.4cqmin 7cqmin color-mix(in srgb,var(--ink) 10%,transparent)}
.cs-pad{position:absolute;inset:0;padding:12cqh 9cqw;display:flex;flex-direction:column;justify-content:center}`;

/** A course scene: root, grid backdrop, slow camera, short fade out. */
const courseScene = (body: string, extraCss = ""): string =>
  `${SCENE_ROOT_OPEN}<style>${SCENE_CSS}${COURSE_CSS}${extraCss}</style><div class="cs-exit"><div class="cs-grid"></div><div class="cs-cam">${body}</div></div></div>`;

const tags = (...rest: string[]) => ["format:course", "course", "education", ...rest];
const TICK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="24"/></svg>`;

export const COURSE_SCENES: BlockInput[] = [
  // ------------------------------------------------------------------ programme title
  {
    name: "scene-course-title",
    title: "Scene — course title",
    description:
      "Names the course: a kicker (the provider or programme type, e.g. 'Nanodegree program'), the course title set large, and three facts that pop in as pills (level, length, format: 'Intermediate', '4 months', 'Mentor-led'). Use the course's real details. Title ≤ ~32 characters. 4.5 s.",
    category: "scene",
    tags: tags("title", "programme", "opener"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("kicker", "Kicker", "Nanodegree program"), text("title", "Course title", "Agentic AI Engineering"), text("meta1", "Fact 1", "Intermediate"), text("meta2", "Fact 2", "4 months"), text("meta3", "Fact 3", "Mentor-led"), ...COURSE_COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 4.5 * S,
      template: courseScene(
        `<div class="cs-pad"><div class="cs-kick" style="--d:.15s;animation:cs-left .7s cubic-bezier(.16,1,.3,1) both">{{kicker}}</div>
<div class="cst-t cs-disp" style="--d:.35s">{{title}}</div>
<div class="cst-r" style="--d:1s"></div>
<div class="cst-m"><span style="--d:1.3s">{{meta1}}</span><span style="--d:1.45s">{{meta2}}</span><span style="--d:1.6s">{{meta3}}</span></div></div>`,
        `.cst-t{margin-top:3cqmin;max-width:150cqmin;font-size:min(15cqmin,11cqw);font-weight:600;letter-spacing:-.03em;line-height:1;text-wrap:balance;animation:ls-rise 1s cubic-bezier(.16,1,.3,1) both}
.cst-r{width:min(60cqmin,70cqw);height:.5cqmin;margin:4.5cqmin 0 4cqmin;background:linear-gradient(90deg,var(--p),var(--s));border-radius:1cqmin;transform-origin:left;animation:cs-draw 1s cubic-bezier(.16,1,.3,1) both}
.cst-m{display:flex;flex-wrap:wrap;gap:2cqmin}
.cst-m span{padding:1.6cqmin 3.2cqmin;border-radius:999px;border:.18cqmin solid var(--line);background:var(--card);font-size:4cqmin;font-weight:600;animation:cs-pop .5s cubic-bezier(.16,1,.3,1) both}`,
      ),
    },
  },
  // ------------------------------------------------------------------ syllabus
  {
    name: "scene-course-syllabus",
    title: "Scene — syllabus",
    description:
      "What the course covers, module by module: a heading on the left, and four module rows that slide in one after another with their length, each ticked off as a progress rail runs down beside them. Real module names from the course (≤ ~28 characters each); lengths like '2 weeks' or '6 lessons' (may be empty). 5 s.",
    category: "scene",
    tags: tags("syllabus", "curriculum", "modules", "what you'll learn"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [
      text("title", "Heading", "What you'll learn"),
      text("m1", "Module 1", "Agent fundamentals"),
      text("t1", "Length 1", "2 weeks"),
      text("m2", "Module 2", "Tools and APIs"),
      text("t2", "Length 2", "3 weeks"),
      text("m3", "Module 3", "Planning and memory"),
      text("t3", "Length 3", "3 weeks"),
      text("m4", "Module 4", "Multi-agent systems"),
      text("t4", "Length 4", "4 weeks"),
      ...COURSE_COMMON,
    ],
    content: {
      kind: "html",
      animated: true,
      durationUs: 5 * S,
      template: courseScene(
        `<div class="csy"><div class="csy-h"><div class="cs-kick" style="--d:.1s;animation:ls-fade .6s ease both">Syllabus</div><div class="csy-t cs-disp" style="--d:.2s">{{title}}</div></div>
<div class="csy-l"><i class="csy-rail" style="--d:.6s"></i>
<div class="csy-m" style="--d:.45s"><b style="--d:1s">${TICK}</b><span class="csy-n">01</span><span class="csy-x">{{m1}}</span><em>{{t1}}</em></div>
<div class="csy-m" style="--d:.7s"><b style="--d:1.6s">${TICK}</b><span class="csy-n">02</span><span class="csy-x">{{m2}}</span><em>{{t2}}</em></div>
<div class="csy-m" style="--d:.95s"><b style="--d:2.2s">${TICK}</b><span class="csy-n">03</span><span class="csy-x">{{m3}}</span><em>{{t3}}</em></div>
<div class="csy-m" style="--d:1.2s"><b style="--d:2.8s">${TICK}</b><span class="csy-n">04</span><span class="csy-x">{{m4}}</span><em>{{t4}}</em></div></div></div>`,
        `.csy{position:absolute;inset:0;display:flex;align-items:center;gap:7cqw;padding:0 8cqw}
.csy-h{flex:0 0 34%}
.csy-t{margin-top:2.4cqmin;font-size:10.4cqmin;font-weight:600;letter-spacing:-.03em;line-height:1.02;animation:ls-rise .9s cubic-bezier(.16,1,.3,1) both}
.csy-l{position:relative;flex:1;display:flex;flex-direction:column;gap:2cqmin}
.csy-rail{position:absolute;left:3.6cqmin;top:4cqmin;bottom:4cqmin;width:.4cqmin;background:var(--p);border-radius:1cqmin;transform-origin:top;animation:cs-drawy 2.4s linear both}
.csy-m{position:relative;display:flex;align-items:center;gap:2.4cqmin;padding:2.4cqmin 3cqmin 2.4cqmin 1.6cqmin;border-radius:2cqmin;background:var(--card);border:.15cqmin solid var(--line);animation:cs-in .7s cubic-bezier(.16,1,.3,1) both}
.csy-m b{position:relative;flex:none;display:grid;place-items:center;width:5.2cqmin;height:5.2cqmin;border-radius:50%;background:var(--p);color:var(--onp);animation:cs-pop .4s cubic-bezier(.16,1,.3,1) both}
.csy-m b svg{width:2.8cqmin;height:2.8cqmin}
.csy-m b path{animation:cs-tick .4s ease-out both}
.csy-n{font-size:2.6cqmin;font-weight:700;letter-spacing:.12em;color:var(--mut)}
.csy-x{flex:1;font-size:5.2cqmin;font-weight:600;letter-spacing:-.02em}
.csy-m em{font-style:normal;font-size:3.3cqmin;color:var(--mut);white-space:nowrap}
@container (max-aspect-ratio:1/1){.csy{flex-direction:column;align-items:stretch;justify-content:center;gap:5cqmin}.csy-h,.csy-l{flex:none}}`,
      ),
    },
  },
  // ------------------------------------------------------------------ lesson
  {
    name: "scene-course-lesson",
    title: "Scene — lesson in a player",
    description:
      "A moment from a lesson: the picture plays inside a video-player frame (it drifts slowly; the progress bar runs), with a chip naming the lesson ('Lesson 3 · Tool use') and a one-line caption of what you learn there. The image must show the subject (from the user, the course's site, find_images or generate_image). Caption ≤ ~60 characters. 5 s.",
    category: "scene",
    tags: tags("lesson", "video", "player", "image", "preview"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [image("image", "Image"), text("chapter", "Lesson chip", "Lesson 3 · Tool use"), text("caption", "Caption", "Give your agent real tools: search, code, APIs."), ...COURSE_COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 5 * S,
      template: courseScene(
        `<div class="csl"><div class="csl-p cs-card" style="--d:.05s"><div class="csl-v"><img src="asset:{{image}}"/></div>
<div class="csl-c"><i class="csl-play"></i><div class="csl-bar"><i style="--d:.4s"></i></div><span>12:40</span></div></div>
<div class="csl-k" style="--d:.6s">{{chapter}}</div>
<div class="csl-t cs-disp" style="--d:.9s">{{caption}}</div></div>`,
        `@keyframes csl-kb{from{transform:scale(1.04)}to{transform:scale(1.16) translate(-2%,-1%)}}
@keyframes csl-run{from{transform:scaleX(.08)}to{transform:scaleX(.62)}}
@keyframes csl-up{from{opacity:0;transform:translateY(5cqmin) scale(.96)}}
.csl{position:absolute;inset:0;display:grid;grid-template-columns:1.5fr 1fr;align-items:center;gap:5cqw;padding:0 7cqw}
.csl-p{overflow:hidden;padding:0;animation:csl-up .9s cubic-bezier(.16,1,.3,1) both}
.csl-v{aspect-ratio:16/9;overflow:hidden;border-radius:2.4cqmin 2.4cqmin 0 0}
.csl-v img{display:block;width:100%;height:100%;object-fit:cover;animation:csl-kb var(--T) linear both;--d:0s}
.csl-c{display:flex;align-items:center;gap:2cqmin;padding:1.8cqmin 2.4cqmin;font-size:2.4cqmin;color:var(--mut)}
.csl-play{width:0;height:0;border-left:2.2cqmin solid var(--ink);border-top:1.3cqmin solid transparent;border-bottom:1.3cqmin solid transparent}
.csl-bar{flex:1;height:.7cqmin;border-radius:1cqmin;background:var(--line);overflow:hidden}
.csl-bar i{display:block;height:100%;background:var(--p);transform-origin:left;animation:csl-run calc(var(--T) - .4s) linear both}
.csl-k{grid-column:2;align-self:end;justify-self:start;padding:1.4cqmin 2.6cqmin;border-radius:999px;background:var(--p);color:var(--onp);font-size:3cqmin;font-weight:700;animation:cs-pop .5s cubic-bezier(.16,1,.3,1) both}
.csl-t{grid-column:2;align-self:start;font-size:6cqmin;font-weight:600;letter-spacing:-.025em;line-height:1.08;animation:ls-rise .9s cubic-bezier(.16,1,.3,1) both}
.csl-p{grid-row:1/3}
@container (max-aspect-ratio:1/1){.csl{grid-template-columns:1fr;grid-template-rows:auto auto auto;align-content:center;gap:3.5cqmin}.csl-p{grid-row:auto}.csl-k,.csl-t{grid-column:1}}`,
      ),
    },
  },
  // ------------------------------------------------------------------ projects
  {
    name: "scene-course-projects",
    title: "Scene — projects you'll build",
    description:
      "The course's projects: a heading and three project cards, each with a picture, a title and one line, dealt onto the table from a stack. Real projects from the course; pictures from the user, the course's site, find_images or generate_image (the same id may repeat). Titles ≤ ~22 characters. 5 s.",
    category: "scene",
    tags: tags("projects", "portfolio", "hands-on", "images"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [
      text("title", "Heading", "What you'll build"),
      image("image1", "Image 1"),
      text("p1", "Project 1", "Research agent"),
      text("d1", "Line 1", "Searches, reads and writes a brief."),
      image("image2", "Image 2"),
      text("p2", "Project 2", "Support agent"),
      text("d2", "Line 2", "Answers with tools and memory."),
      image("image3", "Image 3"),
      text("p3", "Project 3", "Multi-agent team"),
      text("d3", "Line 3", "Agents that plan and hand off."),
      ...COURSE_COMMON,
    ],
    content: {
      kind: "html",
      animated: true,
      durationUs: 5 * S,
      template: courseScene(
        `<div class="csp"><div class="csp-h cs-disp" style="--d:.1s">{{title}}</div><div class="csp-row">
<div class="csp-c cs-card" style="--d:.4s;--r:-7deg"><div class="csp-i"><img src="asset:{{image1}}"/></div><b>{{p1}}</b><span>{{d1}}</span></div>
<div class="csp-c cs-card" style="--d:.6s;--r:5deg"><div class="csp-i"><img src="asset:{{image2}}"/></div><b>{{p2}}</b><span>{{d2}}</span></div>
<div class="csp-c cs-card" style="--d:.8s;--r:-4deg"><div class="csp-i"><img src="asset:{{image3}}"/></div><b>{{p3}}</b><span>{{d3}}</span></div></div></div>`,
        `@keyframes csp-deal{from{opacity:0;transform:translate(0,30cqmin) rotate(var(--r)) scale(.9)}}
.csp{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5cqmin;padding:0 6cqw}
.csp-h{font-size:8cqmin;font-weight:600;letter-spacing:-.03em;animation:ls-rise .8s cubic-bezier(.16,1,.3,1) both}
.csp-row{display:flex;gap:3cqmin;justify-content:center;width:100%}
.csp-c{flex:1;max-width:52cqmin;padding:1.6cqmin 1.6cqmin 3cqmin;display:flex;flex-direction:column;animation:csp-deal .9s cubic-bezier(.16,1,.3,1) both}
.csp-i{aspect-ratio:4/3;border-radius:1.6cqmin;overflow:hidden;margin-bottom:2.4cqmin}
.csp-i img{display:block;width:100%;height:100%;object-fit:cover}
.csp-c b{padding:0 1.4cqmin;font-size:4.8cqmin;font-weight:700;letter-spacing:-.02em}
.csp-c span{padding:.8cqmin 1.4cqmin 0;font-size:3.2cqmin;line-height:1.35;color:var(--mut)}
@container (max-aspect-ratio:1/1){.csp-row{flex-direction:column;align-items:center}.csp-c{width:80cqw;max-width:none;flex-direction:row;align-items:center;gap:2.4cqmin;flex-wrap:wrap}.csp-i{width:24cqw;margin:0}.csp-c b{flex:1}.csp-c span{flex-basis:100%}}`,
      ),
    },
  },
  // ------------------------------------------------------------------ instructor
  {
    name: "scene-course-instructor",
    title: "Scene — instructor",
    description:
      "Introduces who teaches: a round portrait with a ring that draws around it, their name set large, their role, and two credentials as chips ('Ex-Google DeepMind', '10 years in ML'). Only a real instructor with a real photo (from the user or the course's site, or find_images); never a generated face for a real person. Without a photo, use scene-doc-character. 4.5 s.",
    category: "scene",
    tags: tags("instructor", "teacher", "mentor", "person", "portrait"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [image("image", "Portrait"), text("kicker", "Kicker", "Your instructor"), text("name", "Name", "Dr. Maya Chen"), text("role", "Role", "Applied AI lead"), text("cred1", "Credential 1", "10 years in ML"), text("cred2", "Credential 2", "Shipped agents at scale"), ...COURSE_COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 4.5 * S,
      template: courseScene(
        `<div class="csi"><div class="csi-f" style="--d:.1s"><svg class="csi-ring" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" style="--d:.3s"/></svg><div class="csi-p"><img src="asset:{{image}}"/></div></div>
<div class="csi-x"><div class="cs-kick" style="--d:.5s;animation:cs-left .7s cubic-bezier(.16,1,.3,1) both">{{kicker}}</div>
<div class="csi-n cs-disp" style="--d:.65s">{{name}}</div><div class="csi-r" style="--d:.9s">{{role}}</div>
<div class="csi-c"><span style="--d:1.3s">{{cred1}}</span><span style="--d:1.5s">{{cred2}}</span></div></div></div>`,
        `@keyframes csi-ring{from{stroke-dashoffset:302}to{stroke-dashoffset:0}}
.csi{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:7cqw;padding:0 8cqw}
.csi-f{position:relative;flex:none;width:52cqmin;height:52cqmin;animation:cs-pop .8s cubic-bezier(.16,1,.3,1) both}
.csi-ring{position:absolute;inset:-3cqmin;width:calc(100% + 6cqmin);height:calc(100% + 6cqmin);transform:rotate(-90deg)}
.csi-ring circle{fill:none;stroke:var(--p);stroke-width:1.2;stroke-linecap:round;stroke-dasharray:302;animation:csi-ring 1.6s cubic-bezier(.4,0,.2,1) both}
.csi-p{position:absolute;inset:0;border-radius:50%;overflow:hidden;background:var(--card)}
.csi-p img{width:100%;height:100%;object-fit:cover;display:block}
.csi-n{margin-top:2.4cqmin;font-size:min(10cqmin,9cqw);font-weight:600;letter-spacing:-.03em;line-height:1;animation:ls-rise .9s cubic-bezier(.16,1,.3,1) both}
.csi-r{margin-top:1.6cqmin;font-size:4.4cqmin;color:var(--mut);animation:ls-rise .8s cubic-bezier(.16,1,.3,1) both}
.csi-c{display:flex;flex-wrap:wrap;gap:1.6cqmin;margin-top:4cqmin}
.csi-c span{padding:1.3cqmin 2.6cqmin;border-radius:999px;background:var(--card);border:.15cqmin solid var(--line);font-size:3cqmin;font-weight:600;animation:cs-pop .5s cubic-bezier(.16,1,.3,1) both}
@container (max-aspect-ratio:1/1){.csi{flex-direction:column;text-align:center;gap:5cqmin}.csi-c{justify-content:center}.csi-f{width:46cqmin;height:46cqmin}}`,
      ),
    },
  },
  // ------------------------------------------------------------------ outcomes + certificate
  {
    name: "scene-course-outcomes",
    title: "Scene — skills and certificate",
    description:
      "What learners leave with: four skills ticked off on the left, and a certificate of completion that swings into place on the right with the course name, the issuer and a seal. Real skills from the course; only use the certificate if the course gives one. Skills ≤ ~26 characters. 5 s.",
    category: "scene",
    tags: tags("outcomes", "skills", "certificate", "career", "results"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [
      text("title", "Heading", "You'll leave able to"),
      text("s1", "Skill 1", "Design tool-using agents"),
      text("s2", "Skill 2", "Add memory and planning"),
      text("s3", "Skill 3", "Evaluate and guard agents"),
      text("s4", "Skill 4", "Ship to production"),
      text("certificate", "Certificate title", "Agentic AI Engineering"),
      text("issuer", "Issuer", "Udacity"),
      ...COURSE_COMMON,
    ],
    content: {
      kind: "html",
      animated: true,
      durationUs: 5 * S,
      template: courseScene(
        `<div class="cso"><div class="cso-l"><div class="cso-h cs-disp" style="--d:.1s">{{title}}</div>
<div class="cso-s" style="--d:.5s"><b style="--d:.7s">${TICK}</b>{{s1}}</div>
<div class="cso-s" style="--d:.75s"><b style="--d:.95s">${TICK}</b>{{s2}}</div>
<div class="cso-s" style="--d:1s"><b style="--d:1.2s">${TICK}</b>{{s3}}</div>
<div class="cso-s" style="--d:1.25s"><b style="--d:1.45s">${TICK}</b>{{s4}}</div></div>
<div class="cso-c" style="--d:1.4s"><div class="cso-k">Certificate of completion</div><div class="cso-t cs-disp">{{certificate}}</div><i class="cso-line"></i><div class="cso-i">{{issuer}}</div><div class="cso-seal" style="--d:2.4s"><span>✓</span></div></div></div>`,
        `@keyframes cso-swing{from{opacity:0;transform:perspective(140cqmin) rotateY(-55deg) rotate(6deg) translateX(10cqmin)}to{transform:perspective(140cqmin) rotateY(0) rotate(-2deg)}}
.cso{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6cqw;padding:0 8cqw}
.cso-l{flex:1;display:flex;flex-direction:column;gap:2.2cqmin;max-width:80cqmin}
.cso-h{font-size:8.8cqmin;font-weight:600;letter-spacing:-.03em;line-height:1.05;margin-bottom:1.6cqmin;animation:ls-rise .8s cubic-bezier(.16,1,.3,1) both}
.cso-s{display:flex;align-items:center;gap:2cqmin;font-size:5.2cqmin;font-weight:600;letter-spacing:-.015em;animation:cs-left .6s cubic-bezier(.16,1,.3,1) both}
.cso-s b{flex:none;display:grid;place-items:center;width:4.4cqmin;height:4.4cqmin;border-radius:50%;background:var(--p);color:var(--onp);animation:cs-pop .4s cubic-bezier(.16,1,.3,1) both}
.cso-s b svg{width:2.8cqmin;height:2.8cqmin}.cso-s b path{animation:cs-tick .4s ease-out both}
.cso-c{position:relative;flex:none;width:min(70cqmin,62cqw);aspect-ratio:1.414;padding:5cqmin;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:#fffdf8;color:#1b1b1b;border-radius:1cqmin;outline:.5cqmin solid color-mix(in srgb,var(--p) 70%,#fff);outline-offset:-2.4cqmin;box-shadow:0 4cqmin 10cqmin color-mix(in srgb,var(--ink) 22%,transparent);animation:cso-swing 1.1s cubic-bezier(.16,1,.3,1) both;transform:rotate(-2deg)}
.cso-k{font-size:2.3cqmin;letter-spacing:.3em;text-transform:uppercase;color:#6b6b6b}
.cso-t{margin-top:2.4cqmin;font-size:5.6cqmin;font-weight:600;line-height:1.1;color:#141414}
.cso-line{width:40%;height:.15cqmin;background:#bbb;margin:3cqmin 0 1.4cqmin}
.cso-i{font-size:2.8cqmin;font-weight:700;color:#333}
.cso-seal{position:absolute;right:4cqmin;bottom:4cqmin;width:10cqmin;height:10cqmin;border-radius:50%;background:var(--p);color:var(--onp);display:grid;place-items:center;font-size:5cqmin;font-weight:800;box-shadow:0 0 0 .8cqmin color-mix(in srgb,var(--p) 30%,transparent);animation:cs-pop .5s cubic-bezier(.16,1,.3,1) both}
.ls-brand .cso-seal{background:#1b1b1b;color:#fff}
@container (max-aspect-ratio:1/1){.cso{flex-direction:column;gap:6cqmin}.cso-l{flex:none;width:100%}.cso-c{width:78cqw}}`,
      ),
    },
  },
  // ------------------------------------------------------------------ enrol (closer)
  {
    name: "scene-course-enroll",
    title: "Scene — enrol (closer)",
    description:
      "Ends a course film: the course title, a line with when or how to join ('Next cohort starts June 3', 'Enrol anytime, learn at your pace'), a button that presses itself, and the address. Always the last scene. Use the course's real URL and dates; leave `detail` general if you don't know the date. 5.5 s.",
    category: "scene",
    tags: tags("closer", "enroll", "cta", "end card", "outro"),
    aspects: ["16:9", "9:16", "1:1"],
    fields: [text("kicker", "Kicker", "Udacity"), text("title", "Course title", "Agentic AI Engineering"), text("detail", "When / how", "Enrol anytime. Learn at your pace."), text("cta", "Button", "Enroll now"), text("url", "Address", "udacity.com"), ...COURSE_COMMON],
    content: {
      kind: "html",
      animated: true,
      durationUs: 5.5 * S,
      template: courseScene(
        `<div class="cse"><div class="cs-kick" style="--d:.1s;animation:ls-fade .6s ease both">{{kicker}}</div>
<div class="cse-t cs-disp" style="--d:.3s">{{title}}</div>
<div class="cse-d" style="--d:1s">{{detail}}</div>
<div class="cse-row"><span class="cse-b" style="--d:1.5s">{{cta}}</span><span class="cse-u" style="--d:1.8s">{{url}}</span></div></div>`,
        `@keyframes cse-press{0%,60%{transform:scale(1)}70%{transform:scale(.94)}85%,100%{transform:scale(1)}}
.cse{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 8cqw}
.cse-t{margin-top:3cqmin;max-width:150cqmin;font-size:min(14cqmin,11cqw);font-weight:600;letter-spacing:-.035em;line-height:1;text-wrap:balance;animation:ls-blurin 1s cubic-bezier(.16,1,.3,1) both}
.cse-d{margin-top:3cqmin;font-size:4.4cqmin;color:var(--mut);animation:ls-rise .8s cubic-bezier(.16,1,.3,1) both}
.cse-row{display:flex;align-items:center;gap:3cqmin;margin-top:5cqmin}
.cse-b{padding:2cqmin 4.4cqmin;border-radius:999px;background:var(--p);color:var(--onp);font-size:3.8cqmin;font-weight:700;box-shadow:0 1.6cqmin 4cqmin color-mix(in srgb,var(--p) 35%,transparent);animation:cs-pop .55s cubic-bezier(.16,1,.3,1) both,cse-press 1.4s ease 1.2s both}
.cse-u{font-size:3.6cqmin;font-weight:600;animation:ls-fade .6s ease both}`,
      ),
    },
  },
];
