import { vec3 } from 'gl-matrix';
import { Mesh } from './mesh';

export interface QuantizedMesh {
    compressedData: Uint16Array;
    indices: Uint32Array;
    positionMin: vec3;
    positionMax: vec3;
}

export function quantizeMesh(mesh: Mesh): QuantizedMesh {
    // ... existing quantization code ...
}