import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cn } from "@/lib/utils.js";

export interface AstralShellProps {
  colors?: string[];
  backgroundColor?: string;
  nodes?: number;
  connections?: number;
  reach?: number;
  clustering?: number;
  chords?: number;
  radius?: number;
  originX?: number;
  originY?: number;
  lineOpacity?: number;
  nodeSize?: number;
  depthFade?: number;
  spin?: number;
  tilt?: number;
  interactive?: boolean;
  draggable?: boolean;
  hoverRadius?: number;
  hoverBoost?: number;
  clickPulse?: boolean;
  pulseSpeed?: number;
  seed?: number;
  paused?: boolean;
  dpr?: number;
  /** Increment to trigger a visual pulse (e.g. `#capabilities` hash on the home hero). */
  pulseSignal?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const MAX_PULSES = 4;
const FOV = 35;
const DEFAULT_COLORS = ["#7C6BFF", "#FFE6FA"];

const pulseChunk = `
uniform float uClock;
uniform float uDepthFade;
uniform vec4 uPulseTime;
uniform vec3 uPulseOrigin[${MAX_PULSES}];
uniform float uPulseSpeed;

float pulseGlow(vec3 direction) {
  float glow = 0.0;
  for (int k = 0; k < ${MAX_PULSES}; k++) {
    float age = uClock - uPulseTime[k];
    if (age < 0.0 || age > 12.0) continue;
    float travelled = acos(clamp(dot(direction, uPulseOrigin[k]), -1.0, 1.0));
    float front = age * uPulseSpeed - travelled;
    glow += exp(-front * front * 60.0) * exp(-age * 0.38);
  }
  return glow;
}
`;

const sharedChunk = `
${pulseChunk}
uniform float uTime;
uniform float uWorldRadius;
uniform vec2 uPointer;
uniform float uHover;
uniform float uHoverRadius;
uniform float uAspect;

void shellLight(vec4 mv, out vec4 clip, out float depthLight, out float hover, out float front) {
  vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float facing = clamp((mv.z - center.z) / max(uWorldRadius, 1e-4), -1.0, 1.0);
  front = smoothstep(-0.6, 0.6, facing);
  float rim = 1.0 - abs(facing);
  depthLight = mix(1.0 - uDepthFade, 1.0, front) * (1.0 + rim * rim * 0.45);
  clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;
  vec2 delta = (ndc - uPointer) * vec2(uAspect, 1.0);
  hover = exp(-dot(delta, delta) / max(uHoverRadius * uHoverRadius, 1e-4)) * uHover * front;
}
`;

const nodeVertexShader = `
${sharedChunk}

attribute float aDegree;
attribute float aSeed;

uniform float uSize;
uniform float uPixelRatio;

varying float vBright;
varying float vHeat;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 clip;
  float depthLight;
  float hover;
  float front;
  shellLight(mv, clip, depthLight, hover, front);
  float pulse = pulseGlow(normalize(position)) * mix(1.0 - uDepthFade * 0.8, 1.0, front);
  float hub = min(aDegree / 6.0, 1.0);
  float twinkle = 0.78 + 0.22 * sin(uTime * (0.5 + aSeed * 1.3) + aSeed * 40.0);
  vHeat = clamp(hover * 0.9 + pulse, 0.0, 1.0);
  vBright = depthLight * (0.5 + 0.5 * hub) * twinkle + hover * 1.1 + pulse * 1.3;
  gl_Position = clip;
  vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float scale = center.z / min(mv.z, -1e-3);
  gl_PointSize = uSize * uPixelRatio * scale * (0.65 + 0.7 * hub) * (1.0 + vHeat * 0.7);
}
`;

const nodeFragmentShader = `
precision highp float;

uniform vec3 uBase;
uniform vec3 uHot;
uniform float uInk;

varying float vBright;
varying float vHeat;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float disc = 1.0 - smoothstep(0.35, 1.0, r);
  float amount = disc * vBright;
  if (amount < 0.003) discard;
  vec3 color = mix(uBase, uHot, clamp(vHeat + 0.25, 0.0, 1.0));
  if (uInk > 0.5) {
    float alpha = clamp(amount * 0.9, 0.0, 1.0);
    gl_FragColor = vec4(color * alpha, alpha);
  } else {
    gl_FragColor = vec4(color * amount, clamp(amount, 0.0, 1.0));
  }
}
`;

const lineVertexShader = `
${sharedChunk}

attribute float aLength;

uniform float uReach;
uniform float uLineOpacity;

varying float vBright;
varying float vHover;
varying float vFront;
varying float vSpan;
varying vec3 vDirection;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 clip;
  float depthLight;
  float hover;
  float front;
  shellLight(mv, clip, depthLight, hover, front);
  float span = 1.0 - smoothstep(uReach * 0.35, uReach, aLength);
  vBright = depthLight * uLineOpacity * (0.35 + 0.65 * span) + hover * 0.55;
  vHover = hover;
  vFront = front;
  vSpan = mix(0.55, 1.0, span);
  vDirection = position;
  gl_Position = clip;
}
`;

const lineFragmentShader = `
precision highp float;

${pulseChunk}

uniform vec3 uBase;
uniform vec3 uHot;
uniform float uInk;
uniform float uLineGain;

varying float vBright;
varying float vHover;
varying float vFront;
varying float vSpan;
varying vec3 vDirection;

void main() {
  float pulse = pulseGlow(normalize(vDirection)) * mix(1.0 - uDepthFade * 0.8, 1.0, vFront);
  float heat = clamp(vHover * 0.8 + pulse, 0.0, 1.0);
  vec3 color = mix(uBase, uHot, heat);
  float amount = (vBright + pulse * 0.8) * vSpan * uLineGain;
  if (uInk > 0.5) {
    float alpha = clamp(amount * 0.85, 0.0, 1.0);
    gl_FragColor = vec4(color * alpha, alpha);
  } else {
    gl_FragColor = vec4(color * amount, clamp(amount, 0.0, 1.0));
  }
}
`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const isTransparent = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "transparent") return true;
  if (/^#[0-9a-f]{8}$/.test(normalized)) return normalized.endsWith("00");
  if (/^#[0-9a-f]{4}$/.test(normalized)) return normalized.endsWith("0");
  const alpha = normalized.match(
    /^(?:rgba?|hsla?)\(.*[,/]\s*(0|0?\.0+|0%)\s*\)$/,
  );
  return alpha !== null;
};

const scratch = new THREE.Color();

const readSrgb = (target: THREE.Vector3, value: string, fallback: string) => {
  const trimmed = value.trim();
  try {
    scratch.set(/^#[0-9a-f]{8}$/i.test(trimmed) ? trimmed.slice(0, 7) : trimmed);
  } catch {
    scratch.set(fallback);
  }
  const rgb = { r: 0, g: 0, b: 0 };
  scratch.getRGB(rgb, THREE.SRGBColorSpace);
  return target.set(rgb.r, rgb.g, rgb.b);
};

const random = (seed: number) => {
  let state = (Math.floor(seed * 9973) ^ 0x2545f491) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const subscribeToDpr = (notify: () => void) => {
  const media = window.matchMedia("(min-resolution: 2dppx)");
  media.addEventListener("change", notify);
  window.addEventListener("resize", notify);
  return () => {
    media.removeEventListener("change", notify);
    window.removeEventListener("resize", notify);
  };
};

const readDpr = () =>
  typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

const subscribeToMotion = (notify: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

const readMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Network {
  points: Float32Array;
  degree: Float32Array;
  seeds: Float32Array;
  edges: Uint32Array;
  lengths: Float32Array;
}

const onSphere = (x: number, y: number, z: number) => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};

const randomDirection = (next: () => number) => {
  const z = next() * 2 - 1;
  const angle = next() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(angle), r * Math.sin(angle), z];
};

const jitter = (point: number[], amount: number, next: () => number) => {
  const gauss = () => {
    const u = Math.max(next(), 1e-6);
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
  };
  return onSphere(
    point[0] + gauss() * amount,
    point[1] + gauss() * amount,
    point[2] + gauss() * amount,
  );
};

const slerp = (a: number[], b: number[], t: number) => {
  const dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
  const omega = Math.acos(dot);
  if (omega < 1e-4) return a.slice();
  const s = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / s;
  const wb = Math.sin(t * omega) / s;
  return onSphere(
    a[0] * wa + b[0] * wb,
    a[1] * wa + b[1] * wb,
    a[2] * wa + b[2] * wb,
  );
};

const buildNetwork = (
  count: number,
  connections: number,
  reach: number,
  clustering: number,
  chords: number,
  seed: number,
): Network => {
  const next = random(seed + 0.37);
  const hubs: number[][] = [];
  const hubCount = Math.max(8, Math.round(count / 90));
  for (let i = 0; i < hubCount; i++) hubs.push(randomDirection(next));
  const filaments: [number, number][] = [];
  for (let i = 0; i < hubCount; i++) {
    const order = hubs
      .map((hub, j) => ({
        j,
        d:
          j === i
            ? Infinity
            : 1 - (hub[0] * hubs[i][0] + hub[1] * hubs[i][1] + hub[2] * hubs[i][2]),
      }))
      .sort((a, b) => a.d - b.d);
    for (let n = 0; n < 3; n++) {
      const j = order[n].j;
      if (!filaments.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) {
        filaments.push([i, j]);
      }
    }
  }

  const uniformShare = 1 - clamp(clustering, 0, 1) * 0.85;
  const flat = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const pick = next();
    let point: number[];
    if (pick < uniformShare) {
      point = randomDirection(next);
    } else if (pick < uniformShare + (1 - uniformShare) * 0.35) {
      const hub = hubs[Math.floor(next() * hubs.length)];
      point = jitter(hub, 0.07 + next() * 0.06, next);
    } else {
      const [a, b] = filaments[Math.floor(next() * filaments.length)];
      point = jitter(slerp(hubs[a], hubs[b], next()), 0.018 + next() * 0.02, next);
    }
    flat.set(point, i * 3);
  }

  const cell = Math.max(reach, 0.05);
  const cells = new Map<string, number[]>();
  const keyOf = (x: number, y: number, z: number) =>
    `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < count; i++) {
    const key = keyOf(flat[i * 3], flat[i * 3 + 1], flat[i * 3 + 2]);
    const bucket = cells.get(key);
    if (bucket) bucket.push(i);
    else cells.set(key, [i]);
  }

  const degree = new Float32Array(count);
  const seen = new Set<number>();
  const edges: number[] = [];
  const lengths: number[] = [];
  const reach2 = reach * reach;
  const candidates: { j: number; d: number }[] = [];
  const link = (i: number, j: number, length: number, walkable: boolean) => {
    const key = i < j ? i * count + j : j * count + i;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(i, j);
    lengths.push(length);
    if (walkable) {
      degree[i] += 1;
      degree[j] += 1;
    }
  };
  for (let i = 0; i < count; i++) {
    candidates.length = 0;
    const ax = flat[i * 3];
    const ay = flat[i * 3 + 1];
    const az = flat[i * 3 + 2];
    const cx = Math.floor(ax / cell);
    const cy = Math.floor(ay / cell);
    const cz = Math.floor(az / cell);
    for (let x = cx - 1; x <= cx + 1; x++) {
      for (let y = cy - 1; y <= cy + 1; y++) {
        for (let z = cz - 1; z <= cz + 1; z++) {
          const bucket = cells.get(`${x},${y},${z}`);
          if (!bucket) continue;
          for (const j of bucket) {
            if (j === i) continue;
            const dx = flat[j * 3] - ax;
            const dy = flat[j * 3 + 1] - ay;
            const dz = flat[j * 3 + 2] - az;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < reach2) candidates.push({ j, d });
          }
        }
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    for (let n = 0; n < Math.min(connections, candidates.length); n++) {
      link(i, candidates[n].j, Math.sqrt(candidates[n].d), true);
    }
  }

  const chordCount = Math.round(count * clamp(chords, 0, 2));
  for (let c = 0; c < chordCount; c++) {
    const i = Math.floor(next() * count);
    for (let attempt = 0; attempt < 6; attempt++) {
      const j = Math.floor(next() * count);
      if (j === i) continue;
      const dx = flat[j * 3] - flat[i * 3];
      const dy = flat[j * 3 + 1] - flat[i * 3 + 1];
      const dz = flat[j * 3 + 2] - flat[i * 3 + 2];
      const length = Math.hypot(dx, dy, dz);
      if (length > 0.45 && length < 1.6) {
        link(i, j, length, false);
        break;
      }
    }
  }

  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = next();
  return {
    points: flat,
    degree,
    seeds,
    edges: Uint32Array.from(edges),
    lengths: Float32Array.from(lengths),
  };
};

interface PointerInput {
  x: number;
  y: number;
  inside: boolean;
  down: boolean;
  lastClientX: number;
  lastClientY: number;
  dragX: number;
  dragY: number;
  presses: number;
  pressX: number;
  pressY: number;
  travel: number;
}

interface ShellSettings {
  colors: string[];
  backgroundColor: string;
  nodes: number;
  connections: number;
  reach: number;
  clustering: number;
  chords: number;
  radius: number;
  originX: number;
  originY: number;
  lineOpacity: number;
  nodeSize: number;
  depthFade: number;
  spin: number;
  tilt: number;
  interactive: boolean;
  draggable: boolean;
  hoverRadius: number;
  hoverBoost: number;
  clickPulse: boolean;
  pulseSpeed: number;
  seed: number;
  paused: boolean;
  reduced: boolean;
}

interface ShellSceneProps {
  settings: ShellSettings;
  pointerRef: MutableRefObject<PointerInput>;
  wakeRef: MutableRefObject<(() => void) | null>;
}

interface Motion {
  time: number;
  clock: number;
  quaternion: THREE.Quaternion;
  spinVelocity: THREE.Vector2;
  lastDragX: number;
  lastDragY: number;
  dragging: boolean;
  hover: number;
  pointerX: number;
  pointerY: number;
  presses: number;
  pulseTimes: number[];
  pulseOrigins: THREE.Vector3[];
  nextPulse: number;
  lean: THREE.Vector2;
}

const createUniforms = () => ({
  uTime: { value: 0 },
  uClock: { value: 0 },
  uWorldRadius: { value: 1 },
  uDepthFade: { value: 0.7 },
  uPointer: { value: new THREE.Vector2(9, 9) },
  uHover: { value: 0 },
  uHoverRadius: { value: 0.22 },
  uAspect: { value: 1 },
  uPulseTime: { value: new THREE.Vector4(-99, -99, -99, -99) },
  uPulseOrigin: {
    value: Array.from({ length: MAX_PULSES }, () => new THREE.Vector3(0, 0, 1)),
  },
  uPulseSpeed: { value: 1.2 },
  uSize: { value: 3 },
  uPixelRatio: { value: 1 },
  uReach: { value: 0.3 },
  uLineOpacity: { value: 0.5 },
  uLineGain: { value: 1 },
  uBase: { value: new THREE.Vector3() },
  uHot: { value: new THREE.Vector3() },
  uInk: { value: 0 },
});

type ShellUniforms = ReturnType<typeof createUniforms>;

const ShellScene = ({ settings, pointerRef, wakeRef }: ShellSceneProps) => {
  const { size, invalidate } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const nodeMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const lineMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const motionRef = useRef<Motion>({
    time: 0,
    clock: 0,
    quaternion: new THREE.Quaternion(),
    spinVelocity: new THREE.Vector2(),
    lastDragX: 0,
    lastDragY: 0,
    dragging: false,
    hover: 0,
    pointerX: 9,
    pointerY: 9,
    presses: 0,
    pulseTimes: [-99, -99, -99, -99],
    pulseOrigins: Array.from(
      { length: MAX_PULSES },
      () => new THREE.Vector3(0, 0, 1),
    ),
    nextPulse: 0,
    lean: new THREE.Vector2(),
  });
  const helpers = useMemo(
    () => ({
      axis: new THREE.Vector3(),
      turn: new THREE.Quaternion(),
      base: new THREE.Quaternion(),
      point: new THREE.Vector3(),
      euler: new THREE.Euler(),
      raycaster: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      sphere: new THREE.Sphere(),
      inverse: new THREE.Quaternion(),
    }),
    [],
  );
  const uniforms = useMemo(() => createUniforms(), []);
  const count = Math.round(clamp(settings.nodes, 100, 2500));
  const links = Math.round(clamp(settings.connections, 1, 8));
  const reach = clamp(settings.reach, 0.05, 1);
  const clustering = clamp(settings.clustering, 0, 1);
  const chords = clamp(settings.chords, 0, 2);
  const network = useMemo(
    () => buildNetwork(count, links, reach, clustering, chords, settings.seed),
    [count, links, reach, clustering, chords, settings.seed],
  );
  const geometries = useMemo(() => {
    const nodes = new THREE.BufferGeometry();
    nodes.setAttribute("position", new THREE.BufferAttribute(network.points, 3));
    nodes.setAttribute("aDegree", new THREE.BufferAttribute(network.degree, 1));
    nodes.setAttribute("aSeed", new THREE.BufferAttribute(network.seeds, 1));
    nodes.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);

    const edgeCount = network.edges.length / 2;
    const linePositions = new Float32Array(edgeCount * 6);
    const lineLengths = new Float32Array(edgeCount * 2);
    for (let e = 0; e < edgeCount; e++) {
      const a = network.edges[e * 2];
      const b = network.edges[e * 2 + 1];
      linePositions.set(network.points.subarray(a * 3, a * 3 + 3), e * 6);
      linePositions.set(network.points.subarray(b * 3, b * 3 + 3), e * 6 + 3);
      lineLengths[e * 2] = network.lengths[e];
      lineLengths[e * 2 + 1] = network.lengths[e];
    }
    const lines = new THREE.BufferGeometry();
    lines.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    lines.setAttribute("aLength", new THREE.BufferAttribute(lineLengths, 1));
    lines.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    return { nodes, lines };
  }, [network]);
  const [base, hot] = settings.colors;
  const { backgroundColor } = settings;

  useEffect(
    () => () => {
      geometries.nodes.dispose();
      geometries.lines.dispose();
    },
    [geometries],
  );

  useEffect(() => {
    wakeRef.current = invalidate;
    return () => {
      wakeRef.current = null;
    };
  }, [invalidate, wakeRef]);

  useEffect(() => {
    const primary = nodeMaterialRef.current;
    if (!primary) return;
    const values = primary.uniforms as unknown as ShellUniforms;
    readSrgb(values.uBase.value, base ?? DEFAULT_COLORS[0], DEFAULT_COLORS[0]);
    readSrgb(values.uHot.value, hot ?? base ?? DEFAULT_COLORS[1], DEFAULT_COLORS[1]);
    const transparent = isTransparent(backgroundColor);
    scratch.set(transparent ? "#000000" : backgroundColor);
    const lum = scratch.r * 0.2126 + scratch.g * 0.7152 + scratch.b * 0.0722;
    const ink = !transparent && lum > 0.35;
    values.uInk.value = ink ? 1 : 0;
    for (const material of [nodeMaterialRef.current, lineMaterialRef.current]) {
      if (!material) continue;
      material.blending = THREE.CustomBlending;
      material.blendEquation = THREE.AddEquation;
      material.blendSrc = THREE.OneFactor;
      material.blendDst = ink ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor;
      material.blendSrcAlpha = THREE.OneFactor;
      material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
      material.needsUpdate = true;
    }
    invalidate();
  }, [base, hot, backgroundColor, invalidate]);

  useEffect(() => {
    invalidate();
  }, [settings, size, invalidate]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const primary = nodeMaterialRef.current;
    if (!group || !primary) return;
    const values = primary.uniforms as unknown as ShellUniforms;
    const motion = motionRef.current;
    const s = settings;
    const input = pointerRef.current;
    const dt = Math.min(Math.max(delta, 0), 0.05);
    const animate = !s.paused && !s.reduced;
    if (animate) motion.time += dt;
    if (!s.reduced) motion.clock += dt;
    const aspect = size.width / Math.max(size.height, 1);
    const camera = state.camera as THREE.PerspectiveCamera;
    const halfHeight = camera.position.z * Math.tan(toRadians(FOV) / 2);
    const worldRadius = clamp(s.radius, 0.05, 1.5) * 2 * halfHeight;
    group.position.set(
      (clamp(s.originX, -0.5, 1.5) - 0.5) * 2 * halfHeight * aspect,
      (clamp(s.originY, -0.5, 1.5) - 0.5) * 2 * halfHeight,
      0,
    );
    group.scale.setScalar(worldRadius);

    const dragging = s.draggable && s.interactive && input.down;
    if (dragging) {
      if (!motion.dragging) {
        motion.lastDragX = input.dragX;
        motion.lastDragY = input.dragY;
        motion.spinVelocity.set(0, 0);
      }
      const dx = input.dragX - motion.lastDragX;
      const dy = input.dragY - motion.lastDragY;
      motion.lastDragX = input.dragX;
      motion.lastDragY = input.dragY;
      const rate = 1 / Math.max(dt, 1 / 240);
      motion.spinVelocity.set(dx * 3.2 * rate * 0.35, dy * 3.2 * rate * 0.35);
      helpers.axis.set(0, 1, 0);
      helpers.turn.setFromAxisAngle(helpers.axis, dx * 3.2);
      motion.quaternion.premultiply(helpers.turn);
      helpers.axis.set(1, 0, 0);
      helpers.turn.setFromAxisAngle(helpers.axis, -dy * 3.2);
      motion.quaternion.premultiply(helpers.turn);
    } else {
      const decay = Math.exp(-dt * 1.6);
      motion.spinVelocity.multiplyScalar(decay);
      helpers.axis.set(0, 1, 0);
      helpers.turn.setFromAxisAngle(helpers.axis, motion.spinVelocity.x * dt);
      motion.quaternion.premultiply(helpers.turn);
      helpers.axis.set(1, 0, 0);
      helpers.turn.setFromAxisAngle(helpers.axis, -motion.spinVelocity.y * dt);
      motion.quaternion.premultiply(helpers.turn);
      if (animate) {
        const spin = clamp(s.spin, -4, 4) * 0.11;
        helpers.axis.set(0.18, 1, 0.08).normalize();
        helpers.turn.setFromAxisAngle(helpers.axis, spin * dt);
        motion.quaternion.premultiply(helpers.turn);
      }
    }
    motion.dragging = dragging;
    motion.quaternion.normalize();

    const tracking = s.interactive && !s.reduced && input.inside;
    const leanTargetX = tracking ? (input.x - 0.5) * 2 : 0;
    const leanTargetY = tracking ? (input.y - 0.5) * 2 : 0;
    const follow = 1 - Math.exp(-dt * 2.4);
    motion.lean.x += (leanTargetX - motion.lean.x) * follow;
    motion.lean.y += (leanTargetY - motion.lean.y) * follow;
    helpers.euler.set(
      toRadians(clamp(s.tilt, -90, 90)) - motion.lean.y * 0.12,
      motion.lean.x * 0.16,
      0,
    );
    helpers.base.setFromEuler(helpers.euler);
    group.quaternion.copy(helpers.base).multiply(motion.quaternion);
    group.updateMatrixWorld();

    const hoverTarget = tracking && !dragging ? 1 : 0;
    motion.hover += (hoverTarget - motion.hover) * (1 - Math.exp(-dt * 5));
    if (tracking) {
      const glide = 1 - Math.exp(-dt * 14);
      if (motion.pointerX > 5) {
        motion.pointerX = input.x;
        motion.pointerY = input.y;
      }
      motion.pointerX += (input.x - motion.pointerX) * glide;
      motion.pointerY += (input.y - motion.pointerY) * glide;
    } else if (motion.hover < 0.002) {
      motion.pointerX = 9;
      motion.pointerY = 9;
    }

    if (input.presses !== motion.presses) {
      motion.presses = input.presses;
      if (s.clickPulse && s.interactive && !s.reduced && input.travel < 0.02) {
        helpers.ndc.set(input.pressX, input.pressY);
        helpers.raycaster.setFromCamera(helpers.ndc, camera);
        helpers.sphere.set(group.position, worldRadius);
        const ray = helpers.raycaster.ray;
        if (!ray.intersectSphere(helpers.sphere, helpers.point)) {
          ray.closestPointToPoint(group.position, helpers.point);
        }
        helpers.point.sub(group.position).normalize();
        helpers.inverse.copy(group.quaternion).invert();
        helpers.point.applyQuaternion(helpers.inverse);
        const slot = motion.nextPulse;
        motion.nextPulse = (motion.nextPulse + 1) % MAX_PULSES;
        motion.pulseOrigins[slot].copy(helpers.point);
        motion.pulseTimes[slot] = motion.clock;
      }
    }
    const pulseSpeed = clamp(s.pulseSpeed, 0.1, 5);
    const pulseLife = Math.PI / pulseSpeed + 1;
    let pulsing = false;
    for (let k = 0; k < MAX_PULSES; k++) {
      if (motion.clock - motion.pulseTimes[k] < pulseLife) pulsing = true;
      values.uPulseOrigin.value[k].copy(motion.pulseOrigins[k]);
    }

    values.uTime.value = motion.time;
    values.uClock.value = motion.clock;
    values.uWorldRadius.value = worldRadius;
    values.uDepthFade.value = clamp(s.depthFade, 0, 1);
    values.uPointer.value.set(
      motion.pointerX * 2 - 1,
      motion.pointerY * 2 - 1,
    );
    values.uHover.value = motion.hover * clamp(s.hoverBoost, 0, 3);
    values.uHoverRadius.value = clamp(s.hoverRadius, 0.02, 1);
    values.uAspect.value = aspect;
    values.uPulseTime.value.set(
      motion.pulseTimes[0],
      motion.pulseTimes[1],
      motion.pulseTimes[2],
      motion.pulseTimes[3],
    );
    values.uPulseSpeed.value = pulseSpeed;
    values.uSize.value = 3.2 * clamp(s.nodeSize, 0, 4);
    values.uPixelRatio.value = state.viewport.dpr;
    values.uLineGain.value = 1 + (Math.max(state.viewport.dpr, 1) - 1) * 0.85;
    values.uReach.value = reach;
    values.uLineOpacity.value = clamp(s.lineOpacity, 0, 2);

    const moving =
      dragging ||
      pulsing ||
      motion.spinVelocity.lengthSq() > 1e-6 ||
      Math.abs(motion.hover - hoverTarget) > 0.002 ||
      Math.abs(motion.lean.x - leanTargetX) > 0.001 ||
      Math.abs(motion.lean.y - leanTargetY) > 0.001;
    if (!animate && moving) invalidate();
  });

  return (
    <group ref={groupRef}>
      <lineSegments geometry={geometries.lines} frustumCulled={false}>
        <shaderMaterial
          ref={lineMaterialRef}
          vertexShader={lineVertexShader}
          fragmentShader={lineFragmentShader}
          uniforms={uniforms}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </lineSegments>
      <points geometry={geometries.nodes} frustumCulled={false}>
        <shaderMaterial
          ref={nodeMaterialRef}
          vertexShader={nodeVertexShader}
          fragmentShader={nodeFragmentShader}
          uniforms={uniforms}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </points>
    </group>
  );
};

export const AstralShell = ({
  colors = DEFAULT_COLORS,
  backgroundColor = "#0a0a0a",
  nodes = 2400,
  connections = 4,
  reach = 0.2,
  clustering = 0.85,
  chords = 0.35,
  radius = 0.4,
  originX = 0.5,
  originY = 0.5,
  lineOpacity = 0.7,
  nodeSize = 0.8,
  depthFade = 0.7,
  spin = 1,
  tilt = 18,
  interactive = true,
  draggable = true,
  hoverRadius = 0.22,
  hoverBoost = 1,
  clickPulse = true,
  pulseSpeed = 1.2,
  seed = 0,
  paused = false,
  dpr = 2,
  pulseSignal = 0,
  className,
  style,
  children,
}: AstralShellProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<PointerInput>({
    x: 0.5,
    y: 0.5,
    inside: false,
    down: false,
    lastClientX: 0,
    lastClientY: 0,
    dragX: 0,
    dragY: 0,
    presses: 0,
    pressX: 0,
    pressY: 0,
    travel: 0,
  });
  const wakeRef = useRef<(() => void) | null>(null);
  const [visible, setVisible] = useState(true);
  const reducedMotion = useSyncExternalStore(
    subscribeToMotion,
    readMotion,
    () => false,
  );
  const deviceDpr = useSyncExternalStore(subscribeToDpr, readDpr, () => 1);
  const pixelRatio = Math.min(deviceDpr, Math.max(dpr, 0.5));
  const animated = !paused && !reducedMotion;
  const transparent = isTransparent(backgroundColor);

  const settings: ShellSettings = {
    colors,
    backgroundColor,
    nodes,
    connections,
    reach,
    clustering,
    chords,
    radius,
    originX,
    originY,
    lineOpacity,
    nodeSize,
    depthFade,
    spin,
    tilt,
    interactive,
    draggable,
    hoverRadius,
    hoverBoost,
    clickPulse,
    pulseSpeed,
    seed,
    paused,
    reduced: reducedMotion,
  };

  useEffect(() => {
    if (!pulseSignal) return;
    const state = pointerRef.current;
    state.pressX = 0;
    state.pressY = 0;
    state.presses += 1;
    wakeRef.current?.();
  }, [pulseSignal]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "80px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const locate = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      const state = pointerRef.current;
      state.x = (event.clientX - box.left) / Math.max(box.width, 1);
      state.y = 1 - (event.clientY - box.top) / Math.max(box.height, 1);
      state.inside = true;
      return box;
    };
    const move = (event: PointerEvent) => {
      const box = locate(event);
      const state = pointerRef.current;
      if (state.down) {
        const scale = 1 / Math.max(box.height, 1);
        const dx = (event.clientX - state.lastClientX) * scale;
        const dy = (event.clientY - state.lastClientY) * scale;
        state.dragX += dx;
        state.dragY += dy;
        state.travel += Math.hypot(dx, dy);
      }
      state.lastClientX = event.clientX;
      state.lastClientY = event.clientY;
      wakeRef.current?.();
    };
    const down = (event: PointerEvent) => {
      locate(event);
      const state = pointerRef.current;
      state.down = true;
      state.travel = 0;
      state.lastClientX = event.clientX;
      state.lastClientY = event.clientY;
      wakeRef.current?.();
    };
    const up = (event: PointerEvent) => {
      const state = pointerRef.current;
      if (state.down && state.travel < 0.02) {
        state.pressX = state.x * 2 - 1;
        state.pressY = state.y * 2 - 1;
        state.presses += 1;
      }
      state.down = false;
      if (event.pointerType !== "mouse") state.inside = false;
      wakeRef.current?.();
    };
    const leave = () => {
      const state = pointerRef.current;
      state.inside = false;
      state.down = false;
      wakeRef.current?.();
    };
    node.addEventListener("pointermove", move, { passive: true });
    node.addEventListener("pointerdown", down, { passive: true });
    node.addEventListener("pointerup", up, { passive: true });
    node.addEventListener("pointerleave", leave, { passive: true });
    node.addEventListener("pointercancel", leave, { passive: true });
    return () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointerleave", leave);
      node.removeEventListener("pointercancel", leave);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn("relative isolate overflow-hidden", className)}
      style={{
        backgroundColor: transparent ? undefined : backgroundColor,
        touchAction: draggable && interactive ? "none" : undefined,
        ...style,
      }}
    >
      <div className="absolute inset-0" aria-hidden="true">
        <Canvas
          dpr={pixelRatio}
          frameloop={visible && animated ? "always" : "demand"}
          camera={{ fov: FOV, near: 0.1, far: 100, position: [0, 0, 10] }}
          gl={{
            antialias: true,
            alpha: true,
            premultipliedAlpha: true,
            powerPreference: "high-performance",
          }}
          style={{ pointerEvents: "none" }}
        >
          <ShellScene
            settings={settings}
            pointerRef={pointerRef}
            wakeRef={wakeRef}
          />
        </Canvas>
      </div>
      {children ? (
        <div className="relative z-10 h-full w-full">{children}</div>
      ) : null}
    </div>
  );
};

export default AstralShell;
