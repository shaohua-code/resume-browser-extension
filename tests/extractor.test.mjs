import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const publicRoot = new URL('../public/', import.meta.url)

function node(text, extra = {}) {
  return { innerText: text, textContent: text, ...extra }
}

function root(selectors = {}, lists = {}) {
  return {
    querySelector(selector) { return selectors[selector] || null },
    querySelectorAll(selector) { return lists[selector] || [] },
  }
}

function createDocument({ selectors = {}, lists = {}, jsonLd = [] } = {}) {
  const documentRoot = root(selectors, lists)
  return {
    ...documentRoot,
    createElement() {
      return {
        _text: '',
        set innerHTML(value) {
          this._text = String(value)
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>|<\/div>|<\/li>|<\/section>|<\/h\d>/gi, '\n')
            .replace(/<[^>]+>/g, '')
        },
        get textContent() { return this._text },
        querySelectorAll() { return [] },
      }
    },
    querySelectorAll(selector) {
      if (selector === 'script[type="application/ld+json"]') {
        return jsonLd.map((value) => ({ textContent: JSON.stringify(value) }))
      }
      return lists[selector] || []
    },
  }
}

async function loadScripts(context, paths) {
  for (const path of paths) {
    const source = await readFile(new URL(path, publicRoot), 'utf8')
    vm.runInContext(source, context, { filename: path })
  }
}

function createContext({ href, document }) {
  const url = new URL(href)
  const context = vm.createContext({
    URL,
    document,
    location: {
      href: url.href,
      hostname: url.hostname,
      pathname: url.pathname,
    },
    setTimeout,
    clearTimeout,
    console,
  })
  context.globalThis = context
  return context
}

async function test51JobStructuredMerge() {
  const canonical = 'https://jobs.51job.com/shenzhen-luohuqu/172435513.html'
  const description = [
    '工作内容',
    '1、负责公司进出口贸易平台及内部管理系统的后端代码开发与功能迭代；',
    '2、设计并优化数据库结构，保障高并发场景下交易数据的安全性与一致性；',
    '任职要求',
    '1、本科及以上学历，周末双休；',
    '2、了解 Java/Python/Node.js 等主流语言之一。',
  ].join('\n')
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: '后端/前端开发工程师',
    description,
    url: canonical,
    hiringOrganization: { '@type': 'Organization', name: '深圳市韩泫贸易有限公司' },
    jobLocation: {
      '@type': 'Place',
      address: {
        addressLocality: '深圳/罗湖区',
        streetAddress: '深圳罗湖区南方证券大厦',
      },
    },
    skills: ['Java', 'C', 'MySQL', 'Redis', 'Python'],
    salaryCurrency: 'CNY',
    baseSalary: { value: { minValue: 9000, maxValue: 14000, unitText: '月薪' } },
  }
  const document = createDocument({
    selectors: {
      'link[rel="canonical"]': { href: canonical },
      '.jTitle h1': node('后端/前端开发工程师'),
      '.jTitle strong': node('9千-1.4万·14薪'),
      '.job-detail .bmsg.job_msg.inbox': node(description),
      '.corp-card .com_name p': node('深圳市韩泫贸易有限公司'),
      '.msg.ltype .type_2': node('深圳-罗湖区'),
      // 实际 DOM 只显示楼宇名，JSON-LD 提供完整城区地址，合并后应保留后者。
      '.job-address .fp': node('南方证券大厦'),
    },
    jsonLd: [structured],
  })
  const context = createContext({ href: `${canonical}?s=job-list`, document })
  await loadScripts(context, ['content/shared.js', 'content/adapters/structured.js', 'content/adapters/51job.js'])
  const api = context.__AI_RESUME_CONTENT__
  const schema = api.adapters.find((item) => item.id === 'structured-job-posting').extract()
  const site = api.adapters.find((item) => item.id === '51job-detail').extract()
  const response = api.toResponse(api.mergeCandidates(site, schema))

  assert.equal(response.ok, true)
  assert.equal(response.job.sourceTitle, '后端/前端开发工程师')
  assert.equal(response.job.company, '深圳市韩泫贸易有限公司')
  assert.equal(response.job.salary, '9千-1.4万·14薪')
  assert.equal(response.job.location, '深圳-罗湖区')
  assert.equal(response.job.address, '深圳罗湖区南方证券大厦')
  assert.deepEqual([...response.job.skills], ['Java', 'C', 'MySQL', 'Redis', 'Python'])
  assert.equal(response.job.sourceUrl, canonical)
  assert.match(response.job.jdText, /负责公司进出口贸易平台/)
  assert.doesNotMatch(response.job.jdText, /竞争力分析|微信扫码分享|招聘官|公司信息/)
}

async function testDescriptionBoundariesAndMismatch() {
  const document = createDocument()
  const context = createContext({ href: 'https://www.zhaopin.com/jobdetail/example.htm', document })
  await loadScripts(context, ['content/shared.js'])
  const api = context.__AI_RESUME_CONTENT__
  const cleaned = api.cleanDescription([
    '竞争力分析',
    '职位描述',
    '负责业务系统开发。',
    '任职要求',
    '熟悉 JavaScript。',
    '职位招聘官',
    '徐女士',
    '公司信息',
  ].join('\n'))
  assert.equal(cleaned, '职位描述\n负责业务系统开发。\n任职要求\n熟悉 JavaScript。')

  const current = api.normalizeCandidate({ title: '前端工程师', description: '负责前端系统开发与性能优化，参与组件库建设和项目交付。', platform: 'zhaopin' })
  const staleSchema = api.normalizeCandidate({ title: '后端工程师', company: '错误公司', description: '负责后端系统开发与数据库维护，参与接口设计和服务治理。', platform: 'zhaopin' })
  assert.equal(api.mergeCandidates(current, staleSchema).company, '')
}

async function testBossActiveCardConsistency() {
  const card = root({
    '.job-title .job-name': node('前端开发工程师'),
    '.job-card-footer .boss-name': node('TCL实业'),
    '.company-location': node('深圳·南山区·科技园'),
    'a.job-name[href], a[href*="job_detail"], a[href*="job/"]': node('前端开发工程师', { href: 'https://www.zhipin.com/job_detail/example123.html' }),
    '.salary': node('\uE001\uE002-\uE003\uE004K'),
  })
  const detail = root({
    '.job-detail-info .job-name': node('前端开发工程师'),
    '.job-address .job-address-desc': node('深圳南山区TCL科学园国际E城TCL'),
    '.job-detail-body .desc': node('岗位职责\n负责前端架构设计与核心功能开发。\n任职要求\n熟悉 Vue、TypeScript 和工程化。'),
  }, {
    '.job-detail-header .tag-list li': [node('深圳'), node('5-10年'), node('本科')],
    '.job-detail-body .job-label-list li': [node('TypeScript'), node('Vue'), node('Node.js')],
  })
  const document = createDocument({
    selectors: {
      '.job-detail-container .job-detail-box, .job-detail-box, .job-detail-container, .job-detail-wrapper': detail,
      '.job-card-wrap.active, .job-card-wrapper.active, .job-list-box [class*="job-card"][class*="active"]': card,
    },
  })
  const context = createContext({ href: 'https://www.zhipin.com/web/geek/jobs', document })
  await loadScripts(context, ['content/shared.js', 'content/adapters/zhipin.js'])
  context.__AI_RESUME_CONTENT__.wait = async () => {}
  const candidate = await context.__AI_RESUME_CONTENT__.adapters.find((item) => item.id === 'zhipin-current-job').extract()
  const response = context.__AI_RESUME_CONTENT__.toResponse(candidate)
  assert.equal(response.job.company, 'TCL实业')
  assert.equal(response.job.location, '深圳')
  assert.equal(response.job.address, '深圳南山区TCL科学园国际E城TCL')
  assert.equal(response.job.salary, '')
  assert.equal(response.job.sourceUrl, 'https://www.zhipin.com/job_detail/example123.html')
  assert.deepEqual([...response.job.skills], ['TypeScript', 'Vue', 'Node.js'])
}

await test51JobStructuredMerge()
await testDescriptionBoundariesAndMismatch()
await testBossActiveCardConsistency()
console.log('Extractor regression tests passed.')
