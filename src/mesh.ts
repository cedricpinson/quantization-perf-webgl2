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

export function generateRoundedBox(resolution: number): Mesh {

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
        indexOffset: number,
        vertexOffset: number
    ): void {

        // Traverse the face.
        for (let x = 0; x < widthSteps; x++) {
            for (let y = 0; y < heightSteps; y++) {
                // Lower left corner of this quad.
                const pa = vec3.scaleAndAdd(vec3.create(), start, right, (width * x) / widthSteps);
                vec3.scaleAndAdd(pa, pa, up, (height * y) / heightSteps);

                // Lower right corner.
                const pb = vec3.scaleAndAdd(vec3.create(), pa, right, width / widthSteps);

                // Upper right corner.
                const pc = vec3.scaleAndAdd(vec3.create(), pb, up, height / heightSteps);

                // Upper left corner.
                const pd = vec3.scaleAndAdd(vec3.create(), pa, up, height / heightSteps);

                // Store the six vertices of the two triangles composing this quad.
                //positions.push(pa, pb, pc, pa, pc, pd);
                const localQuadIndex = (x * heightSteps + y);
                const vertexIndex = vertexOffset + localQuadIndex * 4;
                const vertexIndexComponent = (vertexOffset + localQuadIndex * 4) * 3;
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

                const triangleIndex = indexOffset + localQuadIndex * 6;
                indices[triangleIndex + 0] = vertexIndex;
                indices[triangleIndex + 1] = vertexIndex + 2;
                indices[triangleIndex + 2] = vertexIndex + 1;
                indices[triangleIndex + 3] = vertexIndex;
                indices[triangleIndex + 4] = vertexIndex + 3;
                indices[triangleIndex + 5] = vertexIndex + 2;
            }
        }
    }

    function roundedBoxPoint(point: vec3, size: vec3, radius: number): { normal: vec3, position: vec3 } {
        // Calculate the min and max bounds of the sphere center.
        const boundMax = vec3.multiply(vec3.create(), size, vec3.fromValues(0.5, 0.5, 0.5));
        vec3.subtract(boundMax, boundMax, [radius, radius, radius]);
        const boundMin = vec3.multiply(vec3.create(), size, vec3.fromValues(-0.5, -0.5, -0.5));
        vec3.add(boundMin, boundMin, [radius, radius, radius]);

        // Clamp the sphere center to the bounds.
        const clamped = vec3.max(vec3.create(), boundMin, point);
        vec3.min(clamped, boundMax, clamped);

        // Calculate the normal and position of our new rounded box vertex and return them.
        const normal = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), point, clamped));
        const position = vec3.scaleAndAdd(vec3.create(), clamped, normal, radius);
        return {
            normal,
            position,
        };
    }

    // it's computed by quad
    const numVerticesPerFace = resolution * resolution * 4;
    const numVertices = numVerticesPerFace * 6;
    const numIndicesPerFace = resolution * resolution * 6;
    const numIndices = numIndicesPerFace * 6;
    const positions: Float32Array = new Float32Array(numVertices * 3);
    const normals: Float32Array = new Float32Array(numVertices * 3);
    const tangents: Float32Array = new Float32Array(numVertices * 4);
    const uvs: Float32Array = new Float32Array(numVertices * 2);
    const indices: Uint32Array = new Uint32Array(numIndices);
    // const indices: Uint32Array = new Uint32Array(numIndicesPerFace);

    // Define a size, radius, and resolution.
    const size = vec3.fromValues(1.6, 1.6, 1.6);
    const radius = 0.2;

    let faceIndex = 0;
    for (const face of faces) {
        const start = vec3.multiply(vec3.create(), face.start, size);
        const width = vec3.length(vec3.multiply(vec3.create(), face.right, size));
        const height = vec3.length(vec3.multiply(vec3.create(), face.up, size));

        let vertexIndexOffset = numVerticesPerFace * faceIndex;
        let indexIndexOffset = numIndicesPerFace * faceIndex;
        grid(start, face.right, face.up, width, height, resolution, resolution, indices, positions, indexIndexOffset, vertexIndexOffset);

        // Move each vertex to its rounded position.
        let tmpPositions: vec3 = vec3.create();
        const uvIndex = face.uvIndex;

        // Calculate face normal by crossing right and up vectors
        // const faceNormal = vec3.cross(vec3.create(), face.right, face.up);
        // vec3.normalize(faceNormal, faceNormal);

        for (let i = 0; i < numVerticesPerFace; i++) {

            let indexPos = (vertexIndexOffset + i) * 3;
            let indexUv = (vertexIndexOffset + i) * 2;
            vec3.set(tmpPositions, positions[indexPos], positions[indexPos + 1], positions[indexPos + 2]);
            const rounded = roundedBoxPoint(tmpPositions, size, radius);

            positions[indexPos + 0] = rounded.position[0];
            positions[indexPos + 1] = rounded.position[1];
            positions[indexPos + 2] = rounded.position[2];

            const u = (rounded.position[uvIndex[0]] / size[uvIndex[0]]) + 0.5;
            const v = (rounded.position[uvIndex[1]] / size[uvIndex[1]]) + 0.5;
            uvs[indexUv + 0] = u
            uvs[indexUv + 1] = v;

            const normal = rounded.normal;

            normals[indexPos + 0] = normal[0];
            normals[indexPos + 1] = normal[1];
            normals[indexPos + 2] = normal[2];

            // Calculate tangent vector
            // Use the face's right vector as a base for the tangent
            const tangent = vec3.normalize(vec3.create(), face.right);
            // Make tangent perpendicular to normal using Gram-Schmidt
            const dot = vec3.dot(tangent, normal);
            vec3.scaleAndAdd(tangent, tangent, normal, -dot);
            vec3.normalize(tangent, tangent);

            // Calculate bitangent and handedness
            const bitangent = vec3.cross(vec3.create(), normal, tangent);
            const handedness = vec3.dot(bitangent, face.up) > 0 ? 1.0 : -1.0;

            // Store tangent with handedness in w component
            const indexTangent = (vertexIndexOffset + i) * 4;
            tangents[indexTangent + 0] = tangent[0];
            tangents[indexTangent + 1] = tangent[1];
            tangents[indexTangent + 2] = tangent[2];
            tangents[indexTangent + 3] = handedness;
        }

        faceIndex++;
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

export function generateMesh(shape: ShapeType, resolution: number): Mesh {
    switch (shape) {
        case 'sphere':
            return generateSphere(resolution);
        case 'wavySphere':
            return generateWavySphere(resolution);
        case 'roundedBox':
            return generateRoundedBox(resolution / 2);
        default:
            return generateSphere(resolution);
    }
}
