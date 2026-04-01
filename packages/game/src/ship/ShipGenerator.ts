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

// ── Section Generators ──────────────────────────────────────────────

function generateAsteroid(
  rng: () => number,
  noiseSeed: number,
): ShipSection {
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

    return vec3(v.x * r, v.y * r, v.z * r);
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
    id: "asteroid",
    zMin: -15,
    zMax: 15,
    segments,
    color: NUM.concrete,
    hardpoints: [],
    mesh: { vertices, indices },
  };
}

function generateEngineering(rng: () => number): ShipSection {
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

  // Engine bells at the tail — varied layouts
  const engineLayout = Math.floor(rng() * 3); // 0=radial, 1=clustered, 2=asymmetric
  const engineCount = engineLayout === 1 ? 1 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 5);
  const engineSpread = engineLayout === 1 ? 1 + rng() * 2 : 2 + rng() * 3;
  for (let e = 0; e < engineCount; e++) {
    let angle: number, dist: number;
    if (engineLayout === 2) {
      // Asymmetric — engines clustered on one side
      angle = rng() * Math.PI * 0.8 + rng() * 0.3;
      dist = engineSpread + rng() * 3;
    } else {
      angle = (e / engineCount) * Math.PI * 2 + rng() * 0.5;
      dist = engineSpread + rng() * 2;
    }
    const cx = Math.cos(angle) * dist;
    const cy = Math.sin(angle) * dist;
    const bellRadius = 1 + rng() * 2.5;
    const bellLength = 2 + rng() * 5;
    const bellSides = 5 + Math.floor(rng() * 4);
    const bellRingCount = 2 + Math.floor(rng() * 2); // 2-3 rings for more detail

    const bellRings: Vec3[][] = [];
    for (let br = 0; br < bellRingCount; br++) {
      const bt = br / (bellRingCount - 1);
      const bz = zStart - bt * bellLength;
      const bRadius = bellRadius * (0.4 + bt * 0.6);
      const ring = makeRing(bz, bellSides, () => bRadius, rng, 0.1);
      for (const v of ring) { v.x += cx; v.y += cy; }
      bellRings.push(ring);
      segments.push(...ringEdges(ring));
      if (br > 0) segments.push(...connectRings(bellRings[br - 1], ring));
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

  return {
    id: "engineering",
    zMin: zStart - 8,
    zMax: zEnd,
    segments,
    color: NUM.signalRed,
    hardpoints: [],
    mesh: meshFromRings(rings) ?? undefined,
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

function generateCommand(rng: () => number): CommandResult {
  const segments: WireframeSegment[] = [];
  const zStart = 15;
  const zEnd = 40 + rng() * 20; // 40-60
  const ringCount = 8 + Math.floor(rng() * 8); // 8-15
  const sides = 6 + Math.floor(rng() * 8); // 6-13

  // Cross-section shape: 0=round, 1=flattened, 2=angular
  const cmdShape = Math.floor(rng() * 3);
  const flattenY = cmdShape === 1 ? 0.5 + rng() * 0.3 : 1;
  const angularR = cmdShape === 2 ? 0.8 + rng() * 0.15 : 1;

  // Randomized taper
  const baseR = 8 + rng() * 5;
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

  // Bridge blister
  const bridgeZ = zEnd - 3 - rng() * 4;
  const bridgeOffX = (rng() - 0.5) * 4;
  const bridgeOffY = 1.5 + rng() * 3;
  const bridgeR = 1.5 + rng() * 2.5;
  const bSides = 6 + Math.floor(rng() * 4);
  for (let layer = 0; layer < 2; layer++) {
    const elev = (layer + 1) / 2;
    const r = bridgeR * Math.cos(elev * Math.PI * 0.4);
    const yOff = bridgeOffY + bridgeR * Math.sin(elev * Math.PI * 0.4);
    const ring = makeRing(bridgeZ, bSides, () => r, rng, 0.1);
    for (const v of ring) { v.x += bridgeOffX; v.y += yOff - bridgeOffY; }
    segments.push(...ringEdges(ring));
    if (layer === 0) {
      const baseRing = makeRing(bridgeZ, bSides, () => bridgeR, rng, 0.05);
      for (const v of baseRing) { v.x += bridgeOffX; }
      segments.push(...ringEdges(baseRing));
      segments.push(...connectRings(baseRing, ring));
    }
  }

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

  const verts = Array.from(vertMap.values());
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

export function generateShip(params: ShipParams): ShipGeometry {
  // Master rng derives independent seeds for each section
  const master = mulberry32(params.seed);
  const asteroidSeed = Math.floor(master() * 2147483647);
  const engineeringSeed = Math.floor(master() * 2147483647);
  const habitatSeed = Math.floor(master() * 2147483647);
  const commandSeed = Math.floor(master() * 2147483647);
  const hardpointSeed = Math.floor(master() * 2147483647);

  const asteroid = generateAsteroid(mulberry32(asteroidSeed), asteroidSeed);
  const engineering = generateEngineering(mulberry32(engineeringSeed));
  const commandResult = generateCommand(mulberry32(commandSeed));
  const command = commandResult.section;
  const habitat = generateHabitat(mulberry32(habitatSeed), commandResult.zEnd);

  // Place hardpoints (skip asteroid — it's the core, not a sector)
  const hpRng = mulberry32(hardpointSeed);
  placeHardpoints(engineering, "engineering", hpRng);
  placeHardpoints(habitat, "habitat", hpRng);
  placeHardpoints(command, "command", hpRng);

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
    totalLength: 106, // -53 to +53
    boundingRadius: maxR,
  };
}
