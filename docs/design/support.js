// Local renderer for the *.dc.html design files (the hosted support.js is not in this repo).
// It defines DCLogic, runs the text/x-dc script with the data-props defaults, expands <sc-for>, <sc-if>,
// <dc-import> and {{a.b}} inside <x-dc>, and moves <helmet> into <head>. window.__dcDone = true when done.
(function () {
  class DCLogic {
    constructor(props) {
      this.props = props || {};
    }
  }
  window.DCLogic = DCLogic;

  function defaults(script) {
    const raw = JSON.parse(script.getAttribute('data-props') || '{}');
    const out = {};
    for (const [k, v] of Object.entries(raw)) if (!k.startsWith('$')) out[k] = v && v.default;
    return out;
  }
  function component(script, props) {
    const Cls = new Function('DCLogic', script.textContent + '\nreturn Component;')(DCLogic);
    return new Cls(props).renderVals();
  }
  function get(scope, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
  }
  const RE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  function fill(str, scope) {
    return str.replace(RE, (_, p) => {
      const v = get(scope, p);
      return v == null ? '' : String(v);
    });
  }
  function value(str, scope) {
    const m = /^\s*\{\{\s*([\w.$]+)\s*\}\}\s*$/.exec(str || '');
    if (m) return get(scope, m[1]);
    return fill(str || '', scope);
  }
  async function walk(node, scope, doc) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        if (RE.test(child.nodeValue)) child.nodeValue = fill(child.nodeValue, scope);
        RE.lastIndex = 0;
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'sc-for') {
        const list = value(child.getAttribute('list'), scope) || [];
        const as = child.getAttribute('as') || 'item';
        const frag = doc.createDocumentFragment();
        for (const item of list) {
          const holder = doc.createElement('div');
          holder.innerHTML = child.innerHTML;
          await walk(holder, { ...scope, [as]: item }, doc);
          while (holder.firstChild) frag.appendChild(holder.firstChild);
        }
        child.replaceWith(frag);
        continue;
      }
      if (tag === 'sc-if') {
        if (value(child.getAttribute('value'), scope)) {
          await walk(child, scope, doc);
          child.replaceWith(...child.childNodes);
        } else child.remove();
        continue;
      }
      if (tag === 'dc-import') {
        const name = child.getAttribute('name');
        const props = {};
        for (const a of child.attributes) if (!['name'].includes(a.name) && !a.name.startsWith('hint-')) props[a.name] = value(a.value, scope);
        const html = await (await fetch(`${name}.dc.html`)).text();
        const other = new DOMParser().parseFromString(html, 'text/html');
        const s = other.querySelector('script[type="text/x-dc"]');
        const vals = component(s, { ...defaults(s), ...props });
        const x = other.querySelector('x-dc');
        x.querySelector('helmet')?.remove();
        const holder = doc.createElement('div');
        holder.innerHTML = x.innerHTML;
        await walk(holder, vals, doc);
        child.replaceWith(...holder.childNodes);
        continue;
      }
      for (const a of [...child.attributes]) if (a.value.includes('{{')) child.setAttribute(a.name, fill(a.value, scope));
      await walk(child, scope, doc);
    }
  }
  async function run() {
    const script = document.querySelector('script[type="text/x-dc"]');
    const x = document.querySelector('x-dc');
    const helmet = x.querySelector('helmet');
    if (helmet) {
      for (const el of [...helmet.children]) document.head.appendChild(el);
      helmet.remove();
    }
    const vals = component(script, defaults(script));
    await walk(x, vals, document);
    x.replaceWith(...x.childNodes);
    await document.fonts.ready;
    window.__dcDone = true;
  }
  document.addEventListener('DOMContentLoaded', () =>
    run().catch((e) => {
      window.__dcError = String(e && e.stack ? e.stack : e);
      window.__dcDone = true;
    })
  );
})();
