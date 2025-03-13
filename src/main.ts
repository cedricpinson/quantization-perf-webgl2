import { mat4, vec3 } from 'gl-matrix';
import { setupUI } from './ui';
import {
    createShader,
    createProgram,
    createBuffer,
    createIndexBuffer,
    createTexture,
    generateRandomTexture,
    generateRandomNormalMap,
    resizeCanvasToDisplaySize
} from './webgl';
import {
    uncompressedVertexShader,
    quantizedVertexShader,
    fragmentShader
} from './shaders';

import { generateMesh } from './mesh';
import { ShapeType } from './mesh';

interface Mesh {
    positions: Float32Array;
    normals: Float32Array;
    tangents: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
}

interface QuantizedMeshCompressedData {
    // - Positions: 3x16bits (quantized on mesh bounding box)
    // - Normals: 2x16bits (octahedral encoding)
    // - Tangents: 1x16bits (1 bit sign + 15 bits angle)
    // - UVs: 2x16bits (quantized 0-1 range)
    data: Uint16Array;
    index: Uint32Array;
}

interface QuantizedMesh {
    compressedData: QuantizedMeshCompressedData | null;
    positionMin: vec3;
    positionMax: vec3;
}

interface UncompressedBuffers {
    position: WebGLBuffer;
    normal: WebGLBuffer;
    tangent: WebGLBuffer;
    uv: WebGLBuffer;
    index: WebGLBuffer;
}

interface QuantizedBuffers {
    data: WebGLBuffer;
    index: WebGLBuffer;
}

interface GpuUncompressedMesh {
    buffers: UncompressedBuffers;
    locations: {
        position: number;
        normal: number;
        tangent: number;
        uv: number;
    };
}

interface GpuQuantizedMesh {
    buffers: QuantizedBuffers;
    locations: {
        positionMin: WebGLUniformLocation | null;
        positionMax: WebGLUniformLocation | null;
        compressedData: number[];
    };
}

function quantizeMesh(mesh: Mesh): QuantizedMesh {
    const { positions, normals, tangents, uvs } = mesh;
    const vertexCount = positions.length / 3;
    const compressedData = new Uint16Array(vertexCount * 8); // 4 vec2 per vertex or 8x16bits

    // Find position bounds
    const positionMin = vec3.fromValues(Infinity, Infinity, Infinity);
    const positionMax = vec3.fromValues(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < positions.length; i += 3) {
        positionMin[0] = Math.min(positionMin[0], positions[i]);
        positionMin[1] = Math.min(positionMin[1], positions[i + 1]);
        positionMin[2] = Math.min(positionMin[2], positions[i + 2]);
        positionMax[0] = Math.max(positionMax[0], positions[i]);
        positionMax[1] = Math.max(positionMax[1], positions[i + 1]);
        positionMax[2] = Math.max(positionMax[2], positions[i + 2]);
    }

    // Quantize positions to 16 bits
    const range = vec3.sub(vec3.create(), positionMax, positionMin);
    for (let i = 0; i < vertexCount; i++) {
        const posIdx = i * 3;
        const tanIdx = i * 4;
        const uvIdx = i * 2;
        const outIdx = i * 8;

        // Quantize positions to 16 bits
        const px = (positions[posIdx] - positionMin[0]) / range[0];
        const py = (positions[posIdx + 1] - positionMin[1]) / range[1];
        const pz = (positions[posIdx + 2] - positionMin[2]) / range[2];

        compressedData[outIdx] = px * 65535;
        compressedData[outIdx + 1] = py * 65535;

        // Encode position.z and tangent angle+sign
        compressedData[outIdx + 2] = pz * 65535;

        // Calculate tangent angle
        const normal = vec3.fromValues(normals[posIdx], normals[posIdx + 1], normals[posIdx + 2]);
        const tangent = vec3.fromValues(tangents[tanIdx], tangents[tanIdx + 1], tangents[tanIdx + 2]);
        const bitangent = vec3.cross(vec3.create(), normal, tangent);
        vec3.normalize(bitangent, bitangent);

        const angle = Math.atan2(
            vec3.dot(tangent, vec3.cross(vec3.create(), normal, bitangent)),
            vec3.dot(tangent, bitangent)
        );

        const normalizedAngle = ((angle + Math.PI) / (2 * Math.PI));
        const quantizedAngle = (normalizedAngle * 32767) | 0 & 0x7FFF;
        const tangentSign = tangents[tanIdx + 3] > 0 ? 1 : 0;
        compressedData[outIdx + 3] = (tangentSign << 15) | quantizedAngle;

        // Encode normal using octahedral encoding
        const nx = normals[posIdx];
        const ny = normals[posIdx + 1];
        const nz = normals[posIdx + 2];
        const invL1Norm = 1 / (Math.abs(nx) + Math.abs(ny) + Math.abs(nz));

        let octX = nx * invL1Norm;
        let octY = ny * invL1Norm;

        if (nz < 0) {
            const temp = octX;
            octX = (1 - Math.abs(octY)) * (octX >= 0 ? 1 : -1);
            octY = (1 - Math.abs(temp)) * (octY >= 0 ? 1 : -1);
        }

        compressedData[outIdx + 4] = ((octX * 0.5 + 0.5) * 65535) | 0;
        compressedData[outIdx + 5] = ((octY * 0.5 + 0.5) * 65535) | 0;

        // Quantize UVs to 16 bits
        compressedData[outIdx + 6] = (uvs[uvIdx] * 65535) | 0;
        compressedData[outIdx + 7] = (uvs[uvIdx + 1] * 65535) | 0;
    }

    return {
        compressedData: { data: compressedData, index: mesh.indices },
        positionMin,
        positionMax
    };
}

interface MeshState {
    currentMesh: Mesh | null;
    currentQuantizedMesh: QuantizedMesh | null;
    GpuUncompressedMesh: GpuUncompressedMesh | null;
    GpuQuantizedMesh: GpuQuantizedMesh | null;
    lastResolution: number;
    lastShape: ShapeType | null;
    numIndices: number;
}

function main() {
    const canvas = document.querySelector('canvas')!;
    const gl = canvas.getContext('webgl2')!;

    if (!gl) {
        alert('WebGL 2 is not available');
        return;
    }

    const { params, stats, pane } = setupUI();

    // Create shaders and programs
    const uncompressedProgram = createProgram(
        gl,
        createShader(gl, gl.VERTEX_SHADER, uncompressedVertexShader),
        createShader(gl, gl.FRAGMENT_SHADER, fragmentShader)
    );

    const quantizedProgram = createProgram(
        gl,
        createShader(gl, gl.VERTEX_SHADER, quantizedVertexShader),
        createShader(gl, gl.FRAGMENT_SHADER, fragmentShader)
    );

    // Create textures
    const size = 256;
    const albedoTexture = createTexture(gl, size, size, generateRandomTexture(size, size));
    const normalTexture = createTexture(gl, size, size, generateRandomNormalMap(size, size));

    // Create matrices
    const modelViewMatrix = mat4.create();
    const projectionMatrix = mat4.create();
    const normalMatrix = mat4.create();

    // Add buffer tracking
    const meshState: MeshState = {
        currentMesh: null,
        currentQuantizedMesh: null,
        GpuUncompressedMesh: null,
        GpuQuantizedMesh: null,
        numIndices: 0,
        lastResolution: -1,
        lastShape: null
    };

    // Helper function to delete buffers
    function deleteBuffers(gl: WebGL2RenderingContext, buffers: UncompressedBuffers | QuantizedBuffers) {
        for (const key in buffers) {
            const buffer = (buffers as any)[key] as WebGLBuffer;
            if (buffer) {
                gl.deleteBuffer(buffer);
            }
        }
    }

    function updateMesh(state: MeshState) {
        if ((params.useQuantizedMesh && state.GpuQuantizedMesh === null) ||
            (!params.useQuantizedMesh && state.GpuUncompressedMesh === null) ||
            state.lastResolution !== params.resolution || state.lastShape !== params.shape) {
            // Delete existing buffers
            if (state.GpuUncompressedMesh) {
                deleteBuffers(gl, state.GpuUncompressedMesh.buffers);
            }
            if (state.GpuQuantizedMesh) {
                deleteBuffers(gl, state.GpuQuantizedMesh.buffers);
            }
            state.GpuQuantizedMesh = null;
            state.GpuUncompressedMesh = null;

            // Clear current meshes
            state.currentMesh = null;
            state.currentQuantizedMesh = null;

            // Generate new meshes
            state.currentMesh = generateMesh(params.shape, params.resolution);
            console.log(`using mesh with ${state.currentMesh.positions.length / 3} vertices and ${state.currentMesh.indices.length / 3} triangles`);
            if (params.useQuantizedMesh) {
                state.currentQuantizedMesh = quantizeMesh(state.currentMesh);
            }

            state.lastResolution = params.resolution;
            state.lastShape = params.shape;
        }
    }

    function setupUncompressedMesh(state: MeshState): number {

        gl.useProgram(uncompressedProgram);

        // Create buffers if they don't exist
        if (!state.GpuUncompressedMesh) {
            if (!state.currentMesh) throw new Error('currentMesh is null');
            const positionBuffer = createBuffer(gl, state.currentMesh.positions, gl.STATIC_DRAW);
            const normalBuffer = createBuffer(gl, state.currentMesh.normals, gl.STATIC_DRAW);
            const tangentBuffer = createBuffer(gl, state.currentMesh.tangents, gl.STATIC_DRAW);
            const uvBuffer = createBuffer(gl, state.currentMesh.uvs, gl.STATIC_DRAW);
            const indexBuffer = createIndexBuffer(gl, state.currentMesh.indices, gl.STATIC_DRAW);

            state.GpuUncompressedMesh = {
                buffers: {
                    position: positionBuffer,
                    normal: normalBuffer,
                    tangent: tangentBuffer,
                    uv: uvBuffer,
                    index: indexBuffer
                },
                locations: {
                    position: gl.getAttribLocation(uncompressedProgram, 'aPosition'),
                    normal: gl.getAttribLocation(uncompressedProgram, 'aNormal'),
                    tangent: gl.getAttribLocation(uncompressedProgram, 'aTangent'),
                    uv: gl.getAttribLocation(uncompressedProgram, 'aUV')
                }
            };
            state.numIndices = state.currentMesh.indices.length;
            state.currentMesh = null;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, state.GpuUncompressedMesh.buffers.position);
        gl.enableVertexAttribArray(state.GpuUncompressedMesh.locations.position);
        gl.vertexAttribPointer(state.GpuUncompressedMesh.locations.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, state.GpuUncompressedMesh.buffers.normal);
        gl.enableVertexAttribArray(state.GpuUncompressedMesh.locations.normal);
        gl.vertexAttribPointer(state.GpuUncompressedMesh.locations.normal, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, state.GpuUncompressedMesh.buffers.tangent);
        gl.enableVertexAttribArray(state.GpuUncompressedMesh.locations.tangent);
        gl.vertexAttribPointer(state.GpuUncompressedMesh.locations.tangent, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, state.GpuUncompressedMesh.buffers.uv);
        gl.enableVertexAttribArray(state.GpuUncompressedMesh.locations.uv);
        gl.vertexAttribPointer(state.GpuUncompressedMesh.locations.uv, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.GpuUncompressedMesh.buffers.index);

        return state.numIndices;
    }

    function setupQuantizedMesh(state: MeshState): number {

        gl.useProgram(quantizedProgram);

        // Create buffers if they don't exist
        if (!state.GpuQuantizedMesh) {
            if (!state.currentQuantizedMesh) throw new Error('currentQuantizedMesh is null');
            const dataBuffer = createBuffer(gl, state.currentQuantizedMesh.compressedData?.data ?? new Uint16Array(), gl.STATIC_DRAW);
            const indexBuffer = createIndexBuffer(gl, state.currentQuantizedMesh.compressedData?.index ?? new Uint32Array(), gl.STATIC_DRAW);

            // compute locations
            let locations = {
                positionMin: gl.getUniformLocation(quantizedProgram, 'uPositionMin'),
                positionMax: gl.getUniformLocation(quantizedProgram, 'uPositionMax'),
                compressedData: [] as GLint[]
            };

            for (let i = 0; i < 4; i++) {
                const loc = gl.getAttribLocation(quantizedProgram, `aCompressedData${i}`);
                locations.compressedData.push(loc);
            }


            state.GpuQuantizedMesh = {
                buffers: {
                    data: dataBuffer,
                    index: indexBuffer
                },
                locations: locations
            };
            state.numIndices = state.currentQuantizedMesh.compressedData?.index.length ?? 0;
            state.currentQuantizedMesh.compressedData = null;
        }


        // Set up vertex attributes for compressed data
        gl.bindBuffer(gl.ARRAY_BUFFER, state.GpuQuantizedMesh.buffers.data);

        // Use stored locations
        for (const loc of state.GpuQuantizedMesh.locations.compressedData) {
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribIPointer(loc, 2, gl.UNSIGNED_SHORT, 16, loc * 4);
        }


        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.GpuQuantizedMesh.buffers.index);

        // Set position bounds uniforms using stored locations
        // @ts-ignore
        gl.uniform3fv(state.GpuQuantizedMesh.locations.positionMin, state.currentQuantizedMesh.positionMin);
        // @ts-ignore
        gl.uniform3fv(state.GpuQuantizedMesh.locations.positionMax, state.currentQuantizedMesh.positionMax);

        return state.numIndices;
    }

    let rotation = 0;
    let animationFrameId: number | null = null;

    function render() {
        stats.begin();

        updateMesh(meshState);
        resizeCanvasToDisplaySize(canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.enable(gl.DEPTH_TEST);
        gl.frontFace(gl.CW);
        if (params.doubleSided) {
            gl.disable(gl.CULL_FACE);
        } else {
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);
        }

        gl.clearColor(0.1, 0.1, 0.1, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (!params.isPaused) {
            rotation += params.rotationSpeed * 0.005;
        }

        // Update matrices
        mat4.perspective(projectionMatrix, Math.PI / 3, gl.canvas.width / gl.canvas.height, 0.1, 100.0);
        mat4.identity(modelViewMatrix);
        mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -3]);
        mat4.rotateY(modelViewMatrix, modelViewMatrix, rotation);
        mat4.rotateX(modelViewMatrix, modelViewMatrix, Math.PI / 6);
        mat4.invert(normalMatrix, modelViewMatrix);
        mat4.transpose(normalMatrix, normalMatrix);

        const program = params.useQuantizedMesh ? quantizedProgram : uncompressedProgram;
        const indexCount = params.useQuantizedMesh ? setupQuantizedMesh(meshState) : setupUncompressedMesh(meshState);

        if (!indexCount) return;

        gl.useProgram(program);

        // Set uniforms
        const mvLoc = gl.getUniformLocation(program, 'uModelViewMatrix');
        const projLoc = gl.getUniformLocation(program, 'uProjectionMatrix');
        const normalMatLoc = gl.getUniformLocation(program, 'uNormalMatrix');
        const lightPosLoc = gl.getUniformLocation(program, 'uLightPosition');
        const albedoLoc = gl.getUniformLocation(program, 'uAlbedoMap');
        const normalMapLoc = gl.getUniformLocation(program, 'uNormalMap');

        gl.uniformMatrix4fv(mvLoc, false, modelViewMatrix);
        gl.uniformMatrix4fv(projLoc, false, projectionMatrix);
        gl.uniformMatrix4fv(normalMatLoc, false, normalMatrix);
        gl.uniform3f(lightPosLoc, 2, 2, 2);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, albedoTexture);
        gl.uniform1i(albedoLoc, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, normalTexture);
        gl.uniform1i(normalMapLoc, 1);

        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);

        stats.end();

        // Only request next frame if not paused
        if (!params.isPaused) {
            animationFrameId = requestAnimationFrame(render);
        }
    }

    // Start the render loop
    render();

    // Add a listener for the pause parameter
    pane.on('change', (ev: any) => {
        if (ev.target.path === 'isPaused') {
            if (!params.isPaused && !animationFrameId) {
                // Resume rendering
                render();
            }
        }
    });

    // Example: function to change shape
    function setShape(shape: ShapeType) {
        params.shape = shape;
    }

    // Example: function to change resolution
    function setResolution(resolution: number) {
        params.resolution = resolution;
    }

    // Example: function to toggle quantized mesh
    function toggleQuantizedMesh() {
        params.useQuantizedMesh = !params.useQuantizedMesh;
    }

    // Example: function to set rotation speed
    function setRotationSpeed(speed: number) {
        params.rotationSpeed = speed;
    }

    // Make these functions available globally if needed
    (window as any).setShape = setShape;
    (window as any).setResolution = setResolution;
    (window as any).toggleQuantizedMesh = toggleQuantizedMesh;
    (window as any).setRotationSpeed = setRotationSpeed;

    // Clean up resources when the page is unloaded
    window.addEventListener('unload', () => {
        if (meshState.GpuUncompressedMesh && meshState.GpuUncompressedMesh.buffers) {
            deleteBuffers(gl, meshState.GpuUncompressedMesh.buffers);
        }
        if (meshState.GpuQuantizedMesh && meshState.GpuQuantizedMesh.buffers) {
            deleteBuffers(gl, meshState.GpuQuantizedMesh.buffers);
        }
    });
}

main();