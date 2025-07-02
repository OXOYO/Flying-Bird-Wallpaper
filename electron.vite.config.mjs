import { resolve, join, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
// ELEMENT-PLUS 按需加载
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
// 图标按需加载
import Icons from 'unplugin-icons/vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 动态获取多页入口
const getEntry = () => {
  const pageEntry = {}
  const entries = fg.globSync('./src/renderer/windows/**/index.html')
  entries.forEach((entry) => {
    const pathArr = entry.split(sep)
    const name = pathArr[pathArr.length - 2]
    if (name) {
      pageEntry[name] = join(process.cwd(), `/src/renderer/windows/${name}/index.html`)
    }
  })
  delete pageEntry.pages
  delete pageEntry.index
  return pageEntry
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@src': resolve('src'),
        '@renderer': resolve('src/renderer'),
        '@resources': resolve('./resources'),
        '@common': resolve('src/common'),
        '@i18n': resolve('src/i18n')
      }
    },
    plugins: [
      vue(),
      // 自动导入
      AutoImport({
        // 自动导入 Vue 相关函数，如：ref, reactive, toRef 等
        imports: ['vue', 'pinia'],
        dts: './auto-imports.d.ts',
        resolvers: [
          // 自动导入 Element Plus 相关函数，如：ElMessage, ElMessageBox... (带样式)
          ElementPlusResolver({ importStyle: 'sass' })
        ],
        // eslint报错解决
        eslintrc: {
          enabled: true,
          filepath: './.eslintrc-auto-import.json',
          globalsPropValue: true
        }
      }),
      // 组件注册
      Components({
        // 自动导入全局自定义组件
        dirs: [resolve(__dirname, 'src/renderer/components')],
        // 指定文件扩展名
        extensions: ['vue'],
        // 开启深度扫描
        deep: true,
        resolvers: [
          // 自动导入 Element Plus 组件
          ElementPlusResolver({ importStyle: 'sass' })
        ]
      }),
      // 图标按需加载
      Icons({
        compiler: 'vue3',
        autoInstall: true
      })
    ],
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "@renderer/assets/custom.scss" as *;',
          silenceDeprecations: ['legacy-js-api']
        }
      }
    },
    build: {
      rollupOptions: {
        input: getEntry()
      }
    }
  }
})
