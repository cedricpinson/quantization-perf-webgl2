import { mat4 } from 'gl-matrix';
import { Pane } from 'tweakpane';
import { Mesh, ShapeType } from './mesh';
import { GpuUncompressedMesh, GpuQuantizedMesh } from './gpu-mesh';
import { PerformanceMonitor } from './performance';
import {
    createShader,
    createProgram,
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

interface UIParams {
    resolution: number;
    rotationSpeed: number;
    useQuantizedMesh: boolean;
    shape: ShapeType;
    isPaused: boolean;
    displayMode: 'default' | 'normal' | 'tangent' | 'uv';
    zoom: number;
}

function getUrlParams(): Partial<UIParams> {
    const params = new URLSearchParams(window.location.search);
    const resolution = params.get('resolution');
    const shape = params.get('shape') as ShapeType | null;
    const useQuantizedMesh = params.get('useQuantizedMesh');
    const rotationSpeed = params.get('rotationSpeed');
    const isPaused = params.get('isPaused');
    const displayMode = params.get('displayMode') as 'default' | 'normal' | 'tangent' | 'uv' | null;
    const zoom = params.get('zoom');

    return {
        resolution: resolution ? Math.min(Math.max(parseInt(resolution), 512), 8192) : undefined,
        shape: shape && ['sphere', 'wavySphere', 'roundedBox'].includes(shape) ? shape : undefined,
        useQuantizedMesh: useQuantizedMesh ? useQuantizedMesh === 'true' : undefined,
        rotationSpeed: rotationSpeed ? parseFloat(rotationSpeed) : undefined,
        isPaused: isPaused ? isPaused === 'true' : undefined,
        displayMode: displayMode ?? 'default',
        zoom: zoom ? parseFloat(zoom) : undefined
    };
}

function updateUrlParams(params: UIParams) {
    const urlParams = new URLSearchParams(window.location.search);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
            urlParams.set(key, String(value));
        } else {
            urlParams.delete(key);
        }
    });
    window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
}

interface MeshState {
    gpuUncompressedMesh: GpuUncompressedMesh | null;
    gpuQuantizedMesh: GpuQuantizedMesh | null;
    lastResolution: number;
    lastShape: ShapeType | null;
}

function main() {
    const canvas = document.querySelector('canvas')!;

    const desiredWidth = 800;
    const desiredHeight = 600;
    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = desiredWidth * devicePixelRatio;
    canvas.height = desiredHeight * devicePixelRatio;
    canvas.style.width = `${desiredWidth}px`;
    canvas.style.height = `${desiredHeight}px`;

    const gl = canvas.getContext('webgl2')!;

    if (!gl) {
        alert('WebGL 2 is not available');
        return;
    }

    // Create performance monitor
    const performance = new PerformanceMonitor(gl);

    // Get URL parameters
    const urlParams = getUrlParams();
    const params: UIParams = {
        resolution: urlParams.resolution ?? 512,
        rotationSpeed: urlParams.rotationSpeed ?? 0.5,
        useQuantizedMesh: urlParams.useQuantizedMesh ?? false,
        shape: urlParams.shape ?? 'sphere',
        isPaused: urlParams.isPaused ?? false,
        displayMode: urlParams.displayMode ?? 'default',
        zoom: urlParams.zoom ?? 0.1
    };

    // Get the controls container
    const controlsContainer = document.getElementById('controls');
    if (!controlsContainer) throw new Error('Controls container not found');

    // Create and configure Tweakpane
    const pane = new Pane({
        container: controlsContainer,
        title: 'Controls'
    });

    // Add controls with proper styling
    pane.addBinding(params, 'resolution', {
        min: 512,
        max: 8192,
        step: 512,
        label: 'Resolution'
    });

    pane.addBinding(params, 'displayMode', {
        options: {
            'Default': 'default',
            'Normal': 'normal',
            'Tangent': 'tangent',
            'UV': 'uv'
        },
        label: 'Display Mode'
    });

    pane.addBinding(params, 'zoom', {
        min: 0.1,
        max: 2,
        step: 0.1,
        label: 'Zoom'
    });

    pane.addBinding(params, 'shape', {
        options: {
            'Sphere': 'sphere',
            'Wavy Sphere': 'wavySphere',
            'Rounded Box': 'roundedBox'
        },
        label: 'Shape'
    });

    pane.addBinding(params, 'rotationSpeed', {
        min: 0,
        max: 2,
        step: 0.1,
        label: 'Rotation Speed'
    });

    pane.addBinding(params, 'useQuantizedMesh', {
        label: 'Use Quantized Mesh'
    });

    pane.addBinding(params, 'isPaused', {
        label: 'Pause'
    });

    // Update URL when parameters change
    pane.on('change', () => {
        updateUrlParams(params);
    });

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
        gpuUncompressedMesh: null,
        gpuQuantizedMesh: null,
        lastResolution: -1,
        lastShape: null
    };

    async function buildMesh() {
        const currentMesh = await generateMesh(params.shape, params.resolution);
        console.log(`using mesh with ${currentMesh.positions.length / 3} vertices and ${currentMesh.indices.length / 3} triangles`);
        return currentMesh;
    }

    function needToBuildMesh(): boolean {
        return (params.useQuantizedMesh && meshState.gpuQuantizedMesh === null) ||
            (!params.useQuantizedMesh && meshState.gpuUncompressedMesh === null) ||
            meshState.lastResolution !== params.resolution || meshState.lastShape !== params.shape;
    }

    // function updateMesh2(state: MeshState) {
    //     if ((params.useQuantizedMesh && state.gpuQuantizedMesh === null) ||
    //         (!params.useQuantizedMesh && state.gpuUncompressedMesh === null) ||
    //         state.lastResolution !== params.resolution || state.lastShape !== params.shape) {
    //         // Clean up existing GPU meshes
    //         if (state.gpuUncompressedMesh) {
    //             state.gpuUncompressedMesh.cleanup(gl);
    //         }
    //         if (state.gpuQuantizedMesh) {
    //             state.gpuQuantizedMesh.cleanup(gl);
    //         }
    //         state.gpuQuantizedMesh = null;
    //         state.gpuUncompressedMesh = null;

    //         // Generate new meshes
    //         const currentMesh = generateMesh(params.shape, params.resolution);
    //         console.log(`using mesh with ${currentMesh.positions.length / 3} vertices and ${currentMesh.indices.length / 3} triangles`);
    //         if (params.useQuantizedMesh) {
    //             state.gpuQuantizedMesh = new GpuQuantizedMesh(gl, quantizedProgram, currentMesh);
    //         } else {
    //             state.gpuUncompressedMesh = new GpuUncompressedMesh(gl, uncompressedProgram, currentMesh);
    //         }

    //         state.lastResolution = params.resolution;
    //         state.lastShape = params.shape;
    //     }
    // }

    function updateMesh(state: MeshState, currentMesh: Mesh) {
        // Clean up existing GPU meshes
        if (state.gpuUncompressedMesh) {
            state.gpuUncompressedMesh.cleanup(gl);
        }
        if (state.gpuQuantizedMesh) {
            state.gpuQuantizedMesh.cleanup(gl);
        }
        state.gpuQuantizedMesh = null;
        state.gpuUncompressedMesh = null;

        if (params.useQuantizedMesh) {
            state.gpuQuantizedMesh = new GpuQuantizedMesh(gl, quantizedProgram, currentMesh);
        } else {
            state.gpuUncompressedMesh = new GpuUncompressedMesh(gl, uncompressedProgram, currentMesh);
        }

        state.lastResolution = params.resolution;
        state.lastShape = params.shape;
    }


    let rotation = 0;

    async function render() {
        if (params.isPaused) {
            requestAnimationFrame(() => render());
            return;
        }

        if (needToBuildMesh()) {
            const currentMesh = await buildMesh();
            updateMesh(meshState, currentMesh);
        }

        if (!meshState.gpuUncompressedMesh && !meshState.gpuQuantizedMesh) {
            requestAnimationFrame(() => render());
            return;
        }

        performance.beginFrame();

        // updateMesh(meshState);
        resizeCanvasToDisplaySize(canvas);

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.enable(gl.DEPTH_TEST);
        gl.frontFace(gl.CW);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (!params.isPaused) {
            rotation += params.rotationSpeed * 0.005;
        }

        // Update matrices
        mat4.perspective(projectionMatrix, Math.PI / 3, gl.canvas.width / gl.canvas.height, 0.1, 100.0);
        mat4.identity(modelViewMatrix);
        mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -3 + params.zoom]);
        mat4.rotateY(modelViewMatrix, modelViewMatrix, rotation);
        mat4.rotateX(modelViewMatrix, modelViewMatrix, Math.PI / 6);
        mat4.invert(normalMatrix, modelViewMatrix);
        mat4.transpose(normalMatrix, normalMatrix);

        const program = params.useQuantizedMesh ? quantizedProgram : uncompressedProgram;
        gl.useProgram(program);

        // Set uniforms
        const mvLoc = gl.getUniformLocation(program, 'uModelViewMatrix');
        const projLoc = gl.getUniformLocation(program, 'uProjectionMatrix');
        const normalMatLoc = gl.getUniformLocation(program, 'uNormalMatrix');
        const lightPosLoc = gl.getUniformLocation(program, 'uLightPosition');
        const albedoLoc = gl.getUniformLocation(program, 'uAlbedoMap');
        const normalMapLoc = gl.getUniformLocation(program, 'uNormalMap');
        const displayModeLoc = gl.getUniformLocation(program, 'uDisplayMode');

        gl.uniformMatrix4fv(mvLoc, false, modelViewMatrix);
        gl.uniformMatrix4fv(projLoc, false, projectionMatrix);
        gl.uniformMatrix4fv(normalMatLoc, false, normalMatrix);
        gl.uniform1i(displayModeLoc, params.displayMode === 'normal' ? 1 : params.displayMode === 'tangent' ? 2 : params.displayMode === 'uv' ? 3 : 0);
        gl.uniform3f(lightPosLoc, 2, 2, 2);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, albedoTexture);
        gl.uniform1i(albedoLoc, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, normalTexture);
        gl.uniform1i(normalMapLoc, 1);

        // Set up and draw mesh
        let indexCount: number;
        if (params.useQuantizedMesh) {
            indexCount = meshState.gpuQuantizedMesh?.bind(gl) ?? 0;
        } else {
            indexCount = meshState.gpuUncompressedMesh?.bind(gl) ?? 0;
        }

        if (indexCount > 0) {
            gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
        }

        performance.endFrame();
        performance.checkQueryResults();

        // Update performance display if needed
        if (performance.shouldUpdateDisplay()) {
            const numVertices = params.useQuantizedMesh ? meshState.gpuQuantizedMesh?.numVertices ?? 0 : meshState.gpuUncompressedMesh?.numVertices ?? 0;
            const numIndices = params.useQuantizedMesh ? meshState.gpuQuantizedMesh?.numIndices ?? 0 : meshState.gpuUncompressedMesh?.numIndices ?? 0;
            const vertexBytes = params.useQuantizedMesh ? meshState.gpuQuantizedMesh?.vertexBytes ?? 0 : meshState.gpuUncompressedMesh?.vertexBytes ?? 0;
            performance.updateDisplay(numVertices, numIndices / 3, vertexBytes);
        }

        requestAnimationFrame(() => render());
    }

    // Start the render loop
    render();

    // Clean up resources when the page is unloaded
    window.addEventListener('unload', () => {
        if (meshState.gpuUncompressedMesh) {
            meshState.gpuUncompressedMesh.cleanup(gl);
        }
        if (meshState.gpuQuantizedMesh) {
            meshState.gpuQuantizedMesh.cleanup(gl);
        }
        performance.cleanup();
    });
}

// const normalTest = vec3.fromValues(
//     0.5773502588272095,
//     -0.5773502588272095,
//     0.5773502588272095
// );
// const tangentTest = vec3.fromValues(
//     0.40824827551841736,
//     -0.40824827551841736,
//     -0.8164966106414795
// );
// const tangentSignTest = 1;
// testTangentEncoding(normalTest, tangentTest, tangentSignTest);
main();
