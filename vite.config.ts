import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Build configuration
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          clerk: ['@clerk/clerk-react'],
          sentry: ['@sentry/react'],
        },
      },
    },
  },
  
  // Development server
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  
  // Preview server
  preview: {
    port: 4173,
    strictPort: true,
  },
  
  // Dependency optimization
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
  },
  
  // Environment variable prefix
  envPrefix: 'VITE_',
  
  // Resolve aliases (optional)
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
