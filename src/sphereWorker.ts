import { quantizeMeshAngle16Bits, quantizeMeshQuaternion12Bits, QuantizationFormat } from './quantize';

interface SphereData {
    resolution: number;
    quantizationFormat: QuantizationFormat;
}

self.onmessage = async (e: MessageEvent<SphereData>) => {
    const start = performance.now();
    const { resolution, quantizationFormat } = e.data;

    const numVertices = (resolution + 1) * (resolution + 1);
    const positions = new Float32Array(numVertices * 3);
    const normals = new Float32Array(numVertices * 3);
    const tangents = new Float32Array(numVertices * 4);
    const uvs = new Float32Array(numVertices * 2);
    const indices = new Uint32Array(resolution * resolution * 6);

    let index = 0;
    // Generate vertices
    for (let lat = 0; lat <= resolution; lat++) {
        const theta = (lat * Math.PI) / resolution;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= resolution; lon++) {
            const phi = (lon * 2 * Math.PI) / resolution;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            // Position
            const x = cosPhi * sinTheta;
            const y = cosTheta;
            const z = sinPhi * sinTheta;

            positions[index * 3] = x;
            positions[index * 3 + 1] = y;
            positions[index * 3 + 2] = z;

            // Normal (same as position for unit sphere)
            normals[index * 3] = x;
            normals[index * 3 + 1] = y;
            normals[index * 3 + 2] = z;

            // Tangent (using cross product with up vector)
            const tx = -z;
            const ty = 0;
            const tz = x;
            const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
            tangents[index * 4] = tx / tl;
            tangents[index * 4 + 1] = ty / tl;
            tangents[index * 4 + 2] = tz / tl;
            tangents[index * 4 + 3] = 1.0;

            // UV coordinates
            uvs[index * 2] = lon / resolution;
            uvs[index * 2 + 1] = lat / resolution;
            index++;
        }
    }

    // Generate indices
    index = 0;
    for (let lat = 0; lat < resolution; lat++) {
        for (let lon = 0; lon < resolution; lon++) {
            const first = lat * (resolution + 1) + lon;
            const second = first + resolution + 1;

            indices[index] = first;
            indices[index + 1] = second;
            indices[index + 2] = first + 1;
            indices[index + 3] = second;
            indices[index + 4] = second + 1;
            indices[index + 5] = first + 1;
            index += 6;
        }
    }

    const result: any = {
        indices,
        vertexBytes: quantizationFormat === QuantizationFormat.Uncompressed ? 3 * 4 + 3 * 4 + 4 * 4 + 2 * 4 : 16,
        numVertices
    };

    if (quantizationFormat !== QuantizationFormat.Uncompressed) {
        let meshQuantized;
        switch (quantizationFormat) {
            case QuantizationFormat.Quaternion12Bits:
                meshQuantized = quantizeMeshQuaternion12Bits(numVertices, positions, normals, tangents, uvs, null, null);
                result.vertexBytes = 16;
                break;
            case QuantizationFormat.Angle16Bits:
            default:
                meshQuantized = quantizeMeshAngle16Bits(numVertices, positions, normals, tangents, uvs, null, null);
                result.vertexBytes = 16;
                break;
        }
        result.quantizedData = meshQuantized.compressedData;
        result.positionMin = meshQuantized.positionMin;
        result.positionMax = meshQuantized.positionMax;
    } else {
        result.positions = positions;
        result.normals = normals;
        result.tangents = tangents;
        result.uvs = uvs;
    }

    // // Let's test the encoding for a specific vertex (e.g., at lat=45°, lon=30°)
    // const testLat = Math.PI / 4;  // 45 degrees
    // const testLon = Math.PI / 6;  // 30 degrees

    // const sinTheta = Math.sin(testLat);
    // const cosTheta = Math.cos(testLat);
    // const sinPhi = Math.sin(testLon);
    // const cosPhi = Math.cos(testLon);

    // // Position/Normal
    // const testNormal = vec3.fromValues(
    //     cosPhi * sinTheta,
    //     cosTheta,
    //     sinPhi * sinTheta
    // );

    // // Tangent calculation (same as in the sphere generation)
    // const tx = -testNormal[2];  // -z
    // const ty = 0;
    // const tz = testNormal[0];   // x
    // const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
    // const testTangent = vec3.fromValues(
    //     tx / tl,
    //     ty / tl,
    //     tz / tl
    // );

    // // Test the encoding with these vectors
    // console.log('Testing tangent encoding for sphere vertex at lat=45°, lon=30°:');
    // testTangentEncoding(testNormal, testTangent, 1.0);

    const end = performance.now();
    const duration = end - start;
    console.log(`Sphere generation took ${duration.toFixed(2)}ms`);

    self.postMessage(result, {
        transfer: [
            ...(quantizationFormat === QuantizationFormat.Uncompressed ? [positions.buffer, normals.buffer, tangents.buffer, uvs.buffer] : [result.quantizedData.buffer]),
            indices.buffer
        ]
    });
}
