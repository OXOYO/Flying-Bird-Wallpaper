import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import liveReload from 'vite-plugin-live-reload'
import viteCompression from 'vite-plugin-compression2'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'
// import { analyzer } from 'vite-bundle-analyzer'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// 图标按需加载
import Icons from 'unplugin-icons/vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: resolve(__dirname, 'src/h5'),
  base: './', // 确保资源使用相对路径
  resolve: {
    alias: {
      '@src': resolve('src'),
      '@h5': resolve('src/h5'),
      '@resources': resolve('./resources'),
      '@common': resolve('src/common'),
      '@i18n': resolve('src/i18n')
    }
  },
  plugins: [
    vue(),
    AutoImport({
      // 自动导入 Vue 相关函数，如：ref, reactive, toRef 等
      imports: ['vue', 'pinia'],
      // 按需导入 Vant 组件
      resolvers: [VantResolver()],
      // 生成 TypeScript 声明文件
      dts: './auto-imports.d.ts',
      // 生成 ESLint 配置文件
      eslintrc: {
        enabled: true,
        filepath: './.eslintrc-auto-import.json',
        globalsPropValue: true
      }
    }),
    Components({
      resolvers: [VantResolver()]
    }),
    liveReload(['src/h5/**/*']), // 监听 src 目录下的文件变化
    Icons({
      compiler: 'vue3'
    }),
    viteCompression()
    // analyzer()
  ],
  build: {
    emptyOutDir: true, // 清空 outDir
    outDir: '../../out/h5', // 客户端输出目录
    assetsDir: 'assets', // 静态资源目录，相对outDir
    rollupOptions: {
      input: resolve(__dirname, 'src/h5/index.html') // 客户端入口文件
    }
  }
})
