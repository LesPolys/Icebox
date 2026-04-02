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

    this.renderer.render(this.threeScene, this.camera);
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
    this.renderer.dispose();
    this.canvas.remove();
  }
}
