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
    private locations: {
        position: number;
        normal: number;
        tangent: number;
        uv: number;
    };
    numIndices: number;
    numVertices: number;
    vertexBytes: number;

    constructor(
        gl: WebGL2RenderingContext,
        program: WebGLProgram,
        mesh: Mesh
    ) {
        if (!mesh.positions || !mesh.normals || !mesh.tangents || !mesh.uvs || !mesh.indices) {
            throw new Error('Mesh is missing required attributes');
        }

        this.numVertices = mesh.positions.length / 3;
        this.vertexBytes = mesh.vertexBytes;
        this.numIndices = mesh.indices.length;

        // Create buffers
        const positionBuffer = createBuffer(gl, mesh.positions, gl.STATIC_DRAW);
        const normalBuffer = createBuffer(gl, mesh.normals, gl.STATIC_DRAW);
        const tangentBuffer = createBuffer(gl, mesh.tangents, gl.STATIC_DRAW);
        // for (let i = 0; i < mesh.tangents.length / 4; i++) {
        //     const a = mesh.tangents[i * 4 + 0];
        //     const b = mesh.tangents[i * 4 + 1];
        //     const c = mesh.tangents[i * 4 + 2];
        //     const d = mesh.tangents[i * 4 + 3];
        //     console.log(a, b, c, d);
        // }
        const uvBuffer = createBuffer(gl, mesh.uvs, gl.STATIC_DRAW);
        const indexBuffer = createIndexBuffer(gl, mesh.indices, gl.STATIC_DRAW);

        this.buffers = {
            position: positionBuffer,
            normal: normalBuffer,
            tangent: tangentBuffer,
            uv: uvBuffer,
            index: indexBuffer
        };
        // Get attribute locations
        this.locations = {
            position: gl.getAttribLocation(program, 'aPosition'),
            normal: gl.getAttribLocation(program, 'aNormal'),
            tangent: gl.getAttribLocation(program, 'aTangent'),
            uv: gl.getAttribLocation(program, 'aUV')
        };
    }

    bind(gl: WebGL2RenderingContext): number {
        // Set up vertex attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.enableVertexAttribArray(this.locations.position);
        gl.vertexAttribPointer(this.locations.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.normal);
        gl.enableVertexAttribArray(this.locations.normal);
        gl.vertexAttribPointer(this.locations.normal, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.tangent);
        gl.enableVertexAttribArray(this.locations.tangent);
        gl.vertexAttribPointer(this.locations.tangent, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.uv);
        gl.enableVertexAttribArray(this.locations.uv);
        gl.vertexAttribPointer(this.locations.uv, 2, gl.FLOAT, false, 0, 0);

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
    private locations: {
        positionMin: WebGLUniformLocation | null;
        positionMax: WebGLUniformLocation | null;
        compressedData: number[];
    };
    numIndices: number;
    private positionMin: vec3;
    private positionMax: vec3;
    numVertices: number;
    vertexBytes: number;

    constructor(
        gl: WebGL2RenderingContext,
        program: WebGLProgram,
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

        // Get uniform and attribute locations
        this.locations = {
            positionMin: gl.getUniformLocation(program, 'uPositionMin'),
            positionMax: gl.getUniformLocation(program, 'uPositionMax'),
            compressedData: []
        };

        // Get compressed data attribute locations
        for (let i = 0; i < 4; i++) {
            const loc = gl.getAttribLocation(program, `aCompressedData${i}`);
            this.locations.compressedData.push(loc);
        }

        this.numIndices = mesh.indices.length;
        this.positionMin = mesh.positionMin;
        this.positionMax = mesh.positionMax;
    }

    bind(gl: WebGL2RenderingContext): number {
        // Set up vertex attributes for compressed data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.data);

        // Use stored locations
        for (const loc of this.locations.compressedData) {
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribIPointer(loc, 2, gl.UNSIGNED_SHORT, 16, loc * 4);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);

        // Set position bounds uniforms
        gl.uniform3fv(this.locations.positionMin, this.positionMin);
        gl.uniform3fv(this.locations.positionMax, this.positionMax);

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