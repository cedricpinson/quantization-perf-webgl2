import { vec3 } from 'gl-matrix';
import { Mesh } from './mesh';
import { encodeTangent } from './tangentEncoding';

export interface QuantizedMesh {
    compressedData: Uint16Array;
    indices: Uint32Array;
    positionMin: vec3;
    positionMax: vec3;
    vertexBytes: number;
}

// - Positions: 3x16bits (quantized on mesh bounding box)
// - Normals: 2x16bits (octahedral encoding)
// - Tangents: 1x16bits (1 bit sign + 15 bits angle)
// - UVs: 2x16bits (quantized 0-1 range)

// Total: 8x16bits per vertex (16 bytes) vs 48 bytes for uncompressed format

export function quantizeMesh(mesh: Mesh): QuantizedMesh {
    const { positions, normals, tangents, uvs } = mesh;
    const vertexCount = positions.length / 3;
    const compressedData = new Uint16Array(vertexCount * 8); // 4 vec2 per vertex or 8x16bits

    // Find position bounds
    const positionMin = vec3.fromValues(Infinity, Infinity, Infinity);
    const positionMax = vec3.fromValues(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < positions.length; i += 3) {
        positionMin[0] = Math.min(positionMin[0], positions[i]);
        positionMin[1] = Math.min(positionMin[1], positions[i + 1]);
        positionMin[2] = Math.min(positionMin[2], positions[i + 2]);
        positionMax[0] = Math.max(positionMax[0], positions[i]);
        positionMax[1] = Math.max(positionMax[1], positions[i + 1]);
        positionMax[2] = Math.max(positionMax[2], positions[i + 2]);
    }

    // Quantize positions to 16 bits
    const range = vec3.sub(vec3.create(), positionMax, positionMin);
    for (let i = 0; i < vertexCount; i++) {
        const posIdx = i * 3;
        const tanIdx = i * 4;
        const uvIdx = i * 2;
        const outIdx = i * 8;

        // Quantize positions to 16 bits
        const px = (positions[posIdx] - positionMin[0]) / range[0];
        const py = (positions[posIdx + 1] - positionMin[1]) / range[1];
        const pz = (positions[posIdx + 2] - positionMin[2]) / range[2];

        compressedData[outIdx] = px * 65535;
        compressedData[outIdx + 1] = py * 65535;

        // Encode position.z and tangent angle+sign
        compressedData[outIdx + 2] = pz * 65535;

        // Calculate tangent angle
        const normal = vec3.fromValues(normals[posIdx], normals[posIdx + 1], normals[posIdx + 2]);
        const tangent = vec3.fromValues(tangents[tanIdx], tangents[tanIdx + 1], tangents[tanIdx + 2]);
        const tangentSign = tangents[tanIdx + 3] > 0 ? 1 : 0;

        const encodedTangent = encodeTangent(normal, tangent, tangentSign);
        //const decodedTangent = decodeTangent(encodedTangent, normal);

        compressedData[outIdx + 3] = encodedTangent;

        // Encode normal using octahedral encoding
        const nx = normals[posIdx];
        const ny = normals[posIdx + 1];
        const nz = normals[posIdx + 2];
        const invL1Norm = 1 / (Math.abs(nx) + Math.abs(ny) + Math.abs(nz));

        let octX = nx * invL1Norm;
        let octY = ny * invL1Norm;

        if (nz < 0) {
            const temp = octX;
            octX = (1 - Math.abs(octY)) * (octX >= 0 ? 1 : -1);
            octY = (1 - Math.abs(temp)) * (octY >= 0 ? 1 : -1);
        }

        compressedData[outIdx + 4] = ((octX * 0.5 + 0.5) * 65535) | 0;
        compressedData[outIdx + 5] = ((octY * 0.5 + 0.5) * 65535) | 0;

        // Quantize UVs to 16 bits
        compressedData[outIdx + 6] = (uvs[uvIdx] * 65535) | 0;
        compressedData[outIdx + 7] = (uvs[uvIdx + 1] * 65535) | 0;
    }

    return {
        compressedData,
        indices: mesh.indices,
        positionMin,
        positionMax,
        vertexBytes: 16
    };
}