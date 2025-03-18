import { vec3 } from 'gl-matrix';
import { Mesh } from './mesh';
import { createBuffer, createIndexBuffer } from './webgl';

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

interface ProgramInfos {
    attributes: { [key: string]: number };
    uniforms: { [key: string]: WebGLUniformLocation };
}


function getUniformsLocations(gl: WebGL2RenderingContext, program: WebGLProgram, uniforms: string[]): { [key: string]: WebGLUniformLocation } {
    const uniformsLocations: { [key: string]: WebGLUniformLocation } = {};
    for (const uniform of uniforms) {
        const loc = gl.getUniformLocation(program, uniform);
        if (!loc) {
            throw new Error(`Uniform ${uniform} not found`);
        }
        uniformsLocations[uniform] = loc;
    }
    return uniformsLocations;
}

function getAttributesLocations(gl: WebGL2RenderingContext, program: WebGLProgram, attributes: string[]): { [key: string]: number } {
    const attributesLocations: { [key: string]: number } = {};
    for (const attribute of attributes) {
        const loc = gl.getAttribLocation(program, attribute);
        if (loc !== -1) {
            attributesLocations[attribute] = loc;
        }
    }
    return attributesLocations;
}

export class GpuUncompressedMesh {
    private buffers: UncompressedBuffers;
    uniformsLocations: Map<WebGLProgram, ProgramInfos>;
    numIndices: number;
    numVertices: number;
    vertexBytes: number;
    result: { numIndices: number, uniformsLocations: { [key: string]: WebGLUniformLocation } };

    constructor(
        gl: WebGL2RenderingContext,
        mesh: Mesh
    ) {
        if (!mesh.positions || !mesh.normals || !mesh.tangents || !mesh.uvs || !mesh.indices) {
            throw new Error('Mesh is missing required attributes');
        }

        this.numVertices = mesh.positions.length / 3;
        this.vertexBytes = mesh.vertexBytes;
        this.numIndices = mesh.indices.length;

        this.uniformsLocations = new Map<WebGLProgram, ProgramInfos>();
        this.result = { numIndices: 0, uniformsLocations: {} };
        // Create buffers
        const positionBuffer = createBuffer(gl, mesh.positions, gl.STATIC_DRAW);
        const normalBuffer = createBuffer(gl, mesh.normals, gl.STATIC_DRAW);
        const tangentBuffer = createBuffer(gl, mesh.tangents, gl.STATIC_DRAW);

        const uvBuffer = createBuffer(gl, mesh.uvs, gl.STATIC_DRAW);
        const indexBuffer = createIndexBuffer(gl, mesh.indices, gl.STATIC_DRAW);

        this.buffers = {
            position: positionBuffer,
            normal: normalBuffer,
            tangent: tangentBuffer,
            uv: uvBuffer,
            index: indexBuffer
        };
    }

    computeUniformsLocations(gl: WebGL2RenderingContext, program: WebGLProgram, commonUniformsNames: string[]): ProgramInfos {
        const locations = {
            attributes: getAttributesLocations(gl, program, ['aPosition', 'aNormal', 'aTangent', 'aUV']),
            uniforms: getUniformsLocations(gl, program, commonUniformsNames)
        };

        return locations;
    }

    bind(gl: WebGL2RenderingContext, program: WebGLProgram, commonUniformsNames: string[]): { numIndices: number, uniformsLocations: { [key: string]: WebGLUniformLocation } } {
        // Use stored locations
        let uniformsLocations = this.uniformsLocations.get(program);
        if (!uniformsLocations) {
            uniformsLocations = this.computeUniformsLocations(gl, program, commonUniformsNames);
            this.uniformsLocations.set(program, uniformsLocations);
        }

        // Set up vertex attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.enableVertexAttribArray(uniformsLocations.attributes['aPosition']);
        gl.vertexAttribPointer(uniformsLocations.attributes['aPosition'], 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.normal);
        gl.enableVertexAttribArray(uniformsLocations.attributes['aNormal']);
        gl.vertexAttribPointer(uniformsLocations.attributes['aNormal'], 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.tangent);
        gl.enableVertexAttribArray(uniformsLocations.attributes['aTangent']);
        gl.vertexAttribPointer(uniformsLocations.attributes['aTangent'], 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.uv);
        gl.enableVertexAttribArray(uniformsLocations.attributes['aUV']);
        gl.vertexAttribPointer(uniformsLocations.attributes['aUV'], 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);

        this.result.numIndices = this.numIndices;
        this.result.uniformsLocations = uniformsLocations.uniforms;

        return this.result;
    }

    cleanup(gl: WebGL2RenderingContext): void {
        for (const key in this.buffers) {
            const buffer = (this.buffers as any)[key] as WebGLBuffer;
            if (buffer) {
                gl.deleteBuffer(buffer);
            }
        }
    }
}

export class GpuQuantizedMesh {
    private buffers: QuantizedBuffers;
    numIndices: number;
    private positionMin: vec3;
    private positionMax: vec3;
    numVertices: number;
    vertexBytes: number;
    uniformsLocations: Map<WebGLProgram, ProgramInfos>;
    result: { numIndices: number, uniformsLocations: { [key: string]: WebGLUniformLocation } };

    constructor(
        gl: WebGL2RenderingContext,
        mesh: Mesh
    ) {

        if (!mesh.quantizedData || !mesh.positionMin || !mesh.positionMax) {
            throw new Error('Mesh is missing quantized data or position bounds');
        }

        //const quantizedMesh = quantizeMesh(mesh);
        this.vertexBytes = mesh.vertexBytes;
        this.numVertices = mesh.numVertices;
        // Create buffers
        const dataBuffer = createBuffer(gl, mesh.quantizedData, gl.STATIC_DRAW);
        const indexBuffer = createIndexBuffer(gl, mesh.indices, gl.STATIC_DRAW);

        this.buffers = {
            data: dataBuffer,
            index: indexBuffer
        };

        this.result = { numIndices: 0, uniformsLocations: {} };

        this.uniformsLocations = new Map<WebGLProgram, ProgramInfos>();

        this.numIndices = mesh.indices.length;
        this.positionMin = mesh.positionMin;
        this.positionMax = mesh.positionMax;
    }

    computeUniformsLocations(gl: WebGL2RenderingContext, program: WebGLProgram, commonUniformsNames: string[]): ProgramInfos {
        const uniformsLocations = {
            attributes: getAttributesLocations(gl, program, ['aCompressedData0', 'aCompressedData1', 'aCompressedData2', 'aCompressedData3']),
            uniforms: getUniformsLocations(gl, program, ['uPositionMin', 'uPositionMax', ...commonUniformsNames])
        };

        this.uniformsLocations.set(program, uniformsLocations);
        return uniformsLocations;
    }

    bind(gl: WebGL2RenderingContext, program: WebGLProgram, commonUniformsNames: string[]): { numIndices: number, uniformsLocations: { [key: string]: WebGLUniformLocation } } {
        // Set up vertex attributes for compressed data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.data);

        // Use stored locations
        let uniformsLocations = this.uniformsLocations.get(program);
        if (!uniformsLocations) {
            uniformsLocations = this.computeUniformsLocations(gl, program, commonUniformsNames);
            this.uniformsLocations.set(program, uniformsLocations);
        }

        for (let i = 0; i < 4; i++) {
            const loc = uniformsLocations.attributes[`aCompressedData${i}`];
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribIPointer(loc, 2, gl.UNSIGNED_SHORT, 16, i * 4);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);

        // Set position bounds uniforms
        gl.uniform3fv(uniformsLocations.uniforms['uPositionMin'], this.positionMin);
        gl.uniform3fv(uniformsLocations.uniforms['uPositionMax'], this.positionMax);

        this.result.numIndices = this.numIndices;
        this.result.uniformsLocations = uniformsLocations.uniforms;

        return this.result;
    }

    cleanup(gl: WebGL2RenderingContext): void {
        for (const key in this.buffers) {
            const buffer = (this.buffers as any)[key] as WebGLBuffer;
            if (buffer) {
                gl.deleteBuffer(buffer);
            }
        }
    }
}