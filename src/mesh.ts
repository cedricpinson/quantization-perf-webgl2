import { vec3 } from 'gl-matrix';

export interface Mesh {
    positions: Float32Array;
    normals: Float32Array;
    tangents: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
    vertexBytes: number;
}

export type ShapeType = 'sphere' | 'wavySphere' | 'roundedBox';


export function generateSphere(resolution: number): Mesh {
    const numVertices = (resolution + 1) * (resolution + 1);
    const positions: Float32Array = new Float32Array(numVertices * 3);
    const normals: Float32Array = new Float32Array(numVertices * 3);
    const tangents: Float32Array = new Float32Array(numVertices * 4);
    const uvs: Float32Array = new Float32Array(numVertices * 2);
    const indices: Uint32Array = new Uint32Array(resolution * resolution * 6);

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

    return {
        positions: positions,
        normals: normals,
        tangents: tangents,
        uvs: uvs,
        indices: indices,
        vertexBytes: 3 * 4 + 3 * 4 + 4 * 4 + 2 * 4
    };
}


export function generateWavySphere(resolution: number): Mesh {

    const numVertices = (resolution + 1) * (resolution + 1);
    const positions: Float32Array = new Float32Array(numVertices * 3);
    const normals: Float32Array = new Float32Array(numVertices * 3);
    const tangents: Float32Array = new Float32Array(numVertices * 4);
    const uvs: Float32Array = new Float32Array(numVertices * 2);
    const indices: Uint32Array = new Uint32Array(resolution * resolution * 6);

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

    // Generate indices (same as sphere)
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

    return {
        positions: positions,
        normals: normals,
        tangents: tangents,
        uvs: uvs,
        indices: indices,
        vertexBytes: 3 * 4 + 3 * 4 + 4 * 4 + 2 * 4
    };
}

export async function generateRoundedBox(resolution: number): Promise<Mesh> {

    const faces = [
        // Positive X
        {
            start: vec3.fromValues(0.5, -0.5, 0.5),
            right: vec3.fromValues(0, 0, -1),
            up: vec3.fromValues(0, 1, 0),
            uvIndex: [2, 1]
        },
        // Negative X
        {
            start: vec3.fromValues(-0.5, -0.5, -0.5),
            right: vec3.fromValues(0, 0, 1),
            up: vec3.fromValues(0, 1, 0),
            uvIndex: [2, 1]
        },
        // Positive Y
        {
            start: vec3.fromValues(-0.5, 0.5, 0.5),
            right: vec3.fromValues(1, 0, 0),
            up: vec3.fromValues(0, 0, -1),
            uvIndex: [0, 2]
        },
        // Negative Y
        {
            start: vec3.fromValues(-0.5, -0.5, -0.5),
            right: vec3.fromValues(1, 0, 0),
            up: vec3.fromValues(0, 0, 1),
            uvIndex: [0, 2]
        },
        // Positive Z
        {
            start: vec3.fromValues(-0.5, -0.5, 0.5),
            right: vec3.fromValues(1, 0, 0),
            up: vec3.fromValues(0, 1, 0),
            uvIndex: [0, 1]
        },
        // Negative Z
        {
            start: vec3.fromValues(0.5, -0.5, -0.5),
            right: vec3.fromValues(-1, 0, 0),
            up: vec3.fromValues(0, 1, 0),
            uvIndex: [0, 1]
        },
    ];

    const numVerticesPerFace = resolution * resolution * 4;
    const numVertices = numVerticesPerFace * 6;
    const numIndicesPerFace = resolution * resolution * 6;
    const numIndices = numIndicesPerFace * 6;

    // Create final arrays
    const positions = new Float32Array(numVertices * 3);
    const normals = new Float32Array(numVertices * 3);
    const tangents = new Float32Array(numVertices * 4);
    const uvs = new Float32Array(numVertices * 2);
    const indices = new Uint32Array(numIndices);

    const size = vec3.fromValues(1.6, 1.6, 1.6);
    const radius = 0.3;

    // Create workers and process faces in parallel
    const workers = faces.map((_, _index) => {
        const worker = new Worker(new URL('./boxFaceWorker.ts', import.meta.url), {
            type: 'module',
        });
        // console.log(`Created worker: ${index}`);
        return worker;
    });

    // Wait a bit for workers to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    const facePromises = faces.map((face, index) => {
        return new Promise<void>((resolve, reject) => {
            const worker = workers[index];

            // Add error handler
            worker.onerror = (error) => {
                console.error(`Worker ${index} error:`, error);
                reject(error);
            };

            worker.onmessage = (e) => {
                const {
                    faceIndex,
                    positions: facePositions,
                    normals: faceNormals,
                    tangents: faceTangents,
                    uvs: faceUvs,
                    indices: faceIndices } = e.data;

                //console.log(`Worker ${faceIndex} messaged back ${facePositions.length} positions`);
                // Copy face data to final arrays
                const vertexOffset = faceIndex * numVerticesPerFace * 3;
                const tangentOffset = faceIndex * numVerticesPerFace * 4;
                const uvOffset = faceIndex * numVerticesPerFace * 2;
                const indexOffset = faceIndex * numIndicesPerFace;

                positions.set(facePositions, vertexOffset);
                normals.set(faceNormals, vertexOffset);
                tangents.set(faceTangents, tangentOffset);
                uvs.set(faceUvs, uvOffset);
                indices.set(faceIndices, indexOffset);

                worker.terminate();
                resolve();
            };

            // Send face data to worker
            //console.log('Sending message to worker', index);
            worker.postMessage({
                start: Array.from(face.start),
                right: Array.from(face.right),
                up: Array.from(face.up),
                uvIndex: face.uvIndex,
                size: Array.from(size),
                radius,
                resolution,
                faceIndex: index,
                numVerticesPerFace,
                numIndicesPerFace
            });
        });
    });

    // Wait for all faces to be processed
    await Promise.all(facePromises);

    return {
        positions,
        normals,
        tangents,
        uvs,
        indices,
        vertexBytes: 3 * 4 + 3 * 4 + 4 * 4 + 2 * 4
    };
}

export async function generateMesh(shape: ShapeType, resolution: number): Promise<Mesh> {
    switch (shape) {
        case 'sphere':
            return generateSphere(resolution);
        case 'wavySphere':
            return generateWavySphere(resolution);
        case 'roundedBox':
            // return generateRoundedBox(2);
            return generateRoundedBox(resolution / 2);
        default:
            return generateSphere(resolution);
    }
}
