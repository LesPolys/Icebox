import { mulberry32, NUM } from "@icebox/shared";
import { createNoise3D } from "./noise";
import type {
  Vec3,
  WireframeSegment,
  ShipSection,
  ShipGeometry,
  ShipParams,
  Hardpoint,
  SectionId,
  AsteroidPlacement,
  EngineBell,
} from "./ShipTypes";

// ── Helpers ──────────────────────────────────────────────────────────

function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function seg(a: Vec3, b: Vec3): WireframeSegment {
  return { a, b };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Generate a ring of N vertices at a given Z, with per-vertex noise */
function makeRing(
  z: number,
  sides: number,
  radiusFn: (angle: number) => number,
  rng: () => number,
  noiseAmp: number,
  angleOffset = 0,
): Vec3[] {
  const verts: Vec3[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + angleOffset;
    const r = radiusFn(a) + (rng() - 0.5) * 2 * noiseAmp;
    verts.push(vec3(Math.cos(a) * r, Math.sin(a) * r, z));
  }
  return verts;
}

/** Connect vertices within a ring (circumferential edges) */
function ringEdges(ring: Vec3[]): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  for (let i = 0; i < ring.length; i++) {
    segs.push(seg(ring[i], ring[(i + 1) % ring.length]));
  }
  return segs;
}

/** Connect two rings longitudinally (ring-to-ring edges) */
function connectRings(a: Vec3[], b: Vec3[]): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    segs.push(seg(a[i], b[i]));
  }
  return segs;
}

/** Add diagonal cross-bracing between two rings */
function crossBrace(
  a: Vec3[],
  b: Vec3[],
  rng: () => number,
  count: number,
): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  const n = Math.min(a.length, b.length);
  const offset = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < count && i < n; i++) {
    const idx = Math.floor((i / count) * n);
    segs.push(seg(a[idx], b[(idx + offset) % n]));
  }
  return segs;
}

/** Triangulate between consecutive rings to produce solid mesh data.
 *  Only works when all rings have the same vertex count. */
function meshFromRings(rings: Vec3[][]): { vertices: Float32Array; indices: Uint16Array } | null {
  if (rings.length < 2) return null;
  const sides = rings[0].length;
  // Collect all vertices
  const verts: number[] = [];
  for (const ring of rings) {
    for (const v of ring) {
      verts.push(v.x, v.y, v.z);
    }
  }
  // Build triangle indices between consecutive rings
  const idx: number[] = [];
  for (let r = 0; r < rings.length - 1; r++) {
    const off0 = r * sides;
    const off1 = (r + 1) * sides;
    for (let i = 0; i < sides; i++) {
      const i1 = (i + 1) % sides;
      // Two triangles per quad
      idx.push(off0 + i, off1 + i, off1 + i1);
      idx.push(off0 + i, off1 + i1, off0 + i1);
    }
  }
  return {
    vertices: new Float32Array(verts),
    indices: new Uint16Array(idx),
  };
}

// ── Architectural Element Generators ────────────────────────────────

/** Cargo pod — box wireframe on struts, mounted at a random angle on hull */
function generateCargoPods(
  rng: () => number,
  rings: Vec3[][],
  envelopeR: (t: number) => number,
  zStart: number,
  zEnd: number,
): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  const count = Math.floor(rng() * 4); // 0-3
  for (let i = 0; i < count; i++) {
    const t = 0.2 + rng() * 0.6;
    const z = lerp(zStart, zEnd, t);
    const angle = rng() * Math.PI * 2;
    const hullR = envelopeR(t);
    const standoff = 1.5 + rng() * 2;
    const cx = Math.cos(angle) * (hullR + standoff);
    const cy = Math.sin(angle) * (hullR + standoff);

    // Box dimensions
    const bw = 1.5 + rng() * 2.5; // width (radial)
    const bh = 1 + rng() * 2;     // height (tangential)
    const bd = 2 + rng() * 3;     // depth (along Z)

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;

    const corners: Vec3[] = [];
    for (const dr of [-1, 1]) {
      for (const dn of [-1, 1]) {
        for (const dz of [-1, 1]) {
          corners.push(vec3(
            cx + dx * dr * bw / 2 + nx * dn * bh / 2,
            cy + dy * dr * bw / 2 + ny * dn * bh / 2,
            z + dz * bd / 2,
          ));
        }
      }
    }
    const boxEdges: [number, number][] = [
      [0, 1], [2, 3], [4, 5], [6, 7],
      [0, 2], [1, 3], [4, 6], [5, 7],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    for (const [a, b] of boxEdges) {
      segs.push(seg(corners[a], corners[b]));
    }

    // Struts from hull to pod
    const hullPt = vec3(Math.cos(angle) * hullR, Math.sin(angle) * hullR, z);
    segs.push(seg(hullPt, corners[0]));
    segs.push(seg(hullPt, corners[2]));
  }
  return segs;
}

/** External tanks — parallel cylinders on struts (engineering only) */
function generateExternalTanks(
  rng: () => number,
  envelopeR: (t: number) => number,
  zStart: number,
  zEnd: number,
): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  const count = Math.floor(rng() * 3); // 0-2
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const tStart = 0.15 + rng() * 0.3;
    const tEnd = tStart + 0.2 + rng() * 0.25;
    const tankR = 1.2 + rng() * 1.8;
    const tankSides = 5 + Math.floor(rng() * 3);
    const tankRingCount = 3 + Math.floor(rng() * 2);
    const hullR = envelopeR((tStart + tEnd) / 2);
    const standoff = hullR + tankR + 1 + rng() * 2;

    const tankRings: Vec3[][] = [];
    for (let r = 0; r < tankRingCount; r++) {
      const rt = r / (tankRingCount - 1);
      const z = lerp(lerp(zStart, zEnd, tStart), lerp(zStart, zEnd, tEnd), rt);
      // Taper at ends for capsule shape
      const endTaper = Math.min(1, Math.min(rt * 3, (1 - rt) * 3));
      const ring = makeRing(z, tankSides, () => tankR * endTaper, rng, 0.05);
      for (const v of ring) {
        v.x += Math.cos(angle) * standoff;
        v.y += Math.sin(angle) * standoff;
      }
      tankRings.push(ring);
      segs.push(...ringEdges(ring));
      if (r > 0) segs.push(...connectRings(tankRings[r - 1], ring));
    }

    // Struts to hull at start and end
    for (const tt of [tStart, tEnd]) {
      const z = lerp(zStart, zEnd, tt);
      const hr = envelopeR(tt);
      const hullPt = vec3(Math.cos(angle) * hr, Math.sin(angle) * hr, z);
      const tankPt = vec3(Math.cos(angle) * standoff, Math.sin(angle) * standoff, z);
      segs.push(seg(hullPt, tankPt));
    }
  }
  return segs;
}

/** Docking arms — articulated truss with ring at tip (habitat only) */
function generateDockingArms(
  rng: () => number,
  drumRadius: number,
  drumZ: number,
  drumLength: number,
  offsetX: number,
  offsetY: number,
): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  const count = Math.floor(rng() * 3); // 0-2
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const az = drumZ + rng() * drumLength;
    const armLen = 8 + rng() * 15;
    const jointCount = 2 + Math.floor(rng() * 2);

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let px = dx * drumRadius + offsetX;
    let py = dy * drumRadius + offsetY;
    let pz = az;

    for (let j = 0; j < jointCount; j++) {
      const segLen = armLen / jointCount;
      const jitter = (rng() - 0.5) * 2;
      const npx = px + dx * segLen;
      const npy = py + dy * segLen;
      const npz = pz + jitter;

      // Truss: two parallel rails + cross-bracing
      const perpX = -dy * 0.5;
      const perpY = dx * 0.5;
      const a1 = vec3(px + perpX, py + perpY, pz);
      const a2 = vec3(px - perpX, py - perpY, pz);
      const b1 = vec3(npx + perpX, npy + perpY, npz);
      const b2 = vec3(npx - perpX, npy - perpY, npz);
      segs.push(seg(a1, b1), seg(a2, b2), seg(a1, a2), seg(b1, b2));
      segs.push(seg(a1, b2)); // cross brace

      px = npx; py = npy; pz = npz;
    }

    // Docking ring at tip
    const ringR = 2 + rng() * 2;
    const ringSides = 6 + Math.floor(rng() * 4);
    const tipRing = makeRing(pz, ringSides, () => ringR, rng, 0.1);
    for (const v of tipRing) { v.x += px - Math.cos(0) * ringR; v.y += py; }
    // Simpler: place ring centered at arm tip
    const dockRing: Vec3[] = [];
    for (let d = 0; d < ringSides; d++) {
      const da = (d / ringSides) * Math.PI * 2;
      dockRing.push(vec3(px + Math.cos(da) * ringR, py + Math.sin(da) * ringR, pz));
    }
    segs.push(...ringEdges(dockRing));
    // Spokes from ring center to ring
    for (let d = 0; d < ringSides; d += 2) {
      segs.push(seg(vec3(px, py, pz), dockRing[d]));
    }
  }
  return segs;
}

/** Antenna arrays — boom + flat grid at tip (command only) */
function generateAntennaArrays(
  rng: () => number,
  envelopeR: (t: number) => number,
  zStart: number,
  zEnd: number,
): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  const count = Math.floor(rng() * 3); // 0-2
  for (let i = 0; i < count; i++) {
    const t = 0.2 + rng() * 0.5;
    const z = lerp(zStart, zEnd, t);
    const angle = rng() * Math.PI * 2;
    const hullR = envelopeR(t);
    const boomLen = 6 + rng() * 12;

    const base = vec3(Math.cos(angle) * hullR, Math.sin(angle) * hullR, z);
    const tip = vec3(
      Math.cos(angle) * (hullR + boomLen),
      Math.sin(angle) * (hullR + boomLen),
      z + (rng() - 0.5) * 3,
    );
    segs.push(seg(base, tip));

    // 3×3 flat grid at tip
    const gridSize = 2 + rng() * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    const rows = 3;
    const cols = 3;
    const gridPts: Vec3[][] = [];
    for (let r = 0; r < rows; r++) {
      gridPts[r] = [];
      for (let c = 0; c < cols; c++) {
        const gr = (r / (rows - 1) - 0.5) * gridSize;
        const gc = (c / (cols - 1) - 0.5) * gridSize;
        gridPts[r][c] = vec3(
          tip.x + nx * gr,
          tip.y + ny * gr,
          tip.z + gc,
        );
      }
    }
    // Grid edges
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c < cols - 1) segs.push(seg(gridPts[r][c], gridPts[r][c + 1]));
        if (r < rows - 1) segs.push(seg(gridPts[r][c], gridPts[r + 1][c]));
      }
    }
  }
  return segs;
}

/** Hull patches — small rectangles offset from hull surface */
function generateHullPatches(
  rng: () => number,
  rings: Vec3[][],
): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  if (rng() > 0.4) return segs; // 60% chance of patches
  const count = 1 + Math.floor(rng() * 5); // 1-5
  for (let i = 0; i < count; i++) {
    const ringIdx = Math.floor(rng() * Math.max(1, rings.length - 1));
    const ring = rings[ringIdx];
    const vertIdx = Math.floor(rng() * ring.length);
    const v = ring[vertIdx];

    const angle = Math.atan2(v.y, v.x);
    const outward = 0.3 + rng() * 0.5;
    const pw = 0.8 + rng() * 1.5;
    const ph = 0.6 + rng() * 1.2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    const cx = v.x + dx * outward;
    const cy = v.y + dy * outward;

    const corners: Vec3[] = [
      vec3(cx + nx * pw / 2, cy + ny * pw / 2, v.z - ph / 2),
      vec3(cx + nx * pw / 2, cy + ny * pw / 2, v.z + ph / 2),
      vec3(cx - nx * pw / 2, cy - ny * pw / 2, v.z + ph / 2),
      vec3(cx - nx * pw / 2, cy - ny * pw / 2, v.z - ph / 2),
    ];
    segs.push(seg(corners[0], corners[1]));
    segs.push(seg(corners[1], corners[2]));
    segs.push(seg(corners[2], corners[3]));
    segs.push(seg(corners[3], corners[0]));
  }
  return segs;
}

/** Cooling loops — pipe arcs that exit hull and reconnect (engineering) */
function generateCoolingLoops(
  rng: () => number,
  envelopeR: (t: number) => number,
  zStart: number,
  zEnd: number,
): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  const count = 1 + Math.floor(rng() * 3); // 1-3
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const tStart = 0.15 + rng() * 0.4;
    const tEnd = tStart + 0.15 + rng() * 0.2;
    const loopHeight = 3 + rng() * 6;
    const segCount = 8 + Math.floor(rng() * 5);

    const pts: Vec3[] = [];
    for (let s = 0; s <= segCount; s++) {
      const lt = s / segCount;
      const t = lerp(tStart, tEnd, lt);
      const z = lerp(zStart, zEnd, t);
      const hullR = envelopeR(t);
      // Sine arc: starts at hull, arcs outward, returns to hull
      const arcH = Math.sin(lt * Math.PI) * loopHeight;
      const r = hullR + arcH;
      pts.push(vec3(Math.cos(angle) * r, Math.sin(angle) * r, z));
    }
    for (let s = 0; s < pts.length - 1; s++) {
      segs.push(seg(pts[s], pts[s + 1]));
    }
  }
  return segs;
}

/** Reactor shielding plates — partial collar of heavy rectangular plates (engineering) */
function generateReactorShield(
  rng: () => number,
  envelopeR: (t: number) => number,
  zStart: number,
  zEnd: number,
): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  const count = 4 + Math.floor(rng() * 5); // 4-8
  const shieldT = 0.4 + rng() * 0.2; // midpoint position
  const shieldZ = lerp(zStart, zEnd, shieldT);
  const baseAngle = rng() * Math.PI * 2;
  const arcSpan = Math.PI * (0.6 + rng() * 0.8); // partial arc, not full ring

  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (i / count) * arcSpan;
    const hullR = envelopeR(shieldT);
    const standoff = 0.4 + rng() * 0.6;
    const r = hullR + standoff;
    const pw = 1.2 + rng() * 1.5;
    const ph = 1.5 + rng() * 2;
    const pd = 0.4 + rng() * 0.4;

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;

    const corners: Vec3[] = [];
    for (const dr of [-1, 1]) {
      for (const dn of [-1, 1]) {
        for (const dz of [-1, 1]) {
          corners.push(vec3(
            dx * (r + dr * pd / 2) + nx * dn * pw / 2,
            dy * (r + dr * pd / 2) + ny * dn * pw / 2,
            shieldZ + dz * ph / 2,
          ));
        }
      }
    }
    const boxEdges: [number, number][] = [
      [0, 1], [2, 3], [4, 5], [6, 7],
      [0, 2], [1, 3], [4, 6], [5, 7],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    for (const [a, b] of boxEdges) {
      segs.push(seg(corners[a], corners[b]));
    }
  }
  return segs;
}

/** Solar arrays — boom + rectangular grid extending from drum surface (habitat) */
function generateSolarArrays(
  rng: () => number,
  drumRadius: number,
  drumZ: number,
  drumLength: number,
  offsetX: number,
  offsetY: number,
): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  const count = 1 + Math.floor(rng() * 4); // 1-4
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const az = drumZ + rng() * drumLength;
    const boomLen = 5 + rng() * 8;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    const base = vec3(dx * drumRadius + offsetX, dy * drumRadius + offsetY, az);
    const tip = vec3(dx * (drumRadius + boomLen) + offsetX, dy * (drumRadius + boomLen) + offsetY, az);
    segs.push(seg(base, tip));

    // Rectangular panel grid (2×3 or 3×4)
    const rows = 2 + Math.floor(rng() * 2);
    const cols = 3 + Math.floor(rng() * 2);
    const panelW = 3 + rng() * 3;
    const panelH = 2 + rng() * 2;
    const nx = -dy;
    const ny = dx;

    const gridPts: Vec3[][] = [];
    for (let r = 0; r < rows; r++) {
      gridPts[r] = [];
      for (let c = 0; c < cols; c++) {
        const gr = (r / (rows - 1) - 0.5) * panelH;
        const gc = (c / (cols - 1) - 0.5) * panelW;
        gridPts[r][c] = vec3(
          tip.x + nx * gc,
          tip.y + ny * gc,
          tip.z + gr,
        );
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c < cols - 1) segs.push(seg(gridPts[r][c], gridPts[r][c + 1]));
        if (r < rows - 1) segs.push(seg(gridPts[r][c], gridPts[r + 1][c]));
      }
    }
  }
  return segs;
}

/** Observation bays — semicircular dome arcs projecting from drum (habitat) */
function generateObservationBays(
  rng: () => number,
  drumRadius: number,
  drumZ: number,
  drumLength: number,
  offsetX: number,
  offsetY: number,
): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  const count = Math.floor(rng() * 3); // 0-2
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const az = drumZ + 0.2 * drumLength + rng() * drumLength * 0.6;
    const domeR = 2 + rng() * 3;
    const arcSegs = 4 + Math.floor(rng() * 3);

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const cx = dx * drumRadius + offsetX;
    const cy = dy * drumRadius + offsetY;

    // Semicircular arc outward from hull surface
    const arcPts: Vec3[] = [];
    for (let s = 0; s <= arcSegs; s++) {
      const at = (s / arcSegs) * Math.PI; // 0 to PI = semicircle
      const r = Math.sin(at) * domeR;
      const zOff = Math.cos(at) * domeR;
      arcPts.push(vec3(cx + dx * r, cy + dy * r, az + zOff));
    }
    for (let s = 0; s < arcPts.length - 1; s++) {
      segs.push(seg(arcPts[s], arcPts[s + 1]));
    }

    // Second arc rotated 90 degrees for dome cross
    const arcPts2: Vec3[] = [];
    const nx = -dy;
    const ny = dx;
    for (let s = 0; s <= arcSegs; s++) {
      const at = (s / arcSegs) * Math.PI;
      const r = Math.sin(at) * domeR;
      const fwd = Math.cos(at) * domeR;
      arcPts2.push(vec3(cx + dx * r, cy + dy * r, az + fwd));
    }
    // Lateral ribs
    for (let s = 0; s <= arcSegs; s++) {
      const at = (s / arcSegs) * Math.PI;
      const r = Math.sin(at) * domeR;
      const lateralPt = vec3(cx + nx * r, cy + ny * r, az);
      if (s > 0 && s < arcSegs) {
        segs.push(seg(vec3(cx, cy, az), lateralPt));
      }
    }
  }
  return segs;
}

/** Sensor dishes — ring of vertices with spokes to central feed (command) */
function generateSensorDishes(
  rng: () => number,
  envelopeR: (t: number) => number,
  zStart: number,
  zEnd: number,
): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  const count = 1 + Math.floor(rng() * 3); // 1-3
  for (let i = 0; i < count; i++) {
    const t = 0.15 + rng() * 0.5;
    const z = lerp(zStart, zEnd, t);
    const angle = rng() * Math.PI * 2;
    const hullR = envelopeR(t);
    const boomLen = 2 + rng() * 4;
    const dishR = 1.5 + rng() * 2.5;
    const dishSides = 6 + Math.floor(rng() * 4);

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const base = vec3(dx * hullR, dy * hullR, z);
    const center = vec3(dx * (hullR + boomLen), dy * (hullR + boomLen), z);
    segs.push(seg(base, center));

    // Feed point — slightly forward of dish center
    const feed = vec3(center.x + dx * (dishR * 0.8), center.y + dy * (dishR * 0.8), center.z);

    // Dish rim + spokes
    const rim: Vec3[] = [];
    const nx = -dy;
    const ny = dx;
    for (let d = 0; d < dishSides; d++) {
      const da = (d / dishSides) * Math.PI * 2;
      rim.push(vec3(
        center.x + nx * Math.cos(da) * dishR,
        center.y + ny * Math.cos(da) * dishR,
        center.z + Math.sin(da) * dishR,
      ));
    }
    segs.push(...ringEdges(rim));
    // Spokes to feed
    for (let d = 0; d < dishSides; d += 2) {
      segs.push(seg(rim[d], feed));
    }
    // Feed strut
    segs.push(seg(center, feed));
  }
  return segs;
}

/** Communication booms — long lateral boom with cross-bracing and dipole V (command) */
function generateCommBooms(
  rng: () => number,
  envelopeR: (t: number) => number,
  zStart: number,
  zEnd: number,
): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  const count = Math.floor(rng() * 3); // 0-2
  for (let i = 0; i < count; i++) {
    const t = 0.1 + rng() * 0.4;
    const z = lerp(zStart, zEnd, t);
    const angle = rng() * Math.PI * 2;
    const hullR = envelopeR(t);
    const boomLen = 15 + rng() * 15; // 15-30 units
    const bracingCount = 3 + Math.floor(rng() * 3);

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    // Two parallel rails with periodic cross-bracing
    const railSpacing = 0.4;
    const nx = -dy * railSpacing;
    const ny = dx * railSpacing;

    let prevA = vec3(dx * hullR + nx, dy * hullR + ny, z);
    let prevB = vec3(dx * hullR - nx, dy * hullR - ny, z);
    segs.push(seg(prevA, prevB));

    for (let b = 1; b <= bracingCount; b++) {
      const bt = b / bracingCount;
      const r = hullR + bt * boomLen;
      const bz = z + (rng() - 0.5) * 2;
      const nextA = vec3(dx * r + nx, dy * r + ny, bz);
      const nextB = vec3(dx * r - nx, dy * r - ny, bz);
      segs.push(seg(prevA, nextA), seg(prevB, nextB));
      segs.push(seg(nextA, nextB));
      segs.push(seg(prevA, nextB)); // cross brace
      prevA = nextA;
      prevB = nextB;
    }

    // Dipole V at tip
    const tipR = hullR + boomLen;
    const tipCenter = vec3(dx * tipR, dy * tipR, z);
    const dipoleLen = 2 + rng() * 3;
    segs.push(seg(tipCenter, vec3(dx * tipR + nx * 3, dy * tipR + ny * 3, z + dipoleLen)));
    segs.push(seg(tipCenter, vec3(dx * tipR - nx * 3, dy * tipR - ny * 3, z + dipoleLen)));
  }
  return segs;
}

/** Bridge module — 5 distinct architectural styles for the command section */
function generateBridgeModule(
  rng: () => number,
  style: number,
  envelopeR: (t: number) => number,
  zStart: number,
  zEnd: number,
  scale: number,
): WireframeSegment[] {
  const segs: WireframeSegment[] = [];
  const bridgeZ = zEnd - 2 - rng() * 5;
  const t = Math.max(0, Math.min(1, (bridgeZ - zStart) / (zEnd - zStart)));
  const hullR = envelopeR(t);

  switch (style) {
    case 0: {
      // ── Tower — vertical stack of rings rising above hull ──
      const towerSides = 6 + Math.floor(rng() * 3);
      const towerBaseR = (1.5 + rng() * 1.5) * scale;
      const towerHeight = (4 + rng() * 4) * scale;
      const towerLayers = 3 + Math.floor(rng() * 2);
      const offAngle = rng() * Math.PI * 2;
      const ox = Math.cos(offAngle) * hullR * 0.3;
      const oy = Math.sin(offAngle) * hullR * 0.3;

      const towerRings: Vec3[][] = [];
      for (let l = 0; l < towerLayers; l++) {
        const lt = l / (towerLayers - 1);
        const elevation = hullR + lt * towerHeight;
        const taper = 1 - lt * 0.3; // narrow slightly at top
        const ring = makeRing(bridgeZ, towerSides, () => towerBaseR * taper, rng, 0.1);
        for (const v of ring) {
          const rx = v.x; const ry = v.y;
          v.x = ox + rx;
          v.y = oy + elevation;
          v.z = bridgeZ + ry * 0.3; // slight Z spread
        }
        towerRings.push(ring);
        segs.push(...ringEdges(ring));
        if (l > 0) segs.push(...connectRings(towerRings[l - 1], ring));
      }
      // Struts to hull
      const hullPt1 = vec3(ox - towerBaseR, hullR * 0.5, bridgeZ);
      const hullPt2 = vec3(ox + towerBaseR, hullR * 0.5, bridgeZ);
      segs.push(seg(hullPt1, towerRings[0][0]));
      segs.push(seg(hullPt2, towerRings[0][Math.floor(towerSides / 2)]));
      break;
    }

    case 1: {
      // ── Bubble — multi-layer dome with window bands ──
      const bSides = 8 + Math.floor(rng() * 4);
      const bubbleR = (2 + rng() * 2.5) * scale;
      const offX = (rng() - 0.5) * 3;
      const baseY = hullR * 0.6;
      const layers = 3 + Math.floor(rng() * 2);

      let prevRing: Vec3[] | null = null;
      for (let l = 0; l < layers; l++) {
        const lt = (l + 1) / layers;
        const elev = Math.sin(lt * Math.PI * 0.5);
        const r = bubbleR * Math.cos(lt * Math.PI * 0.45);
        const ring = makeRing(bridgeZ, bSides, () => r, rng, 0.08);
        for (const v of ring) {
          v.x += offX;
          v.y += baseY + elev * bubbleR;
        }
        segs.push(...ringEdges(ring));
        if (prevRing) {
          segs.push(...connectRings(prevRing, ring));
          // Window slits — horizontal lines between layers at intervals
          const n = Math.min(prevRing.length, ring.length);
          for (let i = 0; i < n; i += 2) {
            const mid = vec3(
              (prevRing[i].x + ring[i].x) * 0.5,
              (prevRing[i].y + ring[i].y) * 0.5,
              (prevRing[i].z + ring[i].z) * 0.5,
            );
            const mid2 = vec3(
              (prevRing[(i + 1) % n].x + ring[(i + 1) % n].x) * 0.5,
              (prevRing[(i + 1) % n].y + ring[(i + 1) % n].y) * 0.5,
              (prevRing[(i + 1) % n].z + ring[(i + 1) % n].z) * 0.5,
            );
            segs.push(seg(mid, mid2));
          }
        } else {
          // Base ring on hull
          const baseRing = makeRing(bridgeZ, bSides, () => bubbleR, rng, 0.05);
          for (const v of baseRing) v.x += offX;
          segs.push(...ringEdges(baseRing));
          segs.push(...connectRings(baseRing, ring));
        }
        prevRing = ring;
      }
      break;
    }

    case 2: {
      // ── Spar — forward boom with module at tip ──
      const sparLen = (8 + rng() * 10) * scale;
      const sparZ = zEnd + sparLen;
      const moduleR = (1 + rng() * 1.5) * scale;
      const moduleSides = 6 + Math.floor(rng() * 3);
      const moduleLen = (2 + rng() * 2) * scale;
      const offX = (rng() - 0.5) * 2;
      const offY = (rng() - 0.5) * 2;

      // Boom truss
      const boomBase = vec3(offX, offY, zEnd);
      const boomTip = vec3(offX, offY, sparZ);
      segs.push(seg(boomBase, boomTip));
      // Parallel rail
      const rail2Base = vec3(offX + 0.4, offY, zEnd);
      const rail2Tip = vec3(offX + 0.4, offY, sparZ);
      segs.push(seg(rail2Base, rail2Tip));
      // Cross bracing along boom
      const braces = 3 + Math.floor(rng() * 3);
      for (let b = 0; b < braces; b++) {
        const bt = (b + 1) / (braces + 1);
        const bz = lerp(zEnd, sparZ, bt);
        segs.push(seg(vec3(offX, offY, bz), vec3(offX + 0.4, offY, bz)));
        if (b > 0) {
          const prevZ = lerp(zEnd, sparZ, b / (braces + 1));
          segs.push(seg(vec3(offX, offY, prevZ), vec3(offX + 0.4, offY, bz)));
        }
      }

      // Module at tip — short cylinder + end cap ring
      const modRings: Vec3[][] = [];
      const modRingCount = 3;
      for (let mr = 0; mr < modRingCount; mr++) {
        const mrt = mr / (modRingCount - 1);
        const mz = sparZ + mrt * moduleLen;
        const ring = makeRing(mz, moduleSides, () => moduleR, rng, 0.08);
        for (const v of ring) { v.x += offX; v.y += offY; }
        modRings.push(ring);
        segs.push(...ringEdges(ring));
        if (mr > 0) segs.push(...connectRings(modRings[mr - 1], ring));
      }
      break;
    }

    case 3: {
      // ── Armored — recessed viewport collar ──
      const collarSides = 8 + Math.floor(rng() * 4);
      const collarR = hullR * (0.7 + rng() * 0.2);
      const collarDepth = (1.5 + rng() * 1.5) * scale;
      const slitHeight = (0.5 + rng() * 0.5) * scale;

      // Outer collar ring
      const outerRing = makeRing(bridgeZ, collarSides, () => collarR * scale, rng, 0.1);
      segs.push(...ringEdges(outerRing));

      // Inner collar ring — smaller, recessed inward
      const innerR = collarR * (0.5 + rng() * 0.15) * scale;
      const innerRing = makeRing(bridgeZ, collarSides, () => innerR, rng, 0.08);
      for (const v of innerRing) v.y += collarDepth;
      segs.push(...ringEdges(innerRing));

      // Angled plates connecting outer to inner (armored slope)
      segs.push(...connectRings(outerRing, innerRing));

      // Viewport slit — horizontal band between two rings
      const slitLower = makeRing(bridgeZ, collarSides,
        () => (collarR * 0.75) * scale, rng, 0.05);
      const slitUpper = makeRing(bridgeZ, collarSides,
        () => (collarR * 0.75) * scale, rng, 0.05);
      for (const v of slitLower) v.y += collarDepth * 0.4;
      for (const v of slitUpper) v.y += collarDepth * 0.4 + slitHeight;
      segs.push(...ringEdges(slitLower));
      segs.push(...ringEdges(slitUpper));
      segs.push(...connectRings(slitLower, slitUpper));
      break;
    }

    case 4: {
      // ── Gondola — pod hanging below hull on struts ──
      const gondolaSides = 6 + Math.floor(rng() * 4);
      const gondolaR = (1.2 + rng() * 1.5) * scale;
      const gondolaLen = (3 + rng() * 3) * scale;
      const dropDist = (hullR * 0.5 + 2 + rng() * 3) * scale;
      const offX = (rng() - 0.5) * 2;

      // Pod rings below hull
      const podRings: Vec3[][] = [];
      const podRingCount = 3 + Math.floor(rng() * 2);
      for (let pr = 0; pr < podRingCount; pr++) {
        const prt = pr / (podRingCount - 1);
        const pz = bridgeZ + (prt - 0.5) * gondolaLen;
        const taper = 1 - Math.abs(prt - 0.5) * 0.6; // barrel shape
        const ring = makeRing(pz, gondolaSides, () => gondolaR * taper, rng, 0.08);
        for (const v of ring) { v.x += offX; v.y -= dropDist; }
        podRings.push(ring);
        segs.push(...ringEdges(ring));
        if (pr > 0) segs.push(...connectRings(podRings[pr - 1], ring));
      }

      // Struts from hull down to pod
      const strutCount = 2 + Math.floor(rng() * 2);
      for (let s = 0; s < strutCount; s++) {
        const st = (s / (strutCount - 1)) * 0.6 + 0.2;
        const sz = bridgeZ + (st - 0.5) * gondolaLen;
        const hullPt = vec3(offX, -hullR * 0.3, sz);
        const podPt = vec3(offX, -dropDist, sz);
        segs.push(seg(hullPt, podPt));
        // Cross brace
        if (s > 0) {
          const prevSz = bridgeZ + (((s - 1) / (strutCount - 1)) * 0.6 + 0.2 - 0.5) * gondolaLen;
          segs.push(seg(vec3(offX, -hullR * 0.3, prevSz), podPt));
        }
      }
      break;
    }
  }

  return segs;
}

// ── Section Generators ──────────────────────────────────────────────

interface AsteroidResult {
  section: ShipSection;
  radius: number;
}

function generateAsteroid(
  rng: () => number,
  noiseSeed: number,
  zOffset = 0,
): AsteroidResult {
  const noise = createNoise3D(noiseSeed);
  const segments: WireframeSegment[] = [];
  const baseRadius = 9 + rng() * 7; // 9-16
  const detail = 2;

  // Build deformed icosphere vertices
  // Use icosahedron base vertices and subdivide
  const phi = (1 + Math.sqrt(5)) / 2;
  const icoVerts: Vec3[] = [
    vec3(-1, phi, 0), vec3(1, phi, 0), vec3(-1, -phi, 0), vec3(1, -phi, 0),
    vec3(0, -1, phi), vec3(0, 1, phi), vec3(0, -1, -phi), vec3(0, 1, -phi),
    vec3(phi, 0, -1), vec3(phi, 0, 1), vec3(-phi, 0, -1), vec3(-phi, 0, 1),
  ];
  // Normalize base verts
  for (const v of icoVerts) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    v.x /= len; v.y /= len; v.z /= len;
  }

  const icoFaces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  // Subdivide
  type TriFace = [number, number, number];
  let verts = [...icoVerts];
  let faces: TriFace[] = [...icoFaces];
  const midpointCache = new Map<string, number>();

  function getMidpoint(i1: number, i2: number): number {
    const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
    const cached = midpointCache.get(key);
    if (cached !== undefined) return cached;
    const v1 = verts[i1];
    const v2 = verts[i2];
    const mid = vec3(
      (v1.x + v2.x) / 2,
      (v1.y + v2.y) / 2,
      (v1.z + v2.z) / 2,
    );
    const len = Math.sqrt(mid.x * mid.x + mid.y * mid.y + mid.z * mid.z);
    mid.x /= len; mid.y /= len; mid.z /= len;
    const idx = verts.length;
    verts.push(mid);
    midpointCache.set(key, idx);
    return idx;
  }

  for (let d = 0; d < detail; d++) {
    const newFaces: TriFace[] = [];
    midpointCache.clear();
    for (const [a, b, c] of faces) {
      const ab = getMidpoint(a, b);
      const bc = getMidpoint(b, c);
      const ca = getMidpoint(c, a);
      newFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = newFaces;
  }

  // Deform vertices with noise — randomize frequencies and amplitudes
  const freq1 = 1.0 + rng() * 1.5; // 1.0-2.5
  const amp1 = 2.5 + rng() * 4.0; // 2.5-6.5
  const freq2 = 3.0 + rng() * 3.0; // 3.0-6.0
  const amp2 = 1.0 + rng() * 2.0; // 1.0-3.0
  const minR = baseRadius * 0.4;

  const deformedVerts = verts.map((v) => {
    const n1 = noise(v.x * freq1, v.y * freq1, v.z * freq1) * amp1;
    const n2 = noise(v.x * freq2, v.y * freq2, v.z * freq2) * amp2;
    const r = Math.max(baseRadius + n1 + n2, minR);

    return vec3(v.x * r, v.y * r, v.z * r + zOffset);
  });

  // Extract edges from faces (deduplicated)
  const edgeSet = new Set<string>();
  for (const [a, b, c] of faces) {
    const edges: [number, number][] = [[a, b], [b, c], [c, a]];
    for (const [i, j] of edges) {
      const key = i < j ? `${i}_${j}` : `${j}_${i}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        segments.push(seg(deformedVerts[i], deformedVerts[j]));
      }
    }
  }

  // Build mesh data for solid rendering
  const vertices = new Float32Array(deformedVerts.length * 3);
  for (let i = 0; i < deformedVerts.length; i++) {
    vertices[i * 3] = deformedVerts[i].x;
    vertices[i * 3 + 1] = deformedVerts[i].y;
    vertices[i * 3 + 2] = deformedVerts[i].z;
  }
  const indices = new Uint16Array(faces.length * 3);
  for (let i = 0; i < faces.length; i++) {
    indices[i * 3] = faces[i][0];
    indices[i * 3 + 1] = faces[i][1];
    indices[i * 3 + 2] = faces[i][2];
  }

  return {
    section: {
      id: "asteroid",
      zMin: -15 + zOffset,
      zMax: 15 + zOffset,
      segments,
      color: NUM.concrete,
      hardpoints: [],
      mesh: { vertices, indices },
    },
    radius: baseRadius,
  };
}

interface AsteroidBounds {
  zMin: number;
  zMax: number;
  radius: number;
}

function generateEngineering(
  rng: () => number,
  asteroidBounds?: AsteroidBounds,
  engineCountOverride?: number,
): ShipSection {
  const segments: WireframeSegment[] = [];
  const zStart = -45 - rng() * 15; // -45 to -60
  const zEnd = -15;
  const ringCount = 10 + Math.floor(rng() * 8); // 10-17
  const sides = 8 + Math.floor(rng() * 8); // 8-15

  // Cross-section shape type: 0=round, 1=squashed, 2=wide
  const shapeType = Math.floor(rng() * 3);
  const squash = shapeType === 1 ? 0.5 + rng() * 0.3 : 1;
  const widen = shapeType === 2 ? 1.3 + rng() * 0.5 : 1;

  // Randomized envelope shape
  const neckRadius = 2.5 + rng() * 3;
  const midRadius = 6 + rng() * 5;
  const baseRadius = 9 + rng() * 4;
  const flarePoint = 0.1 + rng() * 0.2;
  const midPoint = 0.3 + rng() * 0.2;
  // Random bulge — some ships have a wider section partway down
  const hasBulge = rng() > 0.5;
  const bulgeT = 0.4 + rng() * 0.3;
  const bulgeAmt = 1.2 + rng() * 0.6;

  function envelopeRadius(t: number): number {
    let r: number;
    if (t < flarePoint) r = lerp(neckRadius, midRadius, smoothstep(t / flarePoint));
    else if (t < midPoint) r = lerp(midRadius, midRadius * 1.05, smoothstep((t - flarePoint) / (midPoint - flarePoint)));
    else r = lerp(midRadius * 1.05, baseRadius, smoothstep((t - midPoint) / (1 - midPoint)));
    if (hasBulge) {
      const dist = Math.abs(t - bulgeT);
      if (dist < 0.15) r *= lerp(bulgeAmt, 1, dist / 0.15);
    }
    // When asteroid is in engineering sector, hull must clear the rock
    if (asteroidBounds) {
      const z = lerp(zStart, zEnd, t);
      if (z >= asteroidBounds.zMin && z <= asteroidBounds.zMax) {
        r = Math.max(r, asteroidBounds.radius + 2);
      }
    }
    return r;
  }

  // Per-ring angle offset for twist
  const twistRate = (rng() - 0.5) * 0.15;

  const rings: Vec3[][] = [];
  for (let i = 0; i < ringCount; i++) {
    const t = i / (ringCount - 1);
    const z = lerp(zStart, zEnd, t);
    const r = envelopeRadius(t);
    const ring = makeRing(z, sides, (a) => {
      // Elliptical cross-section
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      return r * Math.sqrt(cx * cx * widen * widen + cy * cy * squash * squash);
    }, rng, 0.4 + rng() * 0.6, twistRate * i);
    rings.push(ring);
    segments.push(...ringEdges(ring));
    if (i > 0) {
      segments.push(...connectRings(rings[i - 1], ring));
      if (i % 2 === 0) {
        segments.push(...crossBrace(rings[i - 1], ring, rng, 4 + Math.floor(rng() * 4)));
      }
    }
  }

  // ── Bell shape profiles ──
  function bellProfile(bt: number, shape: number, radius: number): number {
    switch (shape) {
      case 1: return radius * (0.3 + 0.7 * Math.pow(bt, 2.5));    // Flared
      case 2: return radius * (0.85 + bt * 0.15);                  // Straight cylinder
      case 3: return radius * (0.5 + 0.5 * Math.sin(bt * Math.PI)); // Bulged
      default: return radius * (0.4 + bt * 0.6);                   // Cone (original)
    }
  }

  // ── Helper: generate a bell + mount it to a hull ring ──
  function generateBell(
    cx: number, cy: number, bellZ: number,
    bellRadius: number, bellLength: number,
    bellSides: number, bellRingCount: number,
    bellShape: number,
    anchorRing: Vec3[], secondRing?: Vec3[],
  ): { bellRings: Vec3[][]; center: Vec3 } {
    const bellRings: Vec3[][] = [];
    for (let br = 0; br < bellRingCount; br++) {
      const bt = br / (bellRingCount - 1);
      const bz = bellZ - bt * bellLength;
      const bRadius = bellProfile(bt, bellShape, bellRadius);
      const ring = makeRing(bz, bellSides, () => bRadius, rng, 0.1);
      for (const v of ring) { v.x += cx; v.y += cy; }
      bellRings.push(ring);
      segments.push(...ringEdges(ring));
      if (br > 0) segments.push(...connectRings(bellRings[br - 1], ring));
    }

    // Mounting structure
    const bellFront = bellRings[0];
    const strutCount = Math.min(4, Math.max(3, Math.floor(bellSides / 2)));
    const hullSorted = anchorRing
      .map((v) => ({ v, dist: Math.sqrt((v.x - cx) ** 2 + (v.y - cy) ** 2) }))
      .sort((a, b) => a.dist - b.dist);

    const usedHull: Vec3[] = [];
    const usedBell: Vec3[] = [];
    for (let s = 0; s < Math.min(strutCount, hullSorted.length); s++) {
      const hv = hullSorted[s].v;
      const bv = bellFront[s % bellFront.length];
      segments.push(seg(hv, bv));
      usedHull.push(hv);
      usedBell.push(bv);
    }

    // Cross-bracing
    for (let s = 0; s < usedHull.length - 1; s++) {
      segments.push(seg(usedHull[s], usedBell[s + 1]));
      segments.push(seg(usedHull[s + 1], usedBell[s]));
    }
    if (usedHull.length >= 3) {
      segments.push(seg(usedHull[usedHull.length - 1], usedBell[0]));
      segments.push(seg(usedHull[0], usedBell[usedBell.length - 1]));
    }

    // Mounting collar
    const collarRing: Vec3[] = [];
    for (let s = 0; s < usedHull.length; s++) {
      collarRing.push(vec3(
        (usedHull[s].x + usedBell[s].x) * 0.5,
        (usedHull[s].y + usedBell[s].y) * 0.5,
        (usedHull[s].z + usedBell[s].z) * 0.5,
      ));
    }
    segments.push(...ringEdges(collarRing));
    for (let s = 0; s < collarRing.length; s++) {
      segments.push(seg(collarRing[s], usedHull[s]));
      segments.push(seg(collarRing[s], usedBell[s]));
    }

    // Deep anchoring from second ring if available
    if (secondRing) {
      const hullSorted2 = secondRing
        .map((v) => ({ v, dist: Math.sqrt((v.x - cx) ** 2 + (v.y - cy) ** 2) }))
        .sort((a, b) => a.dist - b.dist);
      for (let s = 0; s < Math.min(2, hullSorted2.length); s++) {
        segments.push(seg(hullSorted2[s].v, collarRing[s % collarRing.length]));
      }
    }

    return { bellRings, center: vec3(cx, cy, bellZ) };
  }

  // ── Tail engines — varied layouts with overlap avoidance ──
  const engineLayout = Math.floor(rng() * 3); // 0=radial, 1=clustered, 2=asymmetric
  let engineCount = engineCountOverride
    ?? (engineLayout === 1 ? 1 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 5));
  engineCount = Math.max(1, engineCount); // always at least 1 tail engine
  const engineSpread = engineLayout === 1 ? 2 + rng() * 3 : 3 + rng() * 4;
  const engineBells: EngineBell[] = [];
  const allBellRingSets: Vec3[][][] = [];

  // Track placed engines for overlap check
  const placedEngines: { cx: number; cy: number; r: number }[] = [];

  for (let e = 0; e < engineCount; e++) {
    let cx: number, cy: number, bellRadius: number;
    let placed = false;

    for (let attempt = 0; attempt < 5; attempt++) {
      let angle: number, dist: number;
      if (engineLayout === 2) {
        angle = rng() * Math.PI * 0.8 + rng() * 0.3;
        dist = engineSpread + rng() * 3;
      } else {
        angle = (e / engineCount) * Math.PI * 2 + rng() * 0.5;
        dist = engineSpread + rng() * 2;
      }
      cx = Math.cos(angle) * dist;
      cy = Math.sin(angle) * dist;
      bellRadius = 2.5 + rng() * 3.5;

      const overlaps = placedEngines.some((pe) => {
        const d = Math.sqrt((cx! - pe.cx) ** 2 + (cy! - pe.cy) ** 2);
        return d < bellRadius! + pe.r + 1;
      });
      if (!overlaps) { placed = true; break; }
    }
    if (!placed) continue; // skip overlapping engine

    placedEngines.push({ cx: cx!, cy: cy!, r: bellRadius! });

    const bellLength = 5 + rng() * 6;
    const bellSides = 5 + Math.floor(rng() * 4);
    const bellRingCount = 3 + Math.floor(rng() * 3); // 3-5 rings for shape detail
    const bellShape = Math.floor(rng() * 4); // 0=cone, 1=flared, 2=straight, 3=bulged

    const { bellRings, center } = generateBell(
      cx!, cy!, zStart, bellRadius!, bellLength,
      bellSides, bellRingCount, bellShape,
      rings[0], rings.length > 1 ? rings[1] : undefined,
    );

    engineBells.push({ center, radius: bellRadius!, length: bellLength, thrustDir: vec3(0, 0, -1), rings: bellRings });
    allBellRingSets.push(bellRings);
  }

  // ── Body-mounted lateral thrusters (attitude/maneuvering) ──
  // Either none or 3+ evenly spaced around the hull for believable RCS
  const hasLaterals = rng() > 0.5;
  const lateralCount = hasLaterals ? 3 + Math.floor(rng() * 3) : 0; // 0 or 3-5
  if (lateralCount > 0) {
    // Shared properties for the set — consistent look per ship
    const lRadius = 0.5 + rng() * 1.0;
    const lLength = 1 + rng() * 2;
    const lSides = 5 + Math.floor(rng() * 3);
    const lRingCount = 2 + Math.floor(rng() * 2);
    const lShape = Math.floor(rng() * 4);
    const angledBack = rng() > 0.5; // consistent direction for the set

    // Pick 1-2 Z bands where thrusters sit
    const bandCount = 1 + Math.floor(rng() * 2); // 1-2
    const bands: number[] = [];
    for (let b = 0; b < bandCount; b++) {
      bands.push(0.25 + (b / bandCount) * 0.4 + rng() * 0.1);
    }

    // Evenly space thrusters around the circumference
    const baseAngle = rng() * Math.PI * 2;
    for (let lt = 0; lt < lateralCount; lt++) {
      const angle = baseAngle + (lt / lateralCount) * Math.PI * 2;
      const tPos = bands[lt % bands.length];
      const lz = lerp(zStart, zEnd, tPos);
      const hullR = envelopeRadius(tPos);

      // Mount on hull outer surface
      const mx = Math.cos(angle) * hullR;
      const my = Math.sin(angle) * hullR;
      const thrustDx = Math.cos(angle);
      const thrustDy = Math.sin(angle);

      // Generate bell rings oriented along thrust direction
      const bellRings: Vec3[][] = [];
      for (let br = 0; br < lRingCount; br++) {
        const bt = br / (lRingCount - 1);
        const dist = bt * lLength;
        const bRadius = bellProfile(bt, lShape, lRadius);
        const ring = makeRing(0, lSides, () => bRadius, rng, 0.05);
        for (const vtx of ring) {
          const localX = vtx.x;
          const localY = vtx.y;
          const zOff = angledBack ? -dist * 0.7 : 0;
          const radialDist = dist * (angledBack ? 0.7 : 1);
          vtx.x = mx + thrustDx * radialDist + (-thrustDy) * localX;
          vtx.y = my + thrustDy * radialDist + thrustDx * localX;
          vtx.z = lz + localY + zOff;
        }
        bellRings.push(ring);
        segments.push(...ringEdges(ring));
        if (br > 0) segments.push(...connectRings(bellRings[br - 1], ring));
      }

      // Find nearest hull ring for mounting struts
      let bestRingIdx = 0;
      let bestDist = Infinity;
      for (let ri = 0; ri < rings.length; ri++) {
        const ringZ = lerp(zStart, zEnd, ri / (rings.length - 1));
        const d = Math.abs(ringZ - lz);
        if (d < bestDist) { bestDist = d; bestRingIdx = ri; }
      }
      const anchorRing = rings[bestRingIdx];
      const bellFront = bellRings[0];
      const hullSorted = anchorRing
        .map((vtx) => ({ v: vtx, dist: Math.sqrt((vtx.x - mx) ** 2 + (vtx.y - my) ** 2) }))
        .sort((a, b) => a.dist - b.dist);
      for (let s = 0; s < Math.min(3, hullSorted.length); s++) {
        segments.push(seg(hullSorted[s].v, bellFront[s % bellFront.length]));
        if (s > 0) {
          segments.push(seg(hullSorted[s].v, bellFront[(s - 1) % bellFront.length]));
        }
      }

      // Thrust direction
      const tdx = angledBack ? thrustDx * 0.7 : thrustDx;
      const tdy = angledBack ? thrustDy * 0.7 : thrustDy;
      const tdz = angledBack ? -0.7 : 0;
      const tLen = Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz) || 1;
      const lThrustDir = vec3(tdx / tLen, tdy / tLen, tdz / tLen);
      engineBells.push({ center: vec3(mx, my, lz), radius: lRadius, length: lLength, thrustDir: lThrustDir, rings: bellRings });
      allBellRingSets.push(bellRings);
    }
  }

  // Radiator panels
  const radiatorCount = 1 + Math.floor(rng() * 4);
  for (let r = 0; r < radiatorCount; r++) {
    const angle = (r / radiatorCount) * Math.PI * 2 + rng() * 0.8;
    const panelZ = lerp(zStart * 0.7, zEnd * 1.3, rng());
    const panelDepth = 3 + rng() * 6;
    const panelWidth = 6 + rng() * 12;
    const panelThick = 0.3;
    const hullR = envelopeRadius(Math.max(0, Math.min(1, (panelZ - zStart) / (zEnd - zStart))));

    const cx = Math.cos(angle) * (hullR + panelWidth / 2);
    const cy = Math.sin(angle) * (hullR + panelWidth / 2);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;

    const corners: Vec3[] = [];
    for (const dw of [-1, 1]) {
      for (const dd of [-1, 1]) {
        for (const dt of [-1, 1]) {
          corners.push(vec3(
            cx + dx * dw * panelWidth / 2 + nx * dt * panelThick / 2,
            cy + dy * dw * panelWidth / 2 + ny * dt * panelThick / 2,
            panelZ + dd * panelDepth / 2,
          ));
        }
      }
    }
    const boxEdges: [number, number][] = [
      [0, 1], [2, 3], [4, 5], [6, 7],
      [0, 2], [1, 3], [4, 6], [5, 7],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    for (const [a, b] of boxEdges) {
      segments.push(seg(corners[a], corners[b]));
    }
  }

  // Structural gantries — open truss frames extending from hull
  const gantryCount = Math.floor(rng() * 3); // 0-2
  for (let g = 0; g < gantryCount; g++) {
    const angle = rng() * Math.PI * 2;
    const gz = lerp(zStart * 0.6, zEnd, rng());
    const length = 5 + rng() * 8;
    const hullR = envelopeRadius(Math.max(0, Math.min(1, (gz - zStart) / (zEnd - zStart))));
    const base1 = vec3(Math.cos(angle) * hullR, Math.sin(angle) * hullR, gz - 1);
    const base2 = vec3(Math.cos(angle) * hullR, Math.sin(angle) * hullR, gz + 1);
    const tip1 = vec3(Math.cos(angle) * (hullR + length), Math.sin(angle) * (hullR + length), gz - 0.5);
    const tip2 = vec3(Math.cos(angle) * (hullR + length), Math.sin(angle) * (hullR + length), gz + 0.5);
    segments.push(seg(base1, tip1), seg(base2, tip2), seg(base1, base2), seg(tip1, tip2));
    segments.push(seg(base1, tip2), seg(base2, tip1)); // cross bracing
  }

  // Architectural elements — Phase 4 & 5
  segments.push(...generateCargoPods(rng, rings, envelopeRadius, zStart, zEnd));
  segments.push(...generateExternalTanks(rng, envelopeRadius, zStart, zEnd));
  segments.push(...generateCoolingLoops(rng, envelopeRadius, zStart, zEnd));
  segments.push(...generateReactorShield(rng, envelopeRadius, zStart, zEnd));
  segments.push(...generateHullPatches(rng, rings));

  // Combine hull mesh + engine bell meshes for solid hover
  const meshParts = [meshFromRings(rings)];
  for (const bellRings of allBellRingSets) {
    const bellMesh = meshFromRings(bellRings);
    if (bellMesh) meshParts.push(bellMesh);
  }
  const validParts = meshParts.filter((m): m is NonNullable<typeof m> => m != null);
  let combinedMesh: { vertices: Float32Array; indices: Uint16Array } | undefined;
  if (validParts.length > 0) {
    let totalVerts = 0;
    let totalIdx = 0;
    for (const p of validParts) { totalVerts += p.vertices.length; totalIdx += p.indices.length; }
    const vertices = new Float32Array(totalVerts);
    const indices = new Uint16Array(totalIdx);
    let vOff = 0;
    let iOff = 0;
    let vertexOffset = 0;
    for (const p of validParts) {
      vertices.set(p.vertices, vOff);
      for (let i = 0; i < p.indices.length; i++) {
        indices[iOff + i] = p.indices[i] + vertexOffset;
      }
      vOff += p.vertices.length;
      iOff += p.indices.length;
      vertexOffset += p.vertices.length / 3;
    }
    combinedMesh = { vertices, indices };
  }

  return {
    id: "engineering",
    zMin: zStart - 8,
    zMax: zEnd,
    segments,
    color: NUM.signalRed,
    hardpoints: [],
    mesh: combinedMesh,
    engineBells,
  };
}

function generateHabitat(rng: () => number, commandZEnd: number): ShipSection {
  const segments: WireframeSegment[] = [];
  const allDrumRingSets: Vec3[][][] = [];

  // Habitat drums wrapping the asteroid
  const drumCount = 1 + Math.floor(rng() * 3); // 1-3
  for (let d = 0; d < drumCount; d++) {
    const drumSides = 14 + Math.floor(rng() * 12); // 14-25
    const drumRadius = 16 + rng() * 12; // 16-28
    const drumZStart = -14 + d * (4 + rng() * 6) + (rng() - 0.5) * 4;
    const drumLength = 6 + rng() * 12; // 6-18
    const drumRingSpacing = 1.5 + rng() * 1.5;
    const drumRingCount = Math.max(3, Math.floor(drumLength / drumRingSpacing));
    const offsetX = (rng() - 0.5) * 4;
    const offsetY = (rng() - 0.5) * 4;

    // Drum shape variation: 0=cylinder, 1=barrel (wider middle), 2=tapered
    const drumShape = Math.floor(rng() * 3);
    const barrelBulge = drumShape === 1 ? 1.1 + rng() * 0.3 : 1;
    const taperEnd = drumShape === 2 ? 0.7 + rng() * 0.2 : 1;

    const drumRings: Vec3[][] = [];
    for (let i = 0; i < drumRingCount; i++) {
      const dt = i / (drumRingCount - 1);
      const z = drumZStart + dt * drumLength;
      let rMult = 1.0;
      if (drumShape === 1) {
        // Barrel shape — wider in middle
        rMult = lerp(1, barrelBulge, 1 - Math.abs(dt - 0.5) * 2);
      } else if (drumShape === 2) {
        // Tapered — narrower at one end
        rMult = lerp(1, taperEnd, dt);
      }
      const ring = makeRing(z, drumSides, () => drumRadius * rMult, rng, 0.3 + rng() * 0.5);
      for (const v of ring) { v.x += offsetX; v.y += offsetY; }
      drumRings.push(ring);
      segments.push(...ringEdges(ring));
      if (i > 0) {
        segments.push(...connectRings(drumRings[i - 1], ring));
      }
    }

    allDrumRingSets.push(drumRings);

    // Connecting struts from asteroid surface to drum inner wall
    const strutCount = 6 + Math.floor(rng() * 8); // 6-13
    const strutZ = drumZStart + drumLength / 2;
    for (let s = 0; s < strutCount; s++) {
      const angle = (s / strutCount) * Math.PI * 2 + rng() * 0.3;
      const innerR = 8 + rng() * 5;
      const inner = vec3(
        Math.cos(angle) * innerR + offsetX,
        Math.sin(angle) * innerR + offsetY,
        strutZ + (rng() - 0.5) * drumLength * 0.7,
      );
      const outer = vec3(
        Math.cos(angle) * drumRadius + offsetX,
        Math.sin(angle) * drumRadius + offsetY,
        strutZ + (rng() - 0.5) * drumLength * 0.5,
      );
      segments.push(seg(inner, outer));
    }

    // Drum-specific architectural elements
    segments.push(...generateDockingArms(rng, drumRadius, drumZStart, drumLength, offsetX, offsetY));
    segments.push(...generateSolarArrays(rng, drumRadius, drumZStart, drumLength, offsetX, offsetY));
    segments.push(...generateObservationBays(rng, drumRadius, drumZStart, drumLength, offsetX, offsetY));
    segments.push(...generateCargoPods(rng, drumRings, (_a) => drumRadius, drumZStart, drumZStart + drumLength));
    segments.push(...generateHullPatches(rng, drumRings));
  }

  // Spine corridor — clipped to not extend past command section tip
  const spineSides = 6 + Math.floor(rng() * 6);
  const spineRadius = 2.5 + rng() * 3;
  const spineZMin = -45;
  const spineZMax = Math.min(commandZEnd - 8, 35); // stop well before command tip
  const spineRingCount = 15 + Math.floor(rng() * 10);
  const spineRings: Vec3[][] = [];
  for (let i = 0; i < spineRingCount; i++) {
    const t = i / (spineRingCount - 1);
    const z = lerp(spineZMin, spineZMax, t);
    // Taper the spine radius at the ends
    const endTaper = Math.min(1, Math.min((t) * 5, (1 - t) * 5));
    const ring = makeRing(z, spineSides, () => spineRadius * endTaper, rng, 0.15 + rng() * 0.2);
    spineRings.push(ring);
    segments.push(...ringEdges(ring));
    if (i > 0) {
      segments.push(...connectRings(spineRings[i - 1], ring));
    }
  }

  // Combine drum ring meshes
  const meshParts = allDrumRingSets.map(meshFromRings).filter((m): m is NonNullable<typeof m> => m != null);
  let combinedMesh: { vertices: Float32Array; indices: Uint16Array } | undefined;
  if (meshParts.length > 0) {
    let totalVerts = 0;
    let totalIdx = 0;
    for (const p of meshParts) { totalVerts += p.vertices.length; totalIdx += p.indices.length; }
    const vertices = new Float32Array(totalVerts);
    const indices = new Uint16Array(totalIdx);
    let vOff = 0;
    let iOff = 0;
    let vertexOffset = 0;
    for (const p of meshParts) {
      vertices.set(p.vertices, vOff);
      for (let i = 0; i < p.indices.length; i++) {
        indices[iOff + i] = p.indices[i] + vertexOffset;
      }
      vOff += p.vertices.length;
      iOff += p.indices.length;
      vertexOffset += p.vertices.length / 3;
    }
    combinedMesh = { vertices, indices };
  }

  return {
    id: "habitat",
    zMin: -15,
    zMax: 15,
    segments,
    color: NUM.teal,
    hardpoints: [],
    mesh: combinedMesh,
  };
}

interface CommandResult {
  section: ShipSection;
  zEnd: number;
}

function generateCommand(
  rng: () => number,
  asteroidBounds?: AsteroidBounds,
): CommandResult {
  const segments: WireframeSegment[] = [];
  const zStart = 15;
  const zEnd = 40 + rng() * 20; // 40-60
  const ringCount = 8 + Math.floor(rng() * 8); // 8-15
  const sides = 6 + Math.floor(rng() * 8); // 6-13

  // Cross-section shape: 0=round, 1=flattened, 2=angular
  const cmdShape = Math.floor(rng() * 3);
  const flattenY = cmdShape === 1 ? 0.5 + rng() * 0.3 : 1;
  const angularR = cmdShape === 2 ? 0.8 + rng() * 0.15 : 1;

  // Randomized taper — widen base if asteroid is here
  const baseR = Math.max(8 + rng() * 5, asteroidBounds ? asteroidBounds.radius + 2 : 0);
  const tipR = 0.5 + rng() * 2;
  const shoulderWidth = 0.08 + rng() * 0.15;
  const taperPower = 0.6 + rng() * 1.0;
  // Some ships have a stepped taper (sudden diameter change)
  const hasStep = rng() > 0.6;
  const stepT = 0.3 + rng() * 0.3;
  const stepScale = 0.6 + rng() * 0.2;

  function envelopeRadius(t: number): number {
    let r: number;
    if (t < shoulderWidth) r = lerp(baseR, baseR * 0.9, smoothstep(t / shoulderWidth));
    else {
      const tt = (t - shoulderWidth) / (1 - shoulderWidth);
      r = lerp(baseR * 0.9, tipR, Math.pow(tt, taperPower));
    }
    if (hasStep && t > stepT) r *= stepScale;
    // When asteroid is in command sector, hull must clear the rock
    if (asteroidBounds) {
      const z = lerp(zStart, zEnd, t);
      if (z >= asteroidBounds.zMin && z <= asteroidBounds.zMax) {
        r = Math.max(r, asteroidBounds.radius + 2);
      }
    }
    return r;
  }

  const twistRate = (rng() - 0.5) * 0.1;

  const rings: Vec3[][] = [];
  for (let i = 0; i < ringCount; i++) {
    const t = i / (ringCount - 1);
    const z = lerp(zStart, zEnd, t);
    const r = envelopeRadius(t);
    const ring = makeRing(z, sides, (a) => {
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      let rr = r * Math.sqrt(cx * cx + cy * cy * flattenY * flattenY);
      if (cmdShape === 2) {
        // Angular: add faceted look by modulating radius with side count
        rr *= angularR + (1 - angularR) * Math.abs(Math.cos(a * sides * 0.5));
      }
      return rr;
    }, rng, r * (0.04 + rng() * 0.08), twistRate * i);
    rings.push(ring);
    segments.push(...ringEdges(ring));
    if (i > 0) {
      segments.push(...connectRings(rings[i - 1], ring));
    }
  }

  // Sensor antennae
  const antennaCount = 2 + Math.floor(rng() * 6);
  for (let a = 0; a < antennaCount; a++) {
    const ringIdx = 1 + Math.floor(rng() * Math.max(1, ringCount - 3));
    const vertIdx = Math.floor(rng() * sides);
    const baseVert = rings[ringIdx][vertIdx];
    const angle = Math.atan2(baseVert.y, baseVert.x);
    const length = 3 + rng() * 10;

    const tipX = baseVert.x + Math.cos(angle) * length;
    const tipY = baseVert.y + Math.sin(angle) * length;
    const tipZ = baseVert.z + (rng() - 0.5) * 5;

    segments.push(seg(baseVert, vec3(tipX, tipY, tipZ)));

    // Antenna tip detail
    const tipType = Math.floor(rng() * 3); // 0=disc, 1=fork, 2=none
    if (tipType === 0) {
      const discR = 0.6 + rng() * 1.8;
      const discSides = 5 + Math.floor(rng() * 4);
      const discVerts: Vec3[] = [];
      for (let d = 0; d < discSides; d++) {
        const da = (d / discSides) * Math.PI * 2;
        discVerts.push(vec3(tipX + Math.cos(da) * discR, tipY + Math.sin(da) * discR, tipZ));
      }
      segments.push(...ringEdges(discVerts));
    } else if (tipType === 1) {
      const forkLen = 1 + rng() * 3;
      const tip = vec3(tipX, tipY, tipZ);
      segments.push(
        seg(tip, vec3(tipX + forkLen, tipY, tipZ + forkLen * 0.3)),
        seg(tip, vec3(tipX - forkLen, tipY, tipZ + forkLen * 0.3)),
      );
    }
  }

  // Bridge module — always when asteroid is forward, 60% otherwise
  const hasBridge = asteroidBounds != null || rng() > 0.4;
  if (hasBridge) {
    const bridgeStyle = Math.floor(rng() * 5);
    const bridgeScale = asteroidBounds ? 1.3 : 1.0;
    segments.push(...generateBridgeModule(rng, bridgeStyle, envelopeRadius, zStart, zEnd, bridgeScale));
  }

  // Architectural elements — Phase 4 & 5
  segments.push(...generateAntennaArrays(rng, envelopeRadius, zStart, zEnd));
  segments.push(...generateSensorDishes(rng, envelopeRadius, zStart, zEnd));
  segments.push(...generateCommBooms(rng, envelopeRadius, zStart, zEnd));
  segments.push(...generateHullPatches(rng, rings));

  return {
    section: {
      id: "command",
      zMin: zStart,
      zMax: zEnd + 2,
      segments,
      color: NUM.chartreuse,
      hardpoints: [],
      mesh: meshFromRings(rings) ?? undefined,
    },
    zEnd,
  };
}

// ── Hardpoint Placement ─────────────────────────────────────────────

function placeHardpoints(
  section: ShipSection,
  sectionId: SectionId,
  rng: () => number,
  asteroidBounds?: AsteroidBounds & { zCenter: number },
): void {
  if (section.segments.length === 0) return;

  // Gather unique vertices, find ones near the Z midpoint
  const zMid = (section.zMin + section.zMax) / 2;
  const vertMap = new Map<string, Vec3>();
  for (const s of section.segments) {
    const ka = `${s.a.x.toFixed(2)}_${s.a.y.toFixed(2)}_${s.a.z.toFixed(2)}`;
    const kb = `${s.b.x.toFixed(2)}_${s.b.y.toFixed(2)}_${s.b.z.toFixed(2)}`;
    vertMap.set(ka, s.a);
    vertMap.set(kb, s.b);
  }

  let verts = Array.from(vertMap.values());

  // Filter out vertices inside the asteroid volume
  if (asteroidBounds) {
    const aZC = asteroidBounds.zCenter;
    const aR = asteroidBounds.radius * 1.3; // margin to keep hardpoints clear
    verts = verts.filter((v) => {
      const dx = v.x;
      const dy = v.y;
      const dz = v.z - aZC;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) > aR;
    });
  }

  // Sort by distance to zMid
  verts.sort((a, b) => Math.abs(a.z - zMid) - Math.abs(b.z - zMid));

  // Take the closest ~20% and pick 3 well-spaced ones
  const candidates = verts.slice(0, Math.max(12, Math.floor(verts.length * 0.2)));
  const hardpoints: Hardpoint[] = [];

  // Pick 3 evenly spaced around the circumference
  for (let i = 0; i < 3 && candidates.length > 0; i++) {
    const targetAngle = (i / 3) * Math.PI * 2;
    let bestIdx = 0;
    let bestScore = Infinity;

    for (let j = 0; j < candidates.length; j++) {
      const v = candidates[j];
      const angle = Math.atan2(v.y, v.x);
      let angleDiff = Math.abs(angle - targetAngle);
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
      const zDist = Math.abs(v.z - zMid) * 0.1;
      const score = angleDiff + zDist;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = j;
      }
    }

    const v = candidates[bestIdx];
    const len = Math.sqrt(v.x * v.x + v.y * v.y) || 1;
    const normal = vec3(v.x / len, v.y / len, 0);
    const position = vec3(
      v.x + normal.x * 0.5,
      v.y + normal.y * 0.5,
      v.z,
    );

    hardpoints.push({
      id: `${sectionId}-hp-${i}`,
      section: sectionId,
      position,
      normal,
      slotIndex: i,
    });

    // Remove nearby candidates to ensure spacing
    candidates.splice(bestIdx, 1);
  }

  section.hardpoints = hardpoints;
}

// ── Main Generator ──────────────────────────────────────────────────

const PLACEMENTS: AsteroidPlacement[] = ["engineering", "center", "command"];

export function generateShip(params: ShipParams): ShipGeometry {
  // Master rng derives independent seeds for each section
  const master = mulberry32(params.seed);
  const asteroidSeed = Math.floor(master() * 2147483647);
  const engineeringSeed = Math.floor(master() * 2147483647);
  const habitatSeed = Math.floor(master() * 2147483647);
  const commandSeed = Math.floor(master() * 2147483647);
  const hardpointSeed = Math.floor(master() * 2147483647);

  // Determine asteroid placement
  const asteroidPlacement: AsteroidPlacement =
    params.asteroidPlacement ?? PLACEMENTS[Math.floor(master() * 3)];

  // Z-offset for asteroid based on placement
  const asteroidZOffset =
    asteroidPlacement === "engineering" ? -30 :
    asteroidPlacement === "command" ? 30 : 0;

  const asteroidResult = generateAsteroid(mulberry32(asteroidSeed), asteroidSeed, asteroidZOffset);
  const asteroid = asteroidResult.section;
  const aRadius = asteroidResult.radius;

  // Build asteroid bounds for co-located section
  const aBounds: AsteroidBounds = {
    zMin: asteroid.zMin,
    zMax: asteroid.zMax,
    radius: aRadius,
  };

  const engineering = generateEngineering(
    mulberry32(engineeringSeed),
    asteroidPlacement === "engineering" ? aBounds : undefined,
    params.engineCount,
  );
  const commandResult = generateCommand(
    mulberry32(commandSeed),
    asteroidPlacement === "command" ? aBounds : undefined,
  );
  const command = commandResult.section;
  const habitat = generateHabitat(mulberry32(habitatSeed), commandResult.zEnd);

  // Place hardpoints (skip asteroid — it's the core, not a sector)
  // Pass asteroid bounds so hardpoints avoid spawning inside the rock
  const hpRng = mulberry32(hardpointSeed);
  const hpAsteroidBounds = { ...aBounds, zCenter: asteroidZOffset };
  placeHardpoints(engineering, "engineering", hpRng, hpAsteroidBounds);
  placeHardpoints(habitat, "habitat", hpRng, hpAsteroidBounds);
  placeHardpoints(command, "command", hpRng, hpAsteroidBounds);

  const sections = [asteroid, engineering, habitat, command];

  // Compute bounding radius
  let maxR = 0;
  for (const sec of sections) {
    for (const s of sec.segments) {
      for (const v of [s.a, s.b]) {
        const r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (r > maxR) maxR = r;
      }
    }
  }

  return {
    seed: params.seed,
    sections,
    totalLength: 106,
    boundingRadius: maxR,
    asteroidPlacement,
  };
}
