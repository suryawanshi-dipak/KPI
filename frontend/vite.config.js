import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
})
