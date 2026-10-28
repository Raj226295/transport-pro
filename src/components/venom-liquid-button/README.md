# Venom Liquid Button

A glossy jet-black pill button that grows physics-driven black liquid tentacles when the cursor (or a finger) comes within **150px**. React + GSAP + SVG (Bézier ribbons, gooey filter) + CSS Modules + `requestAnimationFrame`.

```jsx
<VenomButton
  text="Our Services"
  href="/services"
  width={190}
  height={54}
  liquidColor="#050505"
  tentacleCount={7}
  magneticStrength={0.25}
  intensity={1}
  animationSpeed={1}
/>
```

## Files

| File | Job |
| --- | --- |
| `VenomButton.jsx` | The component: pointer handling, animation loop, SVG overlay, click bounce, cleanup |
| `venomPhysics.js` | Pure maths: tentacle personalities, capsule geometry, springs, aiming, Bézier ribbon outline |
| `venomConfig.js` | Constants (trigger distance, SVG padding, filter values) and prop normalising / clamping |
| `VenomButton.module.css` | Glossy button, cyan under-glow, SVG overlay, reduced-motion rules |
| `VenomButtonDemo.jsx` | Playground: live sliders, independent instances, glass card, scroll test |
| `package.json` | Peer dependencies (`react`, `react-dom`, `gsap`) and entry points |

## Install

The component needs React 18+ and GSAP 3.12+ in your project:

```bash
npm install gsap
```

Copy this whole folder into your project (see **Copy into any project** below). Nothing in it has to be edited.

## Run the demo

The demo is a normal React component, so run it inside any Vite project:

```bash
npm create vite@latest venom-demo -- --template react
cd venom-demo
npm install
npm install gsap
# copy the venom-liquid-button folder into venom-demo/src/
```

Replace `src/App.jsx` with:

```jsx
import VenomButtonDemo from "./venom-liquid-button/VenomButtonDemo.jsx";

export default function App() {
  return <VenomButtonDemo />;
}
```

In `src/main.jsx` delete the line `import './index.css'` (the Vite template's body styles centre everything and add a dark background). Then:

```bash
npm run dev
```

Open the printed URL and try:

- Move the cursor toward the big button from every side. At 150px the liquid wakes up.
- Click it: it squashes and bounces and the tentacles splash.
- Drag the sliders for tentacles, intensity, speed and magnetic pull.
- Park the cursor, then scroll the page: the liquid reacts to the button moving under the cursor.
- Open the page on a phone (or use device emulation): press and hold near a button.

## React + Vite

```jsx
import VenomButton from "./venom-liquid-button/VenomButton";

export default function Hero() {
  return <VenomButton text="Our Services" href="/services" />;
}
```

As a form button:

```jsx
<form onSubmit={handleSubmit}>
  <VenomButton text="Save Bill" type="submit" width={160} height={50} />
</form>
```

## Next.js

`VenomButton.jsx` starts with `"use client"`, so it works in the App Router and the Pages Router.

```jsx
// app/page.jsx  (server component: fine as long as you pass no functions)
import VenomButton from "@/components/venom-liquid-button/VenomButton";

export default function Page() {
  return <VenomButton text="Our Services" href="/services" />;
}
```

To use `next/link` for client-side navigation, or to pass `onClick`, use it from a client component:

```jsx
// components/ServicesButton.jsx
"use client";
import Link from "next/link";
import VenomButton from "@/components/venom-liquid-button/VenomButton";

export default function ServicesButton() {
  return <VenomButton as={Link} href="/services" text="Our Services" />;
}
```

## Props

| Prop | Default | Range | Meaning |
| --- | --- | --- | --- |
| `text` | `"Our Services"` | | Label (or pass `children`) |
| `href` | | | Renders an `<a>`; without it a `<button type="button">` |
| `as` | | | Custom element, e.g. `next/link` |
| `width` / `height` | `190` / `54` | 96–640 / 36–120 | Button size in px; thickness of the liquid scales with `height` |
| `liquidColor` | `"#050505"` | any CSS colour | Colour of the liquid and the button body |
| `tentacleCount` | `7` | 3–12 | Number of strands (5–9 looks best) |
| `magneticStrength` | `0.25` | 0–1 | How far the button leans toward the cursor (`0` = off) |
| `intensity` | `1` | 0.3–2 | Height, thickness and wobble of the liquid |
| `animationSpeed` | `1` | 0.25–3 | Time scale of the physics and all tweens |
| `onClick`, `className`, `style`, anything else | | | Forwarded to the button / link |

Values outside the ranges are clamped. Props can change at runtime; changing `tentacleCount` rebuilds the strands.

## Copy into any project

1. Copy the `venom-liquid-button` folder into the project (for example `components/venom-liquid-button/` or `src/venom-liquid-button/`).
2. `npm install gsap` (React must already be there).
3. `import VenomButton from "<path>/venom-liquid-button/VenomButton";`

The button needs a bundler that supports **CSS Modules** (Vite, Next.js, CRA, Remix and Parcel all do) and the `.jsx` extension. Tuning lives in `venomConfig.js` (`TRIGGER_DISTANCE`, `PAD`, filter values, click squash) and the strand personalities in `createTentacles()` inside `venomPhysics.js`, so `VenomButton.jsx` never needs editing.

## How it works

- **Proximity.** The pointer's distance to the pill edge is computed against the capsule geometry on every frame. Under 150px a GSAP tween raises an activation value from 0 to 1; leaving tweens it back.
- **Tentacles.** Each strand roots on the upper surface and has its own thickness, height, curvature, elasticity, damping, wobble and lag behind the cursor. Its tip and two Bézier control points are driven by springs (semi-implicit Euler, frame-rate aware). Strands stand up, lean toward the cursor, and stretch to it when it is above them.
- **Liquid look.** Every strand is a tapered cubic-Bézier ribbon with a tip droplet and a root bulge. An SVG blur + alpha-threshold filter fuses them into one metaball mass. A pale-cyan highlight rides the lit side and a blurred copy forms the shadow on the page.
- **Behaviour.** Strands thin as they stretch, neighbours occasionally merge and separate with an elastic wobble, over-stretched or flicked strands snap, whip back and regrow, and everything retracts with a springy wobble when the pointer leaves.
- **Click.** A GSAP timeline squashes the pill and bounces it back with an elastic ease, and kicks every tentacle.
- **No clipping.** The SVG is rendered in a portal on `document.body` with `position: fixed` and follows the button every frame, so no ancestor (`overflow: hidden`, `backdrop-filter`, `contain`, z-index stacking) can clip it. It is clipped only against the pill itself, so liquid never covers the label. Its `z-index` is `1000` in `VenomButton.module.css`; raise it if you have higher overlays.
- **Performance.** `requestAnimationFrame` runs only while the liquid is active; after the strands settle the loop stops and the button returns to a plain element. Each instance is independent.

## Accessibility and devices

- `prefers-reduced-motion: reduce` turns the liquid, magnetic pull and click bounce off. You get the plain glossy button.
- The liquid SVG is `aria-hidden`; the control is a real `<button>` or `<a>` with a visible `:focus-visible` outline. Keyboard activation (Enter / Space) also plays the click bounce.
- Mouse, pen and touch all use Pointer Events. On touch, pressing and holding within 150px of the button wakes the liquid and lifting the finger retracts it.
- Scrolling is handled: the pointer position is re-evaluated when the page scrolls under a stationary cursor.

## Verification notes

This package was tested in headless Chromium (Playwright) with the real component bundled by esbuild. **GSAP itself could not be installed in the sandbox**, so those runs used a small stand-in for the four GSAP calls the component makes (`to`, `timeline().to`, `delayedCall`, `killTweensOf`). `npm run build` was not run. Please run the demo once in your own project with the real `gsap` installed.

What was observed in that test setup: 7 live strands from every approach direction and none beyond 150px; 5 and 9 strands when changed by slider; tips drawn outside an `overflow: hidden` + `backdrop-filter` card; activation after scrolling under a still cursor; touch hold and release; click squash (scaleY ≈ 0.83) and bounce; no activity and no transform under `prefers-reduced-motion`; and, after unmounting, no overlay SVG left in the page, no animation-frame requests and no console errors.
