import { vec2, vec3 } from 'gl-matrix';

export interface Mesh {
    positions: Float32Array;
    normals: Float32Array;
    tangents: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
}

export type ShapeType = 'sphere' | 'wavySphere' | 'roundedBox';


export function generateSphere(resolution: number): Mesh {
    const positions: number[] = [];
    const normals: number[] = [];
    const tangents: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

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

            positions.push(x, y, z);

            // Normal (same as position for unit sphere)
            normals.push(x, y, z);

            // Tangent (using cross product with up vector)
            const tx = -z;
            const ty = 0;
            const tz = x;
            const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
            tangents.push(tx / tl, ty / tl, tz / tl, 1.0);

            // UV coordinates
            uvs.push(lon / resolution, lat / resolution);
        }
    }

    // Generate indices
    for (let lat = 0; lat < resolution; lat++) {
        for (let lon = 0; lon < resolution; lon++) {
            const first = lat * (resolution + 1) + lon;
            const second = first + resolution + 1;

            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        tangents: new Float32Array(tangents),
        uvs: new Float32Array(uvs),
        indices: new Uint32Array(indices)
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
        indices: indices
    };
}

export function generateRoundedBox(resolution: number): Mesh {

    const faces = [
        // Positive X
        {
            start: vec3.fromValues(0.5, -0.5, 0.5),
            right: vec3.fromValues(0, 0, -1),
            up: vec3.fromValues(0, 1, 0),
        },
        // Negative X
        {
            start: vec3.fromValues(-0.5, -0.5, -0.5),
            right: vec3.fromValues(0, 0, 1),
            up: vec3.fromValues(0, 1, 0),
        },
        // Positive Y
        {
            start: vec3.fromValues(-0.5, 0.5, 0.5),
            right: vec3.fromValues(1, 0, 0),
            up: vec3.fromValues(0, 0, -1),
        },
        // Negative Y
        {
            start: vec3.fromValues(-0.5, -0.5, -0.5),
            right: vec3.fromValues(1, 0, 0),
            up: vec3.fromValues(0, 0, 1),
        },
        // Positive Z
        {
            start: vec3.fromValues(-0.5, -0.5, 0.5),
            right: vec3.fromValues(1, 0, 0),
            up: vec3.fromValues(0, 1, 0),
        },
        // Negative Z
        {
            start: vec3.fromValues(0.5, -0.5, -0.5),
            right: vec3.fromValues(-1, 0, 0),
            up: vec3.fromValues(0, 1, 0),
        },
    ];

    let faceGeometries: { positions: number[], normals: number[] }[] = [];

    function grid(
        start: vec3,
        right: vec3,
        up: vec3,
        width: number,
        height: number,
        widthSteps: number,
        heightSteps: number,
        indices: number[], // data will be pushed to indices and positions
        positions: number[] // data will be pushed to positions
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
                let index = positions.length;
                positions.push(
                    pa[0], pa[1], pa[2],
                    pb[0], pb[1], pb[2],
                    pc[0], pc[1], pc[2],
                    pd[0], pd[1], pd[2]);
                indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
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

    const positions: number[] = [];
    const normals: number[] = [];
    const tangents: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Define a size, radius, and resolution.
    const size = vec3.fromValues(1, 1.25, 1.5);
    const radius = 0.25;

    for (const face of faces) {
        const start = vec3.multiply(vec3.create(), face.start, size);
        const width = vec3.length(vec3.multiply(vec3.create(), face.right, size));
        const height = vec3.length(vec3.multiply(vec3.create(), face.up, size));
        let positionFaceIndex = positions.length;
        grid(start, face.right, face.up, width, height, resolution, resolution, indices, positions);

        // Move each vertex to its rounded position.
        let tmpPositions: vec3 = vec3.create();
        for (let i = positionFaceIndex; i < positions.length / 3; i++) {
            let index = i * 3;
            vec3.set(tmpPositions, positions[index], positions[index + 1], positions[index + 2]);
            const rounded = roundedBoxPoint(tmpPositions, size, radius);

            positions[index] = rounded.position[0];
            positions[index + 1] = rounded.position[1];
            positions[index + 2] = rounded.position[2];

            // Store the normal.
            normals.push(rounded.normal[0], rounded.normal[1], rounded.normal[2]);
        }
    }

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        tangents: new Float32Array(tangents),
        uvs: new Float32Array(uvs),
        indices: new Uint32Array(indices)
    };
}

export function generateMesh(shape: ShapeType, resolution: number): Mesh {
    switch (shape) {
        case 'sphere':
            return generateSphere(resolution);
        case 'wavySphere':
            return generateWavySphere(resolution);
        case 'roundedBox':
            return generateRoundedBox(resolution);
        default:
            return generateSphere(resolution);
    }
}
