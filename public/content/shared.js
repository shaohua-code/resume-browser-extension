(() => {
  /**
   * 招聘页解析公共能力。
   *
   * 所有站点适配器只产出同一种 JobCandidate，字段清洗、JSON-LD 解析、
   * 岗位一致性校验都集中在这里，避免每个平台各写一套容易漂移的规则。
   */
  const PLATFORM_NAMES = {
    zhipin: 'BOSS直聘',
    '51job': '前程无忧',
    zhaopin: '智联招聘',
    liepin: '猎聘',
    lagou: '拉勾',
    '58': '58同城',
    ganji: '赶集直招',
    yingjiesheng: '应届生求职网',
    generic: '招聘网站',
  }

  const DESCRIPTION_START = /^(?:职位描述|岗位描述|职位介绍|职位详情|岗位详情|岗位职责|职位职责|工作职责|工作内容|任职要求|职位要求|岗位要求)\s*[:：]?$/
  const DESCRIPTION_BOUNDARY = /^(?:职位招聘官|招聘官|公司信息|公司介绍|公司简介|企业信息|工作地址|办公地址|公司地址|联系方式|竞争力分析|相似职位|猜你喜欢|相关推荐|安全提示|举报职位|职位发布者)\s*[:：]?$/
  const UI_NOISE = /^(?:竞争力分析|微信扫码分享|微信分享|分享|举报|收藏|已收藏|立即沟通|立即投递|投递简历|申请职位|查看地图|点击查看地图|查看更多信息|查看全部职位|去App|去APP|App下载|APP下载|小程序|意见反馈|聊一聊|换一换|展开|收起)$/i
  const TITLE_NOISE = /^(?:职位描述|岗位描述|职位介绍|职位详情|岗位详情|岗位职责|职位职责|工作职责|工作内容|任职要求|职位要求|岗位要求|微信扫码分享|公司信息|招聘官|收藏|立即沟通|立即投递)$/
  const TRACKING_QUERY = /^(?:utm_.+|from|fromSource|source|refer|ref|spm|ka|sid|track|trackingId|securityId|s|t|req)$/i

  const adapters = []

  function registerAdapter(adapter) {
    if (!adapter?.id || typeof adapter.extract !== 'function') return
    const index = adapters.findIndex((item) => item.id === adapter.id)
    if (index >= 0) adapters.splice(index, 1)
    adapters.push(adapter)
    adapters.sort((left, right) => (right.priority || 0) - (left.priority || 0))
  }

  function normalizeInline(value) {
    return String(value || '')
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/[\uE000-\uF8FF]/g, '□')
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .trim()
  }

  function normalizeBlock(value) {
    return String(value || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/[\uE000-\uF8FF]/g, '□')
      .replace(/\u00A0/g, ' ')
      .split('\n')
      .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  function cleanDescription(value, meta = {}) {
    let lines = normalizeBlock(value).split('\n').filter(Boolean)
    if (!lines.length) return ''

    // 详情容器偶尔包含顶部按钮。只有找到明确业务标题时才裁掉其前方内容。
    const startIndex = lines.findIndex((line) => DESCRIPTION_START.test(line))
    if (startIndex > 0) lines = lines.slice(startIndex)

    const cleaned = []
    for (const line of lines) {
      if (cleaned.length && DESCRIPTION_BOUNDARY.test(line)) break
      if (UI_NOISE.test(line) || /^微信扫码分享\s*/.test(line)) continue
      if (meta.title && sameJobTitle(line, meta.title)) continue
      if (meta.company && comparable(line) === comparable(meta.company)) continue
      if (cleaned[cleaned.length - 1] === line) continue
      cleaned.push(line)
    }

    return cleaned.join('\n').slice(0, 24000).trim()
  }

  function cleanTitle(value) {
    let title = normalizeInline(value)
      .replace(/^[#\s]+/, '')
      .replace(/^(?:急聘|热招|招聘)\s*[·:：-]?\s*/, '')
    const metadataIndex = title.search(/\s+(?:[¥￥]?\d+(?:\.\d+)?(?:千|万|K|k)-\d+(?:\.\d+)?(?:千|万|K|k)(?:[·・]\d+薪)?|[□�]{2,}[-~至][□�]{2,}(?:K|k)?|面议|\d+-\d+年|本科|大专|硕士|博士|收藏|立即沟通|立即投递)(?:\s|$)/)
    if (metadataIndex > 0) title = title.slice(0, metadataIndex)
    return title.replace(/[|｜]\s*.*$/, '').trim().slice(0, 120)
  }

  function comparable(value) {
    return cleanTitle(value).toLocaleLowerCase().replace(/[\s()（）·・•_\-/|｜]/g, '')
  }

  function sameJobTitle(left, right) {
    const a = comparable(left)
    const b = comparable(right)
    if (!a || !b) return false
    return a === b || (Math.min(a.length, b.length) >= 6 && (a.includes(b) || b.includes(a)))
  }

  function unique(values) {
    const seen = new Set()
    return values.filter((value) => {
      const normalized = normalizeInline(value)
      if (!normalized || seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
  }

  function readText(root, selectors) {
    if (!root) return ''
    for (const selector of selectors) {
      const node = root.querySelector?.(selector)
      const value = normalizeInline(node?.innerText ?? node?.textContent)
      if (value) return value
    }
    return ''
  }

  function readBlock(root, selectors) {
    if (!root) return ''
    for (const selector of selectors) {
      const node = root.querySelector?.(selector)
      const value = normalizeBlock(node?.innerText ?? node?.textContent)
      if (value) return value
    }
    return ''
  }

  function readList(root, selectors) {
    if (!root) return []
    for (const selector of selectors) {
      const values = unique([...root.querySelectorAll(selector)].map((node) => normalizeInline(node.innerText ?? node.textContent)))
      if (values.length) return values
    }
    return []
  }

  function canonicalUrl(value = '') {
    try {
      const raw = value || document.querySelector('link[rel="canonical"]')?.href || location.href
      const url = new URL(raw, location.href)
      for (const key of [...url.searchParams.keys()]) {
        if (TRACKING_QUERY.test(key)) url.searchParams.delete(key)
      }
      url.hash = ''
      return url.toString()
    } catch {
      return String(value || location.href || '')
    }
  }

  function currentPlatform() {
    const host = location.hostname.toLocaleLowerCase()
    if (/(^|\.)zhipin\.com$/.test(host)) return 'zhipin'
    if (/(^|\.)51job\.com$/.test(host)) return '51job'
    if (/(^|\.)zhaopin\.com$/.test(host)) return 'zhaopin'
    if (/(^|\.)liepin\.com$/.test(host)) return 'liepin'
    if (/(^|\.)lagou\.com$/.test(host)) return 'lagou'
    if (/(^|\.)58\.com$/.test(host)) return '58'
    if (/(^|\.)ganji\.com$/.test(host)) return 'ganji'
    if (/(^|\.)yingjiesheng\.com$/.test(host)) return 'yingjiesheng'
    return 'generic'
  }

  function platformName(platform = currentPlatform()) {
    return PLATFORM_NAMES[platform] || PLATFORM_NAMES.generic
  }

  function htmlToText(value) {
    const container = document.createElement('div')
    container.innerHTML = String(value || '').replace(/<br\s*\/?>/gi, '\n')
    container.querySelectorAll('li').forEach((node) => {
      if (!/^\s*[•·\-*\d]/.test(node.textContent || '')) node.prepend('• ')
      node.append('\n')
    })
    container.querySelectorAll('p, div, section, h1, h2, h3, h4').forEach((node) => node.append('\n'))
    return normalizeBlock(container.textContent)
  }

  function collectJobPostings() {
    const jobs = []
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(script.textContent || 'null')
        walkStructuredData(parsed, jobs)
      } catch {
        // 某些网站会输出非标准 JSON-LD，忽略该块并交给站点适配器处理。
      }
    }
    const seen = new Set()
    return jobs.filter((item) => {
      const identity = `${item.url || item['@id'] || ''}\n${normalizeInline(item.title || item.name)}\n${normalizeInline(item.hiringOrganization?.name)}`
      if (seen.has(identity)) return false
      seen.add(identity)
      return true
    })
  }

  function walkStructuredData(value, jobs) {
    if (Array.isArray(value)) {
      value.forEach((item) => walkStructuredData(item, jobs))
      return
    }
    if (!value || typeof value !== 'object') return
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']]
    if (types.some((type) => String(type).toLocaleLowerCase() === 'jobposting')) jobs.push(value)
    Object.entries(value).forEach(([key, child]) => {
      if (key !== '@context' && key !== '@type') walkStructuredData(child, jobs)
    })
  }

  function chooseStructuredJob(items) {
    if (!items.length) return null
    if (items.length === 1) return items[0]
    const pageUrl = canonicalUrl()
    const visibleTitle = cleanTitle(readText(document, ['.jTitle h1', 'main h1', 'h1']))
    const ranked = items.map((item) => {
      let score = 0
      const itemUrl = canonicalUrl(item.url || item.mainEntityOfPage?.['@id'] || '')
      if (itemUrl === pageUrl) score += 100
      if (visibleTitle && sameJobTitle(item.title, visibleTitle)) score += 40
      return { item, score }
    }).sort((left, right) => right.score - left.score)
    if (ranked[0].score === 0 || ranked[0].score === ranked[1]?.score) return null
    return ranked[0].item
  }

  function structuredCandidate(item) {
    if (!item) return null
    const title = cleanTitle(item.title || item.name)
    const company = normalizeInline(item.hiringOrganization?.name || item.organization?.name)
    const { location: workLocation, address } = parseStructuredLocation(item.jobLocation)
    const description = cleanDescription(htmlToText(item.description || item.responsibilities || ''), { title, company })
    const platform = currentPlatform()
    return normalizeCandidate({
      title,
      company,
      location: workLocation,
      address,
      salary: formatStructuredSalary(item.baseSalary, item.salaryCurrency),
      skills: splitSkills(item.skills || item.occupationalCategory),
      description,
      sourceUrl: item.url || item.mainEntityOfPage?.['@id'] || canonicalUrl(),
      sourceId: normalizeInline(item.identifier?.value || item.identifier || ''),
      sourcePlatform: platformName(platform),
      platform,
      employmentType: normalizeInline(Array.isArray(item.employmentType) ? item.employmentType.join(' / ') : item.employmentType),
      confidence: 0.98,
      provenance: 'json-ld',
    })
  }

  function parseStructuredLocation(jobLocation) {
    const entries = Array.isArray(jobLocation) ? jobLocation : [jobLocation]
    for (const entry of entries) {
      const address = entry?.address || entry
      if (!address || typeof address !== 'object') continue
      const region = normalizeInline(address.addressRegion)
      const locality = normalizeInline(address.addressLocality)
      const district = normalizeInline(address.addressDistrict)
      const street = normalizeInline(address.streetAddress)
      const workLocation = unique([locality, district]).join('/') || region
      const normalizedStreet = comparablePlace(street)
      const normalizedLocality = comparablePlace(unique([locality, district]).join(''))
      const fullAddress = street && normalizedLocality && !normalizedStreet.includes(normalizedLocality)
        ? unique([locality, district, street]).join('')
        : street
      if (workLocation || fullAddress) return { location: workLocation, address: fullAddress }
    }
    return { location: '', address: '' }
  }

  function formatStructuredSalary(baseSalary, currency = '') {
    if (!baseSalary) return ''
    if (typeof baseSalary === 'string' || typeof baseSalary === 'number') return sanitizeSalary(baseSalary)
    const value = baseSalary.value || baseSalary
    if (typeof value === 'string' || typeof value === 'number') return sanitizeSalary(value)
    const min = Number(value.minValue ?? value.value)
    const max = Number(value.maxValue ?? value.value)
    const unit = normalizeInline(value.unitText || baseSalary.unitText)
    if (!Number.isFinite(min) && !Number.isFinite(max)) return ''
    const amount = Number.isFinite(min) && Number.isFinite(max) && min !== max
      ? `${formatSalaryNumber(min)}-${formatSalaryNumber(max)}`
      : formatSalaryNumber(Number.isFinite(min) ? min : max)
    const unitLabel = /月|MONTH/i.test(unit) ? '/月' : /年|YEAR/i.test(unit) ? '/年' : /时|HOUR/i.test(unit) ? '/时' : ''
    return `${amount}${currency ? ` ${currency}` : ''}${unitLabel}`.trim()
  }

  function formatSalaryNumber(value) {
    if (value >= 10000) return `${Number((value / 10000).toFixed(1))}万`
    if (value >= 1000) return `${Number((value / 1000).toFixed(1))}千`
    return String(value)
  }

  function sanitizeSalary(value) {
    const salary = normalizeInline(value)
    if (!salary || /[□�]{2,}/.test(salary)) return ''
    const match = salary.match(/(?:[¥￥]?\s*)?(?:\d+(?:\.\d+)?\s*(?:千|万|K|k|元)?\s*[-~至]\s*\d+(?:\.\d+)?\s*(?:千|万|K|k|元)(?:[·・]\s*\d+薪)?|\d+(?:\.\d+)?\s*(?:千|万|K|k|元)(?:\/月|\/年)?|面议)(?:[·・]\s*\d+薪)?/)
    return normalizeInline(match?.[0] || salary).slice(0, 80)
  }

  function splitSkills(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(/[，,、;；|｜/\n]/)
    return unique(source.map((item) => normalizeInline(typeof item === 'object' ? item.name : item)))
      .filter((item) => item.length <= 80 && !UI_NOISE.test(item))
      .slice(0, 40)
  }

  function normalizeCandidate(candidate = {}) {
    const platform = candidate.platform || currentPlatform()
    const title = cleanTitle(candidate.title)
    const company = normalizeInline(candidate.company).slice(0, 200)
    return {
      title,
      company,
      location: normalizeInline(candidate.location).slice(0, 160),
      address: normalizeInline(candidate.address).slice(0, 300),
      salary: sanitizeSalary(candidate.salary),
      skills: splitSkills(candidate.skills),
      description: cleanDescription(candidate.description, { title, company }),
      sourceUrl: canonicalUrl(candidate.sourceUrl),
      sourceId: normalizeInline(candidate.sourceId).slice(0, 200),
      sourcePlatform: normalizeInline(candidate.sourcePlatform || platformName(platform)).slice(0, 80),
      sourceOriginal: normalizeInline(candidate.sourceOriginal).slice(0, 120),
      platform,
      employmentType: normalizeInline(candidate.employmentType).slice(0, 120),
      confidence: Number(candidate.confidence || 0),
      provenance: normalizeInline(candidate.provenance),
      partial: Boolean(candidate.partial),
    }
  }

  function isUsableCandidate(candidate, { allowPartial = false } = {}) {
    if (!candidate || TITLE_NOISE.test(candidate.title)) return false
    if (candidate.title.length < 2 || candidate.title.length > 120) return false
    if (!allowPartial && candidate.description.length < 40) return false
    if (candidate.description.length && unrelatedNoiseCount(candidate.description) >= 3) return false
    return true
  }

  function unrelatedNoiseCount(description) {
    return normalizeBlock(description).split('\n').filter((line) => UI_NOISE.test(line) || DESCRIPTION_BOUNDARY.test(line)).length
  }

  function mergeCandidates(siteCandidate, structured) {
    const site = siteCandidate ? normalizeCandidate(siteCandidate) : null
    const schema = structured ? normalizeCandidate(structured) : null
    if (!site) return schema
    if (!schema) return site

    // SPA 切换时 JSON-LD 可能仍是上一个岗位。标题不一致时禁止跨来源补字段。
    if (!sameJobTitle(site.title, schema.title)) return site

    const description = pickDescription(site.description, schema.description)
    return normalizeCandidate({
      ...schema,
      ...site,
      title: site.title || schema.title,
      company: site.company || schema.company,
      location: pickMoreSpecific(site.location, schema.location),
      address: pickMoreSpecific(site.address, schema.address),
      salary: site.salary || schema.salary,
      skills: unique([...site.skills, ...schema.skills]),
      description,
      sourceUrl: site.sourceUrl || schema.sourceUrl,
      sourceId: site.sourceId || schema.sourceId,
      employmentType: site.employmentType || schema.employmentType,
      confidence: Math.max(site.confidence, schema.confidence),
      provenance: `${site.provenance || 'site'}+${schema.provenance || 'json-ld'}`,
    })
  }

  function pickDescription(left, right) {
    if (!left) return right
    if (!right) return left
    const leftNoise = unrelatedNoiseCount(left)
    const rightNoise = unrelatedNoiseCount(right)
    if (leftNoise !== rightNoise) return leftNoise < rightNoise ? left : right
    return left.length >= right.length ? left : right
  }

  function pickMoreSpecific(left, right) {
    const a = normalizeInline(left)
    const b = normalizeInline(right)
    if (!a) return b
    if (!b) return a
    if (a.includes(b)) return a
    if (b.includes(a)) return b
    return a
  }

  function comparablePlace(value) {
    return normalizeInline(value).replace(/[\s/\\\-·・]/g, '')
  }

  function toResponse(candidate) {
    const normalized = normalizeCandidate(candidate)
    if (!isUsableCandidate(normalized)) {
      return { ok: false, error: '未能确认当前岗位的完整标题与职位详情，请打开具体岗位详情并等待内容加载完成后重试' }
    }
    return {
      ok: true,
      job: {
        sourceTitle: normalized.title,
        company: normalized.company,
        location: normalized.location,
        address: normalized.address,
        salary: normalized.salary,
        skills: normalized.skills,
        jdText: normalized.description,
        sourceUrl: normalized.sourceUrl,
        sourceId: normalized.sourceId,
        sourcePlatform: normalized.sourcePlatform,
        sourceOriginal: normalized.sourceOriginal,
        platform: normalized.platform,
        employmentType: normalized.employmentType,
        confidence: normalized.confidence,
        receivedAt: Date.now(),
      },
    }
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  globalThis.__AI_RESUME_CONTENT__ = {
    version: '2.1.0',
    adapters,
    registerAdapter,
    normalizeInline,
    normalizeBlock,
    cleanDescription,
    cleanTitle,
    sameJobTitle,
    unique,
    readText,
    readBlock,
    readList,
    canonicalUrl,
    currentPlatform,
    platformName,
    collectJobPostings,
    chooseStructuredJob,
    structuredCandidate,
    splitSkills,
    sanitizeSalary,
    normalizeCandidate,
    isUsableCandidate,
    mergeCandidates,
    toResponse,
    wait,
  }
})()
