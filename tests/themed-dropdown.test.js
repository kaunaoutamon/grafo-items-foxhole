const test = require('node:test');
const assert = require('node:assert/strict');

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.className = '';
    this.classList = {
      add: (...names) => {
        this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' ');
      }
    };
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }

  dispatch(type, properties = {}) {
    const event = {
      type,
      target: this,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...properties
    };
    for (const callback of this.listeners.get(type) || []) callback(event);
    return event;
  }

  dispatchEvent(event) {
    this.dispatch(event.type, { bubbles: event.bubbles });
    return true;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode?.removeChild(node);
      node.parentNode = this;
      this.children.push(node);
    }
  }

  appendChild(node) {
    this.append(node);
    return node;
  }

  insertBefore(node, reference) {
    node.parentNode?.removeChild(node);
    const index = this.children.indexOf(reference);
    node.parentNode = this;
    this.children.splice(index < 0 ? this.children.length : index, 0, node);
  }

  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parentNode = null;
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...nodes);
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = node => {
      for (const child of node.children) {
        if (selector === '[role="option"]' && child.getAttribute('role') === 'option') found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }

  closest(selector) {
    if (selector === '[role="option"]' && this.getAttribute('role') === 'option') return this;
    return this.parentNode?.closest(selector) || null;
  }

  scrollIntoView() {}
  focus() { this.focused = true; }
}

class FakeSelect extends FakeElement {
  constructor(options) {
    super('select');
    this.options = options;
    this.value = options.find(option => option.selected)?.value ?? options[0]?.value ?? '';
  }

  get value() { return this.currentValue; }
  set value(value) { this.currentValue = value; }

  get selectedIndex() {
    return this.options.findIndex(option => option.value === this.currentValue);
  }
}

globalThis.Element = FakeElement;
globalThis.document = { createElement: tagName => new FakeElement(tagName) };
require('../themed-dropdown.js');

test('styled select mirrors selected values and supports pointer and keyboard choices', () => {
  const parent = new FakeElement('div');
  const select = new FakeSelect([
    { value: '', textContent: 'Seleccioná una opción...' },
    { value: 'salvage', textContent: 'Campo de Salvage' },
    { value: 'refinery', textContent: 'Refinería' }
  ]);
  select.setAttribute('aria-label', 'Receta de material');
  parent.append(select);
  let changeEvents = 0;
  select.addEventListener('change', () => changeEvents++);

  const controller = ThemedDropdown.enhance(select);
  const trigger = controller.trigger;
  const menu = trigger.parentNode.children.find(child => child.getAttribute('role') === 'listbox');

  assert.equal(trigger.textContent, 'Seleccioná una opción...');
  assert.equal(trigger.getAttribute('aria-label'), 'Receta de material');

  trigger.dispatch('click');
  assert.equal(menu.hidden, false);
  assert.equal(menu.querySelectorAll('[role="option"]').length, 3);

  const pointerSelection = menu.children[1];
  menu.dispatch('pointerdown', { target: pointerSelection });
  menu.dispatch('click', { target: pointerSelection });
  assert.equal(select.value, 'salvage');
  assert.equal(trigger.textContent, 'Campo de Salvage');
  assert.equal(menu.hidden, true);
  assert.equal(changeEvents, 1);

  trigger.dispatch('keydown', { key: 'ArrowDown' });
  trigger.dispatch('keydown', { key: 'ArrowDown' });
  trigger.dispatch('keydown', { key: 'Enter' });
  assert.equal(select.value, 'refinery');
  assert.equal(trigger.textContent, 'Refinería');
  assert.equal(changeEvents, 2);

  select.value = '';
  controller.refresh();
  assert.equal(trigger.textContent, 'Seleccioná una opción...');
});
