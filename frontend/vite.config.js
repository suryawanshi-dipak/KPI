import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // jsxRuntime explicit because Vitest's SSR-style transform pipeline doesn't reliably
    // auto-detect the automatic runtime the way `vite dev`/`vite build` do — without this,
    // component files fail under vitest with "React is not defined" despite building fine.
    react({ jsxRuntime: 'automatic' }),
    {
      name: 'redirect-to-trailing-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Redirect requests from /kpi (without trailing slash) to /kpi/
          if (req.url === '/kpi') {
            res.writeHead(301, { Location: '/kpi/' });
            res.end();
          } else {
            next();
          }
        });
      }
    }
  ],
  base: '/kpi/',
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  },
})
