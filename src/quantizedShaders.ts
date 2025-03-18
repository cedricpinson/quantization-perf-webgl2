import { commonUniforms } from './shaders';

const commonQuantizedAttributes = `
in uvec4 aCompressedData0; // xy = position.xy
in uvec4 aCompressedData1; // x = position.z, y = first part of normal/quaternion
in uvec4 aCompressedData2; // xy = rest of normal/quaternion data
in uvec4 aCompressedData3; // xy = uvs
`;

const commonOutputs = `
out vec3 vPosition;
out vec3 vNormal;
out vec4 vTangent;
out vec2 vUV;
`;

const commonConstants = `
const float inv65535 = 1.0 / 65535.0;
const float inv32767 = 1.0 / 32767.0;
const float inv4095 = 1.0 / 4095.0;

#define PI 3.14159265359
#define TWO_PI 6.28318530718
#define HALF_PI 1.57079632679
`;

// quantization functions
const quantizeFunctions = `

vec3 decodePosition16(uvec2 xy, uint z) {
    vec3 pos;
    pos.x = float(xy.x) * inv65535;
    pos.y = float(xy.y) * inv65535;
    pos.z = float(z) * inv65535;
    return mix(uPositionMin, uPositionMax, pos);
}

/**
 * Extracts the normal vector of the tangent frame encoded in the specified quaternion.
 */
void toTangentFrame(const highp vec4 q, out highp vec3 n) {
    n = vec3( 0.0,  0.0,  1.0) +
        vec3( 2.0, -2.0, -2.0) * q.x * q.zwx +
        vec3( 2.0,  2.0, -2.0) * q.y * q.wzy;
}

/**
 * Extracts the normal and tangent vectors of the tangent frame encoded in the
 * specified quaternion.
 */
void toTangentFrame(const highp vec4 q, out highp vec3 n, out highp vec3 t) {
    toTangentFrame(q, n);
    t = vec3( 1.0,  0.0,  0.0) +
        vec3(-2.0,  2.0, -2.0) * q.y * q.yxw +
        vec3(-2.0,  2.0,  2.0) * q.z * q.zwx;
}

void unpack12bitOverlap(uint first, uint second, uint third, out vec2 normal, out vec2 tangent) {
    // Extract normal.x from first 12 bits
    uint normalX = first & 0xFFFu;
    // Extract normal.y from next 12 bits (4 from first, 8 from second)
    uint normalY = ((first >> 12u) & 0xFu) | ((second & 0xFFu) << 4u);
    // Extract tangent.x from next 12 bits (4 from second, 8 from third)
    uint tangentX = ((second >> 8u) & 0xFu) | ((third & 0xFFu) << 4u);
    // Extract tangent.y from remaining bits
    uint tangentY = third >> 8u;

    // Convert to normalized values
    normal.x = float(normalX) * inv4095 * 2.0 - 1.0;
    normal.y = float(normalY) * inv4095 * 2.0 - 1.0;
    tangent.x = float(tangentX) * inv4095 * 2.0 - 1.0;
    tangent.y = float(tangentY) * inv4095 * 2.0 - 1.0;
}

vec3 octDecode16(vec2 oct) {
    vec2 f = vec2(oct) * inv32767 - 1.0;
    vec3 n = vec3(f.x, f.y, 1.0 - abs(f.x) - abs(f.y));
    float t = max(-n.z, 0.0);
    n.x += n.x >= 0.0 ? -t : t;
    n.y += n.y >= 0.0 ? -t : t;
    return normalize(n);
}


// vec3 diamonDecodeTangent16(vec2 oct, vec3 normal) {
//     vec3 tangent = octDecode(oct);
//     // Make tangent orthogonal to normal
//     tangent = normalize(tangent - normal * dot(normal, tangent));
//     return tangent;
// }

vec3 decodeAngleTangent16(uint encoded, vec3 normal) {
    // Extract sign and angle
    float quantizedAngle = float(encoded & 0x7FFFu);

    // Convert back to radians
    float angle = quantizedAngle * inv32767 * TWO_PI - PI;

    // Calculate initial bitangent using same approach as TS code
    vec3 tempVec = abs(normal.x) < 0.9 ?
        vec3(1.0, 0.0, 0.0) :
        vec3(0.0, 1.0, 0.0);
    vec3 bitangent = normalize(cross(normal, tempVec));

    // Rotate bitangent around normal using the same rotation formula
    // float cosAngle = fastCos(angle);
    // float sinAngle = fastSin(angle);
    float cosAngle = cos(angle);
    float sinAngle = sin(angle);
    vec3 rotatedBitangent = cross(normal, bitangent);
    return normalize(bitangent * cosAngle + rotatedBitangent * sinAngle);
}

// Quaternion 12-bit format with overlapping values
void unpack12bitQuaternion(uint a, uint b, uint c, out vec4 quaternion) {
    // Extract quaternion components from overlapped storage
    uint q0 = a & 0xFFFu;
    // Extract q1 from next 12 bits (4 from first, 8 from second)
    uint q1 = ((a >> 12u) & 0xFu) | ((b & 0xFFu) << 4u);
    // Extract q2 from next 12 bits (8 bits from second, 4 bits from third)
    uint q2 = ((b >> 8u) & 0xFFu) | ((c & 0xFu) << 8u);
    // Extract q3 from remaining bits
    uint q3 = (c >> 4u) & 0xFFFu;

    // Convert to normalized values
    quaternion = vec4(
        float(q0) * inv4095 * 2.0 - 1.0,
        float(q1) * inv4095 * 2.0 - 1.0,
        float(q2) * inv4095 * 2.0 - 1.0,
        float(q3) * inv4095 * 2.0 - 1.0
    );
    quaternion = normalize(quaternion);
}
`;

// Shader variants for each format
export const standardAngle16BitVertexShader = `#version 300 es
${commonQuantizedAttributes}
${commonUniforms}
uniform vec3 uPositionMin;
uniform vec3 uPositionMax;
${commonOutputs}
${commonConstants}
${quantizeFunctions}

void main() {
    vec3 position = decodePosition16(aCompressedData0.xy, aCompressedData1.x);

    // Decode normal and tangent from overlapped storage
    vec2 octNormal;
    // Decode normal from octahedral encoding
    vec3 normal = octDecode16(vec2(aCompressedData2.xy));

    // Update tangent decoding
    uint tangentData = aCompressedData1.y;
    vec3 tangent = decodeAngleTangent16(tangentData, normal);
    float tangentSign = float((tangentData >> 15u) & 1u) * 2.0 - 1.0;

    vec2 uv = vec2(aCompressedData3.xy) * inv65535;

    vPosition = (uModelViewMatrix * vec4(position, 1.0)).xyz;
    vNormal = normalize((uNormalMatrix * vec4(normal, 0.0)).xyz);
    vTangent = vec4(normalize((uNormalMatrix * vec4(tangent, 0.0)).xyz), tangentSign);
    vUV = uv;
    gl_Position = uProjectionMatrix * vec4(vPosition, 1.0);
} `;


// Shader variants for each format
// this versions is not yet practical usable as we need to store the sign somewhere
// so it does not work yet
// this article could suggest to drop it and split the mesh :)
// https://www.jeremyong.com/graphics/2023/01/09/tangent-spaces-and-diamond-encoding/
export const compact12BitVertexShader = `#version 300 es
${commonQuantizedAttributes}
${commonUniforms}
uniform vec3 uPositionMin;
uniform vec3 uPositionMax;
${commonOutputs}
${commonConstants}
${quantizeFunctions}

void main() {
    vec3 position = decodePosition16(aCompressedData0.xy, aCompressedData1.x);

    // Decode normal and tangent from overlapped storage
    vec2 octNormal, octTangent;
    unpack12bitOverlap(aCompressedData1.y, aCompressedData2.x, aCompressedData2.y, octNormal, octTangent);

    // oct normal and tangents are already [0,1] float decoded
    vec3 normal = octDecode16(octNormal);
    vec3 tangent = octDecodeTangent(octTangent, normal);
    float tangentSign = float((aCompressedData2.y >> 15u) & 1u) * 2.0 - 1.0;

    vec2 uv = vec2(aCompressedData3.xy) * inv65535;

    vPosition = (uModelViewMatrix * vec4(position, 1.0)).xyz;
    vNormal = normalize((uNormalMatrix * vec4(normal, 0.0)).xyz);
    vTangent = vec4(normalize((uNormalMatrix * vec4(tangent, 0.0)).xyz), tangentSign);
    vUV = uv;
    gl_Position = uProjectionMatrix * vec4(vPosition, 1.0);
} `;

export const quaternion12BitVertexShader = `#version 300 es
${commonQuantizedAttributes}
${commonUniforms}
uniform vec3 uPositionMin;
uniform vec3 uPositionMax;
${commonOutputs}
${commonConstants}
${quantizeFunctions}

void main() {
    vec3 position = decodePosition16(aCompressedData0.xy, aCompressedData1.x);

    // Decode quaternion from overlapped storage
    vec4 quaternion;
    unpack12bitQuaternion(aCompressedData1.y, aCompressedData2.x, aCompressedData2.y, quaternion);

    // Extract normal, tangent and tangent sign from quaternion
    vec3 normal, tangent;
    // https://github.com/fuzhenn/tbn-packer?tab=readme-ov-file
    toTangentFrame(quaternion, normal, tangent);
    float tangentSign = sign(quaternion.w);

    vec2 uv = vec2(aCompressedData3.xy) * inv65535;

    vPosition = (uModelViewMatrix * vec4(position, 1.0)).xyz;
    vNormal = normalize((uNormalMatrix * vec4(normal, 0.0)).xyz);
    vTangent = vec4(normalize((uNormalMatrix * vec4(tangent, 0.0)).xyz), tangentSign);
    vUV = uv;
    gl_Position = uProjectionMatrix * vec4(vPosition, 1.0);
} `;
