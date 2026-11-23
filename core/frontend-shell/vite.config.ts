import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function collectFilesSorted(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesSorted(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function computeDeterministicBuildStamp(): string {
  const hash = crypto.createHash('sha256');
  const roots = [
    path.resolve(__dirname, '../../ui-sdk/src'),
    path.resolve(__dirname, './src'),
  ];
  for (const rootDir of roots) {
    for (const file of collectFilesSorted(rootDir)) {
      hash.update(path.relative(__dirname, file));
      hash.update(fs.readFileSync(file));
    }
  }
  return hash.digest('hex').slice(0, 10);
}

const buildStamp = computeDeterministicBuildStamp();

const platformImportMapPlugin = (): Plugin => ({
  name: 'platform-gateway-importmap',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      const injection = [
        `    <link rel="stylesheet" href="/assets/index-DsNRyJVy.css?v=${buildStamp}" />`,
        '    <script type="importmap">',
        '      {',
        '        "imports": {',
        `          "react": "/api/v1/platform/react-shim.js?v=${buildStamp}",`,
        `          "react-dom": "/api/v1/platform/react-dom-shim.js?v=${buildStamp}",`,
        `          "react/jsx-runtime": "/api/v1/platform/jsx-runtime-shim.js?v=${buildStamp}",`,
        `          "@platform/ui-sdk": "/api/v1/platform/ui-sdk.js?v=${buildStamp}"`,
        '        }',
        '      }',
        '    </script>',
      ].join('\n');
      return html
        .replace('</title>', `</title>\n${injection}`)
        .replace('/assets/index-DFLG7QY4.js', `/assets/index-DFLG7QY4.js?v=${buildStamp}`);
    },
  },
  closeBundle() {
    const outDir = path.resolve(__dirname, '../embed_dist');
    const entryJs = path.join(outDir, 'assets/index-DFLG7QY4.js');
    if (fs.existsSync(entryJs)) {
      const raw = fs.readFileSync(entryJs, 'utf8');
      const patched = raw.replace(/\.\/bootstrap\.js(\?v=[a-f0-9]+)?/g, `./bootstrap.js?v=${buildStamp}`);
      fs.writeFileSync(entryJs, patched, 'utf8');
    }
    const themeSrc = path.resolve(__dirname, '../../ui-sdk/src/styles/theme.css');
    const themeDst = path.join(outDir, 'assets/index-DsNRyJVy.css');
    if (fs.existsSync(themeSrc)) {
      fs.copyFileSync(themeSrc, themeDst);
    }
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
