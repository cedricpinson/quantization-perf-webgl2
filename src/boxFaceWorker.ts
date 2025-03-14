// import { vec3 } from 'gl-matrix';

type vec3 = [number, number, number] | Float32Array;
let vec3: typeof import('gl-matrix').vec3;
// Initialize gl-matrix
(async () => {
    const glMatrix = await import('gl-matrix');
    vec3 = glMatrix.vec3;
    // console.log(`[Worker ${self.name || 'unnamed'}] gl-matrix initialized`);
})();

interface FaceData {
    start: number[];
    right: number[];
    up: number[];
    uvIndex: number[];
    size: number[];
    radius: number;
    resolution: number;
    faceIndex: number;
    numVerticesPerFace: number;
    numIndicesPerFace: number;
}

function grid(
    start: vec3,
    right: vec3,
    up: vec3,
    width: number,
    height: number,
    widthSteps: number,
    heightSteps: number,
    indices: Uint32Array, // data will be pushed to indices and positions
    positions: Float32Array, // data will be pushed to positions
    faceIndex: number,
    numVerticesPerFace: number
): void {

    const offsetVertexIndex = faceIndex * numVerticesPerFace;
    // Traverse the face.
    let pa = vec3.create();
    let pb = vec3.create();
    let pc = vec3.create();
    let pd = vec3.create();
    for (let x = 0; x < widthSteps; x++) {
        for (let y = 0; y < heightSteps; y++) {
            // Lower left corner of this quad.
            vec3.scaleAndAdd(pa, start, right, (width * x) / widthSteps);
            vec3.scaleAndAdd(pa, pa, up, (height * y) / heightSteps);

            // Lower right corner.
            vec3.scaleAndAdd(pb, pa, right, width / widthSteps);

            // Upper right corner.
            vec3.scaleAndAdd(pc, pb, up, height / heightSteps);

            // Upper left corner.
            vec3.scaleAndAdd(pd, pa, up, height / heightSteps);

            // Store the six vertices of the two triangles composing this quad.
            //positions.push(pa, pb, pc, pa, pc, pd);
            const localQuadIndex = (x * heightSteps + y);
            const vertexIndex = localQuadIndex * 4;
            const vertexIndexComponent = vertexIndex * 3;
            positions[vertexIndexComponent + 0] = pa[0];
            positions[vertexIndexComponent + 1] = pa[1];
            positions[vertexIndexComponent + 2] = pa[2];

            positions[vertexIndexComponent + 3] = pb[0];
            positions[vertexIndexComponent + 4] = pb[1];
            positions[vertexIndexComponent + 5] = pb[2];

            positions[vertexIndexComponent + 6] = pc[0];
            positions[vertexIndexComponent + 7] = pc[1];
            positions[vertexIndexComponent + 8] = pc[2];

            positions[vertexIndexComponent + 9] = pd[0];
            positions[vertexIndexComponent + 10] = pd[1];
            positions[vertexIndexComponent + 11] = pd[2];

            const triangleIndex = localQuadIndex * 6;
            indices[triangleIndex + 0] = offsetVertexIndex + vertexIndex + 0;
            indices[triangleIndex + 1] = offsetVertexIndex + vertexIndex + 2;
            indices[triangleIndex + 2] = offsetVertexIndex + vertexIndex + 1;
            indices[triangleIndex + 3] = offsetVertexIndex + vertexIndex + 0;
            indices[triangleIndex + 4] = offsetVertexIndex + vertexIndex + 3;
            indices[triangleIndex + 5] = offsetVertexIndex + vertexIndex + 2;
        }
    }
}

function generateFaceGrid(
    start: vec3,
    right: vec3,
    up: vec3,
    size: vec3,
    radius: number,
    resolution: number,
    positions: Float32Array,
    normals: Float32Array,
    tangents: Float32Array,
    uvs: Float32Array,
    indices: Uint32Array,
    uvIndex: number[],
    faceIndex: number
): void {
    // Copy the grid generation and vertex processing logic here
    // This is the same code as in the original grid function and face processing
    // but working with local arrays instead of global ones
    // ...
    const numVerticesPerFace = positions.length / 3;

    const width = vec3.length(vec3.multiply(vec3.create(), right, size));
    const height = vec3.length(vec3.multiply(vec3.create(), up, size));

    // scale the start point to the size of the face
    start = vec3.multiply(vec3.create(), start, size);
    grid(start, right, up, width, height, resolution, resolution, indices, positions, faceIndex, numVerticesPerFace);

    // Calculate face normal by crossing right and up vectors
    // const faceNormal = vec3.cross(vec3.create(), face.right, face.up);
    // vec3.normalize(faceNormal, faceNormal);
    {
        // Pre-allocate all temporary vectors outside the loop
        const position = vec3.create();
        const normal = vec3.create();
        const tangent = vec3.create();
        const bitangent = vec3.create();
        const clamped = vec3.create();

        // Pre-calculate size values used in bounds check
        const sizeHalf = vec3.scale(vec3.create(), size, 0.5);
        const boundMaxVec = vec3.subtract(vec3.create(), sizeHalf, [radius, radius, radius]);
        const boundMinVec = vec3.negate(vec3.create(), boundMaxVec);

        // Direct array access for better performance
        for (let i = 0; i < numVerticesPerFace; i++) {
            const indexPos = i * 3;
            const indexUv = i * 2;
            const indexTangent = i * 4;

            // Load position directly from array
            position[0] = positions[indexPos];
            position[1] = positions[indexPos + 1];
            position[2] = positions[indexPos + 2];

            // Rounding edges
            // Clamp position to bounds
            // if (false) {
            vec3.max(clamped, boundMinVec, position);
            vec3.min(clamped, boundMaxVec, clamped);

            // Calculate normal and update position
            vec3.subtract(normal, position, clamped);
            vec3.normalize(normal, normal);
            vec3.scaleAndAdd(position, clamped, normal, radius);
            // }
            // End of rounding edges

            // Write position back to array
            positions[indexPos] = position[0];
            positions[indexPos + 1] = position[1];
            positions[indexPos + 2] = position[2];

            // Calculate UVs directly
            uvs[indexUv] = (position[uvIndex[0]] / size[uvIndex[0]]) + 0.5;
            uvs[indexUv + 1] = (position[uvIndex[1]] / size[uvIndex[1]]) + 0.5;

            // Write normal
            normals[indexPos] = normal[0];
            normals[indexPos + 1] = normal[1];
            normals[indexPos + 2] = normal[2];

            // Calculate tangent more efficiently
            vec3.copy(tangent, right);
            vec3.normalize(tangent, tangent);
            const dot = vec3.dot(tangent, normal);
            vec3.scaleAndAdd(tangent, tangent, normal, -dot);
            vec3.normalize(tangent, tangent);

            // Calculate handedness with fewer operations
            vec3.cross(bitangent, normal, tangent);
            const handedness = vec3.dot(bitangent, up) > 0 ? 1.0 : -1.0;

            // Write tangent
            tangents[indexTangent] = tangent[0];
            tangents[indexTangent + 1] = tangent[1];
            tangents[indexTangent + 2] = tangent[2];
            tangents[indexTangent + 3] = handedness;
        }
    }
}
// Set up message handler
self.onmessage = async (e: MessageEvent<FaceData>) => {

    // Wait for gl-matrix to be initialized
    while (!vec3) {
        // console.log(`[Worker ${self.name || 'unnamed'}] Waiting for gl-matrix initialization...`);
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    // console.log(`[Worker ${self.name || 'unnamed'}] Received message:`, {
    //     faceIndex: e.data.faceIndex,
    //     resolution: e.data.resolution,
    //     numVerticesPerFace: e.data.numVerticesPerFace,
    //     numIndicesPerFace: e.data.numIndicesPerFace
    // });
    const startTiming = performance.now();

    const {
        start,
        right,
        up,
        uvIndex,
        size,
        radius,
        resolution,
        faceIndex,
        numVerticesPerFace,
        numIndicesPerFace } = e.data;


    // Convert arrays back to vec3
    const startVec = vec3.fromValues(start[0], start[1], start[2]);
    const rightVec = vec3.fromValues(right[0], right[1], right[2]);
    const upVec = vec3.fromValues(up[0], up[1], up[2]);
    const sizeVec = vec3.fromValues(size[0], size[1], size[2]);

    // Create arrays for this face
    const positions = new Float32Array(numVerticesPerFace * 3);
    const normals = new Float32Array(numVerticesPerFace * 3);
    const tangents = new Float32Array(numVerticesPerFace * 4);
    const uvs = new Float32Array(numVerticesPerFace * 2);
    const indices = new Uint32Array(numIndicesPerFace);

    // Generate grid for this face
    generateFaceGrid(
        startVec, rightVec, upVec,
        sizeVec, radius, resolution,
        positions, normals, tangents, uvs, indices,
        uvIndex, faceIndex
    );

    const endTiming = performance.now();
    const duration = (endTiming - startTiming).toFixed(2);
    console.log(`Face generation time: ${duration} milliseconds`);

    // Send the result back
    self.postMessage({
        faceIndex,
        positions: positions,
        normals: normals,
        tangents: tangents,
        uvs: uvs,
        indices: indices
    }, {
        transfer: [
            positions.buffer,
            normals.buffer,
            tangents.buffer,
            uvs.buffer,
            indices.buffer
        ]
    });

};
