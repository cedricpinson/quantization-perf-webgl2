import { defineConfig } from 'vite';

export default defineConfig({
    worker: {
        format: 'es'
    },
    server: {
        open: true
    },
    build: {
        target: 'esnext',
        rollupOptions: {
            output: {
                format: 'es'
            }
        }
    }
});