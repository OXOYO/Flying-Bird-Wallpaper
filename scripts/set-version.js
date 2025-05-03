import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 获取命令行参数中的版本号
const newVersion = process.argv[2]

if (!newVersion) {
  console.error('请提供版本号，例如: npm run version 1.0.0')
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

// 创建Git标签
// try {
//   execSync(`git tag v${newVersion}`)
//   console.log(`已创建标签 v${newVersion}`)
//   console.log('使用 git push --tags 推送标签到远程仓库')
// } catch (error) {
//   console.error('创建标签失败:', error.message)
// }
