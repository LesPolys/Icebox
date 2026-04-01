export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface WireframeSegment {
  a: Vec3;
  b: Vec3;
}

export type SectionId = "asteroid" | "engineering" | "habitat" | "command";

export interface Hardpoint {
  id: string;
  section: SectionId;
  position: Vec3;
  normal: Vec3;
  slotIndex: number;
}

export interface MeshData {
  vertices: Float32Array;
  indices: Uint16Array;
}

export interface ShipSection {
  id: SectionId;
  zMin: number;
  zMax: number;
  segments: WireframeSegment[];
  color: number;
  hardpoints: Hardpoint[];
  /** Optional solid mesh data (used for asteroid) */
  mesh?: MeshData;
}

export interface ShipGeometry {
  seed: number;
  sections: ShipSection[];
  totalLength: number;
  boundingRadius: number;
}

export interface ShipParams {
  seed: number;
  engineCount?: number;
  drumCount?: number;
  radiatorCount?: number;
}
