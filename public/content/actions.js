(() => {
  const api = globalThis.__AI_RESUME_CONTENT__
  if (!api) return

  /**
   * 页面动作与岗位解析完全分离。这里仅处理用户主动触发的表单回填和投递入口点击，
   * 不会读取或提交招聘表单之外的数据，也不会自动点击最终确认按钮。
   */
  function fillForm(profile) {
    const values = makeValues(profile)
    let filled = 0
    let matched = 0
    const fields = [...document.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea, select')]
    for (const field of fields) {
      if (field.disabled || field.readOnly || !isVisible(field)) continue
      const key = fieldKey(field)
      const value = matchValue(key, values)
      if (!value) continue
      matched += 1

      if (field.tagName === 'SELECT') {
        const option = [...field.options].find((item) => api.normalizeInline(item.textContent).includes(api.normalizeInline(value)))
        if (!option || field.value === option.value) continue
        field.value = option.value
      } else if (field.type === 'radio' || field.type === 'checkbox') {
        const label = fieldKey(field, true)
        if (!api.normalizeInline(label).includes(api.normalizeInline(value)) || field.checked) continue
        field.checked = true
      } else {
        if (api.normalizeInline(field.value) === api.normalizeInline(value)) continue
        setNativeValue(field, value)
      }

      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new Event('change', { bubbles: true }))
      field.dispatchEvent(new Event('blur', { bubbles: true }))
      filled += 1
    }

    filled += fillSegmentedGender(values.gender)
    if (!matched && !filled) return { ok: false, error: '未找到可回填的个人信息字段' }
    return { ok: true, filled, matched }
  }

  function deliverJob(profile) {
    const entry = findDeliveryEntry()
    if (entry) {
      const label = api.normalizeInline(entry.innerText)
      entry.click()
      return { ok: true, action: 'delivery', label }
    }
    const result = fillForm(profile)
    if (result.ok) return { ...result, action: 'autofill' }
    return { ok: false, error: '未找到「立即沟通」或「立即投递」入口，请先打开具体岗位详情' }
  }

  function findDeliveryEntry() {
    const priority = ['立即投递', '投递简历', '立即申请', '马上申请', '申请职位', '立即沟通']
    return [...document.querySelectorAll('button, a, [role="button"], [class*="apply" i], [class*="deliver" i]')]
      .filter((node) => isVisible(node) && !node.hasAttribute('disabled'))
      .map((node) => ({ node, label: api.normalizeInline(node.innerText) }))
      .filter((item) => priority.includes(item.label))
      .sort((left, right) => priority.indexOf(left.label) - priority.indexOf(right.label))[0]?.node || null
  }

  function makeValues(profile) {
    const flat = flatten(profile)
    return {
      name: first(flat, ['name', 'realname', 'username', 'nickname']),
      phone: first(flat, ['phone', 'mobile', 'tel']),
      email: first(flat, ['email']),
      wechat: first(flat, ['wechat', 'weixin']),
      gender: first(flat, ['gender', 'sex']),
      birthday: first(flat, ['birthday', 'birth', 'birthdate']),
      target: first(flat, ['target_position', 'targetposition', 'job_intention', 'expected_position']),
      summary: first(flat, ['summary', 'advantage', 'self_intro', 'introduction', 'personal_advantage']),
      education: first(flat, ['education', 'degree', 'school', 'major']),
      experience: first(flat, ['work_experience', 'experience', 'workexperience']),
      project: first(flat, ['project_experience', 'project', 'projectexperience']),
    }
  }

  function matchValue(key, values) {
    if (/姓名|name|真实姓名/.test(key)) return values.name
    if (/手机|电话|phone|mobile|tel/.test(key)) return values.phone
    if (/邮箱|email|mail/.test(key)) return values.email
    if (/微信|wechat|weixin/.test(key)) return values.wechat
    if (/性别|gender|sex/.test(key)) return values.gender
    if (/出生|生日|birth/.test(key)) return values.birthday
    if (/期望职位|意向岗位|target|intention/.test(key)) return values.target
    if (/个人优势|自我介绍|个人简介|summary|introduction/.test(key)) return values.summary
    if (/工作经历|work experience/.test(key)) return values.experience
    if (/项目经历|project experience/.test(key)) return values.project
    if (/教育经历|学历|学校|education|degree/.test(key)) return values.education
    return ''
  }

  function fieldKey(field, includeLabel = false) {
    const idLabel = field.id ? document.querySelector(`label[for="${CSS.escape(field.id)}"]`)?.innerText : ''
    const nearby = ancestorText(field, includeLabel ? 5 : 3)
    return api.normalizeInline([
      field.name,
      field.id,
      field.placeholder,
      field.getAttribute('aria-label'),
      idLabel,
      nearby,
    ].filter(Boolean).join(' ')).toLocaleLowerCase()
  }

  function ancestorText(field, depth) {
    const parts = []
    let current = field
    for (let index = 0; current && index < depth; index += 1, current = current.parentElement) {
      const text = api.normalizeInline(current.innerText)
      if (text && text.length <= 260) parts.push(text)
      const sibling = api.normalizeInline(current.previousElementSibling?.innerText)
      if (sibling) parts.push(sibling)
    }
    return parts.join(' ')
  }

  function fillSegmentedGender(gender) {
    if (!gender) return 0
    const normalized = api.normalizeInline(gender)
    const target = [...document.querySelectorAll('button, [role="button"], span, div')]
      .find((node) => api.normalizeInline(node.innerText) === normalized && /性别/.test(ancestorText(node, 5)))
    if (!target || target.getAttribute('aria-pressed') === 'true' || /selected|active|checked/.test(target.className || '')) return 0
    target.click()
    return 1
  }

  function flatten(input, prefix = '', output = {}) {
    if (Array.isArray(input)) {
      input.forEach((item, index) => flatten(item, `${prefix}${index}`, output))
      return output
    }
    if (input && typeof input === 'object') {
      Object.entries(input).forEach(([key, value]) => flatten(value, `${prefix}${key}`, output))
      return output
    }
    if (input !== undefined && input !== null && String(input).trim()) output[prefix.toLocaleLowerCase()] = String(input).trim()
    return output
  }

  function first(values, keys) {
    const key = Object.keys(values).find((item) => keys.some((needle) => item.includes(needle)))
    return key ? values[key] : ''
  }

  function isVisible(element) {
    const style = getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
  }

  function setNativeValue(element, value) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set
    if (setter) setter.call(element, value)
    else element.value = value
  }

  api.actions = { fillForm, deliverJob }
})()
