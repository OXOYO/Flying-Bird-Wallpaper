import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 获取命令行参数中的版本号
const newVersion = process.argv[2]

// 验证版本号格式
const versionRegex =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/
if (!versionRegex.test(newVersion)) {
  console.error('版本号格式无效，请使用语义化版本格式，例如: 1.0.0, 1.0.0-alpha, 1.0.0-beta.1')
  process.exit(1)
}

// 更新package.json中的版本号
const packageJsonPath = path.join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
packageJson.version = newVersion
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')

// 更新 .iss 文件中的版本号
const issPath = path.resolve(__dirname, '../build/Flying-Bird-Wallpaper.iss')
if (fs.existsSync(issPath)) {
  let issContent = fs.readFileSync(issPath, 'utf8')

  // 替换版本号
  issContent = issContent.replace(
    /#define MyAppVersion ".*"/,
    `#define MyAppVersion "${newVersion}"`
  )

  // 写回 .iss 文件
  fs.writeFileSync(issPath, issContent)
}

console.log(`版本已更新至 ${newVersion}`)
// 安装依赖
try {
  execSync('npm install')
  console.log('依赖已安装')
} catch (error) {
  console.error('安装依赖失败:', error.message)
}
// 更新Changelog
try {
  execSync('npm run changelog:first')
  console.log('Changelog已更新')
} catch (error) {
  console.error('更新Changelog失败:', error.message)
}

// 创建Git标签
// try {
//   execSync(`git tag v${newVersion}`)
//   console.log(`已创建标签 v${newVersion}`)
//   console.log('使用 git push --tags 推送标签到远程仓库')
// } catch (error) {
//   console.error('创建标签失败:', error.message)
// }
