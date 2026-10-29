/*
 * ThreeKit: the parts every three.js film needs, so a film is only its own scene. A sequence asks for it with
 * data-libs="stage three three-kit" and reads the global ThreeKit inside stage.build. Every helper is a pure
 * function of its inputs (and of t), so frames stay deterministic.
 *
 *   ease          clamp, c01, sm, smr, smoother, mix, expOut, logMix, hermite
 *   renderer      renderer(canvas, w, h): ACES tone mapping, sRGB output, pixel ratio 1, preserveDrawingBuffer
 *   glow          glowTexture(stops), glowSprite(texture, size), GLOW.hot / GLOW.soft / GLOW.blue
 *   noise         NOISE_GLSL: 3D simplex noise (Stefan Gustavson, Ashima Arts, MIT) and fbm(p)
 *   lines         fatLines(segments, opts), polySegs(points): constant-pixel-width lines, drawable to a moving head
 *   camera        shots(list): one camera from several shots, blended on position and on what each looks at
 *                 place(camera, pose): set a PerspectiveCamera from a pose, with near/far fitted to it
 *   checks        subjectOf(camAt, pointAt, opts) → a tl.subject function; motionOf(camAt) → a tl.frame motion function
 *   overlay       toScreen(v, camera, w, h), lineIO(el, tin, tout, t), fadeIO(el, tin, tout, t, dy)
 */
(function () {
  "use strict";
  if (typeof THREE === "undefined") throw new Error('three-kit needs three: use data-libs="stage three three-kit"');

  // ---- easing and interpolation
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var c01 = function (x) { return clamp(x, 0, 1); };
  var sm = function (x) { x = c01(x); return x * x * (3 - 2 * x); };
  var smr = function (t, a, b) { return sm((t - a) / (b - a)); };
  var smoother = function (x) { x = c01(x); return x * x * x * (x * (x * 6 - 15) + 10); };
  var mix = function (a, b, u) { return a + (b - a) * u; };
  var expOut = function (x) { x = c01(x); return 1 - Math.pow(2, -10 * x); };
  /** a to b in log space: a zoom or a distance change that feels constant-speed */
  var logMix = function (a, b, u) { return Math.exp(mix(Math.log(a), Math.log(b), u)); };
  /** 0→1 with a chosen start slope m0 and a flat end: an approach that begins at the speed you arrive with */
  var hermite = function (u, m0) { u = c01(u); var u2 = u * u, u3 = u2 * u; return (-2 * u3 + 3 * u2) + (m0 || 0) * (u3 - 2 * u2 + u); };

  function renderer(canvas, w, h, opts) {
    opts = opts || {};
    var r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(w, h, false);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = opts.exposure != null ? opts.exposure : 1;
    r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  }

  // ---- additive glows from a radial gradient
  function glowTexture(stops) {
    var c = document.createElement("canvas"); c.width = c.height = 256;
    var g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  var cache = {};
  var GLOW = {
    get hot() { return cache.hot || (cache.hot = glowTexture([[0, "rgba(255,255,250,1)"], [0.08, "rgba(255,240,200,0.9)"], [0.25, "rgba(255,170,80,0.32)"], [0.6, "rgba(255,110,30,0.06)"], [1, "rgba(255,90,20,0)"]])); },
    get soft() { return cache.soft || (cache.soft = glowTexture([[0, "rgba(255,200,140,0.55)"], [0.35, "rgba(255,130,50,0.18)"], [1, "rgba(255,90,20,0)"]])); },
    get blue() { return cache.blue || (cache.blue = glowTexture([[0, "rgba(160,205,255,0.5)"], [0.4, "rgba(80,150,255,0.14)"], [1, "rgba(60,120,255,0)"]])); },
  };
  function glowSprite(tex, size) {
    var m = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false });
    var s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
  }

  var NOISE_GLSL = [
    "vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}",
    "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}",
    "float snoise(vec3 v){",
    " const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);",
    " vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);",
    " vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);",
    " vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);",
    " vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));",
    " float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.0*floor(p*ns.z*ns.z);",
    " vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_); vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);",
    " vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw); vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));",
    " vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;",
    " vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);",
    " vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;",
    " vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;",
    " return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}",
    "float fbm(vec3 p){float a=0.5,s=0.0;for(int i=0;i<5;i++){s+=a*snoise(p);p*=2.03;a*=0.5;}return s;}",
  ].join("\n");

  // ---- constant-pixel-width lines: one instance per segment, each with its arc position (s0, s1), so a line can
  // be drawn up to a moving head (uHead) with a hot tip and a cooler tail. Segments crossing the near plane are
  // clipped in view space, so a line that passes the camera stays whole. `uStreak` offsets every segment's end,
  // which turns points into speed streaks. opts: width (px), resolution [w, h], color, hotColor, hot, tail,
  // headLen (arc units), normal (normal blending instead of additive), depthTest.
  function fatLines(segs, opts) {
    opts = opts || {};
    var n = segs.length, g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    var A = new Float32Array(n * 3), B = new Float32Array(n * 3), S = new Float32Array(n * 2);
    segs.forEach(function (s, i) {
      A[i * 3] = s[0].x; A[i * 3 + 1] = s[0].y; A[i * 3 + 2] = s[0].z;
      B[i * 3] = s[1].x; B[i * 3 + 1] = s[1].y; B[i * 3 + 2] = s[1].z;
      S[i * 2] = s[2] || 0; S[i * 2 + 1] = s[3] || 0;
    });
    g.setAttribute("iA", new THREE.InstancedBufferAttribute(A, 3));
    g.setAttribute("iB", new THREE.InstancedBufferAttribute(B, 3));
    g.setAttribute("iS", new THREE.InstancedBufferAttribute(S, 2));
    g.instanceCount = n;
    var res = opts.resolution || [1920, 1080];
    var u = {
      uWidth: { value: opts.width || 3 }, uRes: { value: new THREE.Vector2(res[0], res[1]) }, uNear: { value: 0.01 },
      uHead: { value: 1 }, uHeadLen: { value: opts.headLen || 0.1 }, uHot: { value: opts.hot != null ? opts.hot : 2.2 }, uTail: { value: opts.tail != null ? opts.tail : 0.55 },
      uColor: { value: new THREE.Color(opts.color != null ? opts.color : 0xffa040) }, uHotColor: { value: new THREE.Color(opts.hotColor != null ? opts.hotColor : 0xfff0d0) },
      uOpacity: { value: 1 }, uStreak: { value: new THREE.Vector3() },
    };
    var m = new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, depthTest: opts.depthTest !== false,
      blending: opts.normal ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: false,
      vertexShader: [
        "attribute vec3 iA; attribute vec3 iB; attribute vec2 iS;",
        "uniform float uWidth; uniform vec2 uRes; uniform float uNear; uniform vec3 uStreak;",
        "varying float vSide; varying float vS;",
        "void main(){",
        " vec4 a=modelViewMatrix*vec4(iA,1.0); vec4 b=modelViewMatrix*vec4(iB+uStreak,1.0);",
        " float s0=iS.x, s1=iS.y;",
        " if(a.z>-uNear&&b.z>-uNear){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}",
        " if(a.z>-uNear){float k=(-uNear-a.z)/(b.z-a.z);a=mix(a,b,k);s0=mix(s0,s1,k);}",
        " if(b.z>-uNear){float k=(-uNear-b.z)/(a.z-b.z);b=mix(b,a,k);s1=mix(s1,s0,k);}",
        " vec4 ca=projectionMatrix*a; vec4 cb=projectionMatrix*b;",
        " vec2 sa=ca.xy/ca.w*uRes*0.5, sb=cb.xy/cb.w*uRes*0.5; vec2 d=sb-sa; float L=length(d); d=L>1e-4?d/L:vec2(1.0,0.0);",
        " vec2 nrm=vec2(-d.y,d.x); vec4 c=mix(ca,cb,position.x);",
        " vec2 off=nrm*position.y*uWidth*0.5+d*(position.x*2.0-1.0)*uWidth*0.5;",
        " c.xy+=off/(uRes*0.5)*c.w; gl_Position=c; vSide=position.y; vS=mix(s0,s1,position.x);",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform float uHead; uniform float uHeadLen; uniform float uHot; uniform float uTail; uniform vec3 uColor; uniform vec3 uHotColor; uniform float uOpacity;",
        "varying float vSide; varying float vS;",
        "void main(){",
        " if(vS>uHead) discard;",
        " float edge=1.0-smoothstep(0.25,1.0,abs(vSide)); float k=clamp((uHead-vS)/uHeadLen,0.0,1.0);",
        " vec3 col=mix(uHotColor*uHot,uColor*uTail,smoothstep(0.0,1.0,k));",
        " gl_FragColor=vec4(col,edge*uOpacity);",
        "}",
      ].join("\n"),
    });
    var mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
    /** call once per frame with the camera the scene renders with */
    mesh.userData.update = function (camera) { u.uNear.value = camera.near; };
    return mesh;
  }
  /** a polyline (Vector3[]) → segments with arc positions 0..1, plus the arc position of every point */
  function polySegs(pts) {
    var L = [0];
    for (var i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
    var tot = L[L.length - 1] || 1, out = [];
    for (var j = 1; j < pts.length; j++) out.push([pts[j - 1], pts[j], L[j - 1] / tot, L[j] / tot]);
    return { segs: out, len: L.map(function (x) { return x / tot; }) };
  }

  // ---- the camera: a pose is { p, q, fov, up } (position, the point it looks at, vertical fov, up vector)
  var YUP = new THREE.Vector3(0, 1, 0);
  /**
   * Blend two poses. Position and look-at point are blended separately (wLook defaults to w) and the aim is taken
   * from where the camera really is, so it never points at neither shot's subject mid-blend.
   */
  function blend(a, b, w, wLook) {
    var p = a.p.clone().lerp(b.p, w), q = a.q.clone().lerp(b.q, wLook == null ? w : wLook);
    return { p: p, q: q, fov: mix(a.fov, b.fov, w), up: (a.up || YUP).clone().lerp(b.up || YUP, w).normalize() };
  }
  /**
   * One camera from several shots: list = [{ at, fn }, { at, fn, blend: seconds, aimFirst: 0..1 }, …] in time
   * order. Each fn(t) returns a pose; shot k takes over from shot k-1 at its `at` over `blend` seconds
   * (default 0.8). aimFirst < 1 turns the aim to the new subject in that share of the blend, before the camera
   * has finished moving. Returns camAt(t).
   */
  function shots(list) {
    return function camAt(t) {
      var k = 0;
      while (k < list.length - 1 && t >= list[k + 1].at) k++;
      var cur = list[k];
      if (k === 0) return cur.fn(t);
      var dur = cur.blend != null ? cur.blend : 0.8, u = (t - cur.at) / dur;
      if (u >= 1) return cur.fn(t);
      return blend(list[k - 1].fn(t), cur.fn(t), smoother(u), smoother(u / (cur.aimFirst || 1)));
    };
  }
  /** Set a PerspectiveCamera from a pose. near: a distance to keep in front of the lens (default: 2% of the aim distance). */
  function place(camera, pose, opts) {
    opts = opts || {};
    camera.fov = pose.fov; camera.position.copy(pose.p); camera.up.copy(pose.up || YUP); camera.lookAt(pose.q);
    var d = pose.p.distanceTo(pose.q) || 1;
    camera.near = clamp((opts.near != null ? opts.near : d) * 0.02, opts.minNear || 1e-5, opts.maxNear || 1);
    camera.far = opts.far || 10000;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    return camera;
  }

  // ---- checks the stage kit can run without painting a frame
  var probeCam = new THREE.PerspectiveCamera(), pv = new THREE.Vector3();
  /**
   * A tl.subject function for something in the 3D scene: camAt(t) gives the pose, pointAt(t) the subject's world
   * position (or null while it isn't meant to be seen). The result is its stage position and on-screen radius;
   * opts.radius (world units, default 0) sizes it, opts.w / opts.h the stage (default 1920×1080).
   */
  function subjectOf(camAt, pointAt, opts) {
    opts = opts || {};
    var W = opts.w || 1920, H = opts.h || 1080;
    probeCam.aspect = W / H;
    return function (t) {
      var at = pointAt(t);
      if (!at) return null;
      place(probeCam, camAt(t), opts.place);
      pv.copy(at).applyMatrix4(probeCam.matrixWorldInverse);
      if (pv.z > -probeCam.near) return { x: -1e6, y: -1e6, r: 0 }; // behind the camera: out of frame
      var dist = -pv.z, r = (opts.radius || 0) / (dist * Math.tan(probeCam.fov * Math.PI / 360)) * (H / 2);
      pv.copy(at).project(probeCam);
      return { x: (pv.x + 1) / 2 * W, y: (1 - pv.y) / 2 * H, r: r };
    };
  }
  /**
   * A tl.frame motion function: how far (stage px) the picture moves between two instants, from probe points
   * around what the camera looks at, seen from both poses. Motion blur sizes its samples from it and declared
   * rests use it to check that the painted picture holds still.
   */
  function motionOf(camAt, opts) {
    opts = opts || {};
    var W = opts.w || 1920, H = opts.h || 1080;
    probeCam.aspect = W / H;
    return function (from, to) {
      var a = camAt(from), d = a.p.distanceTo(a.q) || 1, f = a.q.clone().sub(a.p).normalize();
      var side = f.clone().cross(YUP).normalize(), up = side.clone().cross(f);
      var pts = [new THREE.Vector3(), side.multiplyScalar(d * 0.4), up.multiplyScalar(d * 0.3), f.clone().multiplyScalar(-d * 0.5)].map(function (o) { return a.q.clone().add(o); });
      place(probeCam, a, opts.place);
      var A = pts.map(function (p) { return pv.copy(p).project(probeCam).clone(); });
      place(probeCam, camAt(to), opts.place);
      var far = 0;
      pts.forEach(function (p, i) { var b = pv.copy(p).project(probeCam); far = Math.max(far, Math.hypot((b.x - A[i].x) * W / 2, (b.y - A[i].y) * H / 2)); });
      return far;
    };
  }

  // ---- overlays: DOM type over the canvas, set from t every frame
  function toScreen(v, camera, w, h) { pv.copy(v).project(camera); return { x: (pv.x + 1) / 2 * w, y: (1 - pv.y) / 2 * h }; }
  /** A line that rises through its mask (the element clips, its first child moves) and drifts up as it fades out. */
  function lineIO(el, tin, tout, t) {
    var sp = el.firstElementChild, u = smoother((t - tin) / 0.6), v = sm((t - tout) / 0.45);
    el.style.opacity = t < tin || t > tout + 0.45 ? 0 : 1;
    sp.style.transform = "translateY(" + ((1 - u) * 105 - v * 18).toFixed(2) + "%)";
    sp.style.opacity = (u * (1 - v)).toFixed(3);
    sp.style.letterSpacing = mix(0.04, -0.01, u).toFixed(4) + "em";
  }
  function fadeIO(el, tin, tout, t, dy) {
    var u = smoother((t - tin) / 0.5), v = sm((t - tout) / 0.45);
    el.style.opacity = (u * (1 - v)).toFixed(3);
    el.style.transform = "translateY(" + ((1 - u) * (dy || 16) - v * 10).toFixed(2) + "px)";
  }

  window.ThreeKit = {
    clamp: clamp, c01: c01, sm: sm, smr: smr, smoother: smoother, mix: mix, expOut: expOut, logMix: logMix, hermite: hermite,
    renderer: renderer, glowTexture: glowTexture, glowSprite: glowSprite, GLOW: GLOW, NOISE_GLSL: NOISE_GLSL,
    fatLines: fatLines, polySegs: polySegs, blend: blend, shots: shots, place: place,
    subjectOf: subjectOf, motionOf: motionOf, toScreen: toScreen, lineIO: lineIO, fadeIO: fadeIO,
  };
})();
