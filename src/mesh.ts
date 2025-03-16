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
    // Simple mobile detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log(`Executing ${isMobile ? 'sequential (mobile)' : 'parallel (desktop)'} version of rounded box generation`);

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

    if (isMobile) {
        // Sequential execution for mobile
        // console.log('Processing faces sequentially...');
        for (let index = 0; index < faces.length; index++) {
            // console.log(`Processing face ${index + 1}/6`);
            const face = faces[index];
            const worker = new Worker(new URL('./boxFaceWorker.ts', import.meta.url), {
                type: 'module',
            });

            await new Promise<void>((resolve, reject) => {
                worker.onerror = (error) => {
                    console.error(`Worker ${index} error:`, error);
                    worker.terminate();
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
        }
    } else {
        // Parallel execution for desktop
        // console.log('Processing faces in parallel...');
        const workers = faces.map((face, index) => {
            const worker = new Worker(new URL('./boxFaceWorker.ts', import.meta.url), {
                type: 'module',
            });
            return new Promise<void>((resolve, reject) => {
                worker.onerror = (error) => {
                    console.error(`Worker ${index} error:`, error);
                    worker.terminate();
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

        await Promise.all(workers);
        console.log('All faces processed in parallel');
    }

    return mesh;
}
