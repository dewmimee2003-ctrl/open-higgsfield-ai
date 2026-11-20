import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        tailwindcss(),
    ],
    server: {
        proxy: {
            '/api': {
                target: 'https://api.muapi.ai',
                changeOrigin: true,
                secure: false
            },
            '/higgsfield': {
                target: 'https://api.higgsfield.ai',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/higgsfield/, '')
            }
        }
    }
});
