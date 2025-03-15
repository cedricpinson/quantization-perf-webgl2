import { defineConfig } from 'vite';

export default defineConfig({
    worker: {
        format: 'es'
    },
    server: {
        open: true
    },
    base: '/quantization-perf-webgl2',
    build: {
        sourcemap: true,
        outDir: 'dist',
        assetsDir: 'assets',
        target: 'esnext',
        rollupOptions: {
            output: {
                format: 'es'
            }
        }
    }
});