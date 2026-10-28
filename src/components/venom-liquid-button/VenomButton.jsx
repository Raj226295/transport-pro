"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import styles from "./VenomButton.module.css";
import { CLICK, GOO, HIGHLIGHT_COLOR, PAD, SHADOW, TRIGGER_DISTANCE, splitProps } from "./venomConfig.js";
import {
  aimTentacle,
  buildShape,
  capsuleDistance,
  clamp,
  createTentacles,
  makeGeom,
  r1,
  rand,
  setGeom,
  smooth,
  springScalar,
  stepTentacle,
} from "./venomPhysics.js";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * <VenomButton text="Our Services" href="/services" />
 *
 * Props: text, href, width, height, liquidColor, tentacleCount, magneticStrength,
 * intensity, animationSpeed, as (custom element, e.g. next/link), onClick, className, style.
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
      if (mqReduce.matches) return false;
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
      if (mqReduce.matches) return;
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
      if (mqReduce.matches) return;
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
    className: styles.button,
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
    <div ref={wrapRef} className={`${styles.wrap} ${className}`.trim()} style={style}>
      <Tag {...buttonProps}>
        <span className={styles.label}>{children ?? text}</span>
      </Tag>

      {mounted &&
        createPortal(
          <svg
            ref={svgRef}
            className={styles.svg}
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
