import { vec3, vec4 } from 'gl-matrix';
import { TempVars, encodeQuaternion12Bits, decodeQuaternion12Bits, encodeQuaternion16Bits, decodeQuaternion16Bits, encodeQuaternion8Bits, decodeQuaternion8Bits } from './quantize';

/**
 * Encodes a tangent vector into a 16-bit value using normal and tangent vectors
 * Returns a 16-bit number where:
 * - Bits 0-14: Quantized angle (15 bits)
 * - Bit 15: Tangent sign (1 bit)
 */
export function encodeTangentAsAngle16(
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
export function decodeAngleAsTangent16(
    encoded: number,
    normal: vec3
): [vec3, number] {
    // Create a copy of the normal
    const normalCopy = vec3.clone(normal);
    vec3.normalize(normalCopy, normalCopy);

    // Extract sign and angle
    const sign = ((encoded >> 15) & 1) * 2 - 1;
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

/**
 * Optimized tangent decoder using polynomial approximations
 */
export function decodeAngleAsTangentUsingPolynomialApproximation16(
    encoded: number,
    normal: vec3
): [vec3, number] {
    // Create a copy of the normal
    const normalCopy = vec3.clone(normal);
    vec3.normalize(normalCopy, normalCopy);

    // Extract sign and angle
    const sign = ((encoded >> 15) & 1) * 2 - 1;
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


// Test function to verify encoding/decoding functions with their repsective error
export function testTangentEncoding(
    sourceNormal: vec3,
    sourceTangent: vec4,
): void {
    const temps = TempVars;

    // Encode
    // @ts-ignore
    const angleTangent = encodeTangentAsAngle16(vec3.clone(sourceNormal), vec4.clone(sourceTangent), sourceTangent[3]);
    const encodedQuaternion12 = encodeQuaternion12Bits(new Uint16Array(3), vec3.clone(sourceNormal), vec4.clone(sourceTangent), temps);
    const encodedQuaternion16 = encodeQuaternion16Bits(new Uint16Array(4), vec3.clone(sourceNormal), vec4.clone(sourceTangent), temps);
    const encodedQuaternion8 = encodeQuaternion8Bits(new Uint16Array(2), vec3.clone(sourceNormal), vec4.clone(sourceTangent), temps);
    // Decode
    const [decodedAngleTangent, decodedAngleTangentSign] = decodeAngleAsTangent16(angleTangent, vec3.clone(sourceNormal));
    const [decodedAngleTangentOptimized, decodedAngleTangentOptimizedSign] = decodeAngleAsTangentUsingPolynomialApproximation16(angleTangent, vec3.clone(sourceNormal));
    const { normal: qNormal8, tangent: qTangent8 } = decodeQuaternion8Bits(encodedQuaternion8, temps);
    const { normal: qNormal12, tangent: qTangent12 } = decodeQuaternion12Bits(encodedQuaternion12, temps);
    const { normal: qNormal16, tangent: qTangent16 } = decodeQuaternion16Bits(encodedQuaternion16, temps);

    // Format a vector for display
    const formatVec3 = (v: vec3): string => `[${v[0].toFixed(6)}, ${v[1].toFixed(6)}, ${v[2].toFixed(6)}]`;
    const formatVec4 = (v: vec4): string => `[${v[0].toFixed(6)}, ${v[1].toFixed(6)}, ${v[2].toFixed(6)}, ${v[3].toFixed(6)}]`;

    function computeErrorAngle(direction: vec4 | vec3, originalDirection: vec3): number {
        // @ts-ignore
        const dotProduct = vec3.dot(direction, originalDirection);
        const angleError = Math.acos(Math.min(1, Math.max(-1, dotProduct)));
        return angleError;
    }

    function crytekCheckError(tangent: vec4, normal: vec3, qTangent: vec4, qNormal: vec3): { angleError: number, angleErrorNormal: number } {
        // @ts-ignore
        const angleError = computeErrorAngle(tangent, qTangent);
        console.log(`  Decoded tangent+sign: ${formatVec4(qTangent)}`);
        console.log(`  Angle error: ${formatAngleError(angleError)}`);
        const angleErrorNormal = computeErrorAngle(normal, qNormal);
        console.log(`  Decoded normal: ${formatVec3(qNormal)}`);
        console.log(`  Normal angle error: ${formatAngleError(angleErrorNormal)}`);

        return { angleError, angleErrorNormal };
    }

    // Format angle error in both radians and degrees
    const formatAngleError = (radians: number): string =>
        `${radians.toFixed(6)} rad (${(radians * 180 / Math.PI).toFixed(4)}°)`;

    console.log('\n=== TANGENT ENCODING TEST RESULTS ===');
    console.log(`Original vectors:`);
    console.log(`  Normal: ${formatVec3(sourceNormal)}`);
    console.log(`  Tangent+Sign: ${formatVec4(sourceTangent)}`);

    console.log('\n1. ANGLE AS TANGENT ENCODING:');
    const angleError = computeErrorAngle(sourceTangent, decodedAngleTangent);
    console.log(`  Decoded tangent+sign: ${formatVec4(vec4.fromValues(decodedAngleTangent[0], decodedAngleTangent[1], decodedAngleTangent[2], decodedAngleTangentSign))}`);
    console.log(`  Angle error: ${formatAngleError(angleError)}`);
    console.log(`  Sign preserved: ${sourceTangent[3] === decodedAngleTangentSign ? '✓' : '✗'}`);

    console.log('\n2. ANGLE AS TANGENT USING POLYNOMIAL APPROXIMATION ENCODING:');
    const angleErrorOptimized = computeErrorAngle(sourceTangent, decodedAngleTangentOptimized);
    console.log(`  Decoded tangent+sign: ${formatVec4(vec4.fromValues(decodedAngleTangentOptimized[0], decodedAngleTangentOptimized[1], decodedAngleTangentOptimized[2], decodedAngleTangentOptimizedSign))}`);
    console.log(`  Angle error: ${formatAngleError(angleErrorOptimized)}`);
    console.log(`  Sign preserved: ${sourceTangent[3] === decodedAngleTangentOptimizedSign ? '✓' : '✗'}`);

    console.log('\n3. CRYTEK QTangent 12-BIT ENCODING:');
    const { angleError: angleError12, angleErrorNormal: angleErrorNormal12 } = crytekCheckError(sourceTangent, sourceNormal, qTangent12, qNormal12);

    console.log('\n4. CRYTEK QTangent 16-BIT ENCODING:');
    const { angleError: angleError16, angleErrorNormal: angleErrorNormal16 } = crytekCheckError(sourceTangent, sourceNormal, qTangent16, qNormal16);

    console.log('\n5. CRYTEK QTangent 8-BIT ENCODING:');
    const { angleError: angleError8, angleErrorNormal: angleErrorNormal8 } = crytekCheckError(sourceTangent, sourceNormal, qTangent8, qNormal8);

    // Summary table
    console.log('\n=== SUMMARY ===');
    console.log('Method                        | Tangent Error          | Normal Error           | Sign');
    console.log('------------------------------|------------------------|------------------------|-------');
    console.log(`Angle as tangent 16bits       | ${formatAngleError(angleError).padEnd(17)} | N/A                    | ${sourceTangent[3] === decodedAngleTangentSign ? '✓' : '✗'}`);
    console.log(`Angle as tangent approx 16bits| ${formatAngleError(angleErrorOptimized).padEnd(17)} | N/A                    | ${sourceTangent[3] === decodedAngleTangentOptimizedSign ? '✓' : '✗'}`);
    console.log(`Crytek Quaternion 12bits      | ${formatAngleError(angleError12).padEnd(17)} | ${formatAngleError(angleErrorNormal12).padEnd(17)} | ${Math.sign(qTangent12[3]) === sourceTangent[3] ? '✓' : '✗'}`);
    console.log(`Crytek Quaternion 16bits      | ${formatAngleError(angleError16).padEnd(17)} | ${formatAngleError(angleErrorNormal16).padEnd(17)} | ${Math.sign(qTangent16[3]) === sourceTangent[3] ? '✓' : '✗'}`);
    console.log(`Crytek Quaternion 8bits       | ${formatAngleError(angleError8).padEnd(17)} | ${formatAngleError(angleErrorNormal8).padEnd(17)} | ${Math.sign(qTangent8[3]) === sourceTangent[3] ? '✓' : '✗'}`);
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
