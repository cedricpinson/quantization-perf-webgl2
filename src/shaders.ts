// Common vertex shader attributes and uniforms
const commonUniforms = `
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 uNormalMatrix;
uniform vec3 uLightPosition;
uniform sampler2D uAlbedoMap;
uniform sampler2D uNormalMap;
`;

// Uncompressed vertex shader
export const uncompressedVertexShader = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec4 aTangent;
in vec2 aUV;

${commonUniforms}

out vec3 vPosition;
out vec3 vNormal;
out vec4 vTangent;
out vec2 vUV;

void main() {
    vPosition = (uModelViewMatrix * vec4(aPosition, 1.0)).xyz;
    vNormal = normalize((uNormalMatrix * vec4(aNormal, 0.0)).xyz);
    vTangent = vec4(normalize((uNormalMatrix * vec4(aTangent.xyz, 0.0)).xyz), aTangent.w);
    vUV = aUV;
    gl_Position = uProjectionMatrix * vec4(vPosition, 1.0);
}`;

// Quantized vertex shader
export const quantizedVertexShader = `#version 300 es
in uvec4 aCompressedData0; // xy = position.xy
in uvec4 aCompressedData1; // xy = position.z, tangent angle+sign
in uvec4 aCompressedData2; // xy = octahedral normal
in uvec4 aCompressedData3; // xy = uv

${commonUniforms}

uniform vec3 uPositionMin;
uniform vec3 uPositionMax;

out vec3 vPosition;
out vec3 vNormal;
out vec4 vTangent;
out vec2 vUV;

const float inv65535 = 1.0 / 65535.0;
vec3 decodePositionRegular(uvec2 xy, uint z) {
    vec3 pos;
    pos.x = float(xy.x) * inv65535;
    pos.y = float(xy.y) * inv65535;
    pos.z = float(z) * inv65535;
    return mix(uPositionMin, uPositionMax, pos);
}

#define decodePosition decodePositionRegular

const float inv32767 = 1.0 / 32767.0;
vec3 octDecode(vec2 oct) {
    vec2 f = vec2(oct) * inv32767 - 1.0;
    vec3 n = vec3(f.x, f.y, 1.0 - abs(f.x) - abs(f.y));
    float t = max(-n.z, 0.0);
    n.x += n.x >= 0.0 ? -t : t;
    n.y += n.y >= 0.0 ? -t : t;
    return normalize(n);
}

// Original version with cos/sin
vec3 decodeTangentOriginal(uint encoded, vec3 normal) {
    // Extract sign and angle
    float quantizedAngle = float(encoded & 0x7FFFu);

    // Convert back to radians
    float angle = quantizedAngle * inv32767 * 6.28318530718 - 3.14159265359;

    // Calculate initial bitangent using same approach as TS code
    vec3 tempVec = abs(normal.x) < 0.9 ?
        vec3(1.0, 0.0, 0.0) :
        vec3(0.0, 1.0, 0.0);
    vec3 bitangent = normalize(cross(normal, tempVec));

    // Rotate bitangent around normal using the same rotation formula
    float cosAngle = cos(angle);
    float sinAngle = sin(angle);
    vec3 rotatedBitangent = cross(normal, bitangent);
    return normalize(bitangent * cosAngle + rotatedBitangent * sinAngle);
}

// Optimized version without cos/sin
vec3 decodeTangentOptimized(uint encoded, vec3 normal) {
    // Extract angle (exactly as original does)
    float quantizedAngle = float(encoded & 0x7FFFu);
    float angle = quantizedAngle * inv32767 * 6.28318530718 - 3.14159265359;

    // Simple polynomial approximation for cos/sin
    // Normalize angle to [0,1] range
    float t = quantizedAngle * inv32767 - 0.5; //angle / 6.28318530718 + 0.5;  // maps [-π,π] to [0,1]
    t = fract(t);  // handle wrap-around

    // Approximate cos using quadratic
    float t2 = t * t;
    float t4 = t2 * t2;
    float cosAngle = 1.0 - 8.0 * t2 + 8.0 * t4;  // approximates cos(2π*t)
    float sinAngle = 2.0 * t * (1.0 - t) * (1.0 - 2.0 * t);  // approximates sin(2π*t)

    // original
    // float cosAngle = cos(angle);  // TODO: replace with approximation
    // float sinAngle = sin(angle);  // TODO: replace with approximation

    // Rest is identical to original
    vec3 tempVec = abs(normal.x) < 0.9 ?
        vec3(1.0, 0.0, 0.0) :
        vec3(0.0, 1.0, 0.0);
    vec3 bitangent = normalize(cross(normal, tempVec));

    vec3 rotatedBitangent = cross(normal, bitangent);
    return normalize(bitangent * cosAngle + rotatedBitangent * sinAngle);
}
//#define decodeTangent decodeTangentOptimized
#define decodeTangent decodeTangentOriginal

void main() {
    // Decode position
    vec3 position = decodePosition(aCompressedData0.xy, aCompressedData1.x);

    // Decode normal from octahedral encoding
    vec3 normal = octDecode(vec2(aCompressedData2.xy));

    // Update tangent decoding
    uint tangentData = aCompressedData1.y;
    vec3 tangent = decodeTangent(tangentData, normal);
    float tangentSign = float((tangentData >> 15u) & 1u) * 2.0 - 1.0;

    // Decode UVs
    vec2 uv = vec2(aCompressedData3.xy) * inv65535;

    vPosition = (uModelViewMatrix * vec4(position, 1.0)).xyz;
    vNormal = normalize((uNormalMatrix * vec4(normal, 0.0)).xyz);
    vTangent = vec4(normalize((uNormalMatrix * vec4(tangent, 0.0)).xyz), tangentSign);
    vUV = uv;
    gl_Position = uProjectionMatrix * vec4(vPosition, 1.0);
}`;

// Common fragment shader for both pipelines
export const fragmentShader = `#version 300 es
precision highp float;

in vec3 vPosition;
in vec3 vNormal;
in vec4 vTangent;
in vec2 vUV;

uniform int uDisplayMode; // 0: default, 1: normal, 2: tangent, 3: uv
uniform vec3 uLightPosition;
uniform sampler2D uAlbedoMap;
uniform sampler2D uNormalMap;

out vec4 fragColor;

vec3 visualizeNormal(vec3 normal) {
    return normal * 0.5 + 0.5; // Convert from [-1,1] to [0,1] range
}

vec3 visualizeTangent(vec3 tangent) {
    return abs(tangent); // Show absolute values to better visualize direction
}

vec3 visualizeUV(vec2 uv) {
    return vec3(uv, 0.0); // R = U, G = V, B = 0
}

void main() {
    vec3 bitangent = cross(vNormal, vTangent.xyz) * vTangent.w;
    mat3 TBN = mat3(vTangent.xyz, bitangent, vNormal);

    vec3 normalMap = texture(uNormalMap, vUV).xyz * 2.0 - 1.0;
    vec3 normal = normalize(TBN * normalMap);

    // Choose visualization based on display mode
    if (uDisplayMode == 1) {
        // Normal visualization
        fragColor = vec4(visualizeNormal(normalize(vNormal)), 1.0);
    }
    else if (uDisplayMode == 2) {
        // Tangent visualization
        fragColor = vec4(visualizeTangent(normalize(vTangent.xyz)), 1.0);
    }
    else if (uDisplayMode == 3) {
        // UV visualization
        fragColor = vec4(visualizeUV(vUV), 1.0);
    }
    else {
        // Default rendering
        vec3 lightDir = normalize(uLightPosition - vPosition);
        float diffuse = max(dot(normal, lightDir), 0.0);

        vec3 albedo = texture(uAlbedoMap, vUV).rgb;
        vec3 ambient = albedo * 0.2;
        vec3 color = ambient + albedo * diffuse;

        fragColor = vec4(color, 1.0);
    }
}`;