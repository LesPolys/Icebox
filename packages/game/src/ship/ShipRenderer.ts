import * as THREE from "three";
import { NUM } from "@icebox/shared";
import type { ShipGeometry } from "./ShipTypes";
import type { SectionId, Hardpoint } from "./ShipTypes";
import { createExhaustPlume, updateExhaustPlume } from "./EngineGlowMaterial";
import type { ExhaustPlume } from "./EngineGlowMaterial";

export interface ShipOrientation {
  /** Base pitch set by debug slider (rotation around X axis in radians) */
  rotX: number;
  /** Base yaw set by debug slider (rotation around Y axis in radians) */
  rotY: number;
  /** Drag roll — applied around the ship's LOCAL Z axis after pitch/yaw */
  rotZ: number;
}

/** Per-section rendering metadata */
export interface SectionMeta {
  id: SectionId;
  group: THREE.Group;
  primaryMat: THREE.LineBasicMaterial;
  glowMat: THREE.LineBasicMaterial;
  baseColor: THREE.Color;
  hoverColor: THREE.Color;
  lineSegments: THREE.LineSegments;
  /** Semi-solid hover hull (built from convex hull of wireframe verts) */
  hoverMesh: THREE.Mesh | null;
  hoverMeshMat: THREE.MeshBasicMaterial | null;
}

/** Per-hardpoint rendering metadata */
export interface HardpointMeta {
  data: Hardpoint;
  marker: THREE.Mesh;
  hitTarget: THREE.Mesh;
  sectionId: SectionId;
}

// ── Starfield ──────────────────────────────────────────────

const STAR_COUNT = 180;
const STAR_FIELD_RADIUS = 200;     // sphere radius for star placement
const STAR_RECYCLE_Z = STAR_FIELD_RADIUS; // drifted past = recycle

/** 0=cross, 1=dot, 2=6-pointed, 3=diamond, 4=dash */
type StarShape = 0 | 1 | 2 | 3 | 4;

interface Star {
  /** Index into the positions buffer (stride = points-per-star * 3) */
  baseIdx: number;
  /** World-space position */
  x: number; y: number; z: number;
  /** Size multiplier */
  size: number;
  /** Current opacity 0-1 */
  opacity: number;
  /** Target opacity for fading */
  targetOpacity: number;
  /** Lifecycle state */
  state: "visible" | "winking" | "fading_in" | "exploding";
  /** Timer for lifecycle events */
  timer: number;
  /** Spin speed for idle twinkle (radians/s) */
  spin: number;
  /** Visual shape variant */
  shape: StarShape;
}

/** All shapes produce exactly SEGMENTS_PER_STAR line segments = POINTS_PER_STAR endpoints. */
const SEGMENTS_PER_STAR = 8;
const POINTS_PER_STAR = SEGMENTS_PER_STAR * 2; // 16 points
const VERTS_PER_STAR = POINTS_PER_STAR * 3;    // 48 floats

function randomStarShape(): StarShape {
  const r = Math.random();
  if (r < 0.30) return 0; // cross — classic sparkle
  if (r < 0.50) return 1; // dot — tiny compact cluster
  if (r < 0.70) return 2; // 6-pointed — larger prominent stars
  if (r < 0.88) return 3; // diamond — simple clean shape
  return 4;               // dash — subtle streak
}

/** Generate star shape verts — exactly 8 line segments (16 endpoint vec2s → 48 floats with z=0).
 *  All geometry centred at origin, caller offsets to world position. */
function starShapeVerts(shape: StarShape, size: number, angle: number): number[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const rx = (px: number, py: number) => px * c - py * s;
  const ry = (px: number, py: number) => px * s + py * c;
  const push2 = (out: number[], ax: number, ay: number, bx: number, by: number) => {
    out.push(rx(ax, ay), ry(ax, ay), 0, rx(bx, by), ry(bx, by), 0);
  };
  const out: number[] = [];

  switch (shape) {
    case 0: {
      // Cross / sparkle — 4-point with elongated horizontal arms
      const armV = size;
      const armH = size * 1.6;
      const tV = size * 0.14;
      const tH = armH * 0.09;
      // Vertical diamond (4 edges)
      const vP = [[0, -armV], [tV, 0], [0, armV], [-tV, 0]];
      for (let i = 0; i < 4; i++) {
        const a = vP[i], b = vP[(i + 1) % 4];
        push2(out, a[0], a[1], b[0], b[1]);
      }
      // Horizontal diamond (4 edges)
      const hP = [[-armH, 0], [0, tH], [armH, 0], [0, -tH]];
      for (let i = 0; i < 4; i++) {
        const a = hP[i], b = hP[(i + 1) % 4];
        push2(out, a[0], a[1], b[0], b[1]);
      }
      break;
    }
    case 1: {
      // Dot — small octagon with inner cross, looks like a compact point of light
      const r = size * 0.5;
      // Outer octagon (8 edges = 8 segments, perfect fit)
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2;
        const a1 = ((i + 1) / 8) * Math.PI * 2;
        push2(out, Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r);
      }
      break;
    }
    case 2: {
      // 6-pointed star — 6 spokes radiating from center + inner ring connecting midpoints
      const outer = size * 1.2;
      const inner = size * 0.35;
      // 6 spokes (6 segments)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        push2(out, 0, 0, Math.cos(a) * outer, Math.sin(a) * outer);
      }
      // Inner hexagon ring (use 2 segments connecting alternating midpoints for the remaining 2)
      const m0 = (0 / 6) * Math.PI * 2;
      const m2 = (2 / 6) * Math.PI * 2;
      const m4 = (4 / 6) * Math.PI * 2;
      push2(out, Math.cos(m0) * inner, Math.sin(m0) * inner, Math.cos(m2) * inner, Math.sin(m2) * inner);
      push2(out, Math.cos(m2) * inner, Math.sin(m2) * inner, Math.cos(m4) * inner, Math.sin(m4) * inner);
      break;
    }
    case 3: {
      // Diamond — simple 4-sided rhombus with slight asymmetry, plus faint inner cross
      const h = size * 1.1;
      const w = size * 0.6;
      // Outer diamond (4 edges)
      const dP = [[0, -h], [w, 0], [0, h], [-w, 0]];
      for (let i = 0; i < 4; i++) {
        const a = dP[i], b = dP[(i + 1) % 4];
        push2(out, a[0], a[1], b[0], b[1]);
      }
      // Inner cross lines (4 segments — short stubs)
      const stub = size * 0.3;
      push2(out, 0, -stub, 0, stub);
      push2(out, -stub, 0, stub, 0);
      push2(out, -stub * 0.5, -stub * 0.5, stub * 0.5, stub * 0.5);
      push2(out, -stub * 0.5, stub * 0.5, stub * 0.5, -stub * 0.5);
      break;
    }
    case 4: {
      // Dash — elongated streak with a small perpendicular tick, like a distant star in motion
      const len = size * 2.0;
      const tick = size * 0.3;
      // Main streak (1 segment)
      push2(out, -len, 0, len, 0);
      // Center tick (1 segment)
      push2(out, 0, -tick, 0, tick);
      // Tapered ends — thin chevrons (3 segments each side = 6 segments)
      const notch = size * 0.15;
      push2(out, -len * 0.7, notch, -len, 0);
      push2(out, -len * 0.7, -notch, -len, 0);
      push2(out, len * 0.7, notch, len, 0);
      push2(out, len * 0.7, -notch, len, 0);
      push2(out, -len * 0.4, notch * 0.5, -len * 0.4, -notch * 0.5);
      push2(out, len * 0.4, notch * 0.5, len * 0.4, -notch * 0.5);
      break;
    }
  }
  return out;
}

const SECTION_HOVER_COLORS: Record<SectionId, number> = {
  asteroid: NUM.concrete,
  engineering: NUM.signalRed,
  habitat: NUM.teal,
  command: NUM.chartreuse,
};

const SECTION_BASE_COLORS: Record<SectionId, number> = {
  asteroid: NUM.abyss,
  engineering: NUM.void,
  habitat: NUM.void,
  command: NUM.void,
};

export class ShipRenderer {
  readonly threeScene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  /** Root group containing the entire ship — rotate this to reorient the model */
  readonly shipPivot: THREE.Group;
  readonly orientation: ShipOrientation = { rotX: 0, rotY: 0, rotZ: 0 };

  readonly raycaster = new THREE.Raycaster();
  readonly sections: SectionMeta[] = [];
  readonly hardpoints: HardpointMeta[] = [];

  private sectionGroups: THREE.Group[] = [];
  private clock = new THREE.Clock();

  /** Currently hovered section index (-1 = none) */
  hoveredSection = -1;
  /** Currently hovered hardpoint index (-1 = none) */
  hoveredHardpoint = -1;
  /** When true, hovered sections show a semi-solid convex hull */
  solidHover = false;
  /** Engine exhaust plumes */
  private enginePlumes: ExhaustPlume[] = [];
  /** Engine thrust power — 0 = off, 1 = full burn */
  enginePower = 0.7;

  /** Starfield background */
  private stars: Star[] = [];
  private starGeometry: THREE.BufferGeometry | null = null;
  private starPositions: Float32Array | null = null;
  private starGroup: THREE.Group = new THREE.Group();
  /** Star drift speed — how fast stars scroll past (units/s along -Z) */
  starDriftSpeed = 3.0;

  constructor(container: HTMLElement) {
    // Create overlay canvas
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "auto";
    container.style.position = "relative";
    container.appendChild(this.canvas);

    // Three.js renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);

    // Scene
    this.threeScene = new THREE.Scene();

    // Ship pivot — all geometry goes under this so we can rotate the whole model
    this.shipPivot = new THREE.Group();
    this.threeScene.add(this.shipPivot);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      500,
    );
    this.camera.position.set(0, 30, 0);
    this.camera.lookAt(0, 0, 0);

    // Raycaster threshold for lines
    this.raycaster.params.Line = { threshold: 1.5 };

    // ── Starfield ──
    this.initStarfield();
  }

  private initStarfield(): void {
    const positions = new Float32Array(STAR_COUNT * VERTS_PER_STAR);
    this.starPositions = positions;

    for (let i = 0; i < STAR_COUNT; i++) {
      // Distribute on a sphere surface, then randomise depth
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = STAR_FIELD_RADIUS * (0.5 + Math.random() * 0.5);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      const size = 0.3 + Math.random() * 1.2;
      const angle = Math.random() * Math.PI;

      const star: Star = {
        baseIdx: i * VERTS_PER_STAR,
        x, y, z, size,
        opacity: 0.6 + Math.random() * 0.4,
        targetOpacity: 1.0,
        state: "visible",
        timer: 0,
        spin: (Math.random() - 0.5) * 0.3,
        shape: randomStarShape(),
      };
      this.stars.push(star);
      this.writeStarVerts(star, positions, angle);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.starGeometry = geo;

    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(NUM.void),
      transparent: true,
      opacity: 0.7,
    });
    const lines = new THREE.LineSegments(geo, mat);
    this.starGroup.add(lines);
    // Add starfield to scene root (not shipPivot — stars don't rotate with ship)
    this.threeScene.add(this.starGroup);
  }

  /** Write a single star's shape geometry into the shared positions buffer */
  private writeStarVerts(star: Star, buf: Float32Array, angle: number): void {
    const verts = starShapeVerts(star.shape, star.size * star.opacity, angle);
    for (let j = 0; j < verts.length; j += 3) {
      buf[star.baseIdx + j] = star.x + verts[j];
      buf[star.baseIdx + j + 1] = star.y + verts[j + 1];
      buf[star.baseIdx + j + 2] = star.z + verts[j + 2];
    }
  }

  /** Respawn a star behind the ship's travel direction */
  private respawnStar(star: Star): void {
    // Get the ship's backward direction (opposite of forward travel)
    const back = this._starDriftDir.clone().negate();
    // Random offset perpendicular to drift
    const theta = Math.random() * Math.PI * 2;
    const spread = 20 + Math.random() * (STAR_FIELD_RADIUS * 0.6);
    // Build a rough perpendicular basis
    const up = Math.abs(back.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const perp1 = new THREE.Vector3().crossVectors(back, up).normalize();
    const perp2 = new THREE.Vector3().crossVectors(back, perp1).normalize();
    const spawnDist = STAR_FIELD_RADIUS * (0.7 + Math.random() * 0.3);
    star.x = back.x * spawnDist + perp1.x * Math.cos(theta) * spread + perp2.x * Math.sin(theta) * spread;
    star.y = back.y * spawnDist + perp1.y * Math.cos(theta) * spread + perp2.y * Math.sin(theta) * spread;
    star.z = back.z * spawnDist + perp1.z * Math.cos(theta) * spread + perp2.z * Math.sin(theta) * spread;
    star.size = 0.3 + Math.random() * 1.2;
    star.opacity = 0;
    star.targetOpacity = 0.6 + Math.random() * 0.4;
    star.state = "fading_in";
    star.timer = 0;
    star.spin = (Math.random() - 0.5) * 0.3;
    star.shape = randomStarShape();
  }

  buildGeometry(shipGeometry: ShipGeometry): void {
    // Clear previous
    for (const g of this.sectionGroups) {
      this.shipPivot.remove(g);
      g.traverse((obj) => {
        if (obj instanceof THREE.LineSegments || obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
    this.sectionGroups = [];
    this.sections.length = 0;
    this.hardpoints.length = 0;
    this.enginePlumes.length = 0;

    for (const section of shipGeometry.sections) {
      const group = new THREE.Group();

      // Build position array from segments
      const positions = new Float32Array(section.segments.length * 6);
      for (let i = 0; i < section.segments.length; i++) {
        const s = section.segments[i];
        const off = i * 6;
        positions[off] = s.a.x;
        positions[off + 1] = s.a.y;
        positions[off + 2] = s.a.z;
        positions[off + 3] = s.b.x;
        positions[off + 4] = s.b.y;
        positions[off + 5] = s.b.z;
      }

      const bufGeo = new THREE.BufferGeometry();
      bufGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const baseColor = new THREE.Color(SECTION_BASE_COLORS[section.id]);
      const hoverColor = new THREE.Color(SECTION_HOVER_COLORS[section.id]);

      // Asteroid only: always-visible solid mesh + thin wireframe overlay
      if (section.id === "asteroid" && section.mesh) {
        const meshGeo = new THREE.BufferGeometry();
        meshGeo.setAttribute("position", new THREE.BufferAttribute(section.mesh.vertices, 3));
        meshGeo.setIndex(new THREE.BufferAttribute(section.mesh.indices, 1));
        meshGeo.computeVertexNormals();

        // Solid fill — dark, slightly transparent
        const solidMat = new THREE.MeshBasicMaterial({
          color: baseColor.clone(),
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
        });
        const solidMesh = new THREE.Mesh(meshGeo, solidMat);
        group.add(solidMesh);

        // Subtle edge wireframe on top
        const edgeMat = new THREE.LineBasicMaterial({
          color: baseColor.clone(),
          transparent: true,
          opacity: 0.25,
        });
        const edges = new THREE.EdgesGeometry(meshGeo, 15);
        const edgeLines = new THREE.LineSegments(edges, edgeMat);
        group.add(edgeLines);
      }

      const isAsteroidSolid = section.id === "asteroid" && !!section.mesh;

      // Primary solid lines (wireframe segments from generator)
      const primaryMat = new THREE.LineBasicMaterial({
        color: baseColor.clone(),
        transparent: true,
        opacity: isAsteroidSolid ? 0.4 : 0.85,
      });
      const primary = new THREE.LineSegments(bufGeo, primaryMat);
      group.add(primary);

      // Glow pass — additive blended duplicate (skip for asteroid solid)
      const glowMat = new THREE.LineBasicMaterial({
        color: baseColor.clone(),
        transparent: true,
        opacity: isAsteroidSolid ? 0.1 : 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glow = new THREE.LineSegments(bufGeo, glowMat);
      if (!isAsteroidSolid) group.add(glow);

      this.shipPivot.add(group);
      this.sectionGroups.push(group);

      // Build hover mesh from section's ring-triangulated mesh data (not asteroid — it has its own solid)
      let hoverMesh: THREE.Mesh | null = null;
      let hoverMeshMat: THREE.MeshBasicMaterial | null = null;
      if (section.id !== "asteroid" && section.mesh) {
        const hoverGeo = new THREE.BufferGeometry();
        hoverGeo.setAttribute("position", new THREE.BufferAttribute(section.mesh.vertices.slice(), 3));
        hoverGeo.setIndex(new THREE.BufferAttribute(section.mesh.indices.slice(), 1));
        hoverGeo.computeVertexNormals();

        hoverMeshMat = new THREE.MeshBasicMaterial({
          color: hoverColor.clone(),
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        hoverMesh = new THREE.Mesh(hoverGeo, hoverMeshMat);
        hoverMesh.visible = false;
        group.add(hoverMesh);
      }

      this.sections.push({
        id: section.id,
        group,
        primaryMat,
        glowMat,
        baseColor,
        hoverColor,
        lineSegments: primary,
        hoverMesh,
        hoverMeshMat,
      });

      // Hardpoint markers + hit targets
      for (const hp of section.hardpoints) {
        // Diamond marker — larger and double-layered for visibility
        const markerGeo = new THREE.OctahedronGeometry(1.6, 0);
        const markerMat = new THREE.MeshBasicMaterial({
          color: NUM.indigo,
          wireframe: true,
          transparent: true,
          opacity: 1.0,
        });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.set(hp.position.x, hp.position.y, hp.position.z);
        group.add(marker);

        // Inner glow core — additive blended solid for brightness
        const coreGeo = new THREE.OctahedronGeometry(0.9, 0);
        const coreMat = new THREE.MeshBasicMaterial({
          color: NUM.indigo,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.copy(marker.position);
        group.add(core);

        // Invisible larger sphere for easier raycasting
        const hitGeo = new THREE.SphereGeometry(3, 8, 6);
        const hitMat = new THREE.MeshBasicMaterial({
          visible: false,
        });
        const hitTarget = new THREE.Mesh(hitGeo, hitMat);
        hitTarget.position.copy(marker.position);
        group.add(hitTarget);

        this.hardpoints.push({
          data: hp,
          marker,
          hitTarget,
          sectionId: section.id,
        });
      }

      // Engine exhaust plumes — animated concentric rings, only for engineering
      if (section.engineBells) {
        for (const bell of section.engineBells) {
          const plume = createExhaustPlume(
            bell.center,
            bell.radius,
            bell.length,
            bell.thrustDir,
            new THREE.Color(NUM.lime),
          );
          group.add(plume.group);
          this.enginePlumes.push(plume);
        }
      }
    }
  }

  /** Raycast from normalized device coordinates (-1 to 1) */
  raycast(ndcX: number, ndcY: number): { sectionIdx: number; hardpointIdx: number } {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

    // Check hardpoint hit targets first (they take priority)
    const hitTargets = this.hardpoints.map((hp) => hp.hitTarget);
    const hpHits = this.raycaster.intersectObjects(hitTargets, false);
    let hardpointIdx = -1;
    if (hpHits.length > 0) {
      hardpointIdx = hitTargets.indexOf(hpHits[0].object as THREE.Mesh);
    }

    // Check section line segments
    const lineObjects = this.sections.map((s) => s.lineSegments);
    const sectionHits = this.raycaster.intersectObjects(lineObjects, false);
    let sectionIdx = -1;
    if (sectionHits.length > 0) {
      const hitObj = sectionHits[0].object;
      sectionIdx = lineObjects.indexOf(hitObj as THREE.LineSegments);
    }

    return { sectionIdx, hardpointIdx };
  }

  /** Set section highlight state */
  highlightSection(idx: number): void {
    if (idx === this.hoveredSection) return;

    // Restore previous
    if (this.hoveredSection >= 0 && this.hoveredSection < this.sections.length) {
      const prev = this.sections[this.hoveredSection];
      prev.primaryMat.color.copy(prev.baseColor);
      prev.glowMat.color.copy(prev.baseColor);
      prev.primaryMat.opacity = 0.85;
      prev.glowMat.opacity = 0.3;
      if (prev.hoverMesh) prev.hoverMesh.visible = false;
    }

    this.hoveredSection = idx;

    // Apply new highlight
    if (idx >= 0 && idx < this.sections.length) {
      const sec = this.sections[idx];
      sec.primaryMat.color.copy(sec.hoverColor);
      sec.glowMat.color.copy(sec.hoverColor);
      sec.primaryMat.opacity = 1.0;
      sec.glowMat.opacity = 0.5;
      if (this.solidHover && sec.hoverMesh && sec.hoverMeshMat) {
        sec.hoverMeshMat.color.copy(sec.hoverColor);
        sec.hoverMesh.visible = true;
      }
    }
  }

  /** Set hardpoint highlight state */
  highlightHardpoint(idx: number): void {
    if (idx === this.hoveredHardpoint) return;

    // Restore previous
    if (this.hoveredHardpoint >= 0 && this.hoveredHardpoint < this.hardpoints.length) {
      const prev = this.hardpoints[this.hoveredHardpoint];
      (prev.marker.material as THREE.MeshBasicMaterial).color.setHex(NUM.indigo);
      prev.marker.scale.setScalar(1);
    }

    this.hoveredHardpoint = idx;

    // Apply new highlight
    if (idx >= 0 && idx < this.hardpoints.length) {
      const hp = this.hardpoints[idx];
      (hp.marker.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
      hp.marker.scale.setScalar(1.6);
    }
  }

  /** Project a hardpoint's world position to screen pixel coordinates.
   *  Returns null if the point is behind the camera. */
  projectHardpoint(idx: number, canvasW: number, canvasH: number): { x: number; y: number } | null {
    if (idx < 0 || idx >= this.hardpoints.length) return null;
    const marker = this.hardpoints[idx].marker;
    const worldPos = new THREE.Vector3();
    marker.getWorldPosition(worldPos);

    const ndc = worldPos.clone().project(this.camera);
    if (ndc.z > 1) return null; // behind camera

    return {
      x: (ndc.x * 0.5 + 0.5) * canvasW,
      y: (-ndc.y * 0.5 + 0.5) * canvasH,
    };
  }

  // Reusable quaternions to avoid allocation
  private _qBase = new THREE.Quaternion();
  private _qRoll = new THREE.Quaternion();
  private _localZ = new THREE.Vector3();

  update(): void {
    const dt = this.clock.getDelta();
    const t = this.clock.getElapsedTime();

    // Build orientation: first apply pitch/yaw (base pose), then roll around local Z
    this._qBase.setFromEuler(new THREE.Euler(
      this.orientation.rotX,
      this.orientation.rotY,
      0,
    ));

    // Get the local Z axis after pitch/yaw
    this._localZ.set(0, 0, 1).applyQuaternion(this._qBase);
    this._qRoll.setFromAxisAngle(this._localZ, this.orientation.rotZ);

    // Compose: roll * base (roll applied in world space around the transformed axis)
    this.shipPivot.quaternion.copy(this._qRoll).multiply(this._qBase);

    // Pulse hardpoint markers (only non-hovered ones)
    for (let i = 0; i < this.hardpoints.length; i++) {
      if (i === this.hoveredHardpoint) continue;
      const marker = this.hardpoints[i].marker;
      const scale = 0.9 + Math.sin(t * 2.5) * 0.35;
      marker.scale.setScalar(scale);
      (marker.material as THREE.MeshBasicMaterial).opacity =
        0.7 + Math.sin(t * 3) * 0.3;
    }

    // Animate engine exhaust plumes
    for (const plume of this.enginePlumes) {
      updateExhaustPlume(plume, t, this.enginePower);
    }

    // ── Starfield update ──
    this.updateStarfield(dt);

    this.renderer.render(this.threeScene, this.camera);
  }

  // Reusable vector for starfield drift direction
  private _starDriftDir = new THREE.Vector3();

  private updateStarfield(dt: number): void {
    if (!this.starPositions || !this.starGeometry) return;
    const buf = this.starPositions;
    const speed = this.starDriftSpeed * dt;

    // Drift along the ship's local -Z axis (engines fire -Z, so stars stream from +Z toward -Z)
    this._starDriftDir.set(0, 0, -1).applyQuaternion(this.shipPivot.quaternion);
    const dx = this._starDriftDir.x * speed;
    const dy = this._starDriftDir.y * speed;
    const dz = this._starDriftDir.z * speed;

    for (const star of this.stars) {
      // Move star along the ship's forward axis
      star.x += dx;
      star.y += dy;
      star.z += dz;

      // Lifecycle
      star.timer += dt;
      switch (star.state) {
        case "visible":
          // Random chance to wink out or explode
          if (star.timer > 3 && Math.random() < 0.0005) {
            star.state = Math.random() < 0.3 ? "exploding" : "winking";
            star.timer = 0;
          }
          break;
        case "winking":
          // Quick fade out over 0.4s
          star.opacity = Math.max(0, star.targetOpacity * (1 - star.timer / 0.4));
          if (star.timer >= 0.4) {
            this.respawnStar(star);
          }
          break;
        case "exploding": {
          // Rapid expand + fade over 0.6s
          const p = star.timer / 0.6;
          star.size = (0.3 + Math.random() * 1.2) * (1 + p * 3);
          star.opacity = star.targetOpacity * Math.max(0, 1 - p);
          if (p >= 1) {
            this.respawnStar(star);
          }
          break;
        }
        case "fading_in":
          // Gentle fade in over 1.5s
          star.opacity = star.targetOpacity * Math.min(1, star.timer / 1.5);
          if (star.timer >= 1.5) {
            star.opacity = star.targetOpacity;
            star.state = "visible";
            star.timer = 0;
          }
          break;
      }

      // Recycle if drifted too far from origin
      const dist2 = star.x * star.x + star.y * star.y + star.z * star.z;
      if (dist2 > STAR_FIELD_RADIUS * STAR_FIELD_RADIUS) {
        this.respawnStar(star);
      }

      // Rewrite verts with current position + size + spin
      const angle = star.spin * (star.timer + star.z * 0.01);
      this.writeStarVerts(star, buf, angle);
    }

    (this.starGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose(): void {
    for (const g of this.sectionGroups) {
      this.shipPivot.remove(g);
      g.traverse((obj) => {
        if (obj instanceof THREE.LineSegments || obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
    this.sectionGroups = [];
    this.sections.length = 0;
    this.hardpoints.length = 0;
    this.enginePlumes.length = 0;
    // Starfield cleanup
    this.starGroup.traverse((obj) => {
      if (obj instanceof THREE.LineSegments) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    this.threeScene.remove(this.starGroup);
    this.stars.length = 0;
    this.starGeometry = null;
    this.starPositions = null;
    this.renderer.dispose();
    this.canvas.remove();
  }
}
