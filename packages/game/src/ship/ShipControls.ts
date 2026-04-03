import * as THREE from "three";
import type { ShipOrientation } from "./ShipRenderer";

export interface CameraParams {
  distance: number;
  fov: number;
  /** Elevation angle in radians — 0 = level, positive = above */
  elevation: number;
  /** Azimuth offset in radians — base angle before drag rotation */
  azimuth: number;
}

export const DEFAULT_CAMERA: CameraParams = {
  distance: 80,
  fov: 40,
  elevation: 0.6,
  azimuth: -2.2,
};

export const DEFAULT_ORIENTATION: ShipOrientation = {
  rotX: 0,
  rotY: 0,
  rotZ: 0,
};

export type HoverMode = "wireframe" | "solid-hover" | "solid-highlight";

export interface SavedDefaults {
  camera: CameraParams;
  orientation: ShipOrientation;
  hoverMode: HoverMode;
  enginePower: number;
  starDriftSpeed: number;
}

const FALLBACK_DEFAULTS: SavedDefaults = {
  camera: { ...DEFAULT_CAMERA },
  orientation: { ...DEFAULT_ORIENTATION },
  hoverMode: "wireframe",
  enginePower: 0.7,
  starDriftSpeed: 3.0,
};

/** Fetch saved defaults from disk (reads fresh every time) */
export async function loadDefaults(): Promise<SavedDefaults> {
  try {
    const res = await fetch("/__ship-defaults");
    if (!res.ok) return { ...FALLBACK_DEFAULTS };
    const raw = await res.json();
    // Migrate old solidHover boolean
    let hoverMode: HoverMode = raw.hoverMode ?? "wireframe";
    if (!raw.hoverMode && raw.solidHover) hoverMode = "solid-hover";
    return {
      camera: { ...DEFAULT_CAMERA, ...raw.camera },
      orientation: { ...DEFAULT_ORIENTATION, ...raw.orientation },
      hoverMode,
      enginePower: raw.enginePower ?? 0.7,
      starDriftSpeed: raw.starDriftSpeed ?? 3.0,
    };
  } catch {
    return { ...FALLBACK_DEFAULTS };
  }
}

export async function saveDefaults(defaults: SavedDefaults): Promise<boolean> {
  try {
    const res = await fetch("/__ship-defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaults),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export class ShipControls {
  private dollyTarget = 0;
  private dolly = 0;

  private isDragging = false;
  private lastMouseY = 0;

  /** When false, scroll/drag inputs are ignored (e.g. during card drag). */
  enabled = true;

  private readonly minZ = -55;
  private readonly maxZ = 55;
  private readonly dollyLerp = 0.08;
  private readonly scrollSensitivity = 0.08;
  private readonly dragSensitivity = 0.005;

  params: CameraParams;

  /** Drag rotation feeds into ship orientation.rotZ (roll) */
  private shipOrientation: ShipOrientation | null = null;
  private dragRollTarget = 0;
  private dragRoll = 0;
  private readonly rollLerp = 0.1;

  /** The ship pivot group — needed to compute local Z axis in world space */
  private shipPivot: THREE.Group | null = null;

  // Animated transition state
  private animating = false;
  private animStartTime = 0;
  private animDuration = 600;
  private animDollyStart = 0;
  private animDollyEnd = 0;
  private animRollStart = 0;
  private animRollEnd = 0;

  private boundWheel: (e: WheelEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;

  constructor(private canvas: HTMLCanvasElement, params?: Partial<CameraParams>) {
    this.params = { ...DEFAULT_CAMERA, ...params };

    this.boundWheel = this.onWheel.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);

    canvas.addEventListener("wheel", this.boundWheel, { passive: false });
    canvas.addEventListener("mousedown", this.boundMouseDown);
    window.addEventListener("mousemove", this.boundMouseMove);
    window.addEventListener("mouseup", this.boundMouseUp);
  }

  /** Link drag rotation to the ship orientation's rotZ */
  bindShipOrientation(orientation: ShipOrientation): void {
    this.shipOrientation = orientation;
  }

  /** Provide the ship pivot so scroll can follow its local Z axis */
  bindShipPivot(pivot: THREE.Group): void {
    this.shipPivot = pivot;
  }

  /** Current roll target (read-only for external callers) */
  get currentRoll(): number { return this.dragRollTarget; }

  /** Smoothly animate dolly and roll toward target values */
  animateTo(dolly: number, roll: number, duration = 600): void {
    this.animating = true;
    this.animStartTime = performance.now();
    this.animDuration = duration;
    this.animDollyStart = this.dollyTarget;
    this.animDollyEnd = Math.max(this.minZ, Math.min(this.maxZ, dolly));
    this.animRollStart = this.dragRollTarget;
    this.animRollEnd = roll;
  }

  private onWheel(e: WheelEvent): void {
    if (!this.enabled) return;
    e.preventDefault();
    this.dollyTarget += e.deltaY * this.scrollSensitivity;
    this.dollyTarget = Math.max(this.minZ, Math.min(this.maxZ, this.dollyTarget));
  }

  private onMouseDown(e: MouseEvent): void {
    if (!this.enabled) return;
    if (e.button === 0) {
      this.isDragging = true;
      this.lastMouseY = e.clientY;
      this.canvas.style.cursor = "grabbing";
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    const dy = e.clientY - this.lastMouseY;
    this.dragRollTarget += dy * this.dragSensitivity;
    this.lastMouseY = e.clientY;
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.isDragging = false;
      this.canvas.style.cursor = "grab";
    }
  }

  // Reusable vectors to avoid allocation each frame
  private _localZ = new THREE.Vector3();
  private _camOffset = new THREE.Vector3();

  update(camera: THREE.PerspectiveCamera): void {
    // Handle animated transitions — set actual values directly (bypass lerp)
    if (this.animating) {
      const elapsed = performance.now() - this.animStartTime;
      const t = Math.min(1, elapsed / this.animDuration);
      // Smooth ease-in-out
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.dollyTarget = this.animDollyStart + (this.animDollyEnd - this.animDollyStart) * ease;
      this.dolly = this.dollyTarget;
      this.dragRollTarget = this.animRollStart + (this.animRollEnd - this.animRollStart) * ease;
      this.dragRoll = this.dragRollTarget;
      if (t >= 1) this.animating = false;
    } else {
      // Normal lerp when not animating
      this.dolly += (this.dollyTarget - this.dolly) * this.dollyLerp;
      this.dragRoll += (this.dragRollTarget - this.dragRoll) * this.rollLerp;
    }
    if (this.shipOrientation) {
      this.shipOrientation.rotZ = this.dragRoll;
    }

    // Apply FOV if changed
    if (camera.fov !== this.params.fov) {
      camera.fov = this.params.fov;
      camera.updateProjectionMatrix();
    }

    const { distance, elevation, azimuth } = this.params;

    // Camera offset from lookAt in spherical coordinates
    const cosEl = Math.cos(elevation);
    const sinEl = Math.sin(elevation);
    this._camOffset.set(
      Math.cos(azimuth) * cosEl * distance,
      Math.sin(azimuth) * cosEl * distance,
      sinEl * distance,
    );

    // Compute the ship's local Z axis in world space for dolly
    let lookAtPoint: THREE.Vector3;
    if (this.shipPivot) {
      // Get the ship's local Z direction in world space
      this._localZ.set(0, 0, 1);
      this._localZ.applyQuaternion(this.shipPivot.quaternion);
      lookAtPoint = this._localZ.clone().multiplyScalar(this.dolly);
    } else {
      lookAtPoint = new THREE.Vector3(0, 0, this.dolly);
    }

    camera.position.copy(lookAtPoint).add(this._camOffset);
    camera.lookAt(lookAtPoint);
    camera.up.set(0, 0, 1);
  }

  dispose(): void {
    this.canvas.removeEventListener("wheel", this.boundWheel);
    this.canvas.removeEventListener("mousedown", this.boundMouseDown);
    window.removeEventListener("mousemove", this.boundMouseMove);
    window.removeEventListener("mouseup", this.boundMouseUp);
  }
}
