import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const platformImportMapPlugin = (): Plugin => ({
  name: 'platform-gateway-importmap',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      const injection = [
        '    <link rel="stylesheet" href="/api/v1/platform/theme.css" />',
        '    <script type="importmap">',
        '      {',
        '        "imports": {',
        '          "react": "/api/v1/platform/react-shim.js",',
        '          "react-dom": "/api/v1/platform/react-dom-shim.js",',
        '          "react/jsx-runtime": "/api/v1/platform/jsx-runtime-shim.js",',
        '          "@platform/ui-sdk": "/api/v1/platform/ui-sdk.js"',
        '        }',
        '      }',
        '    </script>',
      ].join('\n');
      return html.replace('<head>', `<head>\n${injection}`);
    },
  },
});

export default defineConfig({
  plugins: [react(), platformImportMapPlugin()],
  resolve: {
    alias: {
      react: path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../embed_dist'),
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      external: ['@platform/ui-sdk'],
      output: {
        entryFileNames: 'assets/index-DFLG7QY4.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/index-DsNRyJVy[extname]',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
