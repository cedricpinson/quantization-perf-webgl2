import { vec3 } from 'gl-matrix';

/**
 * Encodes a tangent vector into a 16-bit value using normal and tangent vectors
 * Returns a 16-bit number where:
 * - Bits 0-14: Quantized angle (15 bits)
 * - Bit 15: Tangent sign (1 bit)
 */
export function encodeTangent(
    normal: vec3,
    tangent: vec3,
    tangentSign: number
): number {
    // Create copies to avoid modifying input vectors
    const normalCopy = vec3.clone(normal);
    const tangentCopy = vec3.clone(tangent);

    // Ensure vectors are normalized
    vec3.normalize(normalCopy, normalCopy);
    vec3.normalize(tangentCopy, tangentCopy);

    // Calculate initial bitangent
    const tempVec = Math.abs(normalCopy[0]) < 0.9 ?
        vec3.fromValues(1, 0, 0) :
        vec3.fromValues(0, 1, 0);
    const bitangent = vec3.cross(vec3.create(), normalCopy, tempVec);
    vec3.normalize(bitangent, bitangent);

    // Calculate angle between tangent and bitangent
    const cosAngle = vec3.dot(tangentCopy, bitangent);
    const crossProduct = vec3.cross(vec3.create(), bitangent, tangentCopy);
    const sinAngle = vec3.dot(crossProduct, normalCopy);
    const angle = Math.atan2(sinAngle, cosAngle);

    // Normalize angle to [0,1] range
    const normalizedAngle = (angle + Math.PI) / (2 * Math.PI);

    // Quantize to 15 bits (0-32767)
    const quantizedAngle = Math.round(normalizedAngle * 32767) & 0x7FFF;

    // Combine with sign bit
    const sign = tangentSign > 0 ? 1 : 0;
    return (sign << 15) | quantizedAngle;
}

/**
 * Decodes a 16-bit tangent encoding back into a tangent vector
 * @param encoded - The 16-bit encoded value
 * @param normal - The normal vector
 * @returns [tangent: vec3, tangentSign: number]
 */
export function decodeTangent(
    encoded: number,
    normal: vec3
): [vec3, number] {
    // Create a copy of the normal
    const normalCopy = vec3.clone(normal);
    vec3.normalize(normalCopy, normalCopy);

    // Extract sign and angle
    const sign = (encoded >> 15) & 1;
    const quantizedAngle = encoded & 0x7FFF;

    // Convert back to radians
    const angle = (quantizedAngle / 32767) * (2 * Math.PI) - Math.PI;

    // Calculate initial bitangent
    const tempVec = Math.abs(normalCopy[0]) < 0.9 ?
        vec3.fromValues(1, 0, 0) :
        vec3.fromValues(0, 1, 0);
    const bitangent = vec3.cross(vec3.create(), normalCopy, tempVec);
    vec3.normalize(bitangent, bitangent);

    // Rotate bitangent around normal by the decoded angle
    const tangent = vec3.create();
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    // Use proper rotation formula
    const rotatedBitangent = vec3.create();
    vec3.scale(tangent, bitangent, cosAngle);
    vec3.cross(rotatedBitangent, normalCopy, bitangent);
    vec3.scaleAndAdd(tangent, tangent, rotatedBitangent, sinAngle);
    vec3.normalize(tangent, tangent);

    return [tangent, sign];
}

// Test function to verify encoding/decoding
export function testTangentEncoding(
    normal: vec3,
    tangent: vec3,
    originalSign: number
): void {
    // Encode
    const encoded = encodeTangent(normal, tangent, originalSign);

    // Decode
    const [decodedTangent, decodedSign] = decodeTangent(encoded, normal);

    // Calculate error
    const dotProduct = vec3.dot(tangent, decodedTangent);
    const angleError = Math.acos(Math.min(1, Math.max(-1, dotProduct)));

    console.log('Encoding test results:');
    console.log('Original tangent:', Array.from(tangent));
    console.log('Decoded tangent:', Array.from(decodedTangent));
    console.log('Angle error (radians):', angleError);
    console.log('Sign preserved:', originalSign === decodedSign);
}

if (false) {
    // Example usage
    const normal = vec3.fromValues(0, 1, 0);
    const tangent = vec3.fromValues(1, 0, 0);
    const originalSign = 1;

    // Test the encoding/decoding
    testTangentEncoding(normal, tangent, originalSign);

    // Or use encode/decode directly
    // @ts-ignore
    const encoded = encodeTangent(normal, tangent, originalSign);
    // @ts-ignore
    const [decodedTangent, decodedSign] = decodeTangent(encoded, normal);
}