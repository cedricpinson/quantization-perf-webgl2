import { vec3 } from 'gl-matrix';

export interface Mesh {
    // Common attributes
    indices: Uint32Array;
    vertexBytes: number;
    numVertices: number;

    // Uncompressed mesh attributes (optional)
    positions?: Float32Array;
    normals?: Float32Array;
    tangents?: Float32Array;
    uvs?: Float32Array;

    // Quantized mesh attributes (optional)
    quantizedData?: Uint16Array;
    positionMin?: vec3;
    positionMax?: vec3;
}

export type ShapeType = 'sphere' | 'wavySphere' | 'roundedBox';

async function generateSphere(resolution: number, quantize: boolean = false): Promise<Mesh> {
    const worker = new Worker(new URL('./sphereWorker.ts', import.meta.url), {
        type: 'module',
    });

    return new Promise(resolve => {
        worker.onmessage = (e) => {
            worker.terminate();
            resolve(e.data);
        };
        worker.postMessage({ resolution, quantize });
    });
}

async function generateWavySphere(resolution: number, quantize: boolean = false): Promise<Mesh> {
    const worker = new Worker(new URL('./wavySphereWorker.ts', import.meta.url), {
        type: 'module',
    });

    return new Promise(resolve => {
        worker.onmessage = (e) => {
            worker.terminate();
            resolve(e.data);
        };
        worker.postMessage({ resolution, quantize });
    });
}

export async function generateMesh(shape: ShapeType, resolution: number, quantize: boolean = false): Promise<Mesh> {
    switch (shape) {
        case 'sphere':
            return generateSphere(resolution, quantize);
        case 'wavySphere':
            return generateWavySphere(resolution, quantize);
        case 'roundedBox':
            return generateRoundedBox(resolution / 2, quantize);
        default:
            return generateSphere(resolution, quantize);
    }
}

async function generateRoundedBox(resolution: number, quantize: boolean = false): Promise<Mesh> {
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
    let mesh: Mesh;
    if (!quantize) {
        mesh = {
            positions: new Float32Array(numVertices * 3),
            normals: new Float32Array(numVertices * 3),
            tangents: new Float32Array(numVertices * 4),
            uvs: new Float32Array(numVertices * 2),
            indices: new Uint32Array(numIndices),
            vertexBytes: 3 * 4 + 3 * 4 + 4 * 4 + 2 * 4,
            numVertices: numVertices,
        };
    } else {
        mesh = {
            quantizedData: new Uint16Array(numVertices * 8),
            positionMin: vec3.create(),
            positionMax: vec3.create(),
            indices: new Uint32Array(numIndices),
            vertexBytes: 4 * 4,
            numVertices: numVertices,
        };
    }

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
                    indices: faceIndices,
                    quantizedData: faceQuantizedData,
                    positionMin: facePositionMin,
                    positionMax: facePositionMax
                } = e.data;

                //console.log(`Worker ${faceIndex} messaged back ${facePositions.length} positions`);
                // Copy face data to final arrays

                const indexOffset = faceIndex * numIndicesPerFace;
                mesh.indices.set(faceIndices, indexOffset);
                if (!quantize) {
                    const vertexOffset = faceIndex * numVerticesPerFace * 3;
                    const tangentOffset = faceIndex * numVerticesPerFace * 4;
                    const uvOffset = faceIndex * numVerticesPerFace * 2;

                    mesh?.positions?.set(facePositions, vertexOffset);
                    mesh?.normals?.set(faceNormals, vertexOffset);
                    mesh?.tangents?.set(faceTangents, tangentOffset);
                    mesh?.uvs?.set(faceUvs, uvOffset);
                } else {
                    mesh.quantizedData?.set(faceQuantizedData, faceIndex * numVerticesPerFace * 8);
                    mesh.positionMin = vec3.fromValues(facePositionMin[0], facePositionMin[1], facePositionMin[2]);
                    mesh.positionMax = vec3.fromValues(facePositionMax[0], facePositionMax[1], facePositionMax[2]);
                }

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
                numIndicesPerFace,
                quantize
            });
        });
    });

    // Wait for all faces to be processed
    await Promise.all(facePromises);
    return mesh;
}
