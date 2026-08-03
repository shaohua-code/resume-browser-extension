<script setup>
/**
 * 投递副驾 Agent：把岗位识别、真实经历判断、收藏与受控回填收敛为一条流程。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  ArrowRight, BadgeCheck, BriefcaseBusiness, CheckCircle2, CircleAlert,
  ClipboardCheck, Copy, ExternalLink, FolderHeart, LoaderCircle, RefreshCw,
  Send, ShieldCheck, Sparkles, WandSparkles,
} from 'lucide-vue-next'
import { analyzeJob, deleteSavedJob, exchangeExtensionCode, getAutofillData, getBootstrap, getSavedJobs, saveJob } from './api'

const ui = {
  brand: '\u0041\u0049 \u7b80\u5386',
  subtitle: '\u6295\u9012\u526f\u9a7e Agent',
  connecting: '\u6b63\u5728\u8fde\u63a5 AI \u7b80\u5386',
  connectTip: '\u5df2\u767b\u5f55\u4f1a\u81ea\u52a8\u8fde\u63a5\uff1b\u672a\u767b\u5f55\u65f6\u8bf7\u5728\u6253\u5f00\u7684\u9875\u9762\u5b8c\u6210\u767b\u5f55\u3002',
  reconnect: '\u91cd\u65b0\u8fde\u63a5',
  noJob: '\u6253\u5f00\u4e00\u4e2a\u5177\u4f53\u5c97\u4f4d\u8be6\u60c5\u9875\uff0c\u518d\u70b9\u51fb\u8bc6\u522b\u3002',
  detect: '\u8bc6\u522b\u5f53\u524d\u5c97\u4f4d',
  detecting: '\u6b63\u5728\u8bc6\u522b\u5c97\u4f4d...',
  prepare: '\u5f00\u59cb\u6295\u524d\u51c6\u5907',
  preparing: '\u6b63\u5728\u57fa\u4e8e\u771f\u5b9e\u7ecf\u5386\u5206\u6790...',
  resume: '\u7528\u4e8e\u51c6\u5907\u7684\u7b80\u5386',
  savedJobs: '\u6211\u7684\u6536\u85cf',
  deliver: '\u4e00\u952e\u6295\u9001\u7b80\u5386',
  editor: '\u4fee\u6539\u8fd9\u4efd\u7b80\u5386',
  opener: '\u6c9f\u901a\u5f00\u573a\u767d',
  privacy: '\u4ec5\u5904\u7406\u4f60\u89e6\u53d1\u7684\u5c97\u4f4d\u4e0e\u9009\u5b9a\u7b80\u5386\uff0c\u4e0d\u4f1a\u81ea\u52a8\u63d0\u4ea4\u7533\u8bf7\u3002',
}

const job = ref(null)
const bootstrap = ref(null)
const selectedResume = ref('')
const connecting = ref(false)
const detecting = ref(false)
const preparing = ref(false)
const filling = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const result = ref(null)
const savedJobs = ref([])
const savedId = ref(null)
const confirmingRemove = ref(false)
const pendingAction = ref('')
const appUrl = import.meta.env.VITE_APP_ORIGIN || 'http://localhost:5173'
let removeConfirmTimer = null

const hasJob = computed(() => job.value?.jdText?.length >= 40)
const jobSummary = computed(() => String(job.value?.jdText || '').trim())
const pageAccess = ref('')
const progress = computed(() => [
  { label: '\u8bc6\u522b\u5c97\u4f4d', done: hasJob.value },
  { label: '\u771f\u5b9e\u7ecf\u5386\u5224\u65ad', done: Boolean(result.value) },
  { label: '\u6536\u85cf\u5e76\u51c6\u5907', done: Boolean(savedId.value) },
])
const verdict = computed(() => {
  const score = Number(result.value?.score || 0)
  if (score >= 78) return { label: '\u503c\u5f97\u4f18\u5148\u6295\u9012', tone: 'strong', text: '\u4f60\u5df2\u6709\u591a\u9879\u53ef\u9a8c\u8bc1\u7684\u7ecf\u5386\u652f\u6301\u8fd9\u4e2a\u5c97\u4f4d\u3002' }
  if (score >= 55) return { label: '\u8865\u5f3a\u540e\u518d\u6295', tone: 'watch', text: '\u5c97\u4f4d\u6709\u673a\u4f1a\uff0c\u4f46\u6295\u9012\u524d\u5e94\u5148\u5904\u7406\u5173\u952e\u7f3a\u53e3\u3002' }
  return { label: '\u6682\u4e0d\u5efa\u8bae\u4f18\u5148\u6295', tone: 'weak', text: '\u5173\u952e\u7ecf\u5386\u5339\u914d\u4e0d\u8db3\uff0c\u5efa\u8bae\u4fdd\u5b58\u540e\u7ee7\u7eed\u5bfb\u627e\u66f4\u5408\u9002\u7684\u673a\u4f1a\u3002' }
})
const nextActions = computed(() => {
  if (!result.value) return []
  const firstGap = result.value.gaps?.[0]
  return [
    result.value.advantages?.[0] || '\u4ece\u7b80\u5386\u4e2d\u9009\u51fa\u4e0e\u5c97\u4f4d\u6700\u76f8\u5173\u7684\u4e00\u6bb5\u7ecf\u5386\u3002',
    firstGap ? `\u6295\u9012\u524d\u68c0\u67e5\uff1a${firstGap}` : '\u68c0\u67e5\u7b80\u5386\u4e2d\u7684\u9879\u76ee\u548c\u6280\u80fd\u662f\u5426\u6709\u8db3\u591f\u8bc1\u636e\u3002',
    '\u5728\u7533\u8bf7\u8868\u4e2d\u56de\u586b\u540e\uff0c\u8bf7\u81ea\u5df1\u6838\u5bf9\u5e76\u70b9\u51fb\u63d0\u4ea4\u3002',
  ]
})

// 招聘平台常把岗位 ID 放在查询参数中，只移除明确的追踪参数后再比较收藏状态。
function comparableSourceUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|from|fromSource|source|refer|ref|spm|ka|sid|track|trackingId|securityId|s|t|req)$/i.test(key)) {
        url.searchParams.delete(key)
      }
    }
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function syncSavedState() {
  if (!job.value) {
    savedId.value = null
    return
  }
  const currentUrl = comparableSourceUrl(job.value.sourceUrl)
  const exact = savedJobs.value.find((item) => comparableSourceUrl(item.source_url) === currentUrl)
  // 极少数单页招聘站拿不到岗位链接时，标题与公司同时一致才允许回退匹配。
  const fallback = exact || savedJobs.value.find((item) => (
    item.title === job.value.sourceTitle
    && item.company
    && job.value.company
    && item.company === job.value.company
  ))
  savedId.value = fallback?.id || null
}

onMounted(async () => {
  await loadPendingJob()
  await loadBootstrap()
  if (!bootstrap.value) await connect()
  if (bootstrap.value) {
    await refreshSavedJobs()
    if (!job.value) await captureCurrentJob({ silent: true })
  }
  await runPendingAutofill()
  await runPendingAction()
  await checkPageAccess()
  chrome.storage.session.onChanged.addListener(handleSessionChange)
})

async function checkPageAccess() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    const url = new URL(tab?.url || '')
    const granted = await chrome.permissions.contains({ origins: [`${url.origin}/*`] })
    pageAccess.value = granted ? '当前招聘网站已获插件读取权限' : '当前网站未授权，无法识别岗位内容'
    if (!granted && /^https?:$/.test(url.protocol)) message.warning(pageAccess.value)
  } catch { pageAccess.value = '' }
}

onBeforeUnmount(() => {
  chrome.storage.session.onChanged.removeListener(handleSessionChange)
  if (removeConfirmTimer) clearTimeout(removeConfirmTimer)
})

async function loadPendingJob() {
  const { pendingJob, pendingAction: action, pageActionError } = await chrome.storage.session.get(['pendingJob', 'pendingAction', 'pageActionError'])
  job.value = pendingJob || null
  pendingAction.value = action || ''
  if (pageActionError) {
    error.value = pageActionError
    await chrome.storage.session.remove('pageActionError')
  }
}

function handleSessionChange(changes, areaName) {
  if (areaName !== 'session') return
  if (changes.pendingJob) {
    job.value = changes.pendingJob.newValue || null
    result.value = null
    confirmingRemove.value = false
    syncSavedState()
  }
  if (changes.pendingAction) pendingAction.value = changes.pendingAction.newValue || ''
  if (changes.pageActionError?.newValue) error.value = changes.pageActionError.newValue
  runPendingAction()
}

async function runPendingAction() {
  const action = pendingAction.value
  if (!action || !bootstrap.value || !job.value || preparing.value) return
  pendingAction.value = ''
  await chrome.storage.session.remove('pendingAction')
  if (action === 'save') {
    try {
      await saveAndPrepare()
      notice.value = '\u5df2\u6536\u85cf\u5230\u6211\u7684\u6c42\u804c\uff0c\u53ef\u968f\u65f6\u56de\u6765\u7ee7\u7eed\u51c6\u5907\u3002'
    } catch (requestError) { error.value = requestError.message || '\u6536\u85cf\u5931\u8d25' }
  }
  if (action === 'analyze') await startAgent()
}

async function loadBootstrap() {
  try {
    const { extensionSession } = await chrome.storage.local.get('extensionSession')
    if (!extensionSession?.accessToken) return
    bootstrap.value = await getBootstrap(extensionSession)
    selectedResume.value = bootstrap.value.default_resume_id || bootstrap.value.resumes?.[0]?.id || ''
  } catch (requestError) {
    await chrome.storage.local.remove('extensionSession')
    error.value = requestError.message
  }
}

async function connect() {
  if (connecting.value) return
  connecting.value = true
  error.value = ''
  try {
    const response = await chrome.runtime.sendMessage({ type: 'OPEN_CONNECT', appUrl })
    if (!response?.ok) throw new Error(response?.error || '\u8fde\u63a5\u672a\u5b8c\u6210')
    const session = await exchangeExtensionCode(response.code)
    await chrome.storage.local.set({ extensionSession: { accessToken: session.access_token } })
    await loadBootstrap()
  } catch (requestError) {
    error.value = requestError.message || '\u8fde\u63a5\u5931\u8d25'
  } finally {
    connecting.value = false
  }
}

// Agent 入口：没有岗位时先读取，再做一次 AI 匹配并自动保存为待投递准备。
async function startAgent() {
  notice.value = ''
  error.value = ''
  if (!hasJob.value) await captureCurrentJob()
  if (!hasJob.value || !selectedResume.value || preparing.value) return
  preparing.value = true
  result.value = null
  try {
    const { extensionSession } = await chrome.storage.local.get('extensionSession')
    const match = await analyzeJob(extensionSession, { resumeId: selectedResume.value, jdText: job.value.jdText })
    result.value = {
      score: Math.max(0, Math.min(100, Number(match.match_score || 0))),
      advantages: match.match_advantages || [],
      gaps: match.position_gaps || match.missing_skills || [],
      suggestions: match.suggestions || [],
      opener: buildOpener(match),
    }
    await saveAndPrepare()
    notice.value = '\u5df2\u5b8c\u6210\u5c97\u4f4d\u5224\u65ad\u5e76\u6536\u85cf\u3002\u4e0b\u4e00\u6b65\u53ef\u4ee5\u4fee\u6539\u7b80\u5386\u6216\u8fdb\u5165\u7533\u8bf7\u9875\u56de\u586b\u3002'
  } catch (requestError) {
    error.value = requestError.message || '\u6295\u524d\u51c6\u5907\u5931\u8d25'
  } finally {
    preparing.value = false
  }
}

async function captureCurrentJob({ silent = false } = {}) {
  if (detecting.value) return
  detecting.value = true
  await checkPageAccess()
  if (!silent) error.value = ''
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_CURRENT_JOB' })
    if (!response?.ok) throw new Error(response?.error || '\u6682\u65f6\u65e0\u6cd5\u8bc6\u522b\u5f53\u524d\u5c97\u4f4d')
    job.value = response.job
    result.value = null
    confirmingRemove.value = false
    syncSavedState()
    await chrome.storage.session.set({ pendingJob: response.job })
    const missing = [
      !job.value.company && '\u516c\u53f8',
      !job.value.salary && '\u85aa\u8d44',
      !job.value.location && '\u5de5\u4f5c\u5730\u70b9',
    ].filter(Boolean)
    if (missing.length) message.warning(`\u5df2\u8bc6\u522b\u5c97\u4f4d\uff0c\u4f46\u9875\u9762\u672a\u516c\u5f00${missing.join('\u3001')}`)
    else message.success(`\u5df2\u8bc6\u522b${job.value.sourcePlatform ? ` ${job.value.sourcePlatform}` : ''}\u5f53\u524d\u5c97\u4f4d`)
  } catch (requestError) {
    if (!silent) {
      // 切换标签页后识别失败时清空旧岗位，避免用户误把上一页内容当作当前岗位。
      job.value = null
      result.value = null
      savedId.value = null
      await chrome.storage.session.remove('pendingJob')
      error.value = requestError.message
      message.error(error.value)
    }
  } finally {
    detecting.value = false
  }
}

async function refreshSavedJobs() {
  try {
    const { extensionSession } = await chrome.storage.local.get('extensionSession')
    const data = await getSavedJobs(extensionSession)
    savedJobs.value = data.jobs || []
    syncSavedState()
  } catch {
    savedJobs.value = []
    savedId.value = null
  }
}

async function saveAndPrepare() {
  if (!job.value) throw new Error('\u8bf7\u5148\u8bc6\u522b\u5c97\u4f4d')
  if (!selectedResume.value) throw new Error('\u8bf7\u5148\u9009\u62e9\u7528\u4e8e\u6295\u9012\u7684\u7b80\u5386')
  const { extensionSession } = await chrome.storage.local.get('extensionSession')
  const data = await saveJob(extensionSession, {
    source_url: job.value.sourceUrl,
    title: job.value.sourceTitle,
    company: job.value.company || '',
    location: job.value.location || '',
    address: job.value.address || '',
    salary: job.value.salary || '',
    skills: Array.isArray(job.value.skills) ? job.value.skills : [],
    source_platform: job.value.sourcePlatform || '',
    source_original: job.value.sourceOriginal || '',
    jd_text: job.value.jdText,
    resume_id: selectedResume.value,
    match_result: result.value || {},
    status: result.value ? 'ready' : 'saved',
  })
  if (!data.job?.id) throw new Error('收藏结果缺少岗位编号，请稍后重试')
  savedId.value = data.job.id
  await refreshSavedJobs()
}

async function saveCurrentJob() {
  if (!job.value || saving.value) return
  saving.value = true
  notice.value = ''
  error.value = ''
  try {
    await saveAndPrepare()
    notice.value = '\u5df2\u6536\u85cf\u8fd9\u4e2a\u5c97\u4f4d\uff0c\u53ef\u5728\u300c\u6211\u7684\u6536\u85cf\u300d\u67e5\u770b\u5b8c\u6574\u8be6\u60c5\u3002'
    message.success('\u5c97\u4f4d\u5df2\u6536\u85cf')
  } catch (requestError) {
    error.value = requestError.message || '\u6536\u85cf\u5931\u8d25'
    message.error(error.value)
  } finally {
    saving.value = false
  }
}

function requestRemoveCurrentJob() {
  confirmingRemove.value = true
  message.warning('请再次点击“确认移除”，收藏才会被删除')
  if (removeConfirmTimer) clearTimeout(removeConfirmTimer)
  removeConfirmTimer = setTimeout(() => { confirmingRemove.value = false }, 4500)
}

async function removeCurrentJob() {
  if (!savedId.value || saving.value) return
  saving.value = true
  notice.value = ''
  error.value = ''
  try {
    const removedId = savedId.value
    const { extensionSession } = await chrome.storage.local.get('extensionSession')
    await deleteSavedJob(extensionSession, removedId)
    savedJobs.value = savedJobs.value.filter((item) => item.id !== removedId)
    savedId.value = null
    confirmingRemove.value = false
    notice.value = '已从「我的收藏」移除，招聘网站原有收藏不受影响。'
    message.success('已取消收藏')
  } catch (requestError) {
    error.value = requestError.message || '取消收藏失败'
    message.error(error.value)
  } finally {
    saving.value = false
  }
}

function buildOpener(match) {
  const title = job.value?.sourceTitle || '\u8fd9\u4e2a\u5c97\u4f4d'
  const evidence = match.match_advantages?.[0] || '\u6211\u5177\u5907\u4e0e\u5c97\u4f4d\u76f8\u5173\u7684\u9879\u76ee\u7ecf\u9a8c'
  return `\u60a8\u597d\uff0c\u6211\u5173\u6ce8\u5230${title}\u3002${evidence}\uff0c\u5e0c\u671b\u6709\u673a\u4f1a\u4e0e\u60a8\u8fdb\u4e00\u6b65\u6c9f\u901a\u3002`
}

async function copyOpener() {
  await navigator.clipboard.writeText(result.value?.opener || '')
  notice.value = '\u5f00\u573a\u767d\u5df2\u590d\u5236\u3002'
}

async function deliverCurrentJob() {
  if (!selectedResume.value || filling.value) return
  filling.value = true
  notice.value = ''
  error.value = ''
  try {
    const { extensionSession } = await chrome.storage.local.get('extensionSession')
    const data = await getAutofillData(extensionSession, selectedResume.value)
    const response = await chrome.runtime.sendMessage({ type: 'DELIVER_CURRENT_JOB', profile: data.resume })
    if (!response?.ok) throw new Error(response?.error || '\u672a\u627e\u5230\u53ef\u6295\u9012\u7684\u5165\u53e3')
    notice.value = response.action === 'delivery'
      ? `\u5df2\u6253\u5f00${response.label}\uff0c\u8bf7\u5728\u62db\u8058\u5e73\u53f0\u68c0\u67e5\u7b80\u5386\u540e\u5b8c\u6210\u53d1\u9001\u3002`
      : `\u5df2\u56de\u586b ${response.filled || 0} \u9879\uff0c\u8bf7\u6838\u5bf9\u540e\u63d0\u4ea4\u3002`
    message.success(response.action === 'delivery' ? '\u5df2\u53d1\u8d77\u6295\u9012' : '\u5df2\u5b8c\u6210\u56de\u586b')
  } catch (requestError) {
    error.value = requestError.message || '\u56de\u586b\u5931\u8d25'
    message.error(error.value)
  } finally {
    filling.value = false
  }
}

function openEditor() { if (selectedResume.value) chrome.tabs.create({ url: `${appUrl}/editor/${selectedResume.value}` }) }
function openSavedJobs() { chrome.tabs.create({ url: `${appUrl}/user?tab=saved-jobs` }) }

async function runPendingAutofill() {
  const { pendingAutofill } = await chrome.storage.session.get('pendingAutofill')
  if (!pendingAutofill || !bootstrap.value) return
  await chrome.storage.session.remove('pendingAutofill')
  await deliverCurrentJob()
}
</script>

<template>
  <main class="agent-shell">
    <header class="agent-header">
      <div class="brand-mark"><Sparkles :size="17" /></div>
      <div><b>{{ ui.brand }}</b><span>{{ ui.subtitle }}</span></div>
      <button class="icon-button" title="查看我的收藏" @click="openSavedJobs"><FolderHeart :size="18" /><i>{{ savedJobs.length }}</i></button>
    </header>

    <section v-if="!bootstrap" class="connect-state">
      <ShieldCheck :size="32" /><h1>{{ ui.connecting }}</h1><p>{{ ui.connectTip }}</p>
      <LoaderCircle v-if="connecting" class="spin" :size="23" />
      <button v-else class="agent-primary" @click="connect">{{ ui.reconnect }} <ArrowRight :size="16" /></button>
      <p v-if="error" class="agent-error"><CircleAlert :size="15" />{{ error }}</p>
    </section>

    <template v-else>
      <section class="progress-strip" aria-label="Agent 准备进度">
        <div v-for="(step, index) in progress" :key="step.label" :class="['progress-step', { done: step.done }]">
          <span>{{ step.done ? '✓' : index + 1 }}</span><b>{{ step.label }}</b>
        </div>
      </section>

      <section class="job-card">
        <div class="section-label"><BriefcaseBusiness :size="14" />当前岗位</div>
        <h1 v-if="job">{{ job.sourceTitle }}</h1>
        <p v-else>{{ ui.noJob }}</p>
        <div v-if="job" class="job-meta">
          <span v-if="job.sourcePlatform">{{ job.sourcePlatform }}</span>
          <span v-if="job.company">{{ job.company }}</span>
          <span v-if="job.location">{{ job.location }}</span>
          <span v-if="job.salary">{{ job.salary }}</span>
        </div>
        <p v-if="job?.address" class="job-address">{{ job.address }}</p>
        <div v-if="job?.skills?.length" class="job-skills">
          <span v-for="skill in job.skills" :key="skill">{{ skill }}</span>
        </div>
        <p v-if="jobSummary" class="job-summary">{{ jobSummary }}</p>
        <div class="job-actions">
          <button class="subtle-action" :disabled="detecting" @click="captureCurrentJob"><RefreshCw :class="{ spin: detecting }" :size="14" />{{ detecting ? ui.detecting : ui.detect }}</button>
          <button
            v-if="job && savedId"
            class="subtle-action is-saved"
            :disabled="saving"
            @click="confirmingRemove ? removeCurrentJob() : requestRemoveCurrentJob()"
          ><FolderHeart :size="14" />{{ saving ? '正在取消...' : (confirmingRemove ? '确认移除' : '取消收藏') }}</button>
          <button v-else-if="job" class="subtle-action" :disabled="saving" @click="saveCurrentJob"><FolderHeart :size="14" />{{ saving ? '正在收藏...' : '收藏岗位' }}</button>
        </div>
      </section>

      <section class="resume-card">
        <label>{{ ui.resume }}</label>
        <select v-model="selectedResume" @change="result = null"><option v-for="resume in bootstrap.resumes" :key="resume.id" :value="resume.id">{{ resume.title }}</option></select>
        <button class="agent-primary" :disabled="preparing || !selectedResume" @click="startAgent"><LoaderCircle v-if="preparing" class="spin" :size="17" /><WandSparkles v-else :size="17" />{{ preparing ? ui.preparing : ui.prepare }}</button>
      </section>

      <section v-if="result" class="result-card">
        <div class="verdict" :class="verdict.tone"><div><span>岗位判断</span><b>{{ verdict.label }}</b></div><strong>{{ result.score }}<small>/100</small></strong></div>
        <p class="verdict-copy">{{ verdict.text }}</p>
        <div class="result-block good"><h2><BadgeCheck :size="15" />可用证据</h2><p v-for="item in result.advantages.slice(0, 2)" :key="item">{{ item }}</p><p v-if="!result.advantages.length">请在简历中补充可证明的项目或工作证据。</p></div>
        <div v-if="result.gaps.length" class="result-block warn"><h2><CircleAlert :size="15" />投递前注意</h2><p v-for="item in result.gaps.slice(0, 2)" :key="item">{{ item }}</p></div>
        <div class="result-block action"><h2><ClipboardCheck :size="15" />下一步动作</h2><p v-for="(item, index) in nextActions" :key="item"><i>{{ index + 1 }}</i>{{ item }}</p></div>
        <div class="opener"><div><span>{{ ui.opener }}</span><p>{{ result.opener }}</p></div><button title="复制开场白" @click="copyOpener"><Copy :size="16" /></button></div>
        <div class="agent-actions"><button class="agent-secondary" :disabled="filling" @click="deliverCurrentJob"><LoaderCircle v-if="filling" class="spin" :size="15" /><Send v-else :size="15" />{{ ui.deliver }}</button><button class="agent-outline" @click="openEditor">{{ ui.editor }}<ExternalLink :size="14" /></button></div>
      </section>

      <p v-if="notice" class="agent-notice"><CheckCircle2 :size="15" />{{ notice }}</p>
      <p v-if="error" class="agent-error"><CircleAlert :size="15" />{{ error }}</p>
      <p v-if="pageAccess" class="agent-access"><ShieldCheck :size="14" />{{ pageAccess }}</p>
    </template>
    <footer><ShieldCheck :size="13" />{{ ui.privacy }}</footer>
  </main>
</template>

<style>
:root{font-family:Inter,"Microsoft YaHei",sans-serif;color:#172b27;background:#f5f8f7}.agent-shell{width:100%;min-height:520px;padding:16px;box-sizing:border-box}.agent-header{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px}.brand-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:#167b68;color:#fff}.agent-header b,.agent-header span{display:block}.agent-header b{font-size:15px}.agent-header span{margin-top:2px;color:#7b8a86;font-size:11px}.icon-button{position:relative;display:grid;place-items:center;width:34px;height:34px;border:1px solid #dce7e2;border-radius:8px;background:#fff;color:#315f55;cursor:pointer}.icon-button i{position:absolute;right:-5px;top:-5px;display:grid;min-width:16px;height:16px;place-items:center;border-radius:8px;background:#167b68;color:#fff;font-size:10px;font-style:normal}.connect-state{padding:76px 22px;text-align:center}.connect-state>svg{color:#167b68}.connect-state h1{margin:15px 0 7px;font-size:19px}.connect-state p{color:#667783;font-size:13px;line-height:1.65}.progress-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin:18px 0 13px}.progress-step{display:grid;justify-items:center;gap:5px;color:#97a49f;font-size:10px;text-align:center}.progress-step span{display:grid;place-items:center;width:21px;height:21px;border-radius:50%;border:1px solid #dce7e2;background:#fff;font-size:10px;font-weight:800}.progress-step b{font-weight:600}.progress-step.done{color:#177b69}.progress-step.done span{border-color:#177b69;background:#e6f5f0}.job-card,.resume-card,.result-card{margin-top:12px;border:1px solid #dce7e2;border-radius:8px;background:#fff;box-shadow:0 9px 28px rgba(19,55,46,.045)}.job-card{padding:15px}.section-label{display:flex;align-items:center;gap:6px;color:#177b69;font-size:11px;font-weight:800}.job-card h1{margin:10px 0 0;color:#1e332e;font-size:16px;line-height:1.4;overflow-wrap:anywhere}.job-card>p{margin:10px 0;color:#687a76;font-size:13px;line-height:1.55}.job-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.job-meta span{padding:3px 7px;border-radius:5px;background:#f1f6f4;color:#657974;font-size:11px}.subtle-action{display:inline-flex;align-items:center;gap:5px;margin-top:13px;border:0;background:transparent;padding:0;color:#177b69;font:700 12px inherit;cursor:pointer}.resume-card{padding:14px}.resume-card label{display:block;color:#526560;font-size:12px;font-weight:800}.resume-card select{width:100%;margin-top:8px;padding:10px;border:1px solid #cedbd6;border-radius:7px;background:#fff;color:#263c36;font:13px inherit}.agent-primary,.agent-secondary,.agent-outline{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;border-radius:8px;padding:11px;border:0;font:700 13px inherit;cursor:pointer}.agent-primary{margin-top:11px;background:#167b68;color:#fff;box-shadow:0 7px 15px rgba(22,123,104,.17)}.agent-primary:disabled,.agent-secondary:disabled{opacity:.5;cursor:not-allowed}.result-card{padding:14px}.verdict{display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:7px}.verdict span,.verdict b{display:block}.verdict span{font-size:11px;color:#698079}.verdict b{margin-top:3px;font-size:15px}.verdict strong{font-size:30px;line-height:1}.verdict strong small{margin-left:2px;font-size:11px;font-weight:600}.verdict.strong{background:#eaf7f1;color:#147055}.verdict.watch{background:#fff8e8;color:#a66a07}.verdict.weak{background:#fff1ee;color:#b4533e}.verdict-copy{margin:10px 1px 3px;color:#62746f;font-size:12px;line-height:1.55}.result-block{padding:12px 0;border-bottom:1px solid #e5eeea}.result-block h2{display:flex;align-items:center;gap:6px;margin:0 0 8px;font-size:12px}.result-block.good h2{color:#177b69}.result-block.warn h2{color:#b7791f}.result-block.action h2{color:#426d63}.result-block p{margin:6px 0;padding-left:9px;border-left:2px solid #c8d8d2;color:#51645f;font-size:12px;line-height:1.5;overflow-wrap:anywhere}.result-block.warn p{border-color:#eab85b}.result-block.action i{display:inline-grid;place-items:center;width:15px;height:15px;margin-right:5px;border-radius:50%;background:#e6f5f0;color:#177b69;font-size:9px;font-style:normal;font-weight:800}.opener{display:grid;grid-template-columns:minmax(0,1fr) 30px;gap:8px;margin-top:12px;padding:11px;border-radius:7px;background:#f0f6f3}.opener span{color:#177b69;font-size:11px;font-weight:800}.opener p{margin:5px 0 0;color:#536761;font-size:12px;line-height:1.55;overflow-wrap:anywhere}.opener button{border:0;background:transparent;color:#177b69;cursor:pointer}.agent-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.agent-secondary{background:#177b69;color:#fff}.agent-outline{border:1px solid #cbdad5;background:#fff;color:#35655b}.agent-notice,.agent-error{display:flex;gap:6px;margin:12px 2px;font-size:12px;line-height:1.5;overflow-wrap:anywhere}.agent-notice{color:#177b69}.agent-error{color:#ad5926}.agent-shell footer{display:flex;gap:5px;margin:16px 2px 0;color:#91a09c;font-size:11px;line-height:1.5}.spin{animation:agent-spin .8s linear infinite}@keyframes agent-spin{to{transform:rotate(360deg)}}
.job-summary{max-height:360px;margin:11px 0 0!important;padding:9px 10px;border-left:3px solid #93cbbc;background:#f5faf8;color:#526861!important;font-size:11px!important;line-height:1.65!important;white-space:pre-wrap;overflow:auto}
.job-address{margin:9px 0 0!important;color:#60736e!important;font-size:11px!important;line-height:1.5!important;overflow-wrap:anywhere}
.job-skills{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.job-skills span{padding:3px 6px;border:1px solid #d8e7e1;border-radius:5px;background:#fff;color:#557068;font-size:10px}
.job-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.subtle-action.is-saved{color:#a44f3b}.subtle-action:disabled{opacity:.55;cursor:not-allowed}
.agent-access{display:flex;gap:6px;margin:10px 2px;color:#70817c;font-size:11px;line-height:1.5}
</style>
