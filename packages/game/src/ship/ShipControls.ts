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

const STORAGE_KEY = "icebox_shipviewer_defaults";

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

export interface SavedDefaults {
  camera: CameraParams;
  orientation: ShipOrientation;
  solidHover: boolean;
}

export function loadDefaults(): SavedDefaults {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        camera: { ...DEFAULT_CAMERA, ...parsed.camera },
        orientation: { ...DEFAULT_ORIENTATION, ...parsed.orientation },
        solidHover: parsed.solidHover ?? false,
      };
    }
  } catch { /* use defaults */ }
  return { camera: { ...DEFAULT_CAMERA }, orientation: { ...DEFAULT_ORIENTATION }, solidHover: false };
}

export function saveDefaults(camera: CameraParams, orientation: ShipOrientation, solidHover: boolean): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ camera, orientation, solidHover }));
}

export class ShipControls {
  private dollyTarget = 0;
  private dolly = 0;

  private isDragging = false;
  private lastMouseY = 0;

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

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.dollyTarget += e.deltaY * this.scrollSensitivity;
    this.dollyTarget = Math.max(this.minZ, Math.min(this.maxZ, this.dollyTarget));
  }

  private onMouseDown(e: MouseEvent): void {
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
    // Lerp dolly
    this.dolly += (this.dollyTarget - this.dolly) * this.dollyLerp;

    // Lerp drag roll and apply to ship orientation
    this.dragRoll += (this.dragRollTarget - this.dragRoll) * this.rollLerp;
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
