// @ts-nocheck
/* eslint-disable */
"use client";
/**
 * VenomButton.tsx  (single file, orange edition)
 *
 * Drop this file anywhere in your project and import it. Needs: react, react-dom, gsap.
 *
 *   import VenomButton from "./components/VenomButton";
 *   <VenomButton text="Save Bill" type="submit" onClick={handleSave} />
 *
 * Props: text, href, width, height, liquidColor, tentacleCount, magneticStrength, intensity,
 * animationSpeed, respectReducedMotion, as, onClick, className, style (+ any button/anchor prop).
 * Colour: liquidColor (default orange "#ff6a00"). Both the button and the liquid use it.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";

/* ---------------------------------------------------------------- */
/*  Styles (injected once, no CSS file needed)                       */
/* ---------------------------------------------------------------- */
const VENOM_CSS = `
.venomWrap{position:relative;display:inline-flex;isolation:isolate;vertical-align:middle}
.venomWrap::after{content:"";position:absolute;z-index:-1;left:12%;right:12%;bottom:-12px;height:18px;border-radius:50%;
  background:radial-gradient(closest-side,rgba(255,122,24,.75),rgba(255,122,24,0));filter:blur(7px);pointer-events:none}
.venomBtn{--liquid:#ff6a00;--mx:50%;--my:30%;--sheen:0;position:relative;display:inline-flex;align-items:center;justify-content:center;
  box-sizing:border-box;padding:0 28px;border:0;border-radius:999px;cursor:pointer;text-decoration:none;white-space:nowrap;color:#fff;
  font-family:inherit;font-weight:800;line-height:1;letter-spacing:.01em;user-select:none;-webkit-user-select:none;
  -webkit-tap-highlight-color:transparent;will-change:transform;transform-origin:50% 50%;
  background:
    radial-gradient(70% 55% at 50% 125%,rgba(255,214,150,.55),transparent 70%),
    radial-gradient(120% 170% at 50% -40%,color-mix(in srgb,var(--liquid) 45%,#fff) 0%,var(--liquid) 40%,
      color-mix(in srgb,var(--liquid) 80%,#000) 75%,color-mix(in srgb,var(--liquid) 60%,#000) 100%);
  box-shadow:
    inset 0 1.5px 0 rgba(255,238,210,.75),inset 0 -2px 4px rgba(255,200,120,.5),inset 0 -14px 22px rgba(150,45,0,.5),
    inset 0 10px 18px rgba(255,255,255,.08),0 1px 1px rgba(90,30,0,.35),0 8px 12px -4px rgba(150,50,0,.45),
    0 18px 28px -12px rgba(255,106,0,.55)}
.venomBtn::before{content:"";position:absolute;z-index:1;left:5%;right:5%;top:3px;height:46%;
  border-radius:999px 999px 60% 60%/100% 100% 40% 40%;
  background:linear-gradient(180deg,rgba(255,255,255,.55) 0%,rgba(255,255,255,.16) 55%,rgba(255,255,255,0) 100%);
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent);
  mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent);pointer-events:none}
.venomBtn::after{content:"";position:absolute;z-index:1;inset:0;border-radius:inherit;
  background:radial-gradient(circle 130px at var(--mx) var(--my),rgba(255,240,215,.38),rgba(255,255,255,0) 70%);
  opacity:var(--sheen);mix-blend-mode:screen;pointer-events:none}
.venomLabel{position:relative;z-index:2;color:#fff;text-shadow:0 1px 2px rgba(120,35,0,.8),0 0 12px rgba(255,255,255,.15)}
.venomBtn:hover{filter:brightness(1.06)}
.venomBtn:focus-visible{outline:3px solid #ffd2a1;outline-offset:6px}
.venomSvg{position:fixed;left:0;top:0;z-index:1000;overflow:visible;pointer-events:none;will-change:transform}
`;
if (typeof document !== "undefined") {
  let tag = document.getElementById("venom-button-css");
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "venom-button-css";
    document.head.appendChild(tag);
  }
  tag.textContent = VENOM_CSS;
}

/* ---------------------------------------------------------------- */
/*  Config                                                           */
/* ---------------------------------------------------------------- */

/** Cursor distance (px, measured from the button edge) at which the liquid wakes up. */
const TRIGGER_DISTANCE = 150;

/** The SVG overlay extends this many px past the button on every side. */
const PAD = 240;

/** Points sampled along each Bézier tentacle when building its outline. */
const SAMPLES = 20;

/** Light direction (top-left). Used to decide which side of a tentacle gets the wet highlight. */
const LIGHT = { x: -0.55, y: -0.83 };

/** Pale warm specular streak on every tentacle. */
const HIGHLIGHT_COLOR = "#fff1da";

/** Gooey (metaball) filter: blur, then an alpha threshold (alpha * mul + off). */
const GOO = { blur: 1.2, mul: 18, off: -6.5 };

/** Soft cast shadow of the tentacles on the page. */
const SHADOW = { blur: 7, dx: 6, dy: 15, opacity: 0.26 };

/** Click squash & bounce. */
const CLICK = { squashX: 0.09, squashY: 0.16, press: 0.09, release: 0.85 };

const DEFAULTS = {
  text: "Our Services",
  width: 190,
  height: 54,
  liquidColor: "#ff6a00",
  tentacleCount: 7,
  magneticStrength: 0.25,
  intensity: 1,
  animationSpeed: 1,
};

const LIMITS = {
  width: [96, 640],
  height: [36, 120],
  tentacleCount: [3, 12],
  magneticStrength: [0, 1],
  intensity: [0.3, 2],
  animationSpeed: [0.25, 3],
};

const clampNum = (value, fallback, [lo, hi]) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

/**
 * Splits component props into normalised animation options and everything else
 * (which is forwarded to the underlying <button>/<a>).
 */
function splitProps(props) {
  const {
    text,
    width,
    height,
    liquidColor,
    tentacleCount,
    magneticStrength,
    intensity,
    animationSpeed,
    respectReducedMotion,
    ...rest
  } = props;

  return {
    options: {
      text: text ?? DEFAULTS.text,
      width: clampNum(width, DEFAULTS.width, LIMITS.width),
      height: clampNum(height, DEFAULTS.height, LIMITS.height),
      liquidColor: typeof liquidColor === "string" && liquidColor ? liquidColor : DEFAULTS.liquidColor,
      tentacleCount: Math.round(clampNum(tentacleCount, DEFAULTS.tentacleCount, LIMITS.tentacleCount)),
      magneticStrength: clampNum(magneticStrength, DEFAULTS.magneticStrength, LIMITS.magneticStrength),
      intensity: clampNum(intensity, DEFAULTS.intensity, LIMITS.intensity),
      animationSpeed: clampNum(animationSpeed, DEFAULTS.animationSpeed, LIMITS.animationSpeed),
      respectReducedMotion: respectReducedMotion !== false,
    },
    rest,
  };
}

/* ---------------------------------------------------------------- */
/*  Physics                                                          */
/* ---------------------------------------------------------------- */

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const r1 = (v) => Math.round(v * 10) / 10;

const pt = () => ({ x: 0, y: 0, vx: 0, vy: 0 });
const v2 = () => ({ x: 0, y: 0 });

/* ------------------------------------------------------------------ */
/*  Tentacles                                                          */
/* ------------------------------------------------------------------ */

/**
 * Creates `count` tentacles. Each one gets its own personality: thickness, height,
 * curvature, elasticity, damping, wobble and "movement delay" (how far it lags the cursor).
 */
function createTentacles(count) {
  const list = Array.from({ length: count }, (_, i) => {
    const slot = count === 1 ? 0 : -1 + (2 * (i + 0.5)) / count;
    return {
      // personality ------------------------------------------------
      offset: clamp(slot + rand(-0.35, 0.35) * (2 / count), -1, 1), // where along the top surface it roots
      base: rand(9, 16), // root thickness
      tipR: rand(2.6, 4.6), // droplet radius at the tip
      rise: rand(0, 1), // how tall it stands when the cursor is not directly above
      reach: rand(0.6, 1.0), // how much of the way to the cursor it gets
      rest: rand(70, 130), // length at which it starts thinning
      curve: rand(-1, 1) * rand(0.35, 1.0),
      wa: rand(3, 10), // wobble amplitude
      wf: rand(1.2, 3.4), // wobble frequency
      ph: rand(0, 6.28),
      follow: rand(0.05, 0.22), // lag behind the cursor (movement delay)
      kTip: rand(0.05, 0.12), // elasticity
      dTip: rand(0.78, 0.9), // damping (lower = more wobble)
      kMid: rand(0.03, 0.08),
      dMid: rand(0.8, 0.92),
      thinRate: rand(0.5, 1.4),
      snapAt: rand(120, 260), // stretch length at which it snaps
      fan: rand(-1, 1), // sideways spread of the tip around its aim point
      partner: 0,
      // live state --------------------------------------------------
      life: 1,
      snapped: false,
      cool: 0,
      merge: 0,
      recoil: 0,
      inited: false,
      len: 0,
      ax: 0,
      ay: 0,
      nx: 0,
      ny: -1,
      sc: v2(),
      tip: pt(),
      c1: pt(),
      c2: pt(),
      T: v2(),
      M1: v2(),
      M2: v2(),
      // output of buildShape() ---------------------------------------
      shape: { visible: false, body: "", hi: "", hiOpacity: 0, tx: 0, ty: 0, tr: 0, rx: 0, ry: 0, rr: 0 },
    };
  });
  list.sort((a, b) => a.offset - b.offset);
  list.forEach((s, i) => {
    s.partner = i < list.length - 1 ? i + 1 : Math.max(0, i - 1);
  });
  return list;
}

/* ------------------------------------------------------------------ */
/*  Capsule (pill) geometry, in button-local pixels                    */
/* ------------------------------------------------------------------ */
const makeGeom = () => ({ cx: 0, cy: 0, r: 0, half: 0 });

/** Fits the capsule to the button box, including magnetic offset and squash. */
function setGeom(g, w, h, body, sx = 1, sy = 1) {
  g.cx = w / 2 + body.x;
  g.cy = h / 2 + body.y;
  g.r = (h * sy) / 2;
  g.half = Math.max(0, (w * sx) / 2 - g.r);
}

/** Signed distance from a point to the capsule edge (negative inside). */
function capsuleDistance(g, px, py) {
  const cx = clamp(px, g.cx - g.half, g.cx + g.half);
  return Math.hypot(px - cx, py - g.cy) - g.r;
}

const ROOT = { x: 0, y: 0, nx: 0, ny: -1 };

/** Point + outward normal on the upper surface of the capsule at horizontal position x. */
function topPoint(g, x, out) {
  const dx = x - g.cx;
  const ex = Math.max(0, Math.abs(dx) - g.half) * Math.sign(dx);
  const k = Math.sqrt(Math.max(0, g.r * g.r - ex * ex));
  out.x = x;
  out.y = g.cy - k;
  out.nx = g.r ? ex / g.r : 0;
  out.ny = g.r ? -k / g.r : -1;
  return out;
}

/* ------------------------------------------------------------------ */
/*  Springs                                                            */
/* ------------------------------------------------------------------ */
/** 2-D spring on {x,y,vx,vy}. Semi-implicit Euler, frame-rate aware through dt. */
function springPoint(o, tx, ty, k, damp, dt) {
  const f = Math.pow(damp, dt);
  o.vx = (o.vx + (tx - o.x) * k * dt) * f;
  o.vy = (o.vy + (ty - o.y) * k * dt) * f;
  o.x += o.vx * dt;
  o.y += o.vy * dt;
}

/** 1-D spring on o[p] with velocity o[v]. */
function springScalar(o, p, v, target, k, damp, dt) {
  o[v] = (o[v] + (target - o[p]) * k * dt) * Math.pow(damp, dt);
  o[p] += o[v] * dt;
}

/* ------------------------------------------------------------------ */
/*  Aiming: tentacles stand up, and lean / stretch toward the cursor   */
/* ------------------------------------------------------------------ */
/**
 * Sets the root (on the upper surface) and the spring targets T, M1, M2 of one tentacle.
 * ctx: { g, cursor, prox, act, intensity, U, clock, dt }
 */
function aimTentacle(s, ctx) {
  const { g, cursor, prox, act, intensity, U, clock, dt } = ctx;

  // each tentacle follows a lagging copy of the cursor (its "movement delay")
  if (!s.inited) {
    s.sc.x = cursor.x;
    s.sc.y = cursor.y;
  } else {
    const f = 1 - Math.pow(1 - s.follow, dt);
    s.sc.x += (cursor.x - s.sc.x) * f;
    s.sc.y += (cursor.y - s.sc.y) * f;
  }

  // root on the upper surface
  const range = g.half + g.r * 0.55;
  topPoint(g, g.cx + s.offset * range * 0.96, ROOT);
  s.ax = ROOT.x;
  s.ay = ROOT.y;
  s.nx = ROOT.nx;
  s.ny = ROOT.ny;

  if (!s.inited) {
    [s.tip, s.c1, s.c2].forEach((p) => {
      p.x = s.ax;
      p.y = s.ay;
      p.vx = 0;
      p.vy = 0;
    });
    s.inited = true;
  }

  const vx = s.sc.x - s.ax;
  const vy = s.sc.y - s.ay;
  const d0 = Math.hypot(vx, vy) || 1;
  const cux = vx / d0;
  const cuy = vy / d0;

  // 0 = cursor level with / below the root, 1 = cursor well above it
  const above = smooth(-6, 36, s.ay - s.sc.y);

  // direction: mostly up, leaning toward the cursor; fully toward it when it is above
  const wc = 0.45 + 0.55 * above;
  let ux = cux * wc;
  let uy = Math.min(cuy * wc - (1 - wc), -0.35);
  const ul = Math.hypot(ux, uy) || 1;
  ux /= ul;
  uy /= ul;
  const px = -uy;
  const py = ux;

  // length: stand up to a personal height, or stretch all the way to the cursor
  const riseLen = U * 54 * (0.75 + s.rise * 1.5) * intensity * Math.pow(prox, 0.55);
  const towardLen = d0 * s.reach;
  const gate = smooth(0, 0.1, prox) * act * s.life;
  const Lt = lerp(riseLen, towardLen, above) * gate;

  const wob =
    (Math.sin(clock * s.wf + s.ph) + 0.5 * Math.sin(clock * s.wf * 2.3 + s.ph * 1.7)) *
    s.wa *
    intensity *
    smooth(0, 70, Lt);
  const fanAmt = s.fan * 20 * U * smooth(10, 90, Lt);

  s.T.x = s.ax + ux * Lt + px * (wob + fanAmt);
  s.T.y = s.ay + uy * Lt + py * (wob + fanAmt);

  const stretchT = Lt / s.rest;
  const sag = Lt * 0.11 * clamp(1.25 - stretchT * 0.55, 0, 1); // viscous sag, gone once taut
  s.M1.x = s.ax + ux * Lt * 0.34 + px * (s.curve * Lt * 0.3 + fanAmt * 0.45);
  s.M1.y = s.ay + uy * Lt * 0.34 + py * (s.curve * Lt * 0.3 + fanAmt * 0.45) + sag;
  s.M2.x = s.ax + ux * Lt * 0.68 - px * s.curve * Lt * 0.2 + px * (wob * 0.5 + fanAmt * 0.8);
  s.M2.y = s.ay + uy * Lt * 0.68 - py * s.curve * Lt * 0.2 + py * (wob * 0.5 + fanAmt * 0.8) + sag * 1.3;
}

/**
 * Integrates the springs of one tentacle (tip + two Bézier control points), blending
 * toward its neighbour `P` while `merge` > 0 so that neighbours fuse together.
 */
function stepTentacle(s, P, dt) {
  const m = clamp(s.merge, -0.35, 1) * 0.5; // 0.5 = both tips meet at the midpoint
  const tx = s.T.x + (P.T.x - s.T.x) * m;
  const ty = s.T.y + (P.T.y - s.T.y) * m;
  const m1x = s.M1.x + (P.M1.x - s.M1.x) * m * 0.6;
  const m1y = s.M1.y + (P.M1.y - s.M1.y) * m * 0.6;
  const m2x = s.M2.x + (P.M2.x - s.M2.x) * m;
  const m2y = s.M2.y + (P.M2.y - s.M2.y) * m;

  springPoint(s.tip, tx, ty, s.kTip * (1 + 1.8 * s.recoil), s.dTip, dt);
  springPoint(s.c2, m2x, m2y, s.kMid * 1.3, s.dMid, dt);
  springPoint(s.c1, m1x, m1y, s.kMid, s.dMid, dt);

  s.len = Math.hypot(s.tip.x - s.ax, s.tip.y - s.ay);
}

/* ------------------------------------------------------------------ */
/*  Ribbon outline                                                     */
/* ------------------------------------------------------------------ */
const L = SAMPLES + 1;
const LX = new Float32Array(L);
const LY = new Float32Array(L);
const RX = new Float32Array(L);
const RY = new Float32Array(L);
const HAX = new Float32Array(L);
const HAY = new Float32Array(L);
const HBX = new Float32Array(L);
const HBY = new Float32Array(L);

/**
 * Builds the SVG outline of one tentacle as a tapered ribbon along a cubic Bézier
 * (root -> c1 -> c2 -> tip), plus a wet highlight ribbon, a tip droplet and a root bulge.
 * Writes strings/numbers into s.shape (no allocation per frame beyond the path strings).
 */
function buildShape(s, U, intensity) {
  const out = s.shape;
  const len = s.len;
  const grow = smooth(1.5, 26, len);
  if (grow < 0.01) {
    out.visible = false;
    return out;
  }
  out.visible = true;

  const stretch = len / s.rest;
  const thin = clamp((s.base * U * 0.42) / (1 + s.thinRate * Math.max(0, stretch - 0.9)), 3.4 * U, 10 * U);
  const bw = s.base * U * (0.85 + 0.15 * intensity) * (1 + 0.25 * clamp(s.merge, 0, 1));

  // the ribbon starts a little inside the pill so the join is seamless
  const x0 = s.ax - s.nx * 7;
  const y0 = s.ay - s.ny * 7;
  const x1 = s.c1.x;
  const y1 = s.c1.y;
  const x2 = s.c2.x;
  const y2 = s.c2.y;
  const x3 = s.tip.x;
  const y3 = s.tip.y;

  // the highlight rides the side that faces the light
  const cux = (x3 - s.ax) / (len || 1);
  const cuy = (y3 - s.ay) / (len || 1);
  const sign = -cuy * LIGHT.x + cux * LIGHT.y >= 0 ? 1 : -1;

  for (let k = 0; k <= SAMPLES; k += 1) {
    const t = k / SAMPLES;
    const mt = 1 - t;
    const b0 = mt * mt * mt;
    const b1 = 3 * mt * mt * t;
    const b2 = 3 * mt * t * t;
    const b3 = t * t * t;
    const x = b0 * x0 + b1 * x1 + b2 * x2 + b3 * x3;
    const y = b0 * y0 + b1 * y1 + b2 * y2 + b3 * y3;
    const dx = 3 * mt * mt * (x1 - x0) + 6 * mt * t * (x2 - x1) + 3 * t * t * (x3 - x2);
    const dy = 3 * mt * mt * (y1 - y0) + 6 * mt * t * (y2 - y1) + 3 * t * t * (y3 - y2);
    const dl = Math.hypot(dx, dy) || 1;
    const nx = -dy / dl;
    const ny = dx / dl;
    const w = (thin + (bw - thin) * Math.pow(mt, 2.3)) * 0.5 * grow; // half width
    LX[k] = x + nx * w;
    LY[k] = y + ny * w;
    RX[k] = x - nx * w;
    RY[k] = y - ny * w;
    const off = sign * w * 0.42;
    const hw = Math.max(0.35, w * 0.16);
    HAX[k] = x + nx * (off + hw);
    HAY[k] = y + ny * (off + hw);
    HBX[k] = x + nx * (off - hw);
    HBY[k] = y + ny * (off - hw);
  }

  let d = `M${r1(LX[0])} ${r1(LY[0])}`;
  for (let k = 1; k <= SAMPLES; k += 1) d += `L${r1(LX[k])} ${r1(LY[k])}`;
  for (let k = SAMPLES; k >= 0; k -= 1) d += `L${r1(RX[k])} ${r1(RY[k])}`;
  out.body = `${d}Z`;

  const k0 = 2;
  const k1 = SAMPLES - 2;
  let hd = `M${r1(HAX[k0])} ${r1(HAY[k0])}`;
  for (let k = k0 + 1; k <= k1; k += 1) hd += `L${r1(HAX[k])} ${r1(HAY[k])}`;
  for (let k = k1; k >= k0; k -= 1) hd += `L${r1(HBX[k])} ${r1(HBY[k])}`;
  out.hi = `${hd}Z`;
  out.hiOpacity = r1(0.3 * grow);

  // droplet at the tip and a swelling where the strand leaves the button
  out.tx = r1(x3);
  out.ty = r1(y3);
  out.tr = r1(Math.max(thin * 0.5 + 0.6, s.tipR * U * (0.6 + 0.4 * clamp(1.8 - stretch, 0, 1))) * grow);
  out.rx = r1(s.ax);
  out.ry = r1(s.ay);
  out.rr = r1(bw * 0.62 * smooth(0, 16, len));
  return out;
}

/* ---------------------------------------------------------------- */
/*  Component                                                        */
/* ---------------------------------------------------------------- */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * <VenomButton text="Save Bill" type="submit" onClick={handleSave} />
 *
 * Props: text, href, width, height, liquidColor, tentacleCount, magneticStrength,
 * intensity, animationSpeed, respectReducedMotion, as (custom element), onClick, className, style.
 * Any other prop is forwarded to the <button>/<a>.
 *
 * The black liquid is drawn in an SVG portalled to <body>, so no parent
 * (overflow:hidden, backdrop-filter, contain, z-index) can clip it.
 */
export default function VenomButton(props) {
  const { options, rest: restProps } = splitProps(props);
  const { text, width, height, liquidColor, tentacleCount, magneticStrength, intensity, animationSpeed } = options;
  const { as, href, onClick, onPointerDown, className = "", style, children, ...rest } = restProps;

  const Tag = as || (href ? "a" : "button");
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const svgRef = useRef(null);
  const clipRef = useRef(null);
  const pillRef = useRef(null);
  const els = useRef({ p: [], t: [], r: [], h: [] });
  const optsRef = useRef(options);
  optsRef.current = options; // always read fresh values inside the animation loop
  const clickRef = useRef(null); // set by the effect: plays the squash & bounce

  const [size, setSize] = useState({ w: width, h: height });
  const sizeRef = useRef(size);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // measure the untransformed button box
  useIsoLayoutEffect(() => {
    const el = btnRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w && h && (w !== sizeRef.current.w || h !== sizeRef.current.h)) {
        sizeRef.current = { w, h };
        setSize({ w, h });
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  /* ---------------------------------------------------------------- */
  /*  Animation engine                                                 */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const wrap = wrapRef.current;
    const btn = btnRef.current;
    if (!wrap || !btn) return undefined;

    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    // pass respectReducedMotion={false} to force the effect on even if the OS asks for less motion
    const isReduced = () => optsRef.current.respectReducedMotion && mqReduce.matches;
    const strands = createTentacles(tentacleCount);
    const e = els.current;
    e.p.length = e.t.length = e.r.length = e.h.length = tentacleCount;

    const act = { v: 0 }; // global activation, tweened by GSAP
    const click = { v: 0 }; // squash amount, tweened by GSAP
    const cursor = { x: -9999, y: -9999 }; // button-local
    const client = { x: -9999, y: -9999 }; // viewport
    const body = { x: 0, y: 0, vx: 0, vy: 0, rx: 0, rvx: 0, ry: 0, rvy: 0, sx: 1, svx: 0, sy: 1, svy: 0 };
    const sheen = { x: 50, y: 30 };
    const g = makeGeom();

    let near = false;
    let raf = null;
    let last = 0;
    let idle = 0;
    let clock = 0;
    let dt = 1;
    let pointerSpeed = 0;
    let rawMove = 0;
    let mergeCall = null;

    const speedOf = () => optsRef.current.animationSpeed;

    /* ---------- DOM output ---------- */
    const hideAll = () => {
      strands.forEach((s, i) => {
        if (e.p[i]) e.p[i].setAttribute("d", "");
        if (e.h[i]) e.h[i].setAttribute("d", "");
        if (e.t[i]) e.t[i].setAttribute("r", "0");
        if (e.r[i]) e.r[i].setAttribute("r", "0");
        s.shape.visible = false;
      });
      if (clipRef.current) clipRef.current.setAttribute("d", "");
      if (pillRef.current) pillRef.current.setAttribute("width", "0");
    };

    const writeShape = (s, i) => {
      const o = s.shape;
      const pEl = e.p[i];
      const tEl = e.t[i];
      const rEl = e.r[i];
      const hEl = e.h[i];
      if (!pEl || !tEl || !rEl || !hEl) return;
      if (!o.visible) {
        if (pEl.getAttribute("d")) {
          pEl.setAttribute("d", "");
          hEl.setAttribute("d", "");
          tEl.setAttribute("r", "0");
          rEl.setAttribute("r", "0");
        }
        return;
      }
      pEl.setAttribute("d", o.body);
      hEl.setAttribute("d", o.hi);
      hEl.setAttribute("fill-opacity", o.hiOpacity);
      tEl.setAttribute("cx", o.tx);
      tEl.setAttribute("cy", o.ty);
      tEl.setAttribute("r", o.tr);
      rEl.setAttribute("cx", o.rx);
      rEl.setAttribute("cy", o.ry);
      rEl.setAttribute("r", o.rr);
    };

    const resetStrands = () => {
      strands.forEach((s) => {
        gsap.killTweensOf(s);
        s.inited = false;
        s.life = 1;
        s.snapped = false;
        s.merge = 0;
        s.recoil = 0;
        s.len = 0;
      });
    };

    /* ---------- the frame ---------- */
    const frame = (time) => {
      raf = null;
      const { w, h } = sizeRef.current;
      if (!w || !h) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const o = optsRef.current;
      const speed = o.animationSpeed;
      const rawDt = clamp((time - last) / 16.667, 0.4, 2);
      last = time;
      dt = clamp(rawDt * speed, 0.2, 2.4);
      clock += (rawDt * speed) / 60;

      // cursor in button-local space; re-read every frame so scrolling is handled
      const rect = wrap.getBoundingClientRect();
      cursor.x = client.x - rect.left;
      cursor.y = client.y - rect.top;
      pointerSpeed += (rawMove / rawDt - pointerSpeed) * 0.3;
      rawMove = 0;

      const U = clamp(h / 50, 0.8, 1.7);
      const sv = svgRef.current;
      if (sv) sv.style.transform = `translate3d(${r1(rect.left - PAD)}px,${r1(rect.top - PAD)}px,0)`;

      const cv = click.v;
      const csx = 1 + CLICK.squashX * cv;
      const csy = 1 - CLICK.squashY * cv;

      setGeom(g, w, h, body, body.sx * csx, body.sy * csy);
      const cdist = capsuleDistance(g, cursor.x, cursor.y);
      if (client.x > -9000) setNear(cdist < TRIGGER_DISTANCE);
      const prox = clamp(1 - cdist / TRIGGER_DISTANCE, 0, 1);
      const a = act.v;
      const pr = prox * a;

      /* body: magnetic lean toward the cursor with an elastic wobble */
      const ms = o.magneticStrength;
      const ddx = cursor.x - w / 2;
      const ddy = cursor.y - h / 2;
      const dl = Math.hypot(ddx, ddy) || 1;
      const maxShift = 36 * ms;
      const tiltK = Math.min(1, ms * 3);
      springScalar(body, "x", "vx", (ddx / dl) * maxShift * pr, 0.1, 0.84, dt);
      springScalar(body, "y", "vy", (ddy / dl) * maxShift * 0.65 * pr, 0.1, 0.84, dt);
      springScalar(body, "ry", "rvy", clamp(ddx / (w / 2 + 140), -1, 1) * 8 * tiltK * pr, 0.1, 0.84, dt);
      springScalar(body, "rx", "rvx", -clamp(ddy / (h / 2 + 140), -1, 1) * 9 * tiltK * pr, 0.1, 0.84, dt);
      springScalar(body, "sx", "svx", 1 + 0.03 * Math.min(1, ms * 4) * pr, 0.1, 0.84, dt);
      springScalar(body, "sy", "svy", 1 - 0.015 * Math.min(1, ms * 4) * pr, 0.1, 0.84, dt);
      btn.style.transform = `perspective(900px) translate3d(${body.x.toFixed(2)}px,${body.y.toFixed(2)}px,0) rotateX(${body.rx.toFixed(2)}deg) rotateY(${body.ry.toFixed(2)}deg) scale(${(body.sx * csx).toFixed(4)},${(body.sy * csy).toFixed(4)})`;

      sheen.x += (clamp((cursor.x / w) * 100, -20, 120) - sheen.x) * 0.15 * dt;
      sheen.y += (clamp((cursor.y / h) * 100, -20, 120) - sheen.y) * 0.15 * dt;
      btn.style.setProperty("--mx", `${sheen.x.toFixed(1)}%`);
      btn.style.setProperty("--my", `${sheen.y.toFixed(1)}%`);
      btn.style.setProperty("--sheen", pr.toFixed(3));

      setGeom(g, w, h, body, body.sx * csx, body.sy * csy); // geometry now matches the moved body

      /* aim, then integrate */
      const ctx = { g, cursor, prox, act: a, intensity: o.intensity, U, clock, dt };
      for (let i = 0; i < strands.length; i += 1) aimTentacle(strands[i], ctx);

      for (let i = 0; i < strands.length; i += 1) {
        const s = strands[i];
        stepTentacle(s, strands[s.partner], dt);

        // snapping: too much stretch (or a violent flick) cuts the thread, which whips back
        const tension = s.len / (s.snapAt * U * Math.max(0.8, o.intensity)) + clamp(pointerSpeed / 40, 0, 1) * 0.2;
        if (!s.snapped && s.life > 0.9 && a > 0.3 && tension > 1) {
          s.snapped = true;
          s.cool = clock + rand(0.4, 1.2);
          s.recoil = 1;
          gsap.to(s, { life: 0, duration: 0.14 / speed, ease: "power3.in", overwrite: "auto" });
          gsap.to(s, { recoil: 0, duration: 0.8 / speed, ease: "power2.out", overwrite: "auto" });
        } else if (s.snapped && clock > s.cool && a > 0.3) {
          const d0 = Math.hypot(s.sc.x - s.ax, s.sc.y - s.ay);
          if ((d0 * s.reach) / (s.snapAt * U) < 0.85 || prox > 0.6) {
            s.snapped = false;
            gsap.to(s, { life: 1, duration: rand(0.7, 1.2) / speed, ease: "power2.out", overwrite: "auto" });
          }
        }
      }

      /* SVG: clip hole (the pill itself), fused pill rect, tentacles */
      const hw = g.half + g.r;
      const x0 = g.cx - hw;
      const x1 = g.cx + hw;
      const y0 = g.cy - g.r;
      const y1 = g.cy + g.r;
      const R = g.r;
      const W = w + PAD * 2;
      const H = h + PAD * 2;
      if (clipRef.current) {
        clipRef.current.setAttribute(
          "d",
          `M${-PAD} ${-PAD}H${W - PAD}V${H - PAD}H${-PAD}ZM${r1(x0 + R)} ${r1(y0)}H${r1(x1 - R)}A${r1(R)} ${r1(R)} 0 0 1 ${r1(x1 - R)} ${r1(y1)}H${r1(x0 + R)}A${r1(R)} ${r1(R)} 0 0 1 ${r1(x0 + R)} ${r1(y0)}Z`
        );
      }
      if (pillRef.current) {
        const pe = pillRef.current;
        pe.setAttribute("x", r1(x0 + 0.4));
        pe.setAttribute("y", r1(y0 + 0.4));
        pe.setAttribute("width", r1(hw * 2 - 0.8));
        pe.setAttribute("height", r1(R * 2 - 0.8));
        pe.setAttribute("rx", r1(R - 0.4));
      }
      for (let i = 0; i < strands.length; i += 1) {
        buildShape(strands[i], U, o.intensity);
        writeShape(strands[i], i);
      }

      /* stop the loop once everything has settled */
      if (a < 0.002 && !near && Math.abs(cv) < 0.002 && Math.abs(body.x) + Math.abs(body.y) < 0.05) idle += 1;
      else idle = 0;

      if (idle > 90) {
        hideAll();
        resetStrands();
        btn.style.transform = "";
        btn.style.removeProperty("--sheen");
        Object.assign(body, { x: 0, y: 0, vx: 0, vy: 0, rx: 0, rvx: 0, ry: 0, rvy: 0, sx: 1, svx: 0, sy: 1, svy: 0 });
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const ensureLoop = () => {
      if (raf === null) {
        last = performance.now();
        idle = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    /* ---------- activation ---------- */
    function setNear(value) {
      if (value === near) return;
      near = value;
      const speed = speedOf();
      gsap.to(act, {
        v: value ? 1 : 0,
        duration: (value ? 0.55 : 0.45) / speed,
        ease: value ? "power2.out" : "power2.inOut",
        overwrite: "auto",
      });
    }

    // distance from the pointer to the button edge, using the current layout
    const evalNear = () => {
      const { w, h } = sizeRef.current;
      if (!w || !h || client.x < -9000) return false;
      const rect = wrap.getBoundingClientRect();
      setGeom(g, w, h, body, body.sx, body.sy);
      const d = capsuleDistance(g, client.x - rect.left, client.y - rect.top);
      const isNear = d < TRIGGER_DISTANCE;
      setNear(isNear);
      if (isNear) ensureLoop();
      return isNear;
    };

    /* ---------- pointer (mouse, pen and touch) ---------- */
    const track = (ev) => {
      if (isReduced()) return false;
      if (client.x > -9000) rawMove += Math.hypot(ev.clientX - client.x, ev.clientY - client.y);
      client.x = ev.clientX;
      client.y = ev.clientY;
      return true;
    };
    const onMove = (ev) => {
      if (track(ev)) evalNear();
    };
    const release = () => {
      client.x = -9999;
      client.y = -9999;
      setNear(false);
    };
    const onUp = (ev) => {
      if (ev.pointerType !== "mouse") release(); // a lifted finger / pen is no longer "near"
    };
    const onOut = (ev) => {
      if (!ev.relatedTarget && ev.pointerType === "mouse") release();
    };
    const onScroll = () => {
      if (isReduced()) return;
      evalNear(); // the page moved under a stationary cursor
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    window.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("blur", release);
    document.documentElement.addEventListener("pointerleave", release);

    /* ---------- click: liquid compression + bounce ---------- */
    clickRef.current = () => {
      if (isReduced()) return;
      const speed = speedOf();
      ensureLoop();
      gsap
        .timeline()
        .to(click, { v: 1, duration: CLICK.press / speed, ease: "power2.out", overwrite: "auto" })
        .to(click, { v: 0, duration: CLICK.release / speed, ease: "elastic.out(1,0.3)" });
      // splash: every tentacle gets kicked upward and whips back
      strands.forEach((s) => {
        s.tip.vy -= rand(5, 12);
        s.tip.vx += rand(-4, 4);
        s.recoil = 1;
        gsap.to(s, { recoil: 0, duration: 0.9 / speed, ease: "power2.out", overwrite: "auto" });
      });
    };

    /* ---------- occasional merging of neighbouring tentacles ---------- */
    const mergeTick = () => {
      if (near && strands.length > 1) {
        const speed = speedOf();
        const i = Math.floor(Math.random() * (strands.length - 1));
        const A = strands[i];
        const B = strands[i + 1];
        if (A.merge < 0.05 && B.merge < 0.05) {
          A.partner = i + 1;
          B.partner = i;
          gsap
            .timeline()
            .to([A, B], { merge: rand(0.6, 1), duration: rand(0.35, 0.6) / speed, ease: "power2.inOut" })
            .to(
              [A, B],
              { merge: 0, duration: rand(0.7, 1.1) / speed, ease: "elastic.out(1,0.45)" },
              `+=${rand(0.4, 1.2).toFixed(2)}`
            );
        }
      }
      mergeCall = gsap.delayedCall(rand(0.5, 1.3) / speedOf(), mergeTick);
    };
    mergeCall = gsap.delayedCall(1, mergeTick);

    /* ---------- cleanup ---------- */
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointerout", onOut);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("blur", release);
      document.documentElement.removeEventListener("pointerleave", release);
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      if (mergeCall) mergeCall.kill();
      gsap.killTweensOf(act);
      gsap.killTweensOf(click);
      strands.forEach((s) => gsap.killTweensOf(s));
      clickRef.current = null;
      btn.style.transform = "";
      btn.style.removeProperty("--sheen");
    };
  }, [tentacleCount]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  const W = size.w + PAD * 2;
  const H = size.h + PAD * 2;
  const ids = Array.from({ length: tentacleCount }, (_, i) => i);

  const handlePointerDown = (ev) => {
    if (onPointerDown) onPointerDown(ev);
    if (clickRef.current) clickRef.current();
  };
  const handleClick = (ev) => {
    if (ev.detail === 0 && clickRef.current) clickRef.current(); // keyboard activation
    if (onClick) onClick(ev);
  };

  const buttonProps = {
    ref: btnRef,
    className: "venomBtn",
    style: {
      width,
      height,
      fontSize: Math.round(height * 0.32),
      "--liquid": liquidColor,
    },
    onPointerDown: handlePointerDown,
    onClick: handleClick,
    ...(Tag === "button" ? { type: "button" } : {}),
    ...(href ? { href } : {}),
    ...rest,
  };

  const goo = `${uid}goo`;
  const soft = `${uid}soft`;
  const clip = `${uid}clip`;

  return (
    <div ref={wrapRef} className={`venomWrap ${className}`.trim()} style={style}>
      <Tag {...buttonProps}>
        <span className="venomLabel">{children ?? text}</span>
      </Tag>

      {mounted &&
        createPortal(
          <svg
            ref={svgRef}
            className="venomSvg"
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            aria-hidden="true"
            focusable="false"
            data-venom-liquid=""
          >
            <defs>
              {/* gooey: blur + alpha threshold fuses nearby shapes into one liquid mass */}
              <filter
                id={goo}
                filterUnits="userSpaceOnUse"
                x={-PAD}
                y={-PAD}
                width={W}
                height={H}
                colorInterpolationFilters="sRGB"
              >
                <feGaussianBlur in="SourceGraphic" stdDeviation={GOO.blur} result="b" />
                <feColorMatrix
                  in="b"
                  mode="matrix"
                  values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${GOO.mul} ${GOO.off}`}
                />
              </filter>
              <filter id={soft} filterUnits="userSpaceOnUse" x={-PAD} y={-PAD} width={W} height={H}>
                <feGaussianBlur stdDeviation={SHADOW.blur} />
              </filter>
              {/* everything is clipped to the outside of the pill, so liquid never covers the label */}
              <clipPath id={clip}>
                <path ref={clipRef} clipRule="evenodd" d="" />
              </clipPath>
            </defs>

            <g transform={`translate(${PAD} ${PAD})`}>
              <g clipPath={`url(#${clip})`}>
                {/* soft cast shadow on the page */}
                <g
                  filter={`url(#${soft})`}
                  transform={`translate(${SHADOW.dx} ${SHADOW.dy})`}
                  opacity={SHADOW.opacity}
                  fill={liquidColor}
                >
                  {ids.map((i) => (
                    <use key={`sp${i}`} href={`#${uid}p${i}`} />
                  ))}
                  {ids.map((i) => (
                    <use key={`st${i}`} href={`#${uid}t${i}`} />
                  ))}
                </g>

                {/* the liquid itself */}
                <g filter={`url(#${goo})`} fill={liquidColor}>
                  <rect ref={pillRef} x="0" y="0" width="0" height="0" />
                  {ids.map((i) => (
                    <circle
                      key={`r${i}`}
                      ref={(el) => {
                        els.current.r[i] = el;
                      }}
                      r="0"
                    />
                  ))}
                  {ids.map((i) => (
                    <path
                      key={`p${i}`}
                      id={`${uid}p${i}`}
                      ref={(el) => {
                        els.current.p[i] = el;
                      }}
                      d=""
                    />
                  ))}
                  {ids.map((i) => (
                    <circle
                      key={`t${i}`}
                      id={`${uid}t${i}`}
                      ref={(el) => {
                        els.current.t[i] = el;
                      }}
                      r="0"
                    />
                  ))}
                </g>

                {/* wet specular streaks */}
                <g fill={HIGHLIGHT_COLOR}>
                  {ids.map((i) => (
                    <path
                      key={`h${i}`}
                      ref={(el) => {
                        els.current.h[i] = el;
                      }}
                      d=""
                      fillOpacity="0"
                    />
                  ))}
                </g>
              </g>
            </g>
          </svg>,
          document.body
        )}
    </div>
  );
}
