// ---- shared helpers: easing, a seeded random, colours, a glow sprite texture and GLSL noise
var W = 1920, H = 1080;
var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
var c01 = function (x) { return clamp(x, 0, 1); };
var sm = function (x) { x = c01(x); return x * x * (3 - 2 * x); };
var smr = function (t, a, b) { return sm((t - a) / (b - a)); };
var smoother = function (x) { x = c01(x); return x * x * x * (x * (x * 6 - 15) + 10); };
var mix = function (a, b, u) { return a + (b - a) * u; };
var expOut = function (x) { x = c01(x); return 1 - Math.pow(2, -10 * x); };
var logMix = function (a, b, u) { return Math.exp(mix(Math.log(a), Math.log(b), u)); };
var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
var rng = S.rand(1729);
var GROUND = new THREE.Color(0x07060a);

// a soft round glow for additive sprites: hot centre, long falloff
function glowTexture(stops) {
  var c = document.createElement("canvas"); c.width = c.height = 256;
  var g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
var GLOW_HOT = glowTexture([[0, "rgba(255,255,250,1)"], [0.08, "rgba(255,240,200,0.9)"], [0.25, "rgba(255,170,80,0.32)"], [0.6, "rgba(255,110,30,0.06)"], [1, "rgba(255,90,20,0)"]]);
var GLOW_SOFT = glowTexture([[0, "rgba(255,200,140,0.55)"], [0.35, "rgba(255,130,50,0.18)"], [1, "rgba(255,90,20,0)"]]);
var GLOW_BLUE = glowTexture([[0, "rgba(160,205,255,0.5)"], [0.4, "rgba(80,150,255,0.14)"], [1, "rgba(60,120,255,0)"]]);
function glowSprite(tex, size) {
  var m = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true, toneMapped: false });
  var s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
}

// 3D simplex noise (Stefan Gustavson / Ashima Arts, MIT) plus fbm, shared by the Sun and Earth shaders
var GLSL_NOISE = [
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

// ---- constant-pixel-width lines. One instance per segment; each segment carries its arc position (s0, s1) so a
// line can be drawn up to a moving head with a hot tip and a cooler tail. Additive, so overlapping tangles glow.
// `streak` offsets every segment's end, which turns points into speed streaks.
function fatLines(segs, opts) {
  var n = segs.length;
  var g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  var A = new Float32Array(n * 3), B = new Float32Array(n * 3), Sx = new Float32Array(n * 2);
  segs.forEach(function (s, i) {
    A[i * 3] = s[0].x; A[i * 3 + 1] = s[0].y; A[i * 3 + 2] = s[0].z;
    B[i * 3] = s[1].x; B[i * 3 + 1] = s[1].y; B[i * 3 + 2] = s[1].z;
    Sx[i * 2] = s[2]; Sx[i * 2 + 1] = s[3];
  });
  g.setAttribute("iA", new THREE.InstancedBufferAttribute(A, 3));
  g.setAttribute("iB", new THREE.InstancedBufferAttribute(B, 3));
  g.setAttribute("iS", new THREE.InstancedBufferAttribute(Sx, 2));
  g.instanceCount = n;
  var u = {
    uWidth: { value: opts.width || 3 }, uRes: { value: new THREE.Vector2(W, H) }, uNear: { value: 0.01 },
    uHead: { value: 1 }, uHeadLen: { value: opts.headLen || 0.1 }, uHot: { value: opts.hot || 2.2 }, uTail: { value: opts.tail || 0.55 },
    uColor: { value: new THREE.Color(opts.color || 0xffa040) }, uHotColor: { value: new THREE.Color(opts.hotColor || 0xfff0d0) },
    uOpacity: { value: 1 }, uStreak: { value: new THREE.Vector3() },
  };
  var m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, depthTest: opts.depthTest !== false, blending: opts.normal ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: false,
    vertexShader: [
      "attribute vec3 iA; attribute vec3 iB; attribute vec2 iS;",
      "uniform float uWidth; uniform vec2 uRes; uniform float uNear; uniform vec3 uStreak;",
      "varying float vSide; varying float vS;",
      "void main(){",
      " vec4 a=modelViewMatrix*vec4(iA,1.0); vec4 b=modelViewMatrix*vec4(iB+uStreak,1.0);",
      " float s0=iS.x, s1=iS.y;",
      // clip the segment against the near plane so lines that pass the camera stay whole
      " if(a.z>-uNear&&b.z>-uNear){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}",
      " if(a.z>-uNear){float k=(-uNear-a.z)/(b.z-a.z);a=mix(a,b,k);s0=mix(s0,s1,k);}",
      " if(b.z>-uNear){float k=(-uNear-b.z)/(a.z-b.z);b=mix(b,a,k);s1=mix(s1,s0,k);}",
      " vec4 ca=projectionMatrix*a; vec4 cb=projectionMatrix*b;",
      " vec2 sa=ca.xy/ca.w*uRes*0.5, sb=cb.xy/cb.w*uRes*0.5; vec2 d=sb-sa; float L=length(d); d=L>1e-4?d/L:vec2(1.0,0.0);",
      " vec2 nrm=vec2(-d.y,d.x);",
      " vec4 c=mix(ca,cb,position.x);",
      " vec2 off=nrm*position.y*uWidth*0.5+d*(position.x*2.0-1.0)*uWidth*0.5;",
      " c.xy+=off/(uRes*0.5)*c.w;",
      " gl_Position=c; vSide=position.y; vS=mix(s0,s1,position.x);",
      "}",
    ].join("\n"),
    fragmentShader: [
      "uniform float uHead; uniform float uHeadLen; uniform float uHot; uniform float uTail; uniform vec3 uColor; uniform vec3 uHotColor; uniform float uOpacity;",
      "varying float vSide; varying float vS;",
      "void main(){",
      " if(vS>uHead) discard;",
      " float edge=1.0-smoothstep(0.25,1.0,abs(vSide));",
      " float k=clamp((uHead-vS)/uHeadLen,0.0,1.0);",
      " vec3 col=mix(uHotColor*uHot,uColor*uTail,smoothstep(0.0,1.0,k));",
      " gl_FragColor=vec4(col,edge*uOpacity);",
      "}",
    ].join("\n"),
  });
  var mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
  return mesh;
}
// a polyline (array of Vector3) to segments with arc-length positions 0..1
function polySegs(pts) {
  var L = [0];
  for (var i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
  var tot = L[L.length - 1] || 1, out = [];
  for (var j = 1; j < pts.length; j++) out.push([pts[j - 1], pts[j], L[j - 1] / tot, L[j] / tot]);
  return { segs: out, len: L.map(function (x) { return x / tot; }) };
}
