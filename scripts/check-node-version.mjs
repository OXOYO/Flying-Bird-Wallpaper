const m = process.version.match(/^v(\d+)\.(\d+)\.(\d+)/)
const major = m ? Number(m[1]) : 0
const minor = m ? Number(m[2]) : 0

const satisfied = major > 22 || (major === 22 && minor >= 12)

if (!satisfied) {
  console.error(
    `\n[飞鸟壁纸] 当前 Node.js ${process.version} 无法运行本项目（需要 >= 22.12.0）。\n` +
      `原因：Vite 7 / Vue 编译依赖 crypto.hash 等新 API，Node 18 会报 crypto.hash is not a function。\n\n` +
      `解决：\n` +
      `  1. 安装 Node 22 LTS：https://nodejs.org/\n` +
      `  2. 关闭并重新打开 PowerShell，执行 node -v 确认 >= v22.12.0\n` +
      `  3. 再运行 npm run dev:win\n\n` +
      `若已安装 nvm-windows：nvm install 22.12.0 && nvm use 22.12.0\n`
  )
  process.exit(1)
}
