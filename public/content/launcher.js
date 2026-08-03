(() => {
  const HOST_ID = '__ai-resume-floating-launcher'

  // 热更新会重复注入内容脚本。先销毁旧实例，避免页面出现多个入口或重复事件。
  globalThis.__aiResumeFloatingLauncher?.dispose?.()
  document.getElementById(HOST_ID)?.remove()
  if (!document.documentElement) return

  const host = document.createElement('div')
  host.id = HOST_ID
  host.setAttribute('data-ai-resume-extension', 'floating-launcher')
  const shadow = host.attachShadow({ mode: 'open' })

  // 使用 Shadow DOM 隔离招聘网站样式，保证入口在不同平台上保持一致且不污染宿主页面。
  shadow.innerHTML = `
    <style>
      :host {
        position: fixed;
        top: 52%;
        right: 16px;
        width: 172px;
        height: 96px;
        z-index: 2147483646;
        pointer-events: none;
        transform: translateY(-50%);
        font-family: "Microsoft YaHei", Arial, sans-serif;
      }
      * { box-sizing: border-box; }
      button {
        position: absolute;
        top: 0;
        right: 0;
        display: flex;
        width: 48px;
        height: 48px;
        align-items: center;
        justify-content: flex-end;
        gap: 9px;
        overflow: hidden;
        padding: 7px 8px 7px 13px;
        border: 1px solid rgba(255, 255, 255, .72);
        border-radius: 8px;
        color: #fff;
        background: #117c6b;
        box-shadow: 0 8px 24px rgba(17, 62, 55, .22), 0 2px 6px rgba(17, 62, 55, .14);
        cursor: pointer;
        pointer-events: auto;
        transition: width .2s ease, background-color .2s ease, box-shadow .2s ease;
      }
      button:hover,
      button:focus-visible {
        width: 168px;
        background: #0d6d5e;
        box-shadow: 0 10px 28px rgba(17, 62, 55, .28), 0 3px 8px rgba(17, 62, 55, .16);
        outline: none;
      }
      button:focus-visible { box-shadow: 0 0 0 3px rgba(255, 255, 255, .95), 0 0 0 6px rgba(17, 124, 107, .32); }
      button[aria-busy="true"] { cursor: wait; }
      .label {
        max-width: 0;
        overflow: hidden;
        opacity: 0;
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        line-height: 1;
        white-space: nowrap;
        transition: max-width .2s ease, opacity .15s ease;
      }
      button:hover .label,
      button:focus-visible .label,
      button[aria-busy="true"] .label { max-width: 112px; opacity: 1; }
      button[aria-busy="true"] { width: 168px; }
      .mark {
        display: grid;
        width: 32px;
        height: 32px;
        flex: 0 0 32px;
        place-items: center;
        border: 1px solid rgba(255, 255, 255, .42);
        border-radius: 6px;
        background: rgba(255, 255, 255, .14);
        color: #fff;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0;
      }
      button[aria-busy="true"] .mark { animation: ai-resume-pulse 1s ease-in-out infinite; }
      .status {
        position: absolute;
        top: 56px;
        right: 0;
        width: 168px;
        margin: 0;
        padding: 8px 10px;
        border: 1px solid #d9e8e3;
        border-radius: 6px;
        background: #fff;
        box-shadow: 0 8px 22px rgba(20, 48, 43, .16);
        color: #45615b;
        font-size: 11px;
        line-height: 1.45;
        opacity: 0;
        pointer-events: none;
        transform: translateY(-4px);
        transition: opacity .16s ease, transform .16s ease;
      }
      .status[data-visible="true"] { opacity: 1; transform: translateY(0); }
      .status[data-tone="error"] { border-color: #f1c8bf; color: #a5442e; }
      @keyframes ai-resume-pulse { 50% { opacity: .58; } }
      @media (max-width: 720px) {
        :host { top: auto; right: 12px; bottom: 88px; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        button, .label, .status { transition: none; }
        button[aria-busy="true"] .mark { animation: none; }
      }
    </style>
    <button type="button" title="打开 AI 简历岗位助手" aria-label="打开 AI 简历岗位助手" aria-busy="false">
      <span class="label">打开岗位助手</span>
      <span class="mark" aria-hidden="true">AI</span>
    </button>
    <p class="status" role="status" aria-live="polite"></p>
  `

  const button = shadow.querySelector('button')
  const label = shadow.querySelector('.label')
  const status = shadow.querySelector('.status')
  let opening = false
  let statusTimer = null

  function showStatus(text, tone = 'success') {
    clearTimeout(statusTimer)
    status.textContent = text
    status.dataset.tone = tone
    status.dataset.visible = 'true'
    statusTimer = setTimeout(() => { status.dataset.visible = 'false' }, 2600)
  }

  async function openAssistant() {
    if (opening) return
    opening = true
    button.setAttribute('aria-busy', 'true')
    label.textContent = '正在打开...'
    try {
      const response = await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL_FROM_PAGE' })
      if (!response?.ok) throw new Error(response?.error || '暂时无法打开岗位助手')
      showStatus(response.detected ? '已打开并识别当前岗位' : '已打开，请在侧边栏识别岗位')
    } catch (error) {
      showStatus(error?.message || '暂时无法打开岗位助手', 'error')
    } finally {
      opening = false
      button.setAttribute('aria-busy', 'false')
      label.textContent = '打开岗位助手'
    }
  }

  button.addEventListener('click', openAssistant)
  document.documentElement.append(host)

  globalThis.__aiResumeFloatingLauncher = {
    dispose() {
      clearTimeout(statusTimer)
      button.removeEventListener('click', openAssistant)
      host.remove()
    },
  }
})()
