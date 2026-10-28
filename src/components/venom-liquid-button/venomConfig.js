/**
 * venomConfig.js
 * Every tunable constant and the prop-normalising helper live here, so the
 * animation source (VenomButton.jsx / venomPhysics.js) never needs editing.
 */

/** Cursor distance (px, measured from the button edge) at which the liquid wakes up. */
export const TRIGGER_DISTANCE = 150;

/** The SVG overlay extends this many px past the button on every side. */
export const PAD = 240;

/** Points sampled along each Bézier tentacle when building its outline. */
export const SAMPLES = 20;

/** Light direction (top-left). Used to decide which side of a tentacle gets the wet highlight. */
export const LIGHT = { x: -0.55, y: -0.83 };

/** Pale cyan specular streak on every tentacle. */
export const HIGHLIGHT_COLOR = "#cdf4ff";

/** Gooey (metaball) filter: blur, then an alpha threshold (alpha * mul + off). */
export const GOO = { blur: 1.2, mul: 18, off: -6.5 };

/** Soft cast shadow of the tentacles on the page. */
export const SHADOW = { blur: 7, dx: 6, dy: 15, opacity: 0.26 };

/** Click squash & bounce. */
export const CLICK = { squashX: 0.09, squashY: 0.16, press: 0.09, release: 0.85 };

export const DEFAULTS = {
  text: "Our Services",
  width: 190,
  height: 54,
  liquidColor: "#050505",
  tentacleCount: 7,
  magneticStrength: 0.25,
  intensity: 1,
  animationSpeed: 1,
};

export const LIMITS = {
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
export function splitProps(props) {
  const {
    text,
    width,
    height,
    liquidColor,
    tentacleCount,
    magneticStrength,
    intensity,
    animationSpeed,
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
    },
    rest,
  };
}
