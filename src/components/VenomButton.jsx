"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import styles from "./VenomButton.module.css";

/* ------------------------------------------------------------------ */
/*  Tuning                                                             */
/* ------------------------------------------------------------------ */
const PAD = 260; // SVG overlay extends this far past the button (keep in sync with the CSS `left/top`)
const TRIGGER = 180; // px from the button edge where the goo wakes up
const STRANDS = 12; // 8-15
const SAMPLES = 20; // points sampled along each Bézier strand
const LIGHT = { x: -0.55, y: -0.83 }; // light comes from the top-left
const INK = "#050506";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const r1 = (v) => Math.round(v * 10) / 10;
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// scratch buffers, shared because rendering is synchronous
const LX = new Float32Array(SAMPLES + 1);
const LY = new Float32Array(SAMPLES + 1);
const RX = new Float32Array(SAMPLES + 1);
const RY = new Float32Array(SAMPLES + 1);
const HAX = new Float32Array(SAMPLES + 1);
const HAY = new Float32Array(SAMPLES + 1);
const HBX = new Float32Array(SAMPLES + 1);
const HBY = new Float32Array(SAMPLES + 1);

const pt = () => ({ x: 0, y: 0, vx: 0, vy: 0 });

function createStrands() {
  const list = Array.from({ length: STRANDS }, () => ({
    offset: rand(-32, 32), // where along the edge this strand roots
    base: rand(7, 13), // root thickness
    tipR: rand(1.8, 3.4), // droplet at the tip
    reach: rand(0.72, 1.02), // how much of the way to the cursor it gets
    rest: rand(70, 130), // length at which it starts thinning
    curve: rand(-1, 1) * rand(0.25, 0.9),
    wa: rand(3, 10), // wobble amplitude
    wf: rand(1.2, 3.4), // wobble frequency
    ph: rand(0, 6.28),
    follow: rand(0.05, 0.22), // lag behind the cursor (movement delay)
    kTip: rand(0.05, 0.12), // elasticity
    dTip: rand(0.78, 0.9), // damping (lower = less wobble)
    kMid: rand(0.03, 0.08),
    dMid: rand(0.8, 0.92),
    thinRate: rand(0.5, 1.4),
    snapAt: rand(120, 260), // stretch length at which it snaps
    appear: rand(0, 0.16),
    // live state
    partner: 0,
    life: 1,
    snapped: false,
    cool: 0,
    merge: 0,
    recoil: 0,
    inited: false,
    hidden: true,
    len: 0,
    ax: 0,
    ay: 0,
    nx: 0,
    ny: 1,
    sc: { x: 0, y: 0 },
    tip: pt(),
    c1: pt(),
    c2: pt(),
    T: { x: 0, y: 0 },
    M1: { x: 0, y: 0 },
    M2: { x: 0, y: 0 },
  }));
  // neighbours along the edge merge with each other
  list.sort((a, b) => a.offset - b.offset);
  list.forEach((s, i) => {
    s.partner = i < list.length - 1 ? i + 1 : i - 1;
  });
  return list;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function VenomButton({ text = "Let's Collaborate", href, onClick, icon, arrow = false, variant = "default", className = "", ...rest }) {
  const Tag = href ? "a" : "button";
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const clipRef = useRef(null);
  const pillRef = useRef(null);
  const els = useRef({ p: [], t: [], r: [], h: [] });

  const [size, setSize] = useState({ w: 0, h: 0 });
  const sizeRef = useRef(size);

  // measure the untransformed button box
  useIsoLayoutEffect(() => {
    const el = btnRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w !== sizeRef.current.w || h !== sizeRef.current.h) {
        sizeRef.current = { w, h };
        setSize({ w, h });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const btn = btnRef.current;
    if (!wrap || !btn) return undefined;

    // accessibility + device gates
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Hybrid touch laptops can have a coarse primary pointer and still support a mouse.
    const noHover = window.matchMedia("(any-hover: none)").matches;
    if (reduce || noHover) return undefined;

    const strands = createStrands();
    const act = { v: 0 }; // global activation, tweened by GSAP
    const cursor = { x: -9999, y: -9999 };
    const client = { x: -9999, y: -9999 };
    const body = { x: 0, y: 0, vx: 0, vy: 0, rx: 0, rvx: 0, ry: 0, rvy: 0, sx: 1, svx: 0, sy: 1, svy: 0 };
    const sheen = { x: 50, y: 30 };
    const g = { cx: 0, cy: 0, r: 0, half: 0 };
    const E = { x: 0, y: 0, nx: 0, ny: -1, dist: 0 };
    const Q = { x: 0, y: 0, nx: 0, ny: -1, dist: 0 };

    let near = false;
    let raf = null;
    let last = 0;
    let idle = 0;
    let speed = 0;
    let rawMove = 0;
    let mergeCall = null;

    /* ---------- geometry: the pill is a capsule ---------- */
    const setGeom = () => {
      const { w, h } = sizeRef.current;
      g.cx = w / 2 + body.x;
      g.cy = h / 2 + body.y;
      g.r = (h * body.sy) / 2;
      g.half = Math.max(0, (w * body.sx) / 2 - g.r);
    };

    // nearest boundary point + outward normal + signed distance (negative inside)
    const capsule = (px, py, out) => {
      const cxs = clamp(px, g.cx - g.half, g.cx + g.half);
      const dx = px - cxs;
      const dy = py - g.cy;
      const d = Math.hypot(dx, dy);
      if (d < 1e-3) {
        out.nx = 0;
        out.ny = -1;
        out.x = cxs;
        out.y = g.cy - g.r;
        out.dist = -g.r;
        return out.dist;
      }
      out.nx = dx / d;
      out.ny = dy / d;
      out.x = cxs + out.nx * g.r;
      out.y = g.cy + out.ny * g.r;
      out.dist = d - g.r;
      return out.dist;
    };

    /* ---------- rendering of one strand as a tapered Bézier ribbon ---------- */
    const render = (s, i) => {
      const pEl = els.current.p[i];
      const tEl = els.current.t[i];
      const rEl = els.current.r[i];
      const hEl = els.current.h[i];
      if (!pEl || !tEl || !rEl || !hEl) return;

      const len = s.len;
      const grow = smooth(1.5, 26, len);
      if (grow < 0.01) {
        if (!s.hidden) {
          pEl.setAttribute("d", "");
          hEl.setAttribute("d", "");
          tEl.setAttribute("r", "0");
          rEl.setAttribute("r", "0");
          s.hidden = true;
        }
        return;
      }
      s.hidden = false;

      const stretch = len / s.rest;
      const thin = clamp((s.base * 0.3) / (1 + s.thinRate * Math.max(0, stretch - 0.7)), 1.5, 6);
      const bw = s.base * (1 + 0.25 * clamp(s.merge, 0, 1));

      const x0 = s.ax - s.nx * 7;
      const y0 = s.ay - s.ny * 7;
      const x1 = s.c1.x;
      const y1 = s.c1.y;
      const x2 = s.c2.x;
      const y2 = s.c2.y;
      const x3 = s.tip.x;
      const y3 = s.tip.y;

      // highlight rides the side facing the light
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
        const w = (thin + (bw - thin) * Math.pow(mt, 3.2)) * 0.5 * grow; // half width
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
      pEl.setAttribute("d", `${d}Z`);

      const k0 = 2;
      const k1 = SAMPLES - 2;
      let hd = `M${r1(HAX[k0])} ${r1(HAY[k0])}`;
      for (let k = k0 + 1; k <= k1; k += 1) hd += `L${r1(HAX[k])} ${r1(HAY[k])}`;
      for (let k = k1; k >= k0; k -= 1) hd += `L${r1(HBX[k])} ${r1(HBY[k])}`;
      hEl.setAttribute("d", `${hd}Z`);
      hEl.setAttribute("fill-opacity", r1(0.42 * grow));

      // droplet at the tip + swelling at the root
      const tipR = Math.max(thin * 0.5 + 0.6, s.tipR * (0.6 + 0.4 * clamp(1.8 - stretch, 0, 1))) * grow;
      tEl.setAttribute("cx", r1(x3));
      tEl.setAttribute("cy", r1(y3));
      tEl.setAttribute("r", r1(tipR));
      rEl.setAttribute("cx", r1(s.ax));
      rEl.setAttribute("cy", r1(s.ay));
      rEl.setAttribute("r", r1(bw * 0.62 * smooth(0, 16, len)));
    };

    const hideAll = () => {
      strands.forEach((s, i) => {
        const e = els.current;
        if (e.p[i]) e.p[i].setAttribute("d", "");
        if (e.h[i]) e.h[i].setAttribute("d", "");
        if (e.t[i]) e.t[i].setAttribute("r", "0");
        if (e.r[i]) e.r[i].setAttribute("r", "0");
        s.hidden = true;
      });
      if (clipRef.current) clipRef.current.setAttribute("d", "");
      if (pillRef.current) pillRef.current.setAttribute("width", "0");
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

    /* ---------- spring helper (semi-implicit Euler, frame-rate aware) ---------- */
    let dt = 1;
    const spring = (o, tx, ty, k, damp) => {
      const f = Math.pow(damp, dt);
      o.vx = (o.vx + (tx - o.x) * k * dt) * f;
      o.vy = (o.vy + (ty - o.y) * k * dt) * f;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
    };
    const spr1 = (o, p, v, target, k, damp) => {
      o[v] = (o[v] + (target - o[p]) * k * dt) * Math.pow(damp, dt);
      o[p] += o[v] * dt;
    };

    /* ---------- the frame ---------- */
    const frame = (time) => {
      raf = null;
      const { w, h } = sizeRef.current;
      if (!w) {
        raf = requestAnimationFrame(frame);
        return;
      }
      dt = clamp((time - last) / 16.667, 0.4, 2);
      last = time;
      const now = time / 1000;

      // cursor in button-local space (re-read each frame so scrolling is handled)
      const rect = wrap.getBoundingClientRect();
      cursor.x = client.x - rect.left;
      cursor.y = client.y - rect.top;

      speed += (rawMove / dt - speed) * 0.3;
      rawMove = 0;

      setGeom();
      const cdist = capsule(cursor.x, cursor.y, E);
      const prox = clamp(1 - cdist / TRIGGER, 0, 1);
      const outside = smooth(-2, 12, cdist);
      const a = act.v;

      /* body: leans toward the cursor with an elastic wobble */
      const pr = prox * a;
      const ddx = cursor.x - w / 2;
      const ddy = cursor.y - h / 2;
      const dl = Math.hypot(ddx, ddy) || 1;
      spr1(body, "x", "vx", (ddx / dl) * 8 * pr, 0.1, 0.84);
      spr1(body, "y", "vy", (ddy / dl) * 5 * pr, 0.1, 0.84);
      spr1(body, "ry", "rvy", clamp(ddx / (w / 2 + 140), -1, 1) * 7 * pr, 0.1, 0.84);
      spr1(body, "rx", "rvx", -clamp(ddy / (h / 2 + 140), -1, 1) * 8 * pr, 0.1, 0.84);
      spr1(body, "sx", "svx", 1 + 0.03 * pr, 0.1, 0.84);
      spr1(body, "sy", "svy", 1 - 0.015 * pr, 0.1, 0.84);
      btn.style.transform = `perspective(900px) translate3d(${body.x.toFixed(2)}px,${body.y.toFixed(2)}px,0) rotateX(${body.rx.toFixed(2)}deg) rotateY(${body.ry.toFixed(2)}deg) scale(${body.sx.toFixed(4)},${body.sy.toFixed(4)})`;
      sheen.x += (clamp((cursor.x / w) * 100, -20, 120) - sheen.x) * 0.15 * dt;
      sheen.y += (clamp((cursor.y / h) * 100, -20, 120) - sheen.y) * 0.15 * dt;
      btn.style.setProperty("--mx", `${sheen.x.toFixed(1)}%`);
      btn.style.setProperty("--my", `${sheen.y.toFixed(1)}%`);
      btn.style.setProperty("--sheen", pr.toFixed(3));

      setGeom(); // geometry now matches the body we just moved

      /* pass 1: anchors + targets */
      for (let i = 0; i < strands.length; i += 1) {
        const s = strands[i];
        if (!s.inited) {
          s.sc.x = cursor.x;
          s.sc.y = cursor.y;
        } else {
          const f = 1 - Math.pow(1 - s.follow, dt);
          s.sc.x += (cursor.x - s.sc.x) * f;
          s.sc.y += (cursor.y - s.sc.y) * f;
        }

        // root: nearest edge point to this strand's (lagging) cursor, slid along the tangent
        capsule(s.sc.x, s.sc.y, E);
        capsule(E.x - E.ny * s.offset, E.y + E.nx * s.offset, Q);
        s.ax = Q.x;
        s.ay = Q.y;
        s.nx = Q.nx;
        s.ny = Q.ny;

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
        const ux = vx / d0;
        const uy = vy / d0;
        const px = -uy;
        const py = ux;

        const gate = smooth(s.appear * 0.5, s.appear * 0.5 + 0.06, prox) * a * outside * s.life;
        const Lt = d0 * s.reach * gate;
        const wob =
          (Math.sin(now * s.wf + s.ph) + 0.5 * Math.sin(now * s.wf * 2.3 + s.ph * 1.7)) * s.wa * smooth(0, 70, Lt);

        s.T.x = s.ax + ux * Lt + px * wob;
        s.T.y = s.ay + uy * Lt + py * wob;

        const stretchT = Lt / s.rest;
        const sag = Lt * 0.11 * clamp(1.25 - stretchT * 0.55, 0, 1); // viscous sag, gone when taut
        s.M1.x = s.ax + ux * Lt * 0.34 + px * s.curve * Lt * 0.3;
        s.M1.y = s.ay + uy * Lt * 0.34 + py * s.curve * Lt * 0.3 + sag;
        s.M2.x = s.ax + ux * Lt * 0.68 - px * s.curve * Lt * 0.2 + px * wob * 0.5;
        s.M2.y = s.ay + uy * Lt * 0.68 - py * s.curve * Lt * 0.2 + py * wob * 0.5 + sag * 1.3;
      }

      /* pass 2: springs, merging, snapping */
      for (let i = 0; i < strands.length; i += 1) {
        const s = strands[i];
        const P = strands[s.partner];
        const m = clamp(s.merge, -0.35, 1) * 0.5; // 0.5 = both tips meet at the midpoint
        const tx = s.T.x + (P.T.x - s.T.x) * m;
        const ty = s.T.y + (P.T.y - s.T.y) * m;
        const m1x = s.M1.x + (P.M1.x - s.M1.x) * m * 0.6;
        const m1y = s.M1.y + (P.M1.y - s.M1.y) * m * 0.6;
        const m2x = s.M2.x + (P.M2.x - s.M2.x) * m;
        const m2y = s.M2.y + (P.M2.y - s.M2.y) * m;

        spring(s.tip, tx, ty, s.kTip * (1 + 1.8 * s.recoil), s.dTip);
        spring(s.c2, m2x, m2y, s.kMid * 1.3, s.dMid);
        spring(s.c1, m1x, m1y, s.kMid, s.dMid);

        s.len = Math.hypot(s.tip.x - s.ax, s.tip.y - s.ay);

        const tension = s.len / s.snapAt + clamp(speed / 40, 0, 1) * 0.2;
        if (!s.snapped && s.life > 0.9 && a > 0.3 && tension > 1) {
          s.snapped = true;
          s.cool = now + rand(0.4, 1.2);
          s.recoil = 1;
          gsap.to(s, { life: 0, duration: 0.14, ease: "power3.in", overwrite: "auto" });
          gsap.to(s, { recoil: 0, duration: 0.8, ease: "power2.out", overwrite: "auto" });
        } else if (s.snapped && now > s.cool && a > 0.3) {
          const d0 = Math.hypot(s.sc.x - s.ax, s.sc.y - s.ay);
          if ((d0 * s.reach) / s.snapAt < 0.85) {
            s.snapped = false;
            gsap.to(s, { life: 1, duration: rand(0.7, 1.2), ease: "power2.out", overwrite: "auto" });
          }
        }
      }

      /* SVG: clip hole (the pill itself), fused pill rect, strands */
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
      for (let i = 0; i < strands.length; i += 1) render(strands[i], i);

      /* idle detection: stop the loop once everything has settled */
      if (a < 0.002 && !near) idle += 1;
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

    /* ---------- pointer ---------- */
    const setNear = (value) => {
      if (value === near) return;
      near = value;
      gsap.to(act, {
        v: value ? 1 : 0,
        duration: value ? 0.55 : 0.45,
        ease: value ? "power2.out" : "power2.inOut",
        overwrite: "auto",
      });
    };

    const onMove = (e) => {
      if (e.pointerType === "touch") return;
      const { w } = sizeRef.current;
      if (!w) return;
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (client.x > -9000) rawMove += Math.hypot(e.clientX - client.x, e.clientY - client.y);
      client.x = e.clientX;
      client.y = e.clientY;
      setGeom();
      const d = capsule(x, y, E);
      const isNear = d < TRIGGER;
      setNear(isNear);
      if (isNear) ensureLoop();
    };

    const onLeave = () => setNear(false);
    const onOut = (e) => {
      if (!e.relatedTarget) onLeave();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("blur", onLeave);
    document.documentElement.addEventListener("pointerleave", onLeave);

    /* ---------- occasional merging of neighbouring strands ---------- */
    const mergeTick = () => {
      if (near) {
        const i = Math.floor(Math.random() * (strands.length - 1));
        const A = strands[i];
        const B = strands[i + 1];
        if (A.merge < 0.05 && B.merge < 0.05) {
          A.partner = i + 1;
          B.partner = i;
          gsap
            .timeline()
            .to([A, B], { merge: rand(0.6, 1), duration: rand(0.35, 0.6), ease: "power2.inOut" })
            .to([A, B], { merge: 0, duration: rand(0.7, 1.1), ease: "elastic.out(1,0.45)" }, `+=${rand(0.4, 1.2).toFixed(2)}`);
        }
      }
      mergeCall = gsap.delayedCall(rand(0.5, 1.3), mergeTick);
    };
    mergeCall = gsap.delayedCall(1, mergeTick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onOut);
      window.removeEventListener("blur", onLeave);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (raf !== null) cancelAnimationFrame(raf);
      if (mergeCall) mergeCall.kill();
      gsap.killTweensOf(act);
      strands.forEach((s) => gsap.killTweensOf(s));
      btn.style.transform = "";
    };
  }, []);

  const W = size.w + PAD * 2;
  const H = size.h + PAD * 2;
  const ids = Array.from({ length: STRANDS }, (_, i) => i);

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className}`.trim()}>
      <Tag ref={btnRef} className={`${styles.button} ${variant === "compact" ? styles.compact : ""} ${className}`.trim()} {...(href ? { href } : { type: "button" })} onClick={onClick} {...rest}>
        <span className={styles.content}>
          {icon && <span className={styles.icon}>{icon}</span>}
          <span className={styles.label}>{text}</span>
          {arrow && <span className={styles.arrow} aria-hidden="true">→</span>}
        </span>
      </Tag>

      <svg
        className={styles.svg}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* gooey: blur + alpha threshold fuses nearby shapes into one liquid mass */}
          <filter
            id={`${uid}goo`}
            filterUnits="userSpaceOnUse"
            x={-PAD}
            y={-PAD}
            width={W}
            height={H}
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b" />
            <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -6.5" />
          </filter>
          <filter id={`${uid}soft`} filterUnits="userSpaceOnUse" x={-PAD} y={-PAD} width={W} height={H}>
            <feGaussianBlur stdDeviation="7" />
          </filter>
          {/* everything is clipped to the outside of the pill, so strands never draw over the button face */}
          <clipPath id={`${uid}clip`}>
            <path ref={clipRef} clipRule="evenodd" d="" />
          </clipPath>
        </defs>

        <g transform={`translate(${PAD} ${PAD})`}>
          <g clipPath={`url(#${uid}clip)`}>
            {/* soft cast shadow of the strands on the white page */}
            <g filter={`url(#${uid}soft)`} transform="translate(8 16)" opacity="0.26" fill={INK}>
              {ids.map((i) => (
                <use key={`sp${i}`} href={`#${uid}p${i}`} />
              ))}
              {ids.map((i) => (
                <use key={`st${i}`} href={`#${uid}t${i}`} />
              ))}
            </g>

            {/* the liquid itself */}
            <g filter={`url(#${uid}goo)`} fill={INK}>
              <rect ref={pillRef} x="0" y="0" width="0" height="0" />
              {ids.map((i) => (
                <circle key={`r${i}`} ref={(el) => {
                  els.current.r[i] = el;
                }} r="0" />
              ))}
              {ids.map((i) => (
                <path key={`p${i}`} id={`${uid}p${i}`} ref={(el) => {
                  els.current.p[i] = el;
                }} d="" />
              ))}
              {ids.map((i) => (
                <circle key={`t${i}`} id={`${uid}t${i}`} ref={(el) => {
                  els.current.t[i] = el;
                }} r="0" />
              ))}
            </g>

            {/* wet specular streaks on each strand */}
            <g fill="#fff">
              {ids.map((i) => (
                <path key={`h${i}`} ref={(el) => {
                  els.current.h[i] = el;
                }} d="" fillOpacity="0" />
              ))}
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
