import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

class MockElement {
  constructor(tagName, document) {
    this.tagName = tagName
    this.ownerDocument = document
    this.attributes = new Map()
    this.dataset = {}
    this.listeners = new Map()
    this.textContent = ''
    this.id = ''
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  getAttribute(name) { return this.attributes.get(name) }
  addEventListener(type, listener) { this.listeners.set(type, listener) }
  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type)
  }
  async click() { await this.listeners.get('click')?.() }
  attachShadow() {
    this.shadowRoot = new MockShadowRoot(this.ownerDocument)
    return this.shadowRoot
  }
  remove() { this.ownerDocument.remove(this) }
}

class MockShadowRoot {
  constructor(document) {
    this.document = document
    this.nodes = {}
  }

  // 测试只模拟 launcher 使用的静态节点，不实现无关的 HTML 解析行为。
  set innerHTML(value) {
    this.html = value
    this.nodes.button = new MockElement('button', this.document)
    this.nodes.button.setAttribute('aria-busy', 'false')
    this.nodes.label = new MockElement('span', this.document)
    this.nodes.label.textContent = '打开岗位助手'
    this.nodes.status = new MockElement('p', this.document)
  }

  querySelector(selector) {
    if (selector === 'button') return this.nodes.button
    if (selector === '.label') return this.nodes.label
    if (selector === '.status') return this.nodes.status
    return null
  }
}

function createDocument() {
  const nodes = new Map()
  const document = {
    createElement(tagName) { return new MockElement(tagName, document) },
    getElementById(id) { return nodes.get(id) || null },
    remove(node) { if (node.id) nodes.delete(node.id) },
    documentElement: {
      append(node) { if (node.id) nodes.set(node.id, node) },
    },
  }
  return document
}

const source = await readFile(new URL('../public/content/launcher.js', import.meta.url), 'utf8')
const messages = []
const document = createDocument()
const context = vm.createContext({
  document,
  chrome: {
    runtime: {
      async sendMessage(message) {
        messages.push(message)
        return { ok: true, detected: true }
      },
    },
  },
  clearTimeout() {},
  setTimeout() { return 1 },
})
context.globalThis = context

vm.runInContext(source, context)
const firstHost = document.getElementById('__ai-resume-floating-launcher')
assert.ok(firstHost, 'launcher should be appended to the document')
assert.match(firstHost.shadowRoot.html, /打开 AI 简历岗位助手/)

const button = firstHost.shadowRoot.querySelector('button')
await button.click()
assert.equal(messages.length, 1)
assert.equal(messages[0].type, 'OPEN_SIDE_PANEL_FROM_PAGE')
assert.equal(button.getAttribute('aria-busy'), 'false')
assert.equal(firstHost.shadowRoot.querySelector('.status').textContent, '已打开并识别当前岗位')

// 再次注入必须替换旧实例，验证热更新不会产生重复悬浮入口。
vm.runInContext(source, context)
const secondHost = document.getElementById('__ai-resume-floating-launcher')
assert.ok(secondHost)
assert.notEqual(secondHost, firstHost)
assert.equal(button.listeners.size, 0)

console.log('Floating launcher regression tests passed.')
