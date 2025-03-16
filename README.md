# WebGL2 Mesh Quantization Performance Test

This project demonstrates the performance difference between uncompressed and quantized mesh attributes in WebGL2.

## Features
- Procedurally generated rounded cube with adjustable resolution
- Two rendering modes:
  - Uncompressed: Standard floating-point attributes
  - Quantized: Compressed vertex attributes using 16-bit quantization
- Real-time performance monitoring with Stats.js
- Interactive controls with Tweakpane
- Normal mapping and lighting

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually http://localhost:5173)

## Controls

- Resolution: Adjust the mesh resolution (512-4096)
- Use Quantized Mesh: Toggle between uncompressed and quantized mesh rendering
- Rotation Speed: Control the rotation speed of the model

## Technical Details

### Uncompressed Mesh Format: 48 bytes
- Positions: vec3 (x,y,z)
- Normals: vec3 (x,y,z)
- Tangents: vec4 (x,y,z,w)
- UVs: vec2 (u,v)

### Quantized Mesh Format 1: 16 bytes
- Positions: 3x16bits (quantized on mesh bounding box)
- Normals: 2x16bits (octahedral encoding)
- Tangents: 1x16bits (1 bit sign + 15 bits angle)
- UVs: 2x16bits (quantized 0-1 range)

### Quantized Mesh Format 2: 16 bytes
this one require to have tangent frame without sign meaning splitting vertexes if needed
https://www.jeremyong.com/graphics/2023/01/09/tangent-spaces-and-diamond-encoding/
- Positions: 3x16bits (quantized on mesh bounding box)
- Normals: 2x12bits (octahedral encoding)
- Tangents: 2x12bits (octahedral encoding)
- UVs: 2x16bits (quantized 0-1 range)

### Quantized Mesh Format 3: 16 bytes
- Positions: 3x16bits (quantized on mesh bounding box)
- Quat: 4x12bits (tbn packer)[https://github.com/fuzhenn/tbn-packer]
- UVs: 2x16bits (quantized 0-1 range)

Total: 8x16bits per vertex (16 bytes) vs 48 bytes for uncompressed format
