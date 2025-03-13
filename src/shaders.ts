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
out vec3 vTangent;
out float vTangentW;
out vec2 vUV;

void main() {
    vPosition = (uModelViewMatrix * vec4(aPosition, 1.0)).xyz;
    vNormal = normalize((uNormalMatrix * vec4(aNormal, 0.0)).xyz);
    vTangent = normalize((uNormalMatrix * vec4(aTangent.xyz, 0.0)).xyz);
    vTangentW = aTangent.w;
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
out vec3 vTangent;
out float vTangentW;
out vec2 vUV;

vec3 decodePosition(uvec2 xy, uint z) {
    vec3 pos;
    pos.x = float(xy.x) / 65535.0;
    pos.y = float(xy.y) / 65535.0;
    pos.z = float(z) / 65535.0;
    return mix(uPositionMin, uPositionMax, pos);
}

vec3 octDecode(vec2 oct) {
    vec2 f = vec2(oct) / 32767.5 - 1.0;
    vec3 n = vec3(f.x, f.y, 1.0 - abs(f.x) - abs(f.y));
    float t = max(-n.z, 0.0);
    n.x += n.x >= 0.0 ? -t : t;
    n.y += n.y >= 0.0 ? -t : t;
    return normalize(n);
}

vec3 decodeTangent(uint encoded, vec3 normal) {
    // Extract sign and angle
    float sign = float((encoded >> 15u) & 1u) * 2.0 - 1.0;
    float quantizedAngle = float(encoded & 0x7FFFu);

    // Convert back to radians
    float angle = (quantizedAngle / 32767.0) * 6.28318530718 - 3.14159265359;

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
    vec2 uv = vec2(aCompressedData3.xy) / 65535.0;

    vPosition = (uModelViewMatrix * vec4(position, 1.0)).xyz;
    vNormal = normalize((uNormalMatrix * vec4(normal, 0.0)).xyz);
    vTangent = normalize((uNormalMatrix * vec4(tangent, 0.0)).xyz);
    vTangentW = tangentSign;
    vUV = uv;
    gl_Position = uProjectionMatrix * vec4(vPosition, 1.0);
}`;

// Common fragment shader for both pipelines
export const fragmentShader = `#version 300 es
precision highp float;

in vec3 vPosition;
in vec3 vNormal;
in vec3 vTangent;
in float vTangentW;
in vec2 vUV;

uniform vec3 uLightPosition;
uniform sampler2D uAlbedoMap;
uniform sampler2D uNormalMap;

out vec4 fragColor;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 bitangent = cross(vNormal, vTangent) * vTangentW;
    mat3 TBN = mat3(vTangent, bitangent, vNormal);

    vec3 normalMap = texture(uNormalMap, vUV).xyz * 2.0 - 1.0;
    normal = normalize(TBN * normalMap);

    vec3 lightDir = normalize(uLightPosition - vPosition);
    float diffuse = max(dot(normal, lightDir), 0.0);

    vec3 albedo = texture(uAlbedoMap, vUV).rgb;
    vec3 ambient = albedo * 0.2;
    vec3 color = ambient + albedo * diffuse;

    fragColor = vec4(color, 1.0);
}`;