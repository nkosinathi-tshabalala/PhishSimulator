import { defineConfig, type Plugin } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function figmaAssetResolver(): Plugin {
  return {
    name: 'figma-asset-resolver',

    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }

      return null
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),

    // Required for React
    react(),

    // Required for Tailwind CSS v4
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  // File types to support raw imports.
  // Never add .css, .tsx, or .ts files here.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})