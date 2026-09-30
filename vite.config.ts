import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `base: './'` makes the build work under https://<user>.github.io/<repo>/
// without hard-coding the repository name.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
