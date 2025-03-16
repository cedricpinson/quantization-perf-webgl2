import { vec3, vec4, quat, mat4, mat3 } from 'gl-matrix';
import { encodeTangent } from './tangentEncoding';

const CHAR_BIT = 8;

export interface QuantizedMesh {
    compressedData: Uint16Array;
    indices: Uint32Array;
    positionMin: vec3;
    positionMax: vec3;
    vertexBytes: number;
}

export enum QuantizationFormat {
    Uncompressed = 'none',
    Angle16Bits = 'angle16bits',  // Current format: 16-bit octahedral normals, 16-bit tangent angle
    //    Compact12Bit = 'compact12bit',    // New format: 12-bit octahedral for both normal and tangent
    Quaternion12Bits = 'quaternion12bits' // New format: 12-bit quaternion for normal+tangent frame
}

interface QuantizedAttributes {
    compressedData: Uint16Array;
    positionMin: vec3;
    positionMax: vec3;
}

// - Positions: 3x16bits (quantized on mesh bounding box)
// - Normals: 2x16bits (octahedral encoding)
// - Tangents: 1x16bits (1 bit sign + 15 bits angle)
// - UVs: 2x16bits (quantized 0-1 range)

// Total: 8x16bits per vertex (16 bytes) vs 48 bytes for uncompressed format
export function quantizeStandard16bit(numVertices: number, positions: Float32Array, normals: Float32Array, tangents: Float32Array, uvs: Float32Array, min: vec3 | null, max: vec3 | null): QuantizedAttributes {
    const compressedData = new Uint16Array(numVertices * 8); // 4 vec2 per vertex or 8x16bits

    const positionMin = vec3.fromValues(Infinity, Infinity, Infinity);
    const positionMax = vec3.fromValues(-Infinity, -Infinity, -Infinity);
    if (!min || !max) {
        // Find position bounds
        for (let i = 0; i < positions.length; i += 3) {
            positionMin[0] = Math.min(positionMin[0], positions[i]);
            positionMin[1] = Math.min(positionMin[1], positions[i + 1]);
            positionMin[2] = Math.min(positionMin[2], positions[i + 2]);
            positionMax[0] = Math.max(positionMax[0], positions[i]);
            positionMax[1] = Math.max(positionMax[1], positions[i + 1]);
            positionMax[2] = Math.max(positionMax[2], positions[i + 2]);
        }
    } else {
        vec3.copy(positionMin, min);
        vec3.copy(positionMax, max);
    }
    // Quantize positions to 16 bits
    const range = vec3.sub(vec3.create(), positionMax, positionMin);
    for (let i = 0; i < numVertices; i++) {
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
        //------------------------------------------------------------

        // Quantize UVs to 16 bits
        compressedData[outIdx + 6] = (uvs[uvIdx] * 65535) | 0;
        compressedData[outIdx + 7] = (uvs[uvIdx + 1] * 65535) | 0;
    }

    return {
        compressedData,
        positionMin,
        positionMax,
    };
}

// Total: 8x16bits per vertex (16 bytes) vs 48 bytes for uncompressed format
export function quantizeQuat12bit(numVertices: number, positions: Float32Array, normals: Float32Array, tangents: Float32Array, uvs: Float32Array, min: vec3 | null, max: vec3 | null): QuantizedAttributes {
    const compressedData = new Uint16Array(numVertices * 8); // 4 vec2 per vertex or 8x16bits

    const positionMin = vec3.fromValues(Infinity, Infinity, Infinity);
    const positionMax = vec3.fromValues(-Infinity, -Infinity, -Infinity);
    if (!min || !max) {
        // Find position bounds
        for (let i = 0; i < positions.length; i += 3) {
            positionMin[0] = Math.min(positionMin[0], positions[i]);
            positionMin[1] = Math.min(positionMin[1], positions[i + 1]);
            positionMin[2] = Math.min(positionMin[2], positions[i + 2]);
            positionMax[0] = Math.max(positionMax[0], positions[i]);
            positionMax[1] = Math.max(positionMax[1], positions[i + 1]);
            positionMax[2] = Math.max(positionMax[2], positions[i + 2]);
        }
    } else {
        vec3.copy(positionMin, min);
        vec3.copy(positionMax, max);
    }
    // Quantize positions to 16 bits
    const range = vec3.sub(vec3.create(), positionMax, positionMin);
    for (let i = 0; i < numVertices; i++) {
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

        const q = packTangentFrame(quat.create(), normal, vec4.fromValues(tangent[0], tangent[1], tangent[2], tangentSign), TempVars);
        // Pack quaternion into 12 bits
        const packedQ = [
            Math.round((q[0] * 0.5 + 0.5) * 4095),
            Math.round((q[1] * 0.5 + 0.5) * 4095),
            Math.round((q[2] * 0.5 + 0.5) * 4095),
            Math.round((q[3] * 0.5 + 0.5) * 4095)
        ];

        const [first, second, third] = pack12bitQuaternion(packedQ[0], packedQ[1], packedQ[2], packedQ[3]);
        compressedData[outIdx + 3] = first;
        compressedData[outIdx + 4] = second;
        compressedData[outIdx + 5] = third;

        // Quantize UVs to 16 bits
        compressedData[outIdx + 6] = (uvs[uvIdx] * 65535) | 0;
        compressedData[outIdx + 7] = (uvs[uvIdx + 1] * 65535) | 0;
    }

    return {
        compressedData,
        positionMin,
        positionMax,
    };
}

// Helper functions for octahedral encoding
// function octEncode(normal: vec3): [number, number] {
//     const l1norm = Math.abs(normal[0]) + Math.abs(normal[1]) + Math.abs(normal[2]);
//     const x = normal[0] / l1norm;
//     const y = normal[1] / l1norm;

//     if (normal[2] <= 0) {
//         const tempX = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
//         const tempY = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
//         return [tempX, tempY];
//     }
//     return [x, y];
// }

// Pack a float in [0,1] to n bits
// function packSignedFloat(value: number, bits: number): number {
//     const maxValue = (1 << bits) - 1;
//     return Math.round((value * 0.5 + 0.5) * maxValue);
// }

// function packUnsignedFloat(value: number, bits: number): number {
//     const maxValue = (1 << bits) - 1;
//     return Math.round((value) * maxValue);
// }

// // Unpack from n bits to float in [0,1]
// function unpackUnsignedFloat(value: number, bits: number): number {
//     const maxValue = (1 << bits) - 1;
//     return value / maxValue;
// }

function unpackSignedFloat(value: number, bits: number): number {
    const maxValue = (1 << bits) - 1;
    return (value / maxValue) * 2.0 - 1.0;
}

// Pack four 12-bit values into three 16-bit values with overlap
function pack12bitQuaternion(a: number, b: number, c: number, d: number): [number, number, number] {
    // First 16 bits: all of a (12 bits) and first 4 bits of b
    const first = (a & 0xFFF) | ((b & 0xF) << 12);
    // Second 16 bits: last 8 bits of b and first 8 bits of c
    const second = ((b >> 4) & 0xFF) | ((c & 0xFF) << 8);
    // Third 16 bits: last 4 bits of c and all of d (12 bits)
    const third = ((c >> 8) & 0xF) | ((d & 0xFFF) << 4);
    return [first, second, third];
}

function store4x12to3x16(out: number[], a: number, b: number, c: number, d: number) {
    // First 16 bits: all of a (12 bits) and first 4 bits of b
    const first = (a & 0xFFF) | ((b & 0xF) << 12);
    // Second 16 bits: last 8 bits of b and first 8 bits of c
    const second = ((b >> 4) & 0xFF) | ((c & 0xFF) << 8);
    // Third 16 bits: last 4 bits of c and all of d (12 bits)
    const third = ((c >> 8) & 0xF) | ((d & 0xFFF) << 4);
    out[0] = first;
    out[1] = second;
    out[2] = third;
    return out;
}

function unpack3x16To4x12(out: vec4, a: number, b: number, c: number): vec4 {
    // Extract first 12-bit value (all from first 12 bits of a)
    out[0] = a & 0xFFF;

    // Extract second 12-bit value (4 bits from a, 8 bits from b)
    out[1] = ((a >> 12) & 0xF) | ((b & 0xFF) << 4);

    // Extract third 12-bit value (8 bits from b, 4 bits from c)
    out[2] = ((b >> 8) & 0xFF) | ((c & 0xF) << 8);

    // Extract fourth 12-bit value (all from last 12 bits of c)
    out[3] = (c >> 4) & 0xFFF;

    return out;
}


export function pack12bitQuaternionToUint16(out: number[], a: number, b: number, c: number, d: number): number[] {
    // Pack quaternion into 12 bits
    const q0 = Math.round((a * 0.5 + 0.5) * 4095);
    const q1 = Math.round((b * 0.5 + 0.5) * 4095);
    const q2 = Math.round((c * 0.5 + 0.5) * 4095);
    const q3 = Math.round((d * 0.5 + 0.5) * 4095);

    return store4x12to3x16(out, q0, q1, q2, q3);
}

export function unpack12bitQuaternion(out: quat, a: number, b: number, c: number): quat {
    const q = vec4.create();
    unpack3x16To4x12(q, a, b, c);
    q[0] = unpackSignedFloat(q[0], 12);
    q[1] = unpackSignedFloat(q[1], 12);
    q[2] = unpackSignedFloat(q[2], 12);
    q[3] = unpackSignedFloat(q[3], 12);
    quat.normalize(out, q);
    return out;
}


function toMat3(out: mat3, c00: number, c01: number, c02: number, c10: number, c11: number, c12: number, c20: number, c21: number, c22: number) {
    out[0] = c00;
    out[1] = c01;
    out[2] = c02;
    out[3] = c10;
    out[4] = c11;
    out[5] = c12;
    out[6] = c20;
    out[7] = c21;
    out[8] = c22;
    return out;
}

function toNormal(out: vec3, q: quat) {
    // Create local vectors instead of using global ones
    const F0 = vec3.fromValues(0.0, 0.0, 1.0);
    const F1 = vec3.fromValues(2.0, -2.0, -2.0);
    const F2 = vec3.fromValues(2.0, 2.0, -2.0);

    const n1 = vec3.create();
    const n2 = vec3.create();
    const tmp = vec3.create();

    // n1 = F1 * q[0] * [q[2], q[3], q[0]]
    vec3.scale(n1, F1, q[0]);
    vec3.multiply(n1, n1, vec3.set(tmp, q[2], q[3], q[0]));

    // n2 = F2 * q[1] * [q[3], q[2], q[1]]
    vec3.scale(n2, F2, q[1]);
    vec3.multiply(n2, n2, vec3.set(tmp, q[3], q[2], q[1]));

    // out = F0 + n1 + n2
    vec3.add(out, F0, n1);
    vec3.add(out, out, n2);
}

// Helper function to ensure quaternion w component is positive
function positive(q: quat): quat {
    if (q[3] < 0) {
        return quat.scale(q, q, -1);
    }
    return q;
}

// Create a class to manage temporary variables
interface TempVars {
    TMP0: vec3;
    TMP1: vec3;
    TMP2: vec3;
    MAT0: mat4;
    F0: vec3;
    F1: vec3;
    F2: vec3;
    Q0: vec3;
    Q1: vec3;
    Q2: vec3;
}

export const TempVars: TempVars = {
    TMP0: vec3.create(),
    TMP1: vec3.create(),
    TMP2: vec3.create(),
    MAT0: mat4.create(),
    F0: vec3.fromValues(0.0, 0.0, 1.0),
    F1: vec3.fromValues(2.0, -2.0, -2.0),
    F2: vec3.fromValues(2.0, 2.0, -2.0),
    Q0: vec3.fromValues(1, 0, 0),
    Q1: vec3.fromValues(-2, 2, -2),
    Q2: vec3.fromValues(-2, 2, 2),
};

// Update the packTangentFrameFilament function to use the temp vars

export function packTangentFrame(q: quat, n: vec3, t: vec4, temps: TempVars): quat {
    // @ts-ignore
    const c = vec3.cross(temps.TMP0, n, t);
    // @ts-ignore
    const mat = toMat3(temps.MAT0, t[0], t[1], t[2], c[0], c[1], c[2], n[0], n[1], n[2]);
    q = quat.fromMat3(q, mat);
    q = quat.normalize(q, q);
    q = positive(q);

    const storageSize = 2; //sizeof(int16_t)
    // Ensure w is never 0.0
    // Bias is 2^(nb_bits - 1) - 1
    const bias = 1 / ((1 << (storageSize * CHAR_BIT - 1)) - 1);
    if (q[3] < bias) {
        q[3] = bias;
        const factor = Math.sqrt(1.0 - bias * bias);
        q[0] *= factor;
        q[1] *= factor;
        q[2] *= factor;
    }

    // @ts-ignore
    const b = t[3] > 0 ? vec3.cross(temps.TMP1, t, n) : vec3.cross(temps.TMP1, n, t);

    // If there's a reflection ((n x t) . b <= 0), make sure w is negative
    // @ts-ignore
    const cc = vec3.cross(temps.TMP2, t, n);
    if (vec3.dot(cc, b) < 0) {
        quat.scale(q, q, -1);
    }
    return q;
}

/**
 * Extracts the normal and tangent vectors of the tangent frame encoded in the
 * specified quaternion.
 */
export function unpackNormalTangent(q: quat, n: vec3, t: vec3, temps: TempVars) {
    toNormal(n, q);

    const t0 = temps.Q0;
    const t1 = vec3.scale(temps.TMP0, temps.Q1, q[1]);
    vec3.multiply(t1, t1, vec3.set(temps.TMP1, q[1], q[0], q[3]));
    const t2 = vec3.scale(temps.TMP2, temps.Q2, q[2]);
    vec3.multiply(t2, t2, vec3.set(temps.TMP1, q[2], q[3], q[0]));

    vec3.add(t, t0, t1);
    vec3.add(t, t, t2);
}