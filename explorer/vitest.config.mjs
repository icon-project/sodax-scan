import { defineConfig } from 'vitest/config'
import { transformWithEsbuild } from 'vite'
import path from 'node:path'

// lib/*.js contains JSX; parse project .js files as JSX before import analysis.
const jsxInJs = {
    name: 'jsx-in-js',
    enforce: 'pre',
    async transform(code, id) {
        if (!/\/(lib|components|app)\/.*\.js$/.test(id) || id.includes('node_modules')) return null
        return transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' })
    }
}

export default defineConfig({
    plugins: [jsxInJs],
    resolve: {
        alias: {
            '@': path.resolve(__dirname),
            'next/link': path.resolve(__dirname, 'test/stubs/next-link.jsx'),
            'next/image': path.resolve(__dirname, 'test/stubs/next-image.jsx')
        }
    },
    test: {
        // Cap workers: this machine has 16 GB; uncapped runners froze it.
        maxWorkers: 3,
        minWorkers: 1
    }
})
