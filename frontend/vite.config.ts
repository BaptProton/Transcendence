import { defineConfig, Plugin } from 'vite';
import path from 'path';

function cssBeforeJsPlugin(): Plugin {
  return {
    name: 'css-before-js',
    enforce: 'post',
    transformIndexHtml(html) {
      const scriptTags: string[] = [];
      const cssTags: string[] = [];

      const scriptRegex = /<script[^>]*type="module"[^>]*><\/script>/g;
      const cssRegex = /<link[^>]*rel="stylesheet"[^>]*>/g;

      let match;
      while ((match = scriptRegex.exec(html)) !== null) {
        scriptTags.push(match[0]);
      }
      while ((match = cssRegex.exec(html)) !== null) {
        cssTags.push(match[0]);
      }

      html = html.replace(scriptRegex, '');
      html = html.replace(cssRegex, '');

      const headCloseTag = '</head>';
      const headCloseIndex = html.indexOf(headCloseTag);

      if (headCloseIndex !== -1) {
        const allTags = [...cssTags, ...scriptTags].join('\n  ');
        html = html.slice(0, headCloseIndex) + '  ' + allTags + '\n' + html.slice(headCloseIndex);
      }

      return html;
    }
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    hmr: {
      clientPort: 5173,
    },
  },
  plugins: [cssBeforeJsPlugin()],
});
