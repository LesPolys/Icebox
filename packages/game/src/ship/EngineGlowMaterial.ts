import * as THREE from "three";

const RING_COUNT = 6;
const SIDES = 10;

interface V3 { x: number; y: number; z: number }

export interface ExhaustPlume {
  group: THREE.Group;
  rings: {
    line: THREE.LineLoop;
    mat: THREE.LineBasicMaterial;
  }[];
  coneLines: THREE.LineSegments;
  coneMat: THREE.LineBasicMaterial;
  bellRadius: number;
  bellLength: number;
  bellCenter: V3;
  /** Unit vector: direction exhaust travels */
  thrustDir: V3;
  /** Perpendicular basis vectors for ring plane */
  basisU: V3;
  basisV: V3;
}

/** Build an orthonormal basis from a direction vector */
function buildBasis(dir: V3): { u: V3; v: V3 } {
  // Pick a vector not parallel to dir
  const up = Math.abs(dir.z) < 0.9
    ? { x: 0, y: 0, z: 1 }
    : { x: 1, y: 0, z: 0 };
  // u = normalize(cross(dir, up))
  let ux = dir.y * up.z - dir.z * up.y;
  let uy = dir.z * up.x - dir.x * up.z;
  let uz = dir.x * up.y - dir.y * up.x;
  const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
  ux /= uLen; uy /= uLen; uz /= uLen;
  // v = cross(dir, u)
  const vx = dir.y * uz - dir.z * uy;
  const vy = dir.z * ux - dir.x * uz;
  const vz = dir.x * uy - dir.y * ux;
  return { u: { x: ux, y: uy, z: uz }, v: { x: vx, y: vy, z: vz } };
}

export function createExhaustPlume(
  bellCenter: V3,
  bellRadius: number,
  bellLength: number,
  thrustDir: V3,
  color: THREE.Color,
): ExhaustPlume {
  const group = new THREE.Group();
  const rings: ExhaustPlume["rings"] = [];
  const { u, v } = buildBasis(thrustDir);

  for (let r = 0; r < RING_COUNT; r++) {
    const positions = new Float32Array(SIDES * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
      color: color.clone(),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const line = new THREE.LineLoop(geo, mat);
    // Position relative to bell center — vertices are in local coords
    line.position.set(bellCenter.x, bellCenter.y, bellCenter.z);
    group.add(line);
    rings.push({ line, mat });
  }

  // Cone core lines
  const conePositions = new Float32Array(SIDES * 6);
  const coneGeo = new THREE.BufferGeometry();
  coneGeo.setAttribute("position", new THREE.BufferAttribute(conePositions, 3));

  const coneMat = new THREE.LineBasicMaterial({
    color: color.clone(),
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const coneLines = new THREE.LineSegments(coneGeo, coneMat);
  coneLines.position.set(bellCenter.x, bellCenter.y, bellCenter.z);
  group.add(coneLines);

  return { group, rings, coneLines, coneMat, bellRadius, bellLength, bellCenter, thrustDir, basisU: u, basisV: v };
}

/**
 * Animate exhaust plume each frame.
 *
 * Rings originate small midway up the bell and expand along thrustDir.
 * All positions are LOCAL to bellCenter.
 */
export function updateExhaustPlume(
  plume: ExhaustPlume,
  time: number,
  power: number,
): void {
  const { rings, bellRadius, bellLength, thrustDir: d, basisU: u, basisV: v, coneLines, coneMat } = plume;

  // bellCenter is the narrow top (hull attachment). Bell mouth is at bellLength along thrustDir.
  // Effect starts midway down the bell, expands through the mouth, and dissipates past it.
  const startTravel = bellLength * 0.5; // midway down the bell
  const endTravel = bellLength * 2.5;   // well past the mouth
  const totalTravel = endTravel - startTravel;
  const originRadius = bellRadius * 0.2; // small at start
  const mouthRadius = bellRadius * 1.0;  // matches bell at mouth
  const endRadius = bellRadius * 1.6;    // expands past mouth
  // Where along 0-1 phase the bell mouth sits
  const mouthPhase = (bellLength - startTravel) / totalTravel;
  const cycleSpeed = 0.7;

  // --- Rings ---
  for (let r = 0; r < rings.length; r++) {
    const { line, mat } = rings[r];

    if (power < 0.01) { line.visible = false; continue; }
    line.visible = true;

    const phase = ((time * cycleSpeed + r / rings.length) % 1);

    // Travel along thrust direction (always positive, from start to end)
    const travel = startTravel + phase * totalTravel;

    // Radius: grow from small to bell-sized at mouth, then expand further
    let rad: number;
    if (phase < mouthPhase) {
      const t = phase / mouthPhase;
      rad = originRadius + (mouthRadius - originRadius) * t;
    } else {
      const t = (phase - mouthPhase) / (1 - mouthPhase);
      rad = mouthRadius + (endRadius - mouthRadius) * t;
    }

    const rippleAmp = 0.1 * power * Math.sin(time * 4.5 + r * 1.7);
    const posAttr = line.geometry.getAttribute("position") as THREE.BufferAttribute;

    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2;
      const wobble = 1 + rippleAmp * Math.sin(a * 3 + time * 3 + r);
      const finalR = rad * wobble;
      const cosA = Math.cos(a) * finalR;
      const sinA = Math.sin(a) * finalR;
      // Position = travel along thrustDir + ring in perpendicular plane
      posAttr.setXYZ(i,
        d.x * travel + u.x * cosA + v.x * sinA,
        d.y * travel + u.y * cosA + v.y * sinA,
        d.z * travel + u.z * cosA + v.z * sinA,
      );
    }
    posAttr.needsUpdate = true;

    const fadeOut = 1 - phase * 0.6;
    const pulse = 0.9 + 0.1 * Math.sin(time * 5 + r * 2);
    mat.opacity = fadeOut * power * 0.9 * pulse;
  }

  // --- Cone core lines ---
  if (power < 0.01) { coneLines.visible = false; return; }
  coneLines.visible = true;

  const posAttr = coneLines.geometry.getAttribute("position") as THREE.BufferAttribute;
  const coreNarrowR = bellRadius * (0.08 + 0.06 * Math.sin(time * 6));
  const coreWideR = bellRadius * (0.9 + 0.15 * Math.sin(time * 3.5));
  const narrowTravel = startTravel; // midway down the bell
  const wideTravel = bellLength * 1.3; // just past the mouth

  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * Math.PI * 2;
    const flutter = 1 + 0.12 * Math.sin(time * 8 + i * 2.3);

    // Narrow end
    const nr = coreNarrowR * flutter * power;
    const nCos = Math.cos(a) * nr;
    const nSin = Math.sin(a) * nr;
    posAttr.setXYZ(i * 2,
      d.x * narrowTravel + u.x * nCos + v.x * nSin,
      d.y * narrowTravel + u.y * nCos + v.y * nSin,
      d.z * narrowTravel + u.z * nCos + v.z * nSin,
    );

    // Wide end
    const wr = coreWideR * flutter;
    const wCos = Math.cos(a) * wr;
    const wSin = Math.sin(a) * wr;
    posAttr.setXYZ(i * 2 + 1,
      d.x * wideTravel + u.x * wCos + v.x * wSin,
      d.y * wideTravel + u.y * wCos + v.y * wSin,
      d.z * wideTravel + u.z * wCos + v.z * wSin,
    );
  }
  posAttr.needsUpdate = true;

  const corePulse = 0.8 + 0.2 * Math.sin(time * 7);
  coneMat.opacity = power * 0.55 * corePulse;
}
