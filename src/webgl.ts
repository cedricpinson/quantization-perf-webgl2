export function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
        gl.deleteShader(shader);
        throw new Error('Shader compilation failed');
    }

    return shader;
}

export function createProgram(gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(`Program link error: ${gl.getProgramInfoLog(program)}`);
        gl.deleteProgram(program);
        throw new Error('Program linking failed');
    }

    return program;
}

export function createTexture(gl: WebGL2RenderingContext, width: number, height: number, data: Uint8Array): WebGLTexture {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return texture;
}

export function generateRandomTexture(width: number, height: number): Uint8Array {
    const data = new Uint8Array(width * height * 4);
    const frequency = 8;
    const octaves = 8;

    // Generate multiple octaves of perlin-like noise
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let value = 0;
            let amplitude = 1;
            let maxValue = 0;

            // Sum multiple frequencies
            for (let o = 0; o < octaves; o++) {
                const nx = x * frequency * Math.pow(2, o) / width;
                const ny = y * frequency * Math.pow(2, o) / height;

                // Smooth noise using cosine interpolation
                const noise = Math.cos(nx + ny * 1.5) * Math.cos(ny - nx * 0.8);
                value += noise * amplitude;
                maxValue += amplitude;
                amplitude *= 0.5;
            }

            // Normalize and scale to color range
            value = (value / maxValue) * 0.5 + 0.5;

            const i = (y * width + x) * 4;
            // Create a nice color gradient
            data[i] = Math.floor(128 + value * 64);     // R: warmer tones
            data[i + 1] = Math.floor(128 + value * 48); // G: medium variation
            data[i + 2] = Math.floor(128 + value * 96); // B: stronger variation
            data[i + 3] = 255;                          // A
        }
    }
    return data;
}

export function generateRandomNormalMap(width: number, height: number): Uint8Array {
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        // Generate random perturbations in tangent space (x,y are offsets, z points up)
        const x = (Math.random() * 0.4 - 0.2); // Small x offset (-0.2 to 0.2)
        const y = (Math.random() * 0.4 - 0.2); // Small y offset (-0.2 to 0.2)
        const z = Math.sqrt(1 - Math.min(x * x + y * y, 1)); // Up vector

        // Store as normalized RGB values (0.5,0.5,1.0 is neutral normal)
        data[i] = (x * 0.5 + 0.5) * 255;     // R: tangent offset
        data[i + 1] = (y * 0.5 + 0.5) * 255; // G: bitangent offset
        data[i + 2] = z * 255;               // B: up vector
        data[i + 3] = 255;                    // A
    }
    return data;
}

export function createBuffer(gl: WebGL2RenderingContext, data: ArrayBuffer, usage: number): WebGLBuffer {
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // const chunkSize = 128 * 1024 * 1024; // 128MB in bytes
    const totalSize = data.byteLength;

    // First allocate the full buffer
    console.log(`Allocating Vertex Buffer ${totalSize / 1024 / 1024} MB`);
    gl.bufferData(gl.ARRAY_BUFFER, totalSize, usage);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);

    // // Then upload in chunks
    // for (let offset = 0; offset < totalSize; offset += chunkSize) {
    //     const chunk = new Uint8Array(data, offset, Math.min(chunkSize, totalSize - offset));
    //     gl.bufferSubData(gl.ARRAY_BUFFER, offset, chunk);
    // }
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
        console.error('WebGL error after buffer allocation:', error);
        throw new Error('Failed to allocate WebGL buffer');
    }

    return buffer;
}

export function createIndexBuffer(gl: WebGL2RenderingContext, data: Uint32Array, usage: number): WebGLBuffer {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, usage);
    return buffer;
}

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): boolean {
    const dpr = window.devicePixelRatio;
    const displayWidth = Math.round(canvas.clientWidth * dpr);
    const displayHeight = Math.round(canvas.clientHeight * dpr);

    const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;
    if (needResize) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
    return needResize;
}