import { mat4, vec3, vec4 } from 'gl-matrix';
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
    fragmentShader
} from './shaders';
import {
    standardAngle16BitVertexShader,
    quaternion12BitVertexShader,
    //    compact12BitVertexShader,
} from './quantizedShaders';
import { generateMesh } from './mesh';
import { QuantizationFormat } from './quantize';
import { testTangentEncoding } from './tangentEncoding';

interface UIParams {
    resolution: number;
    rotationSpeed: number;
    shape: ShapeType;
    isPaused: boolean;
    displayMode: 'default' | 'normal' | 'tangent' | 'uv';
    zoom: number;
    version: string;
    quantizationFormat: QuantizationFormat;
}

function getUrlParams(): Partial<UIParams> {
    const params = new URLSearchParams(window.location.search);
    const resolution = params.get('resolution');
    const shape = params.get('shape') as ShapeType | null;
    const rotationSpeed = params.get('rotationSpeed');
    const isPaused = params.get('isPaused');
    const displayMode = params.get('displayMode') as 'default' | 'normal' | 'tangent' | 'uv' | null;
    const zoom = params.get('zoom');
    const quantizationFormat = params.get('quantizationFormat') as QuantizationFormat | null;

    return {
        resolution: resolution ? Math.min(Math.max(parseInt(resolution), 512), 8192) : undefined,
        shape: shape && ['sphere', 'wavySphere', 'roundedBox'].includes(shape) ? shape : undefined,
        rotationSpeed: rotationSpeed ? parseFloat(rotationSpeed) : undefined,
        isPaused: isPaused ? isPaused === 'true' : undefined,
        displayMode: displayMode ?? 'default',
        zoom: zoom ? parseFloat(zoom) : undefined,
        quantizationFormat: quantizationFormat && Object.values(QuantizationFormat).includes(quantizationFormat) ? quantizationFormat : QuantizationFormat.Uncompressed
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
    lastQuantizationFormat: QuantizationFormat | null;
    isBuildingMesh: boolean;
    program: WebGLProgram | null;
}

function main() {

    // Let's test the encoding for a specific vertex (e.g., at lat=45°, lon=30°)
    // @ts-ignore
    window.testTangentEncoding = testTangentEncoding;
    testTangentEncoding(vec3.fromValues(0.6124, 0.7071, 0.3536), vec4.fromValues(-0.5000, 0.0000, 0.8660, -1.0));
    console.info('%cTest different encoding of tangents/normal with the function window.testTangentEncoding in the console eg: \nwindow.testTangentEncoding([0.6124, 0.7071, 0.3536], [0.5000, 0.0000, 0.8660, -1.0]);', 'color: #00EE00');
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
        shape: urlParams.shape ?? 'sphere',
        isPaused: urlParams.isPaused ?? false,
        displayMode: urlParams.displayMode ?? 'default',
        zoom: urlParams.zoom ?? 0.1,
        version: 'v2',
        quantizationFormat: urlParams.quantizationFormat ?? QuantizationFormat.Angle16Bits
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

    pane.addBinding(params, 'isPaused', {
        label: 'Pause'
    });

    pane.addBinding(params, 'quantizationFormat', {
        options: {
            'None': QuantizationFormat.Uncompressed,
            'Angle 16-bit': QuantizationFormat.Angle16Bits,
            'QTangent 12-bit': QuantizationFormat.Quaternion12Bits
        },
        label: 'Quantization Format'
    });

    // Update URL when parameters change
    pane.on('change', () => {
        updateUrlParams(params);
    });


    const programs = {
        [QuantizationFormat.Uncompressed]: createProgram(
            gl,
            createShader(gl, gl.VERTEX_SHADER, uncompressedVertexShader),
            createShader(gl, gl.FRAGMENT_SHADER, fragmentShader)
        ),
        [QuantizationFormat.Angle16Bits]: createProgram(
            gl,
            createShader(gl, gl.VERTEX_SHADER, standardAngle16BitVertexShader),
            createShader(gl, gl.FRAGMENT_SHADER, fragmentShader)
        ),
        [QuantizationFormat.Quaternion12Bits]: createProgram(
            gl,
            createShader(gl, gl.VERTEX_SHADER, quaternion12BitVertexShader),
            createShader(gl, gl.FRAGMENT_SHADER, fragmentShader)
        )
    };


    // Create textures
    const size = 256;
    const albedoTexture = createTexture(gl, size, size, generateRandomTexture(size, size));
    const normalTexture = createTexture(gl, size, size, generateRandomNormalMap(size, size));

    // Create matrices
    const modelViewMatrix = mat4.create();
    const projectionMatrix = mat4.create();
    const normalMatrix = mat4.create();

    const commonUniforms = [
        'uModelViewMatrix',
        'uProjectionMatrix',
        'uNormalMatrix',
        'uLightPosition',
        'uAlbedoMap',
        'uNormalMap',
        'uDisplayMode'
    ];


    // Add buffer tracking
    const meshState: MeshState = {
        gpuUncompressedMesh: null,
        gpuQuantizedMesh: null,
        lastResolution: -1,
        lastShape: null,
        lastQuantizationFormat: null,
        isBuildingMesh: false,
        program: null
    };

    async function buildMesh() {
        const currentMesh = await generateMesh(params.shape, params.resolution, params.quantizationFormat);
        console.log(`using mesh ${params.quantizationFormat !== QuantizationFormat.Uncompressed ? 'quantized' : 'uncompressed'} ${currentMesh.numVertices} vertices and ${currentMesh.indices.length / 3} triangles`);
        if (params.quantizationFormat !== QuantizationFormat.Uncompressed) {
            const bytes = currentMesh.quantizedData?.byteLength ?? 0;
            console.log(`Vertex Quantized: ${bytes / 1024 / 1024} MB`);
        } else {
            let bytes = currentMesh?.positions?.byteLength ?? 0;
            console.log(`Vertex Uncompressed Positions: ${bytes / 1024 / 1024} MB`);
            bytes = currentMesh?.normals?.byteLength ?? 0;
            console.log(`Vertex Uncompressed Normals: ${bytes / 1024 / 1024} MB`);
            bytes = currentMesh?.tangents?.byteLength ?? 0;
            console.log(`Vertex Uncompressed Tangents: ${bytes / 1024 / 1024} MB`);
            bytes = currentMesh?.uvs?.byteLength ?? 0;
            console.log(`Vertex Uncompressed UVs: ${bytes / 1024 / 1024} MB`);
        }
        return currentMesh;
    }

    function needToBuildMesh(): boolean {
        return !meshState.isBuildingMesh && (
            (params.quantizationFormat !== QuantizationFormat.Uncompressed && (
                meshState.gpuQuantizedMesh === null ||
                meshState.lastResolution !== params.resolution ||
                meshState.lastShape !== params.shape ||
                meshState.lastQuantizationFormat !== params.quantizationFormat
            )) ||
            (params.quantizationFormat === QuantizationFormat.Uncompressed && (
                meshState.gpuUncompressedMesh === null ||
                meshState.lastResolution !== params.resolution ||
                meshState.lastShape !== params.shape
            ))
        );
    }

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

        if (params.quantizationFormat !== QuantizationFormat.Uncompressed) {
            state.gpuQuantizedMesh = new GpuQuantizedMesh(gl, currentMesh);
        } else {
            state.gpuUncompressedMesh = new GpuUncompressedMesh(gl, currentMesh);
        }

        state.lastResolution = params.resolution;
        state.lastShape = params.shape;
        state.lastQuantizationFormat = params.quantizationFormat;
    }

    let rotation = 0;

    async function startMeshBuild(meshState: MeshState) {
        if (meshState.isBuildingMesh) return;

        meshState.isBuildingMesh = true;
        const currentMesh = await buildMesh();
        updateMesh(meshState, currentMesh);
        meshState.program = programs[params.quantizationFormat];
        meshState.isBuildingMesh = false;
    }

    async function render() {
        if (params.isPaused) {
            requestAnimationFrame(render);
            return;
        }

        if (needToBuildMesh()) {
            startMeshBuild(meshState);
        }

        if (!meshState.gpuUncompressedMesh && !meshState.gpuQuantizedMesh) {
            requestAnimationFrame(render);
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

        let useQuantizedMesh = false;
        if (meshState.isBuildingMesh) {
            // during build state use the last available program
            useQuantizedMesh = meshState.gpuQuantizedMesh ? true : false;
        } else {
            // during normal state use the selected program
            useQuantizedMesh = params.quantizationFormat !== QuantizationFormat.Uncompressed;
        }
        const program = meshState.program;
        if (!program) {
            throw new Error('Program not found');
        }
        gl.useProgram(program);

        // Set up and draw mesh
        let indexCount: number;
        let uniformsLocations: { [key: string]: WebGLUniformLocation };
        if (useQuantizedMesh) {
            if (!meshState.gpuQuantizedMesh) {
                throw new Error('Quantized mesh not found');
            }
            const result = meshState.gpuQuantizedMesh.bind(gl, program, commonUniforms);
            indexCount = result.numIndices;
            uniformsLocations = result.uniformsLocations;
        } else {
            if (!meshState.gpuUncompressedMesh) {
                throw new Error('Uncompressed mesh not found');
            }
            const result = meshState.gpuUncompressedMesh.bind(gl, program, commonUniforms);
            indexCount = result.numIndices;
            uniformsLocations = result.uniformsLocations;
        }

        // Set uniforms
        gl.uniformMatrix4fv(uniformsLocations['uModelViewMatrix'], false, modelViewMatrix);
        gl.uniformMatrix4fv(uniformsLocations['uProjectionMatrix'], false, projectionMatrix);
        gl.uniformMatrix4fv(uniformsLocations['uNormalMatrix'], false, normalMatrix);
        gl.uniform1i(uniformsLocations['uDisplayMode'], params.displayMode === 'normal' ? 1 : params.displayMode === 'tangent' ? 2 : params.displayMode === 'uv' ? 3 : 0);
        gl.uniform3f(uniformsLocations['uLightPosition'], 2, 2, 2);
        gl.uniform1i(uniformsLocations['uAlbedoMap'], 0);
        gl.uniform1i(uniformsLocations['uNormalMap'], 1);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, albedoTexture);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, normalTexture);

        if (indexCount > 0) {
            gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
        }

        performance.endFrame();
        performance.checkQueryResults();

        // Update performance display if needed
        if (performance.shouldUpdateDisplay()) {
            const numVertices = params.quantizationFormat !== QuantizationFormat.Uncompressed ? meshState.gpuQuantizedMesh?.numVertices ?? 0 : meshState.gpuUncompressedMesh?.numVertices ?? 0;
            const numIndices = params.quantizationFormat !== QuantizationFormat.Uncompressed ? meshState.gpuQuantizedMesh?.numIndices ?? 0 : meshState.gpuUncompressedMesh?.numIndices ?? 0;
            const vertexBytes = params.quantizationFormat !== QuantizationFormat.Uncompressed ? meshState.gpuQuantizedMesh?.vertexBytes ?? 0 : meshState.gpuUncompressedMesh?.vertexBytes ?? 0;
            performance.updateDisplay(numVertices, numIndices / 3, vertexBytes, params.quantizationFormat, params.version);
        }

        requestAnimationFrame(render);
    }

    // Start the render loop
    render();
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
