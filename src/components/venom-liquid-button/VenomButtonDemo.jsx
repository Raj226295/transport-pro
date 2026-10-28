"use client";

import { useState } from "react";
import VenomButton from "./VenomButton.jsx";
import { DEFAULTS, LIMITS } from "./venomConfig.js";

/**
 * Stand-alone playground. Render <VenomButtonDemo /> anywhere (see README).
 * - top: a live control panel (tentacles, intensity, speed, magnetic pull)
 * - middle: three independent buttons with different colours / sizes
 * - a glass card with overflow:hidden, to prove the liquid is never clipped
 * - bottom: a button far below the fold, to test cursor tracking after scrolling
 */
const page = {
  minHeight: "100vh",
  background: "#fff",
  color: "#0b0b0d",
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
  padding: "56px 24px 40px",
  boxSizing: "border-box",
};
const section = { maxWidth: 880, margin: "0 auto 72px" };
const h2 = { fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b6f76", margin: "0 0 20px" };
const row = { display: "flex", flexWrap: "wrap", gap: 56, alignItems: "center", justifyContent: "center", padding: "90px 0 40px" };
const card = {
  position: "relative",
  overflow: "hidden", // deliberately hostile: the liquid must still show outside the card
  padding: "90px 80px 60px",
  borderRadius: 28,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  boxShadow: "0 20px 60px -30px rgba(0,0,0,0.25)",
  display: "flex",
  justifyContent: "center",
};

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#3b3e44" }}>
      <span style={{ display: "flex", justifyContent: "space-between" }}>
        {label}
        <b style={{ fontVariantNumeric: "tabular-nums" }}>{value}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export default function VenomButtonDemo() {
  const [cfg, setCfg] = useState({
    tentacleCount: DEFAULTS.tentacleCount,
    intensity: DEFAULTS.intensity,
    animationSpeed: DEFAULTS.animationSpeed,
    magneticStrength: DEFAULTS.magneticStrength,
  });
  const [clicks, setClicks] = useState(0);
  const set = (key) => (value) => setCfg((c) => ({ ...c, [key]: value }));

  return (
    <div style={page}>
      <section style={section}>
        <h2 style={h2}>Venom liquid button — playground</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 20 }}>
          <Slider label="tentacleCount" value={cfg.tentacleCount} min={LIMITS.tentacleCount[0]} max={LIMITS.tentacleCount[1]} step={1} onChange={set("tentacleCount")} />
          <Slider label="intensity" value={cfg.intensity} min={0.3} max={2} step={0.1} onChange={set("intensity")} />
          <Slider label="animationSpeed" value={cfg.animationSpeed} min={0.25} max={3} step={0.25} onChange={set("animationSpeed")} />
          <Slider label="magneticStrength" value={cfg.magneticStrength} min={0} max={1} step={0.05} onChange={set("magneticStrength")} />
        </div>

        <div style={row}>
          <VenomButton
            text="Our Services"
            href="#services"
            width={190}
            height={54}
            liquidColor="#050505"
            {...cfg}
            data-testid="hero"
            onClick={(e) => {
              e.preventDefault();
              setClicks((n) => n + 1);
            }}
          />
        </div>
        <p style={{ textAlign: "center", color: "#6b6f76", fontSize: 14, margin: 0 }}>
          Move the cursor within 150px of the button, click it, or tap it on a phone. Clicks: <b>{clicks}</b>
        </p>
      </section>

      <section style={section}>
        <h2 style={h2}>Independent instances</h2>
        <div style={row}>
          <VenomButton text="Get Started" width={170} height={50} tentacleCount={5} onClick={() => {}} />
          <VenomButton text="Contact Us" width={190} height={54} liquidColor="#0b1a33" tentacleCount={8} intensity={1.2} onClick={() => {}} />
          <VenomButton text="Pricing" width={150} height={46} liquidColor="#1b0b2e" tentacleCount={6} animationSpeed={1.5} onClick={() => {}} />
        </div>
      </section>

      <section style={section}>
        <h2 style={h2}>Inside an overflow:hidden glass card</h2>
        <div style={card}>
          <VenomButton text="Save Bill" width={160} height={50} tentacleCount={7} data-testid="card" onClick={() => {}} />
        </div>
      </section>

      <section style={{ ...section, minHeight: "70vh" }}>
        <h2 style={h2}>Scroll test — keep the cursor still and scroll</h2>
        <div style={{ height: "42vh" }} />
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
          <VenomButton text="Scroll Test" width={190} height={54} data-testid="scroll" onClick={() => {}} />
        </div>
      </section>
    </div>
  );
}
