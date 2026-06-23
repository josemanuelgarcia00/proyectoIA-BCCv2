import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Sin backend propio: ajusta esto al nombre real del repo de GitHub Pages
  // que se cree para este proyecto antes de desplegar (https://<usuario>.github.io/<repo>/).
  base: '/prueba/',
  plugins: [react()],
})
