import { access, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const errors = []

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8')
}

function expect(condition, message) {
  if (!condition) errors.push(message)
}

const [packageText, manifestText, background, content, launcher, prd, skill, skillUi] = await Promise.all([
  read('package.json'),
  read('public/manifest.json'),
  read('public/background.js'),
  read('public/content.js'),
  read('public/content/launcher.js'),
  read('prd/AI简历浏览器扩展-PRD.md'),
  read('skills/update-browser-extension/SKILL.md'),
  read('skills/update-browser-extension/agents/openai.yaml'),
])

const packageJson = JSON.parse(packageText)
const manifest = JSON.parse(manifestText)
const backgroundList = background.match(/const CONTENT_FILES\s*=\s*\[([\s\S]*?)\]/)?.[1] || ''
const backgroundFiles = [...backgroundList.matchAll(/['"]([^'"]+\.js)['"]/g)].map((match) => match[1])

expect(packageJson.version === manifest.version, 'package.json 与 manifest.json 版本不一致')
expect(Number.parseInt(manifest.minimum_chrome_version, 10) >= 116, '悬浮入口需要 minimum_chrome_version >= 116')
expect(manifest.permissions?.includes('sidePanel'), 'Manifest 缺少 sidePanel 权限')
// 招聘站点只能在用户主动触发时临时访问，防止以后重构时意外恢复常驻读取。
expect(!manifest.content_scripts?.length, '招聘站点不得配置自动运行的 Manifest content_scripts')

const requiredFiles = [
  'content/shared.js',
  'content/adapters/structured.js',
  'content/adapters/zhipin.js',
  'content/adapters/51job.js',
  'content/adapters/zhaopin.js',
  'content/adapters/liepin.js',
  'content/adapters/lagou.js',
  'content/adapters/classifieds.js',
  'content/adapters/yingjiesheng.js',
  'content/adapters/generic.js',
  'content/actions.js',
  'content/launcher.js',
  'content.js',
]
expect(JSON.stringify(backgroundFiles) === JSON.stringify(requiredFiles), '后台动态注入模块缺失或加载顺序发生未记录变化')

for (const file of backgroundFiles) {
  try {
    await access(path.join(root, 'public', file))
  } catch {
    errors.push(`后台注入配置引用了不存在的文件：public/${file}`)
  }
}

const recruitingHosts = ['zhipin', '51job', 'zhaopin', 'liepin', 'lagou', '58', 'ganji', 'yingjiesheng']
for (const host of recruitingHosts) {
  expect(!manifest.host_permissions?.some((pattern) => pattern.includes(host)), `招聘站点 ${host} 不应申请常驻 host_permissions`)
}

expect(background.includes('chrome.action.onClicked.addListener'), '工具栏点击没有显式打开侧边栏的处理器')
expect(background.includes('chrome.scripting.executeScript'), '后台缺少用户触发后的动态注入')
const tabUpdateHandler = background.match(/chrome\.tabs\.onUpdated\.addListener\(async \(tabId, changeInfo\) => \{([\s\S]*?)\n\}\)/)?.[1] || ''
expect(tabUpdateHandler.includes('clearJobForTabSwitch') && !tabUpdateHandler.includes('captureJob'), '导航监听只能清除旧岗位，不能读取新页面')
expect(!content.includes('AUTO_DETECTED_JOB') && !content.includes('MutationObserver') && !content.includes('setInterval'), '内容脚本不得自动观察或轮询招聘页面')
expect(launcher.includes("attachShadow({ mode: 'open' })"), '悬浮入口未使用 Shadow DOM 隔离')
expect(launcher.includes("type: 'OPEN_SIDE_PANEL_FROM_PAGE'"), '悬浮入口消息契约缺失')
expect(background.includes("message?.type === 'OPEN_SIDE_PANEL_FROM_PAGE'"), '后台未处理悬浮入口消息')
expect(background.includes('chrome.sidePanel.open'), '后台缺少 sidePanel.open 调用')
expect(prd.includes('悬浮入口'), 'PRD 未记录悬浮入口')
expect(prd.includes('Chrome 116'), 'PRD 未记录最低浏览器版本')
expect(prd.includes('--更新插件'), 'PRD 未记录知识同步命令')
expect(/^---\r?\n[\s\S]*?name:\s*update-browser-extension[\s\S]*?description:[\s\S]*?\r?\n---/m.test(skill), 'Skill frontmatter 缺少有效 name 或 description')
expect(!skill.includes('[TODO:'), 'Skill 中仍有初始化 TODO')
expect(skillUi.includes('display_name: "更新浏览器插件"'), 'Skill UI 元数据缺少正确显示名称')

if (errors.length) {
  console.error('插件契约检查失败：')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log(`插件契约检查通过：${backgroundFiles.length} 个按需注入模块；招聘站点未配置常驻权限。`)
