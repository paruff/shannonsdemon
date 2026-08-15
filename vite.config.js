import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const commit = process.env.GITHUB_SHA || 'local';

export default defineConfig({
  base: '/shannonsdemon/',
  plugins: [react()],
  define: {
    __VERSION__: JSON.stringify(process.env.npm_package_version),
    __COMMIT__: JSON.stringify(commit),
    __COMMIT_SHORT__: JSON.stringify(commit.slice(0, 7)),
  },
});
