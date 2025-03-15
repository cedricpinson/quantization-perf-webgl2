import { quantizeMesh } from './quantize';
interface WavySphereData {
    resolution: number;
    quantize: boolean;
}

// Import quantizeMesh dynamically to ensure it's loaded before use
self.onmessage = async (e: MessageEvent<WavySphereData>) => {
    const start = performance.now();
    const { resolution, quantize } = e.data;

    const numVertices = (resolution + 1) * (resolution + 1);
    const positions = new Float32Array(numVertices * 3);
    const normals = new Float32Array(numVertices * 3);
    const tangents = new Float32Array(numVertices * 4);
    const uvs = new Float32Array(numVertices * 2);
    const indices = new Uint32Array(resolution * resolution * 6);

    const waves = 8;  // Number of waves
    const amplitude = 0.2;  // Wave height

    let index = 0;
    for (let lat = 0; lat <= resolution; lat++) {
        const theta = (lat * Math.PI) / resolution;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= resolution; lon++) {
            const phi = (lon * 2 * Math.PI) / resolution;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            // Add wavy displacement
            const wave = 1 + amplitude * Math.sin(waves * phi) * Math.sin(waves * theta);

            // Position
            const x = cosPhi * sinTheta * wave;
            const y = cosTheta * wave;
            const z = sinPhi * sinTheta * wave;

            positions[index * 3] = x;
            positions[index * 3 + 1] = y;
            positions[index * 3 + 2] = z;

            // Calculate normal (more complex due to displacement)
            const nx = cosPhi * sinTheta;
            const ny = cosTheta;
            const nz = sinPhi * sinTheta;
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
            normals[index * 3] = nx / nl;
            normals[index * 3 + 1] = ny / nl;
            normals[index * 3 + 2] = nz / nl;

            // Tangent
            const tx = -z;
            const ty = 0;
            const tz = x;
            const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
            tangents[index * 4] = tx / tl;
            tangents[index * 4 + 1] = ty / tl;
            tangents[index * 4 + 2] = tz / tl;
            tangents[index * 4 + 3] = 1.0;

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
        vertexBytes: quantize ? 16 : 3 * 4 + 3 * 4 + 4 * 4 + 2 * 4,
        numVertices
    };

    if (quantize) {
        const { compressedData, positionMin, positionMax } = quantizeMesh(numVertices, positions, normals, tangents, uvs, null, null);
        result.quantizedData = compressedData;
        result.positionMin = positionMin;
        result.positionMax = positionMax;
    } else {
        result.positions = positions;
        result.normals = normals;
        result.tangents = tangents;
        result.uvs = uvs;
    }

    const end = performance.now();
    const duration = end - start;
    console.log(`Wavy sphere generation took ${duration.toFixed(2)}ms`);

    self.postMessage(result, {
        transfer: [
            ...(quantize ? [result.quantizedData.buffer, indices.buffer] : [positions.buffer, normals.buffer, tangents.buffer, uvs.buffer, indices.buffer]),
        ]
    });
};
