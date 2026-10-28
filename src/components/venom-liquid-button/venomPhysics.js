/**
 * venomPhysics.js
 * Framework-free maths for the Venom liquid: tentacle personalities, capsule geometry,
 * spring integration, aiming (upward + toward the cursor) and the Bézier ribbon outline.
 * Nothing in here touches React, the DOM or GSAP, so it is easy to unit-test.
 */
import { SAMPLES, LIGHT } from "./venomConfig.js";

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rand = (a, b) => a + Math.random() * (b - a);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const r1 = (v) => Math.round(v * 10) / 10;

const pt = () => ({ x: 0, y: 0, vx: 0, vy: 0 });
const v2 = () => ({ x: 0, y: 0 });

/* ------------------------------------------------------------------ */
/*  Tentacles                                                          */
/* ------------------------------------------------------------------ */

/**
 * Creates `count` tentacles. Each one gets its own personality: thickness, height,
 * curvature, elasticity, damping, wobble and "movement delay" (how far it lags the cursor).
 */
export function createTentacles(count) {
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
export const makeGeom = () => ({ cx: 0, cy: 0, r: 0, half: 0 });

/** Fits the capsule to the button box, including magnetic offset and squash. */
export function setGeom(g, w, h, body, sx = 1, sy = 1) {
  g.cx = w / 2 + body.x;
  g.cy = h / 2 + body.y;
  g.r = (h * sy) / 2;
  g.half = Math.max(0, (w * sx) / 2 - g.r);
}

/** Signed distance from a point to the capsule edge (negative inside). */
export function capsuleDistance(g, px, py) {
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
export function springPoint(o, tx, ty, k, damp, dt) {
  const f = Math.pow(damp, dt);
  o.vx = (o.vx + (tx - o.x) * k * dt) * f;
  o.vy = (o.vy + (ty - o.y) * k * dt) * f;
  o.x += o.vx * dt;
  o.y += o.vy * dt;
}

/** 1-D spring on o[p] with velocity o[v]. */
export function springScalar(o, p, v, target, k, damp, dt) {
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
export function aimTentacle(s, ctx) {
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
export function stepTentacle(s, P, dt) {
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
export function buildShape(s, U, intensity) {
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
