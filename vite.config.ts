import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

function pathResolve(dir: string) {
  return resolve(process.cwd(), '.', dir)
}

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.app.json',
      rollupTypes: true,
      outDir: 'dist',
      include: ['lib/**/*.ts']
    })
  ],
  resolve: {
    alias: [
      {
        find: /@\//,
        replacement: pathResolve('lib') + '/'
      },
      {
        find: /#\//,
        replacement: pathResolve('types') + '/'
      }
    ]
  },
  build: {
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        },
        exports: 'named'
      }
    },
    lib: {
      entry: pathResolve('lib/index.ts'),
      name: 'WS',
      fileName: 'index',
      formats: ['es', 'umd']
    }
  }
})
