'use strict';
// Test helpers — NOT a test file (no `node:test` calls here).
// Loaded by both boot-smoke.test.js and physics.test.js.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function makeStubElement(tag = 'div', id = '') {
  const listeners = {};
  const classList = {
    _set: new Set(),
    add(...c) { c.forEach(x => this._set.add(x)); },
    remove(...c) { c.forEach(x => this._set.delete(x)); },
    toggle(c, on) {
      if (on === undefined) {
        if (this._set.has(c)) this._set.delete(c); else this._set.add(c);
      } else {
        if (on) this._set.add(c); else this._set.delete(c);
      }
    },
    contains(c) { return this._set.has(c); },
  };
  const el = {
    tagName: tag.toUpperCase(),
    id,
    style: new Proxy({ setProperty(k, v){ this[k] = v; }, removeProperty(k){ delete this[k]; }, getPropertyValue(k){ return this[k] ?? ''; } }, { get: (t, k) => t[k], set: (t, k, v) => { t[k] = v; return true; } }),
    classList,
    children: [],
    dataset: {},
    textContent: '',
    innerHTML: '',
    width: 1100,
    height: 720,
    offsetWidth: 1100,
    offsetHeight: 720,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener() {},
    dispatchEvent(ev) { (listeners[ev.type] || []).forEach(fn => fn(ev)); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
    querySelector() { return makeStubElement(); },
    querySelectorAll() { return []; },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(name, val) { this[name] = val; },
    getAttribute(name) { return this[name] ?? null; },
    getContext() {
      const grad = { addColorStop: () => {} };
      return new Proxy({}, {
        get: (_, k) => {
          if (k === 'canvas') return el;
          if (['createLinearGradient', 'createRadialGradient', 'createPattern'].includes(k))
            return () => grad;
          if (k === 'getImageData')
            return () => ({ data: new Uint8ClampedArray(4) });
          if (k === 'measureText')
            return () => ({ width: 10 });
          return typeof k === 'string' && k.startsWith('@@') ? undefined : (() => {});
        },
        set: () => true,
      });
    },
    onclick: null,
    onmousedown: null,
    onmouseup: null,
  };
  return el;
}

function buildSandbox() {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, makeStubElement('div', id));
    return elements.get(id);
  };
  const documentStub = {
    getElementById: get,
    querySelector: () => makeStubElement(),
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    body: makeStubElement('body'),
    documentElement: makeStubElement('html'),
    hidden: false,
    createElement: (tag) => makeStubElement(tag),
  };
  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    document: documentStub,
    window: null,
    navigator: { userAgent: 'node-stub', maxTouchPoints: 0 },
    screen: { orientation: null },
    location: { href: 'http://localhost/', pathname: '/' },
    localStorage: {
      _store: {},
      getItem(k) { return this._store[k] ?? null; },
      setItem(k, v) { this._store[k] = String(v); },
      removeItem(k) { delete this._store[k]; },
      clear() { this._store = {}; },
    },
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    AudioContext: function () {
      return {
        state: 'running', resume: () => Promise.resolve(),
        createOscillator: () => ({ connect:()=>{}, start:()=>{}, stop:()=>{}, frequency:{value:0,setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}}, type:'sine' }),
        createGain: () => ({ connect:()=>{}, gain:{value:0,setValueAtTime:()=>{},linearRampToValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{},setTargetAtTime:()=>{}}}),
        createBiquadFilter: () => ({ connect:()=>{}, type:'lowpass', frequency:{value:0,setTargetAtTime:()=>{}}, Q:{value:0} }),
        destination: {}, currentTime: 0,
      };
    },
    Audio: function (src) { return { src, loop:false, preload:'auto', volume:0, paused:true, currentTime:0, addEventListener:()=>{}, play:()=>Promise.resolve(), pause:()=>{} }; },
    Image: function () { return { addEventListener:()=>{}, src:'' }; },
    confirm: () => true,
    prompt: () => '',
    alert: () => {},
    innerWidth: 1100,
    innerHeight: 720,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  elements.set('game', makeStubElement('canvas', 'game'));
  return { sandbox, elements };
}

const FILES = [
  '01-core.js','02-input.js','03-actors.js','04-enemies.js','05-flow.js',
  '06-audio.js','07-loop.js','08-update.js','09-boss-ai.js','10-modes.js',
  '11-render.js','12-icons.js','13-hub.js','14-boss-arena.js','15-3d-mode.js'
];

function loadAllAsBrowser(sandbox) {
  const ctx = vm.createContext(sandbox);
  const combined = FILES.map(f =>
    `// ===== ${f} =====\n` + fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')
  ).join('\n');
  // Expose key locals so tests can introspect them.
  const tail = `;Object.assign(globalThis, {
    __exports__: {
      canvas: typeof canvas!=='undefined' ? canvas : undefined,
      state, save, keys,
      startSurvival, beginRound, endRound, update, render, makePlayer,
      resetKeys, fitCanvas, IS_PHONE, isTouch,
    }
  });`;
  vm.runInContext(combined + tail, ctx, { filename: 'js/[combined]' });
  return ctx;
}

// Evaluate a single expression inside the sandbox and return its value.
function vm_eval(ctx, expr) {
  return vm.runInContext(`(()=>{ return ${expr}; })()`, ctx);
}
// Run one or more statements inside the sandbox, no return value.
function vm_run(ctx, stmts) {
  return vm.runInContext(`(()=>{ ${stmts} })()`, ctx);
}

function freshGame() {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  vm_run(ctx, "startSurvival('medium');");
  return {
    ctx,
    get player() { return vm_eval(ctx, 'player'); },
    get state()  { return vm_eval(ctx, 'state');  },
    get keys()   { return vm_eval(ctx, 'keys');   },
    update: (dt) => vm_run(ctx, `update(${dt});`),
    setKey: (k, v) => vm_run(ctx, `keys[${JSON.stringify(k)}] = ${v};`),
  };
}

module.exports = { buildSandbox, loadAllAsBrowser, vm_eval, vm_run, freshGame, FILES, ROOT };
