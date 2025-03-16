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

export class GpuUncompressedMesh {
    private buffers: UncompressedBuffers;
    uniformsLocations: Map<WebGLProgram, {
        attributes: {
            position: number;
            normal: number;
            tangent: number;
            uv: number;
        };
    }>;
    numIndices: number;
    numVertices: number;
    vertexBytes: number;

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

        this.uniformsLocations = new Map<WebGLProgram, {
            attributes: {
                position: number;
                normal: number;
                tangent: number;
                uv: number;
            };
        }>();

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

    computeUniformsLocations(gl: WebGL2RenderingContext, program: WebGLProgram): {
        attributes: {
            position: number;
            normal: number;
            tangent: number;
            uv: number;
        }
    } {
        const locations = {
            attributes: {
                position: gl.getAttribLocation(program, 'aPosition'),
                normal: gl.getAttribLocation(program, 'aNormal'),
                tangent: gl.getAttribLocation(program, 'aTangent'),
                uv: gl.getAttribLocation(program, 'aUV')
            }
        };

        return locations;
    }

    bind(gl: WebGL2RenderingContext, program: WebGLProgram): number {
        // Use stored locations
        let uniformsLocations = this.uniformsLocations.get(program);
        if (!uniformsLocations) {
            uniformsLocations = this.computeUniformsLocations(gl, program);
        }

        // Set up vertex attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.enableVertexAttribArray(uniformsLocations.attributes.position);
        gl.vertexAttribPointer(uniformsLocations.attributes.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.normal);
        gl.enableVertexAttribArray(uniformsLocations.attributes.normal);
        gl.vertexAttribPointer(uniformsLocations.attributes.normal, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.tangent);
        gl.enableVertexAttribArray(uniformsLocations.attributes.tangent);
        gl.vertexAttribPointer(uniformsLocations.attributes.tangent, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.uv);
        gl.enableVertexAttribArray(uniformsLocations.attributes.uv);
        gl.vertexAttribPointer(uniformsLocations.attributes.uv, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);

        return this.numIndices;
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
    uniformsLocations: Map<WebGLProgram, {
        positionMin: WebGLUniformLocation | null;
        positionMax: WebGLUniformLocation | null;
        compressedData: number[];
    }>;

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

        this.uniformsLocations = new Map<WebGLProgram, {
            positionMin: WebGLUniformLocation | null;
            positionMax: WebGLUniformLocation | null;
            compressedData: number[];
        }>();


        this.numIndices = mesh.indices.length;
        this.positionMin = mesh.positionMin;
        this.positionMax = mesh.positionMax;
    }
    computeUniformsLocations(gl: WebGL2RenderingContext, program: WebGLProgram): {
        positionMin: WebGLUniformLocation | null;
        positionMax: WebGLUniformLocation | null;
        compressedData: number[];
    } {
        const uniformsLocations = {
            positionMin: gl.getUniformLocation(program, 'uPositionMin'),
            positionMax: gl.getUniformLocation(program, 'uPositionMax'),
            compressedData: [] as number[]
        };

        for (let i = 0; i < 4; i++) {
            const loc = gl.getAttribLocation(program, `aCompressedData${i}`);
            uniformsLocations.compressedData.push(loc);
        }

        this.uniformsLocations.set(program, uniformsLocations);
        return uniformsLocations;
    }

    bind(gl: WebGL2RenderingContext, program: WebGLProgram): number {
        // Set up vertex attributes for compressed data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.data);

        // Use stored locations
        let uniformsLocations = this.uniformsLocations.get(program);
        if (!uniformsLocations) {
            uniformsLocations = this.computeUniformsLocations(gl, program);
        }

        for (let i = 0; i < 4; i++) {
            const loc = uniformsLocations.compressedData[i];
            gl.enableVertexAttribArray(i);
            gl.vertexAttribIPointer(loc, 2, gl.UNSIGNED_SHORT, 16, i * 4);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);

        // Set position bounds uniforms
        gl.uniform3fv(uniformsLocations.positionMin, this.positionMin);
        gl.uniform3fv(uniformsLocations.positionMax, this.positionMax);

        return this.numIndices;
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