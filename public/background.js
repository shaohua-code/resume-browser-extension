const MENU_IDENTIFY = 'ai-resume-identify-job'
const MENU_SAVE = 'ai-resume-save-job'
const MENU_FILL = 'ai-resume-fill-form'
// 仅在用户点击插件、页面入口或右键菜单时动态注入页面能力，避免安装后常驻读取招聘页面。
const CONTENT_FILES = [
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

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({ id: MENU_IDENTIFY, title: '\u7528 AI \u7b80\u5386\u5206\u6790\u5f53\u524d\u5c97\u4f4d', contexts: ['page', 'selection'] })
  chrome.contextMenus.create({ id: MENU_SAVE, title: '\u6536\u85cf\u5f53\u524d\u5c97\u4f4d\u5f85\u51c6\u5907', contexts: ['page', 'selection'] })
  chrome.contextMenus.create({ id: MENU_FILL, title: '\u4e00\u952e\u6295\u9001\u5f53\u524d\u5c97\u4f4d\u7b80\u5386', contexts: ['page', 'editable'] })
})

// 工具栏点击是明确的用户手势；只有此时才打开侧边栏并解析当前招聘页。
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id || tab.windowId == null) return
  const openPromise = chrome.sidePanel.open({ windowId: tab.windowId })
  const capturePromise = isSupportedJobPage(tab.url)
    ? captureJob(tab.id)
    : Promise.resolve({ ok: false, error: '请先打开支持的招聘网站岗位详情，再点击识别' })

  try {
    await openPromise
    const result = await capturePromise
    if (result.ok) {
      await chrome.storage.session.set({ pendingJob: result.job, activeJobTabId: tab.id, pageActionError: '' })
    } else {
      await chrome.storage.session.remove(['pendingJob', 'activeJobTabId'])
      await chrome.storage.session.set({ pageActionError: result.error, pendingAction: '' })
    }
  } catch (error) {
    await chrome.storage.session.set({ pageActionError: error?.message || '暂时无法打开岗位助手' })
  }
})

// 标签切换只清除旧岗位上下文，不读取新页面，避免侧边栏误用前一个标签页的岗位。
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await clearJobForTabSwitch(tabId)
})

// 导航只清除旧岗位数据，不解析新页面；SPA 内容变化由用户手动点击识别刷新。
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === 'loading') await clearJobForTabSwitch(-1, tabId)
})

async function clearJobForTabSwitch(activeTabId, navigatingTabId = null) {
  const { activeJobTabId } = await chrome.storage.session.get('activeJobTabId')
  const tabChanged = activeJobTabId && activeTabId !== -1 && activeJobTabId !== activeTabId
  const navigatingCurrentJob = activeJobTabId && navigatingTabId === activeJobTabId
  if (tabChanged || navigatingCurrentJob) {
    await chrome.storage.session.remove(['pendingJob', 'activeJobTabId', 'pendingAction'])
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (!tab?.id) return
    if (info.menuItemId === MENU_FILL) {
      await chrome.storage.session.set({ pendingAutofill: { tabId: tab.id, receivedAt: Date.now() } })
      return chrome.sidePanel.open({ windowId: tab.windowId })
    }
    if (!isSupportedJobPage(tab.url)) {
      await chrome.storage.session.set({ pageActionError: '\u8bf7\u5148\u5728\u5df2\u5c55\u5f00\u7684\u5c97\u4f4d\u8be6\u60c5\u4e2d\u4f7f\u7528\u6b64\u529f\u80fd\uff08\u652f\u6301 BOSS\u3001\u524d\u7a0b\u65e0\u5fe7\u3001\u667a\u8054\u3001\u730e\u8058\u3001\u62c9\u52fe\u300158 \u540c\u57ce\u7b49\uff09', pendingAction: '' })
      return chrome.sidePanel.open({ windowId: tab.windowId })
    }
    const result = await captureJob(tab.id, info.selectionText || '')
    await chrome.storage.session.set(result.ok
      ? { pendingJob: result.job, activeJobTabId: tab.id, pendingAction: info.menuItemId === MENU_SAVE ? 'save' : 'analyze', pageActionError: '' }
      : { pageActionError: result.error, pendingAction: '' })
    if (!result.ok) await chrome.storage.session.remove(['pendingJob', 'activeJobTabId'])
    await chrome.sidePanel.open({ windowId: tab.windowId })
  } catch (error) {
    if (tab?.windowId) await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {})
    await chrome.storage.session.set({ pageActionError: error.message || '\u53f3\u952e\u64cd\u4f5c\u5931\u8d25' })
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPEN_SIDE_PANEL_FROM_PAGE') {
    openSidePanelFromPage(sender)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error?.message || '暂时无法打开岗位助手' }))
    return true
  }
  if (message?.type === 'OPEN_CONNECT') { openConnect(message.appUrl).then(sendResponse); return true }
  if (message?.type === 'AUTOFILL_PAGE') { autofillActivePage(message.profile).then(sendResponse); return true }
  if (message?.type === 'DELIVER_CURRENT_JOB') { deliverCurrentJob(message.profile).then(sendResponse); return true }
  if (message?.type === 'CAPTURE_CURRENT_JOB') { captureActiveJob().then(sendResponse); return true }
})

// 悬浮入口的点击属于明确的用户手势。先立即打开全局侧边栏，再异步识别当前岗位，
// 避免等待 DOM 解析后丢失 Chrome 对 sidePanel.open 的用户手势要求。
async function openSidePanelFromPage(sender) {
  const tab = sender?.tab
  if (!tab?.id || tab.windowId == null) return { ok: false, error: '未找到当前招聘页面' }

  // 必须在消息处理的同步用户手势阶段首先发起打开请求，岗位解析随后并行执行。
  const openPromise = chrome.sidePanel.open({ windowId: tab.windowId })
  const capturePromise = isSupportedJobPage(tab.url)
    ? captureJob(tab.id)
    : Promise.resolve({ ok: false, error: '当前页面不是已支持的招聘网站' })

  try {
    await openPromise
  } catch (error) {
    return { ok: false, error: error?.message || '暂时无法打开岗位助手' }
  }

  const result = await capturePromise
  if (result.ok) {
    await chrome.storage.session.set({ pendingJob: result.job, activeJobTabId: tab.id, pageActionError: '' })
  } else {
    // 识别失败时清理旧岗位，防止侧边栏把上一个页面的结果误认为当前岗位。
    await chrome.storage.session.remove(['pendingJob', 'activeJobTabId'])
    await chrome.storage.session.set({ pageActionError: result.error || '暂时无法识别当前岗位' })
  }
  return { ok: true, detected: Boolean(result.ok), error: result.ok ? '' : result.error }
}

async function captureActiveJob() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (!tab?.id) return { ok: false, error: '\u672a\u627e\u5230\u5f53\u524d\u9875\u9762' }
  if (!isSupportedJobPage(tab.url)) {
    return { ok: false, error: '\u8bf7\u5148\u6253\u5f00\u62db\u8058\u7f51\u7ad9\u7684\u5177\u4f53\u5c97\u4f4d\u8be6\u60c5\uff0c\u518d\u70b9\u51fb\u8bc6\u522b' }
  }
  return captureJob(tab.id)
}

async function captureJob(tabId, selectionText = '') {
  try {
    const result = await runInTab(tabId, { type: 'EXTRACT_JOB', selectionText })
    if (result?.ok) await chrome.storage.session.set({ activeJobTabId: tabId })
    return result
  }
  catch (error) { return { ok: false, error: error.message || '\u6682\u65f6\u65e0\u6cd5\u8bfb\u53d6\u5f53\u524d\u5c97\u4f4d' } }
}

function isSupportedJobPage(rawUrl) {
  try {
    const url = new URL(rawUrl || '')
    const supported = /(^|\.)(zhipin|51job|zhaopin|liepin|lagou|58|ganji|yingjiesheng)\.com$/i.test(url.hostname)
    if (!supported) return false
    // BOSS also displays a selected job in /web/geek/jobs. Other sites use their
    // own detail routes, so accept the supported host and let the semantic parser
    // verify that the page contains a real position description.
    return true
  } catch {
    return false
  }
}

async function openConnect(appUrl) {
  const redirectUri = chrome.identity.getRedirectURL('extension-auth')
  const authUrl = `${appUrl || 'http://localhost:5173'}/extension/connect?redirect_uri=${encodeURIComponent(redirectUri)}`
  return new Promise((resolve) => chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (callbackUrl) => {
    if (chrome.runtime.lastError || !callbackUrl) return resolve({ ok: false, error: chrome.runtime.lastError?.message || '\u8fde\u63a5\u5df2\u53d6\u6d88' })
    const code = new URL(callbackUrl).searchParams.get('code')
    resolve({ ok: Boolean(code), code })
  }))
}

async function autofillActivePage(profile) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (!tab?.id) return { ok: false, error: '\u672a\u627e\u5230\u5f53\u524d\u9875\u9762' }
  try { return await runInTab(tab.id, { type: 'AUTOFILL_FORM', profile }) }
  catch (error) { return { ok: false, error: error.message || '\u56de\u586b\u5931\u8d25' } }
}

// A click from the user in the Side Panel is the explicit delivery action. On BOSS it
// triggers the visible "立即沟通/立即投递" entry; ordinary application forms fall back to autofill.
async function deliverCurrentJob(profile) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (!tab?.id) return { ok: false, error: '\u672a\u627e\u5230\u5f53\u524d\u9875\u9762' }
  try { return await runInTab(tab.id, { type: 'DELIVER_JOB', profile: profile || {} }) }
  catch (error) { return { ok: false, error: error.message || '\u4e00\u952e\u6295\u9001\u5931\u8d25' } }
}

async function runInTab(tabId, message) {
  await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES })
  return chrome.tabs.sendMessage(tabId, message)
}
