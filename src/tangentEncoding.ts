import { quat, vec3, vec4 } from 'gl-matrix';
import { pack12bitQuaternionToUint16, packTangentFrame, TempVars, unpack12bitQuaternion, unpackNormalTangent } from './quantize';

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
 * Fast polynomial approximation for sine
 * Max error < 0.001 for range [-π, π]
 */
function fastSin(x: number): number {
    // Wrap x to [-π, π]
    x = x % (2 * Math.PI);
    if (x > Math.PI) x -= 2 * Math.PI;
    else if (x < -Math.PI) x += 2 * Math.PI;

    // Coefficients for polynomial approximation
    const a3 = -0.16666667;  // -1/6
    const a5 = 0.008333333;  // 1/120
    const a7 = -0.000198413; // -1/5040

    const x2 = x * x;
    const x3 = x2 * x;

    return x + a3 * x3 + a5 * x3 * x2 + a7 * x3 * x2 * x2;
}

/**
 * Fast polynomial approximation for cosine using sin(x + π/2)
 * Max error < 0.001 for range [-π, π]
 */
function fastCos(x: number): number {
    return fastSin(x + Math.PI / 2);
}

/**
 * Optimized tangent decoder using polynomial approximations
 */
export function decodeAngleAsTangent16bits(
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

    // Get sine and cosine values using polynomial approximation
    const cosAngle = fastCos(angle);
    const sinAngle = fastSin(angle);

    // Rotate bitangent around normal
    const tangent = vec3.create();
    const rotatedBitangent = vec3.create();
    vec3.scale(tangent, bitangent, cosAngle);
    vec3.cross(rotatedBitangent, normalCopy, bitangent);
    vec3.scaleAndAdd(tangent, tangent, rotatedBitangent, sinAngle);
    vec3.normalize(tangent, tangent);

    return [tangent, sign];
}

/**
 * Optimized tangent decoder using polynomial approximations
 */
export function decodeAngleAsTangentUsingPolynomialApproximation16bits(
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

    // Get sine and cosine values using polynomial approximation
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    // Rotate bitangent around normal
    const tangent = vec3.create();
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
    let quaternion = quat.create();
    const temps = TempVars;
    const encodedFilament = packTangentFrame(quaternion, normal, vec4.fromValues(tangent[0], tangent[1], tangent[2], originalSign), temps);

    // Decode
    const [decodedTangent, decodedSign] = decodeAngleAsTangent16bits(encoded, normal);
    const [decodedTangentOptimized, decodedSignOptimized] = decodeAngleAsTangentUsingPolynomialApproximation16bits(encoded, normal);
    const normalFilament = vec3.create();
    const tangentFilament = vec3.create();
    unpackNormalTangent(encodedFilament, normalFilament, tangentFilament, temps);

    // Format a vector for display
    const formatVec3 = (v: vec3): string => `[${v[0].toFixed(4)}, ${v[1].toFixed(4)}, ${v[2].toFixed(4)}]`;
    const formatVec4 = (v: vec4 | [vec3, number]): string => {
        if (Array.isArray(v)) {
            // Handle [vec3, number] format
            const vec = v[0] as vec3;
            return `[${vec[0].toFixed(4)}, ${vec[1].toFixed(4)}, ${vec[2].toFixed(4)}, ${v[1]}]`;
        } else {
            // Handle vec4 format
            return `[${v[0].toFixed(4)}, ${v[1].toFixed(4)}, ${v[2].toFixed(4)}, ${v[3].toFixed(4)}]`;
        }
    };

    // Format angle error in both radians and degrees
    const formatAngleError = (radians: number): string =>
        `${radians.toFixed(6)} rad (${(radians * 180 / Math.PI).toFixed(4)}°)`;

    console.log('\n=== TANGENT ENCODING TEST RESULTS ===');
    console.log(`Original vectors:`);
    console.log(`  Normal: ${formatVec3(normal)}`);
    console.log(`  Tangent+Sign: ${formatVec4([tangent, originalSign])}`);

    console.log('\n1. ANGLE AS TANGENT ENCODING:');
    const dotProduct = vec3.dot(tangent, decodedTangent);
    const angleError = Math.acos(Math.min(1, Math.max(-1, dotProduct)));
    console.log(`  Decoded tangent+sign: ${formatVec4([decodedTangent, decodedSign])}`);
    console.log(`  Angle error: ${formatAngleError(angleError)}`);
    console.log(`  Sign preserved: ${originalSign === decodedSign ? '✓' : '✗'}`);

    console.log('\n2. ANGLE AS TANGENT USING POLYNOMIAL APPROXIMATION ENCODING:');
    const dotProductOptimized = vec3.dot(tangent, decodedTangentOptimized);
    const angleErrorOptimized = Math.acos(Math.min(1, Math.max(-1, dotProductOptimized)));
    console.log(`  Decoded tangent+sign: ${formatVec4([decodedTangentOptimized, decodedSignOptimized])}`);
    console.log(`  Angle error: ${formatAngleError(angleErrorOptimized)}`);
    console.log(`  Sign preserved: ${originalSign === decodedSignOptimized ? '✓' : '✗'}`);

    console.log('\n3. CRYTEK QUATERNION ENCODING:');
    const dotProductFilament = vec3.dot(tangent, tangentFilament);
    const angleErrorFilament = Math.acos(Math.min(1, Math.max(-1, dotProductFilament)));
    // Create a tangent+sign vec4 for display
    const tangentFilamentVec4 = vec4.fromValues(
        tangentFilament[0],
        tangentFilament[1],
        tangentFilament[2],
        Math.sign(vec3.dot(vec3.cross(vec3.create(), normal, tangent),
            vec3.cross(vec3.create(), normalFilament, tangentFilament)))
    );
    console.log(`  Decoded tangent+sign: ${formatVec4(tangentFilamentVec4)}`);
    console.log(`  Angle error: ${formatAngleError(angleErrorFilament)}`);

    const dotProductNormalFilament = vec3.dot(normal, normalFilament);
    const angleErrorNormalFilament = Math.acos(Math.min(1, Math.max(-1, dotProductNormalFilament)));
    console.log(`  Decoded normal: ${formatVec3(normalFilament)}`);
    console.log(`  Normal angle error: ${formatAngleError(angleErrorNormalFilament)}`);

    console.log('\n4. CRYTEK QUATERNION 12-BIT ENCODING:');
    // test with 12bits quaternion
    const normalFilament12 = vec3.create();
    const tangentFilament12 = vec3.create();
    let uint12 = new Uint16Array(3);
    // @ts-ignore
    pack12bitQuaternionToUint16(uint12, encodedFilament[0], encodedFilament[1], encodedFilament[2], encodedFilament[3]);
    const quaternion12 = quat.create();
    unpack12bitQuaternion(quaternion12, uint12[0], uint12[1], uint12[2]);
    unpackNormalTangent(quaternion12, normalFilament12, tangentFilament12, temps);

    const dotProductFilament12 = vec3.dot(tangent, tangentFilament12);
    const angleErrorFilament12 = Math.acos(Math.min(1, Math.max(-1, dotProductFilament12)));
    // Create a tangent+sign vec4 for display
    const tangentFilament12Vec4 = vec4.fromValues(
        tangentFilament12[0],
        tangentFilament12[1],
        tangentFilament12[2],
        Math.sign(vec3.dot(vec3.cross(vec3.create(), normal, tangent),
            vec3.cross(vec3.create(), normalFilament12, tangentFilament12)))
    );
    console.log(`  Decoded tangent+sign: ${formatVec4(tangentFilament12Vec4)}`);
    console.log(`  Angle error: ${formatAngleError(angleErrorFilament12)}`);

    const dotProductNormalFilament12 = vec3.dot(normal, normalFilament12);
    const angleErrorNormalFilament12 = Math.acos(Math.min(1, Math.max(-1, dotProductNormalFilament12)));
    console.log(`  Decoded normal: ${formatVec3(normalFilament12)}`);
    console.log(`  Normal angle error: ${formatAngleError(angleErrorNormalFilament12)}`);

    // Summary table
    console.log('\n=== SUMMARY ===');
    console.log('Method                        | Tangent Error          | Normal Error           | Sign');
    console.log('------------------------------|------------------------|------------------------|-------');
    console.log(`Angle as tangent 16bits       | ${formatAngleError(angleError).padEnd(17)} | N/A                    | ${originalSign === decodedSign ? '✓' : '✗'}`);
    console.log(`Angle as tangent approx 16bits| ${formatAngleError(angleErrorOptimized).padEnd(17)} | N/A                    | ${originalSign === decodedSignOptimized ? '✓' : '✗'}`);
    console.log(`Crytek Quaternion             | ${formatAngleError(angleErrorFilament).padEnd(17)} | ${formatAngleError(angleErrorNormalFilament).padEnd(17)} | ${Math.sign(tangentFilamentVec4[3]) === originalSign ? '✓' : '✗'}`);
    console.log(`Crytek Quaternion 12bits      | ${formatAngleError(angleErrorFilament12).padEnd(17)} | ${formatAngleError(angleErrorNormalFilament12).padEnd(17)} | ${Math.sign(tangentFilament12Vec4[3]) === originalSign ? '✓' : '✗'}`);
}

// Example usage
// const normal = vec3.fromValues(0, 1, 0);
// const tangent = vec3.fromValues(1, 0, 0);
// const originalSign = 1;

// Let's test the encoding for a specific vertex (e.g., at lat=45°, lon=30°)
// const normal = vec3.fromValues(0.6124, 0.7071, 0.3536);
// const tangent = vec3.fromValues(-0.5000, 0.0000, 0.8660);
// const originalSign = 1.0;

// Test the encoding/decoding after initializing the temp vars
// setTimeout(() => {
//     testTangentEncoding(normal, tangent, originalSign);
// }, 0);
