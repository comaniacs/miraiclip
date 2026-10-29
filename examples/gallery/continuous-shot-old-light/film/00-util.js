// ---- shared helpers: ThreeKit (data-libs "three-kit") supplies easing, glows, noise and lines; this file only
// names them for the film, with its own frame size, palette ground and random seed.
var K = ThreeKit;
var W = 1920, H = 1080;
var clamp = K.clamp, c01 = K.c01, sm = K.sm, smr = K.smr, smoother = K.smoother, mix = K.mix, expOut = K.expOut, logMix = K.logMix;
var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
var rng = S.rand(1729);
var GROUND = new THREE.Color(0x07060a);
var GLOW_HOT = K.GLOW.hot, GLOW_SOFT = K.GLOW.soft, GLOW_BLUE = K.GLOW.blue;
var glowSprite = K.glowSprite, polySegs = K.polySegs, GLSL_NOISE = K.NOISE_GLSL;
var fatLines = function (segs, opts) { opts.resolution = [W, H]; return K.fatLines(segs, opts); };
