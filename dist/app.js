/* Procreate Web 0.2.0 — build 2026-11-12T12:29:16.261Z — ES5 estricto */

/* ---- 00-core.js ---- */

/* ==========================================================================
   00 — Núcleo: utilidades, entorno, eventos, DOM y matrices.
   ES5 estricto. Sin dependencias.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});

  PCW.version = '0.2.0-shell';
  PCW.build = 'fase-2';

  /* ---------------------------------------------------------------- util */

  function clamp(v, min, max) {
    if (v < min) { return min; }
    if (v > max) { return max; }
    return v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function uid(prefix) {
    var n = Math.floor(Math.random() * 0xffffff).toString(36);
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + n;
  }

  var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function formatDate(ts) {
    var d = new Date(ts || Date.now());
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function formatDim(w, h) {
    return w + ' × ' + h;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) { return bytes + ' B'; }
    if (bytes < 1024 * 1024) { return (bytes / 1024).toFixed(0) + ' KB'; }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseHexColor(str) {
    if (!str) { return null; }
    var s = String(str).replace(/^\s+|\s+$/g, '');
    if (s.charAt(0) === '#') { s = s.substring(1); }
    if (s.length === 3) {
      s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) +
        s.charAt(2) + s.charAt(2);
    }
    if (!/^[0-9a-fA-F]{6}$/.test(s)) { return null; }
    return {
      r: parseInt(s.substring(0, 2), 16),
      g: parseInt(s.substring(2, 4), 16),
      b: parseInt(s.substring(4, 6), 16)
    };
  }

  function hexToRgb(hex) {
    return parseHexColor(hex);
  }

  function componentToHex(c) {
    var v = Math.round(clamp(c, 0, 255));
    return (v < 16 ? '0' : '') + v.toString(16);
  }

  function rgbToHex(r, g, b) {
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
  }

  function rgbToHsv(r, g, b) {
    r = r / 255; g = g / 255; b = b / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var d = max - min;
    var h = 0;
    if (d !== 0) {
      if (max === r) {
        h = ((g - b) / d) % 6;
      } else if (max === g) {
        h = (b - r) / d + 2;
      } else {
        h = (r - g) / d + 4;
      }
      h *= 60;
      if (h < 0) { h += 360; }
    }
    var s = max === 0 ? 0 : d / max;
    return { h: h, s: s, v: max };
  }

  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 1);
    v = clamp(v, 0, 1);
    var c = v * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = v - c;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  function hsvToHex(h, s, v) {
    var rgb = hsvToRgb(h, s, v);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var self = this;
      var args = arguments;
      if (timer) { clearTimeout(timer); }
      timer = setTimeout(function () {
        timer = null;
        fn.apply(self, args);
      }, wait);
    };
  }

  function throttle(fn, wait) {
    var last = 0;
    var timer = null;
    return function () {
      var self = this;
      var args = arguments;
      var now = Date.now();
      var remaining = wait - (now - last);
      if (remaining <= 0) {
        if (timer) { clearTimeout(timer); timer = null; }
        last = now;
        fn.apply(self, args);
      } else if (!timer) {
        timer = setTimeout(function () {
          timer = null;
          last = Date.now();
          fn.apply(self, args);
        }, remaining);
      }
    };
  }

  function isArray(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function isObject(v) {
    return v !== null && typeof v === 'object' && !isArray(v);
  }

  function extend(target) {
    var i, key;
    for (i = 1; i < arguments.length; i += 1) {
      var src = arguments[i];
      if (!src) { continue; }
      for (key in src) {
        if (Object.prototype.hasOwnProperty.call(src, key)) {
          target[key] = src[key];
        }
      }
    }
    return target;
  }

  function copy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* Relleno por inundación con umbral RGBA. Devuelve la máscara y el rectángulo
     de la zona conexa, o null si el punto no es rellenable. Las máscaras
     opcionales allowA/allowB excluyen los píxeles con alfa 0 (selección y
     bloqueo alfa). Es una función pura para poder probarla sin DOM. */
  function floodRegion(data, w, h, sx, sy, tol, allowA, allowB) {
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) { return null; }
    var start = sy * w + sx;
    if (allowA && allowA[start * 4 + 3] === 0) { return null; }
    if (allowB && allowB[start * 4 + 3] === 0) { return null; }
    var sr = data[start * 4];
    var sg = data[start * 4 + 1];
    var sb = data[start * 4 + 2];
    var sa = data[start * 4 + 3];
    var visited = new Uint8Array(w * h);
    var mask = new Uint8Array(w * h);
    var stack = [start];
    var x0 = w;
    var y0 = h;
    var x1 = -1;
    var y1 = -1;
    var count = 0;

    function fits(idx) {
      if (idx < 0 || idx >= w * h) { return false; }
      var i4 = idx * 4;
      if (Math.abs(data[i4] - sr) > tol) { return false; }
      if (Math.abs(data[i4 + 1] - sg) > tol) { return false; }
      if (Math.abs(data[i4 + 2] - sb) > tol) { return false; }
      if (Math.abs(data[i4 + 3] - sa) > tol) { return false; }
      if (allowA && allowA[i4 + 3] === 0) { return false; }
      if (allowB && allowB[i4 + 3] === 0) { return false; }
      return true;
    }

    while (stack.length) {
      var idx = stack.pop();
      if (visited[idx]) { continue; }
      var y = Math.floor(idx / w);
      var row = y * w;
      var col = idx - row;
      var left = col;
      while (left > 0 && !visited[row + left - 1] && fits(row + left - 1)) {
        left -= 1;
      }
      var right = col;
      while (right < w - 1 && !visited[row + right + 1] && fits(row + right + 1)) {
        right += 1;
      }
      var x;
      for (x = left; x <= right; x += 1) {
        var p = row + x;
        if (visited[p]) { continue; }
        visited[p] = 1;
        mask[p] = 1;
        count += 1;
        if (x < x0) { x0 = x; }
        if (x > x1) { x1 = x; }
        if (y < y0) { y0 = y; }
        if (y > y1) { y1 = y; }
        if (y > 0) {
          var up = p - w;
          if (!visited[up] && fits(up)) { stack.push(up); }
        }
        if (y < h - 1) {
          var down = p + w;
          if (!visited[down] && fits(down)) { stack.push(down); }
        }
      }
    }
    if (!count) { return null; }
    return {
      mask: mask,
      x0: x0, y0: y0, x1: x1, y1: y1,
      count: count
    };
  }

  /* Clasifica un toque multitáctil como deshacer (2 dedos), rehacer (3 dedos)
     o nada. Solo cuenta como toque si no hubo desplazamiento apreciable y
     duró menos que GESTURE_TAP_MS. */
  var GESTURE_TAP_MS = 900;
  var GESTURE_TAP_SLOP = 16;

  function tapHistoryAction(maxFingers, moved, durationMs) {
    if (moved) { return null; }
    if (maxFingers < 2 || maxFingers > 3) { return null; }
    if (durationMs < 0 || durationMs > GESTURE_TAP_MS) { return null; }
    return maxFingers === 2 ? 'undo' : 'redo';
  }

  PCW.util = {
    clamp: clamp,
    lerp: lerp,
    uid: uid,
    pad2: pad2,
    formatDate: formatDate,
    formatDim: formatDim,
    formatBytes: formatBytes,
    escapeHtml: escapeHtml,
    parseHexColor: parseHexColor,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    rgbToHsv: rgbToHsv,
    hsvToRgb: hsvToRgb,
    hsvToHex: hsvToHex,
    debounce: debounce,
    throttle: throttle,
    isArray: isArray,
    isObject: isObject,
    extend: extend,
    copy: copy,
    floodRegion: floodRegion,
    tapHistoryAction: tapHistoryAction,
    GESTURE_TAP_MS: GESTURE_TAP_MS,
    GESTURE_TAP_SLOP: GESTURE_TAP_SLOP
  };

  /* --------------------------------------------------------------- entorno */

  var ua = (typeof navigator !== 'undefined' && navigator.userAgent) ?
    navigator.userAgent : '';
  var iosMatch = /OS (\d+)_(\d+)/.exec(ua);
  var navPlatform = (typeof navigator !== 'undefined' && navigator.platform) ?
    navigator.platform : '';
  var navTouchPoints = (typeof navigator !== 'undefined' && navigator.maxTouchPoints) ?
    navigator.maxTouchPoints : 0;
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navPlatform === 'MacIntel' && navTouchPoints > 1);
  var isSafari = /Safari/.test(ua) && !/Chrome|CriOS|Android/.test(ua);
  var dpr = (typeof root.devicePixelRatio === 'number' && root.devicePixelRatio > 0) ?
    root.devicePixelRatio : 1;

  var hasIndexedDB = false;
  try { hasIndexedDB = !!root.indexedDB; } catch (e) { hasIndexedDB = false; }

  var hasWebSQL = false;
  try { hasWebSQL = typeof root.openDatabase === 'function'; } catch (e2) { hasWebSQL = false; }

  var hasDownload = false;
  var hasBlob = false;
  var hasTouch = false;
  var canvasBlend = false;

  if (typeof document !== 'undefined') {
    try {
      hasDownload = 'download' in document.createElement('a');
    } catch (e3) { hasDownload = false; }
    try {
      hasBlob = !!root.Blob && !!root.URL && !!root.URL.createObjectURL;
    } catch (e4) { hasBlob = false; }
    hasTouch = ('ontouchstart' in root) || navTouchPoints > 0;
    try {
      var c = document.createElement('canvas');
      var ctx = c.getContext('2d');
      if (ctx) {
        ctx.globalCompositeOperation = 'multiply';
        canvasBlend = ctx.globalCompositeOperation === 'multiply';
      }
    } catch (e5) { canvasBlend = false; }
  }

  PCW.env = {
    ua: ua,
    isIOS: !!isIOS,
    isSafari: isSafari,
    iosVersion: iosMatch ? (parseInt(iosMatch[1], 10) + '.' + iosMatch[2]) : '',
    dpr: dpr,
    screenW: (typeof screen !== 'undefined' ? screen.width : 0),
    screenH: (typeof screen !== 'undefined' ? screen.height : 0),
    hasIndexedDB: hasIndexedDB,
    hasWebSQL: hasWebSQL,
    hasDownload: hasDownload,
    hasBlob: hasBlob,
    hasTouch: !!hasTouch,
    canvasBlend: canvasBlend,
    platform: (typeof navigator !== 'undefined' ? navigator.platform : '')
  };

  /* ---------------------------------------------------------------- eventos */

  var listeners = {};

  PCW.events = {
    on: function (name, fn) {
      if (!listeners[name]) { listeners[name] = []; }
      listeners[name].push(fn);
      return fn;
    },
    off: function (name, fn) {
      if (!listeners[name]) { return; }
      var i;
      for (i = 0; i < listeners[name].length; i += 1) {
        if (listeners[name][i] === fn) {
          listeners[name].splice(i, 1);
          return;
        }
      }
    },
    emit: function (name, data) {
      var list = listeners[name];
      if (!list) { return; }
      var copyList = list.slice(0);
      var i;
      for (i = 0; i < copyList.length; i += 1) {
        try {
          copyList[i](data);
        } catch (err) {
          PCW.logError && PCW.logError('events:' + name, err);
        }
      }
    }
  };

  /* ------------------------------------------------------------------- DOM */

  function qs(sel, scope) {
    return (scope || document).querySelector(sel);
  }

  function qsa(sel, scope) {
    var list = (scope || document).querySelectorAll(sel);
    return Array.prototype.slice.call(list);
  }

  function id(elId) {
    return document.getElementById(elId);
  }

  function create(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) { el.className = cls; }
    if (text != null) { el.appendChild(document.createTextNode(text)); }
    return el;
  }

  function on(el, type, fn, useCapture) {
    if (!el) { return fn; }
    el.addEventListener(type, fn, !!useCapture);
    return fn;
  }

  function show(el) {
    if (el) { el.classList.remove('is-hidden'); }
  }

  function hide(el) {
    if (el) { el.classList.add('is-hidden'); }
  }

  function toggle(el, force) {
    if (!el) { return; }
    if (force === true) { show(el); return; }
    if (force === false) { hide(el); return; }
    el.classList.toggle('is-hidden');
  }

  function isHidden(el) {
    return !el || el.classList.contains('is-hidden');
  }

  function setText(el, text) {
    if (el) { el.textContent = text == null ? '' : String(text); }
  }

  function empty(el) {
    if (!el) { return; }
    while (el.firstChild) { el.removeChild(el.firstChild); }
  }

  function css(el, styles) {
    var key;
    for (key in styles) {
      if (Object.prototype.hasOwnProperty.call(styles, key)) {
        el.style[key] = styles[key];
      }
    }
  }

  PCW.dom = {
    qs: qs,
    qsa: qsa,
    id: id,
    create: create,
    on: on,
    show: show,
    hide: hide,
    toggle: toggle,
    isHidden: isHidden,
    setText: setText,
    empty: empty,
    css: css
  };

  /* ---------------------------------------------------------------- matriz */

  function matIdentity() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }

  function matMul(m, n) {
    return {
      a: m.a * n.a + m.c * n.b,
      b: m.b * n.a + m.d * n.b,
      c: m.a * n.c + m.c * n.d,
      d: m.b * n.c + m.d * n.d,
      e: m.a * n.e + m.c * n.f + m.e,
      f: m.b * n.e + m.d * n.f + m.f
    };
  }

  function matApply(m, x, y) {
    return {
      x: m.a * x + m.c * y + m.e,
      y: m.b * x + m.d * y + m.f
    };
  }

  function matInvert(m) {
    var det = m.a * m.d - m.b * m.c;
    if (!det) { return matIdentity(); }
    return {
      a: m.d / det,
      b: -m.b / det,
      c: -m.c / det,
      d: m.a / det,
      e: (m.c * m.f - m.d * m.e) / det,
      f: (m.b * m.e - m.a * m.f) / det
    };
  }

  function matTranslate(x, y) {
    return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
  }

  function matScale(x, y) {
    return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 };
  }

  function matRotate(rad) {
    var c = Math.cos(rad);
    var s = Math.sin(rad);
    return { a: c, b: s, c: -s, d: c, e: 0, f: 0 };
  }

  PCW.mat = {
    identity: matIdentity,
    mul: matMul,
    apply: matApply,
    invert: matInvert,
    translate: matTranslate,
    scale: matScale,
    rotate: matRotate
  };

  /* ------------------------------------------------------------------ log */

  PCW.logs = [];

  PCW.log = function (message, kind) {
    var entry = {
      at: Date.now(),
      kind: kind || 'info',
      message: String(message == null ? '' : message)
    };
    PCW.logs.push(entry);
    if (PCW.logs.length > 400) { PCW.logs.shift(); }
    if (root.console && console.log) {
      console.log('[PCW] ' + entry.message);
    }
    return entry;
  };

  PCW.logError = function (context, err) {
    var msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    PCW.log((context ? context + ': ' : '') + msg, 'error');
    PCW.events.emit('error', { context: context, error: err });
  };

  /* -------------------------------------------------------------- guardar */

  PCW.guard = function (context, fn) {
    return function () {
      try {
        return fn.apply(this, arguments);
      } catch (err) {
        PCW.logError(context, err);
        return null;
      }
    };
  };

})(typeof window !== 'undefined' ? window : this);

/* ---- 10-storage.js ---- */

/* ==========================================================================
   10 — Almacenamiento: IndexedDB → WebSQL → memoria.
   Todas las operaciones tienen timeout y verificación de lectura.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});
  var util = PCW.util;

  var mode = 'pending';
  var idb = null;
  var wdb = null;
  var initStarted = false;
  var initQueue = [];

  var mem = {
    projects: {},
    layers: {},
    kv: {}
  };

  function later(fn) {
    setTimeout(fn, 0);
  }

  function guard(cb, ms) {
    var done = false;
    var timer = setTimeout(function () {
      if (!done) {
        done = true;
        cb(new Error('Tiempo de espera agotado (' + ms + ' ms)'));
      }
    }, ms || 8000);
    return function (err, res) {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      cb(err, res);
    };
  }

  function finishInit() {
    var queue = initQueue.slice(0);
    initQueue = [];
    var i;
    for (i = 0; i < queue.length; i += 1) {
      queue[i](null, {
        mode: mode,
        label: label(),
        detail: detail()
      });
    }
  }

  function label() {
    if (mode === 'idb') { return 'IndexedDB'; }
    if (mode === 'websql') { return 'WebSQL'; }
    if (mode === 'memory') { return 'Memoria (sin persistencia)'; }
    return 'Iniciando';
  }

  function detail() {
    if (mode === 'idb') {
      return 'Los proyectos persisten en este navegador. Safari 9 puede desalojarlos; exporta respaldos.';
    }
    if (mode === 'websql') {
      return 'IndexedDB falló; se usa WebSQL como respaldo. Exporta respaldos con frecuencia.';
    }
    if (mode === 'memory') {
      return 'Sin almacenamiento persistente disponible. Al cerrar la pestaña se pierden los proyectos.';
    }
    return '';
  }

  /* ----------------------------------------------------------- IndexedDB */

  function openIDB(cb) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) { return; }
      done = true;
      cb(new Error('IndexedDB no respondió al abrir'));
    }, 4000);

    function end(err, db) {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      cb(err, db);
    }

    var req;
    try {
      req = root.indexedDB.open('pcw', 1);
    } catch (e) {
      end(e);
      return;
    }

    req.onupgradeneeded = function () {
      var db = req.result;
      try {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('layers')) {
          var store = db.createObjectStore('layers', { keyPath: 'key' });
          store.createIndex('projectId', 'projectId', { unique: false });
        }
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'k' });
        }
      } catch (e) {
        end(e);
      }
    };

    req.onsuccess = function () {
      end(null, req.result);
    };

    req.onerror = function () {
      end(req.error || new Error('Error al abrir IndexedDB'));
    };

    req.onblocked = function () {
      end(new Error('IndexedDB bloqueado por otra pestaña'));
    };
  }

  function idbTx(stores, txMode, work, cb) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) { return; }
      done = true;
      cb(new Error('Transacción IndexedDB sin respuesta'));
    }, 8000);

    function end(err) {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      cb(err || null);
    }

    var tx;
    try {
      tx = idb.transaction(stores, txMode);
    } catch (e) {
      end(e);
      return;
    }

    tx.oncomplete = function () { end(null); };
    tx.onerror = function () { end(tx.error || new Error('Error de transacción IndexedDB')); };
    tx.onabort = function () { end(tx.error || new Error('Transacción IndexedDB abortada')); };

    try {
      work(tx);
    } catch (e2) {
      end(e2);
      try { tx.abort(); } catch (e3) { /* ignorado */ }
    }
  }

  function idbGet(store, key, cb) {
    var out = null;
    idbTx([store], 'readonly', function (tx) {
      var req = tx.objectStore(store).get(key);
      req.onsuccess = function () { out = req.result; };
    }, function (err) {
      cb(err, out);
    });
  }

  function idbPut(store, value, cb) {
    idbTx([store], 'readwrite', function (tx) {
      tx.objectStore(store).put(value);
    }, cb);
  }

  function idbListProjects(cb) {
    var list = [];
    idbTx(['projects'], 'readonly', function (tx) {
      var req = tx.objectStore('projects').openCursor();
      req.onsuccess = function () {
        var cursor = req.result;
        if (cursor) {
          list.push(cursor.value);
          cursor.continue();
        }
      };
    }, function (err) {
      if (err) { cb(err); return; }
      list.sort(function (a, b) {
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
      cb(null, list);
    });
  }

  function idbSaveProject(record, layerData, removedIds, cb) {
    var tx;
    try {
      tx = idb.transaction(['projects', 'layers'], 'readwrite');
    } catch (e) {
      cb(e);
      return;
    }

    var done = false;
    var timer = setTimeout(function () {
      if (!done) { done = true; cb(new Error('Guardado IndexedDB sin respuesta')); }
    }, 10000);

    function end(err) {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      if (err) { cb(err); return; }
      idbGet('projects', record.id, function (err2, saved) {
        if (err2) { cb(err2); return; }
        if (!saved || saved.updatedAt !== record.updatedAt) {
          cb(new Error('Verificación de guardado fallida'));
          return;
        }
        cb(null);
      });
    }

    tx.oncomplete = function () { end(null); };
    tx.onerror = function () { end(tx.error || new Error('Error al guardar proyecto')); };
    tx.onabort = function () { end(tx.error || new Error('Guardado abortado')); };

    try {
      tx.objectStore('projects').put(record);
      var layerStore = tx.objectStore('layers');
      var layerId;
      for (layerId in layerData) {
        if (Object.prototype.hasOwnProperty.call(layerData, layerId)) {
          layerStore.put({
            key: record.id + '/' + layerId,
            projectId: record.id,
            layerId: layerId,
            data: layerData[layerId]
          });
        }
      }
      var i;
      for (i = 0; i < removedIds.length; i += 1) {
        layerStore.delete(record.id + '/' + removedIds[i]);
      }
    } catch (e2) {
      end(e2);
      try { tx.abort(); } catch (e3) { /* ignorado */ }
    }
  }

  function idbLoadProject(projectId, cb) {
    var record = null;
    var layers = {};
    idbTx(['projects'], 'readonly', function (tx) {
      var req = tx.objectStore('projects').get(projectId);
      req.onsuccess = function () { record = req.result; };
    }, function (err) {
      if (err) { cb(err); return; }
      if (!record) { cb(new Error('Proyecto no encontrado')); return; }
      idbTx(['layers'], 'readonly', function (tx2) {
        var store = tx2.objectStore('layers');
        var index = store.index('projectId');
        var req2 = index.openCursor(IDBKeyRange.only(projectId));
        req2.onsuccess = function () {
          var cursor = req2.result;
          if (cursor) {
            layers[cursor.value.layerId] = cursor.value.data;
            cursor.continue();
          }
        };
      }, function (err2) {
        if (err2) { cb(err2); return; }
        cb(null, { record: record, layers: layers });
      });
    });
  }

  function idbDeleteProject(projectId, cb) {
    idbTx(['projects', 'layers'], 'readwrite', function (tx) {
      tx.objectStore('projects').delete(projectId);
      var index = tx.objectStore('layers').index('projectId');
      var req = index.openCursor(IDBKeyRange.only(projectId));
      req.onsuccess = function () {
        var cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    }, cb);
  }

  /* --------------------------------------------------------------- WebSQL */

  function openWS() {
    if (typeof root.openDatabase !== 'function') { return null; }
    try {
      return root.openDatabase('pcw_ws', '1.0', 'Procreate Web', 8 * 1024 * 1024);
    } catch (e) {
      return null;
    }
  }

  function wsRun(sql, args, cb) {
    var done = guard(cb || function () {}, 8000);
    wdb.transaction(function (tx) {
      tx.executeSql(sql, args || [], function () {
        done(null);
      }, function (tx2, err) {
        done(err || new Error('Error SQL'));
        return true;
      });
    }, function (err) {
      done(err || new Error('Error de transacción WebSQL'));
    }, function () {
      done(null);
    });
  }

  function wsInit(cb) {
    wdb = openWS();
    if (!wdb) { cb(new Error('WebSQL no disponible')); return; }
    var done = guard(cb, 8000);
    wdb.transaction(function (tx) {
      tx.executeSql('CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, json TEXT, updatedAt INTEGER)');
      tx.executeSql('CREATE TABLE IF NOT EXISTS layers (key TEXT PRIMARY KEY, projectId TEXT, data TEXT)');
      tx.executeSql('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
      tx.executeSql('CREATE INDEX IF NOT EXISTS layers_project ON layers (projectId)');
    }, function (err) {
      done(err || new Error('No se pudo crear el esquema WebSQL'));
    }, function () {
      var stamp = String(Date.now());
      wdb.transaction(function (tx2) {
        tx2.executeSql('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', ['__test', stamp]);
        tx2.executeSql('SELECT v FROM kv WHERE k = ?', ['__test'], function (tx3, rs) {
          if (!rs.rows.length || rs.rows.item(0).v !== stamp) {
            done(new Error('Verificación WebSQL fallida'));
          }
        });
      }, function (err2) {
        done(err2 || new Error('Error de prueba WebSQL'));
      }, function () {
        done(null);
      });
    });
  }

  function wsListProjects(cb) {
    var done = guard(cb, 8000);
    var rows = [];
    wdb.transaction(function (tx) {
      tx.executeSql('SELECT json FROM projects ORDER BY updatedAt DESC', [], function (tx2, rs) {
        var i;
        for (i = 0; i < rs.rows.length; i += 1) {
          try {
            rows.push(JSON.parse(rs.rows.item(i).json));
          } catch (e) { /* registro corrupto */ }
        }
      }, function (tx3, err) {
        done(err);
        return true;
      });
    }, function (err) {
      done(err);
    }, function () {
      done(null, rows);
    });
  }

  function wsSaveProject(record, layerData, removedIds, cb) {
    var done = guard(cb, 12000);
    var json = JSON.stringify(record);
    wdb.transaction(function (tx) {
      tx.executeSql(
        'INSERT OR REPLACE INTO projects (id, json, updatedAt) VALUES (?, ?, ?)',
        [record.id, json, record.updatedAt]
      );
      var layerId;
      for (layerId in layerData) {
        if (Object.prototype.hasOwnProperty.call(layerData, layerId)) {
          tx.executeSql(
            'INSERT OR REPLACE INTO layers (key, projectId, data) VALUES (?, ?, ?)',
            [record.id + '/' + layerId, record.id, layerData[layerId]]
          );
        }
      }
      var i;
      for (i = 0; i < removedIds.length; i += 1) {
        tx.executeSql('DELETE FROM layers WHERE key = ?', [record.id + '/' + removedIds[i]]);
      }
    }, function (err) {
      done(err || new Error('Error al guardar en WebSQL'));
    }, function () {
      wdb.transaction(function (tx2) {
        tx2.executeSql('SELECT updatedAt FROM projects WHERE id = ?', [record.id], function (tx3, rs) {
          if (!rs.rows.length || rs.rows.item(0).updatedAt !== record.updatedAt) {
            done(new Error('Verificación WebSQL del proyecto fallida'));
          }
        });
      }, function (err2) {
        done(err2);
      }, function () {
        done(null);
      });
    });
  }

  function wsLoadProject(projectId, cb) {
    var done = guard(cb, 10000);
    var record = null;
    var layers = {};
    wdb.transaction(function (tx) {
      tx.executeSql('SELECT json FROM projects WHERE id = ?', [projectId], function (tx2, rs) {
        if (rs.rows.length) {
          try { record = JSON.parse(rs.rows.item(0).json); } catch (e) { record = null; }
        }
      });
      tx.executeSql('SELECT layerId, data FROM layers WHERE projectId = ?', [projectId], function (tx3, rs2) {
        var i;
        for (i = 0; i < rs2.rows.length; i += 1) {
          layers[rs2.rows.item(i).layerId] = rs2.rows.item(i).data;
        }
      });
    }, function (err) {
      done(err);
    }, function () {
      if (!record) {
        done(new Error('Proyecto no encontrado'));
      } else {
        done(null, { record: record, layers: layers });
      }
    });
  }

  function wsDeleteProject(projectId, cb) {
    var done = guard(cb, 8000);
    wdb.transaction(function (tx) {
      tx.executeSql('DELETE FROM projects WHERE id = ?', [projectId]);
      tx.executeSql('DELETE FROM layers WHERE projectId = ?', [projectId]);
    }, function (err) {
      done(err);
    }, function () {
      done(null);
    });
  }

  /* ------------------------------------------------------------- Memoria */

  function memList(cb) {
    var list = [];
    var id;
    for (id in mem.projects) {
      if (Object.prototype.hasOwnProperty.call(mem.projects, id)) {
        list.push(mem.projects[id]);
      }
    }
    list.sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    later(function () { cb(null, list); });
  }

  function memSave(record, layerData, removedIds, cb) {
    var copy = JSON.parse(JSON.stringify(record));
    mem.projects[record.id] = copy;
    var layerId;
    for (layerId in layerData) {
      if (Object.prototype.hasOwnProperty.call(layerData, layerId)) {
        mem.layers[record.id + '/' + layerId] = {
          projectId: record.id,
          layerId: layerId,
          data: layerData[layerId]
        };
      }
    }
    var i;
    for (i = 0; i < removedIds.length; i += 1) {
      delete mem.layers[record.id + '/' + removedIds[i]];
    }
    later(function () { cb(null); });
  }

  function memLoad(projectId, cb) {
    var record = mem.projects[projectId];
    if (!record) {
      later(function () { cb(new Error('Proyecto no encontrado')); });
      return;
    }
    var layers = {};
    var key;
    for (key in mem.layers) {
      if (Object.prototype.hasOwnProperty.call(mem.layers, key)) {
        if (mem.layers[key].projectId === projectId) {
          layers[mem.layers[key].layerId] = mem.layers[key].data;
        }
      }
    }
    later(function () {
      cb(null, { record: JSON.parse(JSON.stringify(record)), layers: layers });
    });
  }

  function memDelete(projectId, cb) {
    delete mem.projects[projectId];
    var key;
    var remove = [];
    for (key in mem.layers) {
      if (Object.prototype.hasOwnProperty.call(mem.layers, key) &&
          mem.layers[key].projectId === projectId) {
        remove.push(key);
      }
    }
    var i;
    for (i = 0; i < remove.length; i += 1) {
      delete mem.layers[remove[i]];
    }
    later(function () { cb(null); });
  }

  /* ------------------------------------------------------------------ init */

  function tryWebSQL() {
    wsInit(function (err) {
      if (err) {
        idb = null;
        wdb = null;
        mode = 'memory';
      } else {
        mode = 'websql';
      }
      PCW.log('Almacenamiento: ' + label(), mode === 'memory' ? 'warn' : 'info');
      finishInit();
    });
  }

  function tryIDB() {
    openIDB(function (err, db) {
      if (err) {
        PCW.log('IndexedDB no disponible: ' + err.message, 'warn');
        tryWebSQL();
        return;
      }
      idb = db;
      var stamp = Date.now();
      idbPut('kv', { k: '__test', v: stamp }, function (putErr) {
        if (putErr) {
          PCW.log('IndexedDB falló al escribir: ' + putErr.message, 'warn');
          try { idb.close(); } catch (e) { /* ignorado */ }
          idb = null;
          tryWebSQL();
          return;
        }
        idbGet('kv', '__test', function (getErr, res) {
          if (getErr || !res || res.v !== stamp) {
            PCW.log('IndexedDB no superó la verificación de lectura', 'warn');
            try { idb.close(); } catch (e2) { /* ignorado */ }
            idb = null;
            tryWebSQL();
            return;
          }
          mode = 'idb';
          PCW.log('Almacenamiento: IndexedDB');
          finishInit();
        });
      });
    });
  }

  function init(cb) {
    if (mode !== 'pending') {
      if (cb) {
        later(function () {
          cb(null, { mode: mode, label: label(), detail: detail() });
        });
      }
      return;
    }
    if (cb) { initQueue.push(cb); }
    if (initStarted) { return; }
    initStarted = true;
    if (!PCW.env.hasIndexedDB && !PCW.env.hasWebSQL) {
      mode = 'memory';
      PCW.log('Sin IndexedDB ni WebSQL: modo memoria', 'warn');
      finishInit();
      return;
    }
    if (PCW.env.hasIndexedDB) {
      tryIDB();
    } else {
      tryWebSQL();
    }
  }

  /* ------------------------------------------------------------------- API */

  function saveProject(record, opts, cb) {
    opts = opts || {};
    var layerData = opts.layerData || {};
    var removedIds = opts.removedLayerIds || [];
    var copy = util.copy(record);
    copy.updatedAt = Date.now();
    record.updatedAt = copy.updatedAt;
    copy.layerCount = copy.layers ? copy.layers.length : 0;

    if (mode === 'idb') {
      idbSaveProject(copy, layerData, removedIds, cb || function () {});
    } else if (mode === 'websql') {
      wsSaveProject(copy, layerData, removedIds, cb || function () {});
    } else {
      memSave(copy, layerData, removedIds, cb || function () {});
    }
  }

  function listProjects(cb) {
    if (mode === 'idb') { idbListProjects(cb); return; }
    if (mode === 'websql') { wsListProjects(cb); return; }
    memList(cb);
  }

  function loadProject(projectId, cb) {
    if (mode === 'idb') { idbLoadProject(projectId, cb); return; }
    if (mode === 'websql') { wsLoadProject(projectId, cb); return; }
    memLoad(projectId, cb);
  }

  function deleteProject(projectId, cb) {
    if (mode === 'idb') { idbDeleteProject(projectId, cb || function () {}); return; }
    if (mode === 'websql') { wsDeleteProject(projectId, cb || function () {}); return; }
    memDelete(projectId, cb || function () {});
  }

  function saveSettings(settings, cb) {
    var json = JSON.stringify(settings || {});
    if (mode === 'idb') {
      idbPut('kv', { k: 'settings', v: json }, cb || function () {});
      return;
    }
    if (mode === 'websql') {
      wsRun('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', ['settings', json], cb || function () {});
      return;
    }
    mem.kv.settings = json;
    if (cb) { later(function () { cb(null); }); }
  }

  function loadSettings(cb) {
    function parse(value) {
      try {
        return value ? JSON.parse(value) : {};
      } catch (e) {
        return {};
      }
    }
    if (mode === 'idb') {
      idbGet('kv', 'settings', function (err, res) {
        cb(err, parse(res && res.v));
      });
      return;
    }
    if (mode === 'websql') {
      var done = guard(cb, 8000);
      wdb.transaction(function (tx) {
        tx.executeSql('SELECT v FROM kv WHERE k = ?', ['settings'], function (tx2, rs) {
          done(null, parse(rs.rows.length ? rs.rows.item(0).v : ''));
        });
      }, function (err) {
        done(err);
      });
      return;
    }
    cb(null, parse(mem.kv.settings));
  }

  function info() {
    return {
      mode: mode,
      label: label(),
      detail: detail(),
      persisted: mode === 'idb' || mode === 'websql'
    };
  }

  PCW.storage = {
    init: init,
    info: info,
    saveProject: saveProject,
    listProjects: listProjects,
    loadProject: loadProject,
    deleteProject: deleteProject,
    saveSettings: saveSettings,
    loadSettings: loadSettings,
    _memory: mem
  };

})(typeof window !== 'undefined' ? window : this);

/* ---- 20-model.js ---- */

/* ==========================================================================
   20 — Modelo de documento, presupuestos y pinceles propios.
   Sin DOM: verificable desde Node.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});
  var util = PCW.util;

  var SCHEMA = 'pcw/1';
  var BUDGET_BYTES = 40 * 1024 * 1024;
  var HISTORY_BYTES = 12 * 1024 * 1024;
  var MIN_SIZE = 64;
  var MAX_SIZE = 4096;

  var BLEND_LABELS = {
    'source-over': 'Normal',
    'multiply': 'Multiplicar',
    'screen': 'Trama',
    'overlay': 'Superponer',
    'darken': 'Oscurecer',
    'lighten': 'Aclarar',
    'color-dodge': 'Sobreexponer color',
    'color-burn': 'Subexponer color',
    'hard-light': 'Luz fuerte',
    'soft-light': 'Luz suave',
    'difference': 'Diferencia',
    'exclusion': 'Exclusión',
    'hue': 'Tono',
    'saturation': 'Saturación',
    'color': 'Color',
    'luminosity': 'Luminosidad'
  };

  /* Categorías nativas de la biblioteca de Procreate 3.1. Los pinceles son
     propios: se inspiran en el tipo de medio, no copian parámetros ni recursos. */
  var BRUSH_SETS = [
    'Boceto', 'Entintado', 'Dibujo', 'Pintura', 'Artístico', 'Caligrafía',
    'Aerógrafo', 'Carboncillos', 'Elementos', 'Luminancia', 'Materiales'
  ];

  var BRUSHES = [
    /* Boceto */
    { id: 'pencil-6b', name: '6B Pencil', set: 'Boceto', category: 'pencil',
      size: 9, opacity: 0.9, hardness: 0.5, spacing: 0.10,
      jitter: 0.25, scatter: 0.12, taper: 0.7, grain: 0.4,
      speed: 0.35, streamline: 0.25 },
    { id: 'pencil-hb', name: 'Lápiz HB', set: 'Boceto', category: 'pencil',
      size: 5, opacity: 0.95, hardness: 0.72, spacing: 0.09,
      jitter: 0.15, scatter: 0.06, taper: 0.55, grain: 0.18 },

    /* Entintado */
    { id: 'ink-technical', name: 'Tinta técnica', set: 'Entintado', category: 'ink',
      size: 7, opacity: 1, hardness: 1, spacing: 0.06,
      jitter: 0.03, scatter: 0.01, taper: 0.25, grain: 0 },
    { id: 'studio-pen', name: 'Pluma de estudio', set: 'Entintado', category: 'ink',
      size: 8, opacity: 1, hardness: 1, spacing: 0.03,
      jitter: 0.02, scatter: 0.01, taper: 0.28, grain: 0, speed: 0.6 },
    { id: 'gpen-manga', name: 'G-Pen manga', set: 'Entintado', category: 'ink',
      size: 14, opacity: 0.96, hardness: 0.96, spacing: 0.035,
      jitter: 0.04, scatter: 0.02, taper: 0.85, grain: 0, speed: 0.75 },
    { id: 'ink-brush', name: 'Pincel de tinta', set: 'Entintado', category: 'ink',
      size: 21, opacity: 0.98, hardness: 0.9, spacing: 0.05,
      jitter: 0.08, scatter: 0.03, taper: 0.8, grain: 0.05 },
    { id: 'dry-ink', name: 'Dry Ink', set: 'Entintado', category: 'ink',
      size: 26, opacity: 0.9, hardness: 0.84, spacing: 0.045,
      jitter: 0.06, scatter: 0.03, taper: 0.75, grain: 0.32,
      streak: 0.75, speed: 0.55, streamline: 0.35 },

    /* Dibujo */
    { id: 'colored-pencil', name: 'Lápiz de color', set: 'Dibujo', category: 'drawing',
      size: 7, opacity: 0.85, hardness: 0.6, spacing: 0.08,
      jitter: 0.22, scatter: 0.1, taper: 0.55, grain: 0.32 },
    { id: 'chalk', name: 'Tiza', set: 'Dibujo', category: 'drawing',
      size: 18, opacity: 0.7, hardness: 0.3, spacing: 0.12,
      jitter: 0.55, scatter: 0.35, taper: 0.4, grain: 0.8 },

    /* Pintura */
    { id: 'paint-soft', name: 'Pincel suave', set: 'Pintura', category: 'painting',
      size: 42, opacity: 0.75, hardness: 0.08, spacing: 0.06,
      jitter: 0.05, scatter: 0.02, taper: 0.35, grain: 0.08 },
    { id: 'paint-round', name: 'Pincel redondo', set: 'Pintura', category: 'painting',
      size: 24, opacity: 0.9, hardness: 0.75, spacing: 0.06,
      jitter: 0.1, scatter: 0.04, taper: 0.4, grain: 0.12 },
    { id: 'watercolor', name: 'Acuarela', set: 'Pintura', category: 'water',
      size: 48, opacity: 0.45, hardness: 0.15, spacing: 0.07,
      jitter: 0.12, scatter: 0.05, taper: 0.3, grain: 0.3 },

    /* Artístico */
    { id: 'pastel', name: 'Pastel', set: 'Artístico', category: 'artistic',
      size: 30, opacity: 0.8, hardness: 0.5, spacing: 0.10,
      jitter: 0.3, scatter: 0.18, taper: 0.45, grain: 0.55 },
    { id: 'dry-brush', name: 'Pincel seco', set: 'Artístico', category: 'artistic',
      size: 34, opacity: 0.68, hardness: 0.7, spacing: 0.16,
      jitter: 0.35, scatter: 0.2, taper: 0.3, grain: 0.7 },
    { id: 'shale-brush', name: 'Shale Brush', set: 'Artístico', category: 'charcoal',
      size: 40, opacity: 0.62, hardness: 0.22, spacing: 0.09,
      jitter: 0.55, scatter: 0.4, taper: 0.3, grain: 0.85,
      streak: 0.35, speed: 0.25, streamline: 0.12 },
    { id: 'palette-knife', name: 'Espátula', set: 'Artístico', category: 'artistic',
      size: 28, opacity: 0.9, hardness: 0.75, spacing: 0.06,
      jitter: 0.1, scatter: 0.04, taper: 0.2, grain: 0.2 },
    { id: 'splatter', name: 'Salpicadura', set: 'Artístico', category: 'artistic',
      size: 20, opacity: 0.8, hardness: 0.8, spacing: 0.34,
      jitter: 0.9, scatter: 0.9, taper: 0, grain: 0 },

    /* Caligrafía */
    { id: 'calligraphy', name: 'Caligrafía', set: 'Caligrafía', category: 'calligraphy',
      size: 12, opacity: 1, hardness: 0.95, spacing: 0.03,
      jitter: 0.02, scatter: 0.01, taper: 0.2, grain: 0, speed: 0.3 },
    { id: 'brush-script', name: 'Pincel caligráfico', set: 'Caligrafía', category: 'calligraphy',
      size: 18, opacity: 0.95, hardness: 0.8, spacing: 0.05,
      jitter: 0.06, scatter: 0.02, taper: 0.6, grain: 0.08, speed: 0.5 },

    /* Aerógrafo */
    { id: 'air-soft', name: 'Aerógrafo suave', set: 'Aerógrafo', category: 'airbrush',
      size: 64, opacity: 0.32, hardness: 0, spacing: 0.04,
      jitter: 0, scatter: 0, taper: 0.15, grain: 0 },
    { id: 'air-grain', name: 'Aerógrafo con grano', set: 'Aerógrafo', category: 'airbrush',
      size: 52, opacity: 0.38, hardness: 0.1, spacing: 0.06,
      jitter: 0.15, scatter: 0.08, taper: 0.2, grain: 0.55 },

    /* Carboncillos */
    { id: 'charcoal', name: 'Carboncillo', set: 'Carboncillos', category: 'charcoal',
      size: 26, opacity: 0.82, hardness: 0.35, spacing: 0.10,
      jitter: 0.5, scatter: 0.3, taper: 0.5, grain: 0.62 },
    { id: 'charcoal-soft', name: 'Carboncillo difuso', set: 'Carboncillos', category: 'charcoal',
      size: 34, opacity: 0.6, hardness: 0.1, spacing: 0.08,
      jitter: 0.6, scatter: 0.4, taper: 0.3, grain: 0.75 },

    /* Elementos */
    { id: 'sparkle', name: 'Chispas', set: 'Elementos', category: 'elements',
      size: 10, opacity: 0.9, hardness: 0.9, spacing: 0.18,
      jitter: 0.9, scatter: 0.8, taper: 0.2, grain: 0 },
    { id: 'cloud', name: 'Nube', set: 'Elementos', category: 'elements',
      size: 80, opacity: 0.18, hardness: 0, spacing: 0.05,
      jitter: 0.1, scatter: 0.3, taper: 0.1, grain: 0.1 },

    /* Luminancia */
    { id: 'light-pen', name: 'Pluma de luz', set: 'Luminancia', category: 'luminance',
      size: 12, opacity: 0.8, hardness: 0.2, spacing: 0.04,
      jitter: 0.05, scatter: 0.02, taper: 0.2, grain: 0 },
    { id: 'glow', name: 'Resplandor', set: 'Luminancia', category: 'luminance',
      size: 40, opacity: 0.25, hardness: 0, spacing: 0.05,
      jitter: 0, scatter: 0, taper: 0.1, grain: 0 },

    /* Materiales */
    { id: 'oil-paint', name: 'Óleo', set: 'Materiales', category: 'materials',
      size: 30, opacity: 0.9, hardness: 0.5, spacing: 0.08,
      jitter: 0.25, scatter: 0.12, taper: 0.3, grain: 0.35 },
    { id: 'acrylic', name: 'Acrílico', set: 'Materiales', category: 'materials',
      size: 26, opacity: 0.95, hardness: 0.8, spacing: 0.06,
      jitter: 0.12, scatter: 0.06, taper: 0.25, grain: 0.15 }
  ];

  var PALETTE = [
    '#1c1c1e', '#ffffff', '#8e8e93', '#c7c7cc',
    '#ff3b30', '#ff9500', '#ffcc00', '#34c759',
    '#00c7be', '#007aff', '#5856d6', '#af52de',
    '#ff2d55', '#a2845e', '#5c4033', '#2c3e50'
  ];

  function intSize(v) {
    var n = parseInt(v, 10);
    if (isNaN(n)) { return 0; }
    return n;
  }

  function bytesForLayer(w, h) {
    return Math.max(0, intSize(w) * intSize(h) * 4);
  }

  function budgetFor(w, h) {
    var bytes = bytesForLayer(w, h);
    var maxLayers = 0;
    if (bytes > 0) {
      maxLayers = Math.floor(BUDGET_BYTES / bytes);
    }
    if (maxLayers > 8) { maxLayers = 8; }
    if (maxLayers < 0) { maxLayers = 0; }
    return {
      width: intSize(w),
      height: intSize(h),
      layerBytes: bytes,
      maxLayers: maxLayers,
      totalBytes: maxLayers * bytes,
      overBudget: bytes > BUDGET_BYTES
    };
  }

  function cleanName(name) {
    var s = String(name == null ? '' : name).replace(/^\s+|\s+$/g, '');
    if (!s) { s = 'Sin título'; }
    if (s.length > 60) { s = s.substring(0, 60); }
    return s;
  }

  function nextLayerName(doc) {
    var max = 0;
    var i, m, n;
    for (i = 0; i < doc.layers.length; i += 1) {
      m = /^Capa (\d+)$/.exec(doc.layers[i].name || '');
      if (m) {
        n = parseInt(m[1], 10);
        if (n > max) { max = n; }
      }
    }
    return 'Capa ' + (max + 1);
  }

  function makeLayer(name, opts) {
    opts = opts || {};
    return {
      id: util.uid('layer'),
      name: cleanName(name),
      visible: opts.visible !== false,
      opacity: (typeof opts.opacity === 'number') ? util.clamp(opts.opacity, 0, 1) : 1,
      blend: opts.blend || 'source-over',
      alphaLock: !!opts.alphaLock
    };
  }

  function createDoc(opts) {
    opts = opts || {};
    var w = intSize(opts.width) || 1024;
    var h = intSize(opts.height) || 768;
    var now = Date.now();
    var layer = makeLayer(opts.layerName || 'Capa 1');
    var doc = {
      schema: SCHEMA,
      id: opts.id || util.uid('doc'),
      name: cleanName(opts.name),
      width: w,
      height: h,
      background: opts.background || '#ffffff',
      createdAt: now,
      updatedAt: now,
      layers: [layer],
      activeLayerId: layer.id,
      view: { scale: 1, rotation: 0, tx: 0, ty: 0, flipX: false },
      brushId: opts.brushId || 'pencil-6b',
      brushSize: opts.brushSize || 24,
      brushOpacity: (typeof opts.brushOpacity === 'number') ? opts.brushOpacity : 85,
      color: opts.color || '#1c1c1e',
      recentColors: (opts.recentColors || []).slice(0, 16),
      palette: (opts.palette || PALETTE).slice(0),
      historyLimit: opts.historyLimit || 0,
      symmetry: opts.symmetry || 'off'
    };
    return doc;
  }

  function canAddLayer(doc) {
    var budget = budgetFor(doc.width, doc.height);
    return doc.layers.length < budget.maxLayers;
  }

  function addLayer(doc, opts) {
    if (!canAddLayer(doc)) { return null; }
    opts = opts || {};
    var layer = makeLayer(opts.name || nextLayerName(doc), opts);
    if (typeof opts.index === 'number') {
      doc.layers.splice(util.clamp(opts.index, 0, doc.layers.length), 0, layer);
    } else {
      doc.layers.push(layer);
    }
    if (opts.activate !== false) {
      doc.activeLayerId = layer.id;
    }
    doc.updatedAt = Date.now();
    return layer;
  }

  function findLayer(doc, layerId) {
    var i;
    for (i = 0; i < doc.layers.length; i += 1) {
      if (doc.layers[i].id === layerId) { return doc.layers[i]; }
    }
    return null;
  }

  function layerIndex(doc, layerId) {
    var i;
    for (i = 0; i < doc.layers.length; i += 1) {
      if (doc.layers[i].id === layerId) { return i; }
    }
    return -1;
  }

  function removeLayer(doc, layerId) {
    if (doc.layers.length <= 1) { return false; }
    var index = layerIndex(doc, layerId);
    if (index < 0) { return false; }
    doc.layers.splice(index, 1);
    if (doc.activeLayerId === layerId) {
      var next = doc.layers[Math.max(0, index - 1)];
      doc.activeLayerId = next ? next.id : doc.layers[0].id;
    }
    doc.updatedAt = Date.now();
    return true;
  }

  function moveLayer(doc, layerId, direction) {
    var index = layerIndex(doc, layerId);
    if (index < 0) { return false; }
    var target = index + (direction > 0 ? 1 : -1);
    if (target < 0 || target >= doc.layers.length) { return false; }
    var tmp = doc.layers[index];
    doc.layers[index] = doc.layers[target];
    doc.layers[target] = tmp;
    doc.updatedAt = Date.now();
    return true;
  }

  function duplicateLayerMeta(doc, layerId) {
    if (!canAddLayer(doc)) { return null; }
    var index = layerIndex(doc, layerId);
    if (index < 0) { return null; }
    var src = doc.layers[index];
    var layer = makeLayer(src.name + ' copia', {
      visible: src.visible,
      opacity: src.opacity,
      blend: src.blend,
      alphaLock: src.alphaLock
    });
    doc.layers.splice(index + 1, 0, layer);
    doc.activeLayerId = layer.id;
    doc.updatedAt = Date.now();
    return layer;
  }

  /* Ajustes de pincel propios del usuario. Se guardan en el navegador y se
     aplican sobre una copia: los valores originales de la biblioteca no se
     modifican, de modo que «Restablecer» siempre funciona. */
  var BRUSH_STORE_KEY = 'pcw.brushes.v1';
  var BRUSH_OVERRIDE_KEYS = {
    size: true, opacity: true, hardness: true, spacing: true,
    jitter: true, scatter: true, taper: true, grain: true,
    streak: true, speed: true, streamline: true, stabilize: true,
    motionFilter: true, shapeCorrection: true, pressure: true
  };
  var BRUSH_EXTRA_DEFAULTS = {
    stabilize: 0.18,
    streamline: 0.2,
    motionFilter: 0.2,
    shapeCorrection: 1,
    pressure: 0.35
  };
  var brushOverrides = null;

  function readBrushStore() {
    if (brushOverrides) { return brushOverrides; }
    brushOverrides = {};
    try {
      if (root.localStorage) {
        var raw = root.localStorage.getItem(BRUSH_STORE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') { brushOverrides = parsed; }
        }
      }
    } catch (e) { /* almacenamiento no disponible */ }
    return brushOverrides;
  }

  function persistBrushStore() {
    try {
      if (root.localStorage) {
        root.localStorage.setItem(BRUSH_STORE_KEY, JSON.stringify(brushOverrides || {}));
      }
    } catch (e) { /* almacenamiento no disponible */ }
  }

  function getBrush(brushId) {
    var i;
    for (i = 0; i < BRUSHES.length; i += 1) {
      if (BRUSHES[i].id === brushId) { return BRUSHES[i]; }
    }
    return BRUSHES[0];
  }

  function resolveBrush(brushId) {
    var base = getBrush(brushId);
    var out = {};
    var key;
    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) { out[key] = base[key]; }
    }
    for (key in BRUSH_EXTRA_DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(BRUSH_EXTRA_DEFAULTS, key) &&
          typeof out[key] !== 'number') {
        out[key] = BRUSH_EXTRA_DEFAULTS[key];
      }
    }
    var store = readBrushStore();
    var override = store[base.id];
    if (override) {
      for (key in override) {
        if (Object.prototype.hasOwnProperty.call(override, key) &&
            BRUSH_OVERRIDE_KEYS[key]) {
          out[key] = override[key];
        }
      }
    }
    out.id = base.id;
    out.name = base.name;
    out.set = base.set;
    out.category = base.category;
    return out;
  }

  function setBrushOverride(brushId, key, value) {
    if (!BRUSH_OVERRIDE_KEYS[key]) { return false; }
    var base = getBrush(brushId);
    var store = readBrushStore();
    if (!store[base.id]) { store[base.id] = {}; }
    store[base.id][key] = value;
    persistBrushStore();
    return true;
  }

  function clearBrushOverride(brushId) {
    var base = getBrush(brushId);
    var store = readBrushStore();
    delete store[base.id];
    persistBrushStore();
  }

  function brushOverride(brushId) {
    var store = readBrushStore();
    var base = getBrush(brushId);
    var src = store[base.id] || {};
    var out = {};
    var key;
    for (key in src) {
      if (Object.prototype.hasOwnProperty.call(src, key)) { out[key] = src[key]; }
    }
    return out;
  }

  function brushSets() {
    var sets = ['Todos'];
    var i;
    for (i = 0; i < BRUSH_SETS.length; i += 1) {
      sets.push(BRUSH_SETS[i]);
    }
    return sets;
  }

  function blendLabel(blend) {
    return BLEND_LABELS[blend] || blend || 'Normal';
  }

  function copyLayerMeta(layer) {
    return {
      id: layer.id,
      name: layer.name,
      visible: layer.visible !== false,
      opacity: (typeof layer.opacity === 'number') ? layer.opacity : 1,
      blend: layer.blend || 'source-over',
      alphaLock: !!layer.alphaLock
    };
  }

  function toRecord(doc, thumb) {
    var layers = [];
    var i;
    for (i = 0; i < doc.layers.length; i += 1) {
      layers.push(copyLayerMeta(doc.layers[i]));
    }
    return {
      schema: SCHEMA,
      id: doc.id,
      name: doc.name,
      width: doc.width,
      height: doc.height,
      background: doc.background,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt || Date.now(),
      layers: layers,
      layerCount: layers.length,
      activeLayerId: doc.activeLayerId,
      view: util.copy(doc.view || {}),
      brushId: doc.brushId,
      brushSize: doc.brushSize,
      brushOpacity: doc.brushOpacity,
      color: doc.color,
      recentColors: (doc.recentColors || []).slice(0, 16),
      palette: (doc.palette || PALETTE).slice(0),
      symmetry: doc.symmetry || 'off',
      thumb: thumb || doc.thumb || ''
    };
  }

  function validSize(w, h) {
    return w >= MIN_SIZE && h >= MIN_SIZE && w <= MAX_SIZE && h <= MAX_SIZE;
  }

  function fromRecord(record) {
    if (!record || !record.id) { throw new Error('Registro de proyecto inválido'); }
    var w = intSize(record.width);
    var h = intSize(record.height);
    if (!validSize(w, h)) { throw new Error('Dimensiones inválidas: ' + w + '×' + h); }
    var doc = createDoc({
      id: record.id,
      name: record.name,
      width: w,
      height: h,
      background: record.background,
      color: record.color,
      palette: record.palette,
      recentColors: record.recentColors,
      brushId: record.brushId,
      brushSize: record.brushSize,
      brushOpacity: record.brushOpacity
    });
    doc.createdAt = record.createdAt || doc.createdAt;
    doc.updatedAt = record.updatedAt || doc.updatedAt;
    doc.layers = [];
    var i;
    var layers = util.isArray(record.layers) ? record.layers : [];
    for (i = 0; i < layers.length; i += 1) {
      doc.layers.push(copyLayerMeta(layers[i]));
    }
    if (!doc.layers.length) {
      doc.layers.push(makeLayer('Capa 1'));
    }
    doc.activeLayerId = record.activeLayerId || doc.layers[doc.layers.length - 1].id;
    if (layerIndex(doc, doc.activeLayerId) < 0) {
      doc.activeLayerId = doc.layers[doc.layers.length - 1].id;
    }
    if (record.view) {
      doc.view = {
        scale: typeof record.view.scale === 'number' ? record.view.scale : 1,
        rotation: typeof record.view.rotation === 'number' ? record.view.rotation : 0,
        tx: typeof record.view.tx === 'number' ? record.view.tx : 0,
        ty: typeof record.view.ty === 'number' ? record.view.ty : 0,
        flipX: !!record.view.flipX
      };
    }
    var symmetry = record.symmetry;
    doc.symmetry = (symmetry === 'vertical' || symmetry === 'horizontal' ||
      symmetry === 'quad') ? symmetry : 'off';
    doc.thumb = record.thumb || '';
    return doc;
  }

  function estimateProjectBytes(doc, layerCount) {
    var count = layerCount || doc.layers.length;
    return bytesForLayer(doc.width, doc.height) * count;
  }

  /* ==========================================================================
     Geometría de trazos: filtros, simplificación, reconocimiento de formas y
     curvas Bézier. Sin DOM para poder verificarlo desde Node.
     ========================================================================== */

  function distance(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pointSegmentDistance(p, a, b) {
    var vx = b.x - a.x;
    var vy = b.y - a.y;
    var len2 = vx * vx + vy * vy;
    if (len2 < 1e-9) { return distance(p, a); }
    var t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
    t = util.clamp(t, 0, 1);
    var dx = p.x - (a.x + vx * t);
    var dy = p.y - (a.y + vy * t);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pathLength(points) {
    var total = 0;
    var i;
    for (i = 1; i < points.length; i += 1) {
      total += distance(points[i - 1], points[i]);
    }
    return total;
  }

  function pointBounds(points) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    var i;
    for (i = 0; i < points.length; i += 1) {
      if (points[i].x < minX) { minX = points[i].x; }
      if (points[i].y < minY) { minY = points[i].y; }
      if (points[i].x > maxX) { maxX = points[i].x; }
      if (points[i].y > maxY) { maxY = points[i].y; }
    }
    if (!points.length) { return null; }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  /* Ramer–Douglas–Peucker: conserva esquinas y reduce puntos redundantes. */
  function simplifyRdp(points, epsilon) {
    if (!points || points.length < 3) { return points ? points.slice(0) : []; }
    var maxDist = -1;
    var index = 0;
    var i;
    for (i = 1; i < points.length - 1; i += 1) {
      var d = pointSegmentDistance(points[i], points[0], points[points.length - 1]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > epsilon) {
      var left = simplifyRdp(points.slice(0, index + 1), epsilon);
      var right = simplifyRdp(points.slice(index), epsilon);
      return left.slice(0, left.length - 1).concat(right);
    }
    return [points[0], points[points.length - 1]];
  }

  /* Elimina vértices casi alineados con sus vecinos. RDP puede conservar un
     punto intermedio cuando el contorno es convexo; ese punto falsearía el
     número de lados de un polígono. */
  function dropFlatVertices(verts, epsilon) {
    var list = verts.slice(0);
    var changed = true;
    var guard = 0;
    while (changed && list.length > 3 && guard < 16) {
      changed = false;
      guard += 1;
      var i;
      for (i = 0; i < list.length; i += 1) {
        var prev = list[(i - 1 + list.length) % list.length];
        var next = list[(i + 1) % list.length];
        if (pointSegmentDistance(list[i], prev, next) <= epsilon * 0.7) {
          list.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
    return list;
  }

  /* Media móvil ponderada. Se usa para el filtro de movimiento involuntario.
     Los extremos se conservan para que el trazo no pierda su inicio. */
  function smoothPoints(points, strength, passes) {
    var src = points.slice(0);
    var rounds = Math.max(1, Math.round(passes || 1));
    var amount = util.clamp(strength, 0, 1);
    var round;
    var i;
    for (round = 0; round < rounds; round += 1) {
      var out = [src[0]];
      for (i = 1; i < src.length - 1; i += 1) {
        var midX = (src[i - 1].x + src[i].x * 2 + src[i + 1].x) / 4;
        var midY = (src[i - 1].y + src[i].y * 2 + src[i + 1].y) / 4;
        out.push({
          x: src[i].x + (midX - src[i].x) * amount,
          y: src[i].y + (midY - src[i].y) * amount
        });
      }
      if (src.length > 1) { out.push(src[src.length - 1]); }
      src = out;
    }
    return src;
  }

  function averagePoints(points) {
    if (!points.length) { return null; }
    var sx = 0;
    var sy = 0;
    var i;
    for (i = 0; i < points.length; i += 1) {
      sx += points[i].x;
      sy += points[i].y;
    }
    return { x: sx / points.length, y: sy / points.length };
  }

  function isClosedPath(points, tolerance) {
    if (points.length < 4) { return false; }
    var b = pointBounds(points);
    var diag = Math.sqrt(b.w * b.w + b.h * b.h);
    var limit = tolerance == null ? Math.max(18, diag * 0.2) : tolerance;
    return distance(points[0], points[points.length - 1]) <= limit;
  }

  function polygonArea(points) {
    var area = 0;
    var i;
    for (i = 0; i < points.length; i += 1) {
      var j = (i + 1) % points.length;
      area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  }

  function regularPolygonGeometry(center, radius, sides, rotation) {
    var pts = [];
    var i;
    for (i = 0; i < sides; i += 1) {
      var a = rotation + (i * Math.PI * 2) / sides;
      pts.push({
        x: center.x + Math.cos(a) * radius,
        y: center.y + Math.sin(a) * radius
      });
    }
    return pts;
  }

  /* Clasifica un trazo cerrado o abierto en una forma geométrica. La
     confianza (0-1) permite que la corrección automática sea selectiva. */
  function quickShapeForPoints(points, brushSize) {
    if (!points || points.length < 4) { return null; }
    var b = pointBounds(points);
    var diag = Math.sqrt(b.w * b.w + b.h * b.h);
    if (diag < 12) { return null; }
    var total = pathLength(points);
    if (total < 18) { return null; }
    var width = Math.max(1, brushSize || 1);
    var tol = Math.max(2.5, width * 0.45);
    var closed = isClosedPath(points);
    var first = points[0];
    var last = points[points.length - 1];

    /* Línea recta: abierta y con poca desviación respecto a la cuerda. */
    if (!closed) {
      var chord = distance(first, last);
      if (chord > Math.max(20, diag * 0.45)) {
        var maxDev = 0;
        var i;
        for (i = 1; i < points.length - 1; i += 1) {
          var dev = pointSegmentDistance(points[i], first, last);
          if (dev > maxDev) { maxDev = dev; }
        }
        var lineTol = Math.max(3, chord * 0.045) + tol * 0.4;
        if (maxDev <= lineTol) {
          var straightness = 1 - util.clamp(maxDev / lineTol, 0, 1);
          return {
            type: 'line',
            confidence: 0.55 + straightness * 0.45,
            points: [{ x: first.x, y: first.y }, { x: last.x, y: last.y }],
            closed: false
          };
        }
      }
    }

    if (closed && b.w > 10 && b.h > 10) {
      /* Rectángulo / cuadrado: los puntos siguen el perímetro de la caja y el
         área encerrada llena esa caja. Un círculo ocupa ~78 % y se descarta
         aquí para pasar al test de elipse. */
      var band = Math.max(4, Math.min(b.w, b.h) * 0.16 + tol);
      var near = 0;
      var j;
      for (j = 0; j < points.length; j += 1) {
        var p = points[j];
        var edge = Math.min(
          Math.abs(p.x - b.x), Math.abs(p.x - (b.x + b.w)),
          Math.abs(p.y - b.y), Math.abs(p.y - (b.y + b.h))
        );
        if (edge <= band) { near += 1; }
      }
      var perimeterRatio = near / points.length;
      var areaRatio = polygonArea(points) / (b.w * b.h);
      if (perimeterRatio >= 0.76 && areaRatio >= 0.88) {
        var square = Math.abs(b.w - b.h) <= Math.max(b.w, b.h) * 0.14;
        return {
          type: 'rect',
          confidence: util.clamp((perimeterRatio - 0.6) / 0.4, 0.4, 1),
          square: square,
          x: b.x, y: b.y, w: b.w, h: b.h,
          points: [
            { x: b.x, y: b.y },
            { x: b.x + b.w, y: b.y },
            { x: b.x + b.w, y: b.y + b.h },
            { x: b.x, y: b.y + b.h }
          ],
          closed: true
        };
      }

      /* Elipse: error radial bajo respecto a la elipse inscrita en la caja. */
      var cx = b.x + b.w / 2;
      var cy = b.y + b.h / 2;
      var rx = b.w / 2;
      var ry = b.h / 2;
      var sumErr = 0;
      var maxErr = 0;
      var k;
      for (k = 0; k < points.length; k += 1) {
        var nx = (points[k].x - cx) / rx;
        var ny = (points[k].y - cy) / ry;
        var value = nx * nx + ny * ny;
        var err = Math.abs(value - 1);
        sumErr += err;
        if (err > maxErr) { maxErr = err; }
      }
      var meanErr = sumErr / points.length;
      /* Un polígono inscrito también enciende el test de área, pero sus
         lados se hunden hasta un 25 % respecto al círculo. La tolerancia
         radial estricta deja pasar curvas dibujadas a mano y rechaza
         pentágonos o hexágonos que deben probarse como polígonos. */
      if (meanErr <= 0.14 && maxErr <= 0.25) {
        return {
          type: 'ellipse',
          confidence: util.clamp(1 - meanErr * 1.7, 0.4, 1),
          cx: cx, cy: cy, rx: rx, ry: ry,
          closed: true
        };
      }
    }

    /* Triángulo y polígonos: se simplifica el contorno y se estudian los
       vértices. Un polígono regular exige lados de longitud parecida. */
    if (closed) {
      var eps = Math.max(4, diag * 0.055);
      var simplified = simplifyRdp(points, eps);
      var verts = simplified.slice(0);
      if (verts.length > 1 && distance(verts[0], verts[verts.length - 1]) < eps * 1.6) {
        verts.pop();
      }
      verts = dropFlatVertices(verts, eps);
      if (verts.length === 3) {
        var triArea = polygonArea(verts);
        if (triArea > diag * diag * 0.04) {
          return {
            type: 'triangle',
            confidence: 0.6,
            points: verts,
            closed: true
          };
        }
      }
      if (verts.length >= 4 && verts.length <= 8) {
        var lens = [];
        var m;
        for (m = 0; m < verts.length; m += 1) {
          lens.push(distance(verts[m], verts[(m + 1) % verts.length]));
        }
        var mean = 0;
        for (m = 0; m < lens.length; m += 1) { mean += lens[m]; }
        mean /= lens.length;
        var variance = 0;
        for (m = 0; m < lens.length; m += 1) {
          variance += (lens[m] - mean) * (lens[m] - mean);
        }
        variance = Math.sqrt(variance / lens.length) / Math.max(1, mean);
        if (variance < 0.34) {
          /* Centroide de los vértices: el centro de la caja no coincide con
             el centro de un polígono regular girado. */
          var center = averagePoints(verts);
          var sumR = 0;
          for (m = 0; m < verts.length; m += 1) {
            sumR += distance(center, verts[m]);
          }
          var radius = sumR / verts.length;
          var rot = Math.atan2(verts[0].y - center.y, verts[0].x - center.x);
          return {
            type: 'polygon',
            confidence: util.clamp(1 - variance, 0.45, 0.98),
            sides: verts.length,
            cx: center.x, cy: center.y, radius: radius,
            rotation: rot,
            points: regularPolygonGeometry(center, radius, verts.length, rot),
            closed: true
          };
        }
      }
    }

    return null;
  }

  /* Catmull-Rom → Bézier cúbica. Cada ancla guarda sus dos manejadores en
     coordenadas absolutas para poder editarlos con el dedo. */
  function catmullRomToBezier(points, closed, tension) {
    var n = points.length;
    if (n < 2) { return { anchors: [], closed: false }; }
    var t = (tension == null ? 1 / 6 : tension);
    var anchors = [];
    var i;
    for (i = 0; i < n; i += 1) {
      var prev;
      var next;
      if (closed) {
        prev = points[(i - 1 + n) % n];
        next = points[(i + 1) % n];
      } else {
        prev = points[i > 0 ? i - 1 : 0];
        next = points[i < n - 1 ? i + 1 : n - 1];
      }
      var dx = (next.x - prev.x) * t;
      var dy = (next.y - prev.y) * t;
      anchors.push({
        x: points[i].x,
        y: points[i].y,
        inX: points[i].x - dx,
        inY: points[i].y - dy,
        outX: points[i].x + dx,
        outY: points[i].y + dy
      });
    }
    return { anchors: anchors, closed: !!closed };
  }

  function bezierPoint(p0, c1, c2, p1, t) {
    var mt = 1 - t;
    var a = mt * mt * mt;
    var b = 3 * mt * mt * t;
    var c = 3 * mt * t * t;
    var d = t * t * t;
    return {
      x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
      y: a * p0.y + b * c1.y + c * c2.y + d * p1.y
    };
  }

  function sampleBezier(anchors, closed, stepsPerSegment) {
    if (!anchors || anchors.length < 2) { return []; }
    var steps = Math.max(3, Math.round(stepsPerSegment || 8));
    var out = [];
    var i;
    var count = closed ? anchors.length : anchors.length - 1;
    for (i = 0; i < count; i += 1) {
      var a = anchors[i];
      var b = anchors[(i + 1) % anchors.length];
      var c1 = { x: a.outX, y: a.outY };
      var c2 = { x: b.inX, y: b.inY };
      var s;
      for (s = 0; s < steps; s += 1) {
        out.push(bezierPoint(a, c1, c2, b, s / steps));
      }
    }
    if (!closed && anchors.length) {
      var last = anchors[anchors.length - 1];
      out.push({ x: last.x, y: last.y });
    }
    return out;
  }

  /* Convierte un trazo libre en curvas editables. El epsilon controla
     cuántos anclas se conservan. */
  function curveForPoints(points, options) {
    if (!points || points.length < 3) { return null; }
    var opts = options || {};
    var b = pointBounds(points);
    var diag = Math.sqrt(b.w * b.w + b.h * b.h);
    var epsilon = opts.epsilon || Math.max(2.5, diag * 0.012);
    var simplified = simplifyRdp(points, epsilon);
    var closed = opts.closed;
    if (closed == null) {
      closed = isClosedPath(points, Math.max(14, diag * 0.12));
    }
    if (closed && simplified.length > 1 &&
        distance(simplified[0], simplified[simplified.length - 1]) < epsilon * 2) {
      simplified.pop();
    }
    if (simplified.length < 2) { return null; }
    var curves = catmullRomToBezier(simplified, closed, opts.tension);
    return {
      anchors: curves.anchors,
      closed: curves.closed,
      sampled: sampleBezier(curves.anchors, curves.closed, opts.steps || 8)
    };
  }

  PCW.model = {
    SCHEMA: SCHEMA,
    BUDGET_BYTES: BUDGET_BYTES,
    HISTORY_BYTES: HISTORY_BYTES,
    MIN_SIZE: MIN_SIZE,
    MAX_SIZE: MAX_SIZE,
    BLEND_LABELS: BLEND_LABELS,
    BRUSHES: BRUSHES,
    BRUSH_SETS: BRUSH_SETS,
    PALETTE: PALETTE,
    bytesForLayer: bytesForLayer,
    budgetFor: budgetFor,
    createDoc: createDoc,
    createLayer: makeLayer,
    canAddLayer: canAddLayer,
    addLayer: addLayer,
    findLayer: findLayer,
    layerIndex: layerIndex,
    removeLayer: removeLayer,
    moveLayer: moveLayer,
    duplicateLayerMeta: duplicateLayerMeta,
    nextLayerName: nextLayerName,
    getBrush: getBrush,
    resolveBrush: resolveBrush,
    setBrushOverride: setBrushOverride,
    clearBrushOverride: clearBrushOverride,
    brushOverride: brushOverride,
    brushSets: brushSets,
    blendLabel: blendLabel,
    copyLayerMeta: copyLayerMeta,
    toRecord: toRecord,
    fromRecord: fromRecord,
    validSize: validSize,
    estimateProjectBytes: estimateProjectBytes,
    cleanName: cleanName,
    distance: distance,
    pointSegmentDistance: pointSegmentDistance,
    pathLength: pathLength,
    pointBounds: pointBounds,
    simplifyRdp: simplifyRdp,
    smoothPoints: smoothPoints,
    averagePoints: averagePoints,
    isClosedPath: isClosedPath,
    quickShapeForPoints: quickShapeForPoints,
    catmullRomToBezier: catmullRomToBezier,
    sampleBezier: sampleBezier,
    curveForPoints: curveForPoints,
    bezierPoint: bezierPoint
  };

})(typeof window !== 'undefined' ? window : this);

/* ---- 30-ui.js ---- */

/* ==========================================================================
   30 — UI común: pantallas, modales, avisos, sliders, paneles y entrega.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});
  var dom = PCW.dom;
  var util = PCW.util;

  var currentScreen = 'screen-gallery';
  var toastTimer = null;
  var saveTimer = null;
  var modalOnClose = null;
  var activeSlider = null;

  function showScreen(id) {
    var screens = dom.qsa('.screen');
    var i;
    for (i = 0; i < screens.length; i += 1) {
      if (screens[i].id === id) {
        dom.show(screens[i]);
      } else {
        dom.hide(screens[i]);
      }
    }
    if (id === 'screen-studio') {
      closeModal();
      closePopovers();
    }
    currentScreen = id;
    PCW.events.emit('screen', id);
  }

  function current() {
    return currentScreen;
  }

  /* --------------------------------------------------------------- modales */

  function closeModal() {
    var rootEl = dom.id('modal-root');
    var body = dom.id('modal-body');
    var foot = dom.id('modal-foot');
    if (!rootEl || dom.isHidden(rootEl)) { return; }
    dom.hide(rootEl);
    dom.empty(body);
    dom.empty(foot);
    var cb = modalOnClose;
    modalOnClose = null;
    if (cb) { cb(); }
  }

  function modal(opts) {
    opts = opts || {};
    closeModal();
    var rootEl = dom.id('modal-root');
    var card = dom.id('modal-card');
    var title = dom.id('modal-title');
    var body = dom.id('modal-body');
    var foot = dom.id('modal-foot');

    dom.setText(title, opts.title || '');
    dom.empty(body);
    if (typeof opts.body === 'string') {
      body.innerHTML = opts.body;
    } else if (opts.body) {
      body.appendChild(opts.body);
    }
    dom.empty(foot);
    if (opts.width) { card.style.width = opts.width + 'px'; }
    else { card.style.width = ''; }
    modalOnClose = opts.onClose || null;

    var ctrl = {
      root: rootEl,
      card: card,
      body: body,
      foot: foot,
      close: closeModal
    };

    var buttons = opts.buttons || [];
    var i;
    for (i = 0; i < buttons.length; i += 1) {
      (function (spec) {
        var btn = dom.create('button', 'text-btn' +
          (spec.primary ? ' strong' : '') +
          (spec.danger ? ' danger' : ''), spec.label);
        btn.type = 'button';
        if (spec.danger) {
          btn.style.color = '#ff7a7a';
        }
        dom.on(btn, 'click', function () {
          var keep = false;
          if (spec.onClick) {
            keep = spec.onClick(ctrl);
          }
          if (keep !== false) { closeModal(); }
        });
        foot.appendChild(btn);
      }(buttons[i]));
    }

    dom.show(rootEl);
    if (opts.focus) {
      setTimeout(function () {
        var field = dom.qs(opts.focus, body);
        if (field) {
          try { field.focus(); } catch (e) { /* ignorado */ }
        }
      }, 60);
    }
    return ctrl;
  }

  function confirm(opts, cb) {
    opts = opts || {};
    return modal({
      title: opts.title || 'Confirmar',
      body: '<p class="form-note" style="margin-top:0;font-size:13px;color:#d8d8de;">' +
        util.escapeHtml(opts.message || '') + '</p>',
      width: 420,
      buttons: [
        { label: opts.cancelLabel || 'Cancelar' },
        {
          label: opts.confirmLabel || 'Continuar',
          primary: !opts.danger,
          danger: !!opts.danger,
          onClick: function () {
            if (cb) { cb(); }
          }
        }
      ]
    });
  }

  function prompt(opts, cb) {
    opts = opts || {};
    var bodyHtml = '<label class="field"><span class="field-label" style="display:block;margin-bottom:6px;color:#9a9aa3;font-size:11px;">' +
      util.escapeHtml(opts.label || 'Nombre') +
      '</span><input id="prompt-input" class="input" type="text" value="' +
      util.escapeHtml(opts.value || '') + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>' +
      (opts.note ? '<p class="form-note">' + util.escapeHtml(opts.note) + '</p>' : '');
    return modal({
      title: opts.title || 'Editar',
      body: bodyHtml,
      width: 420,
      focus: '#prompt-input',
      buttons: [
        { label: 'Cancelar' },
        {
          label: opts.confirmLabel || 'Guardar',
          primary: true,
          onClick: function (ctrl) {
            var input = dom.id('prompt-input');
            if (cb) { cb(input ? input.value : '', ctrl); }
          }
        }
      ]
    });
  }

  /* ---------------------------------------------------------------- avisos */

  function toast(message, ms) {
    var el = dom.id('toast');
    if (!el) { return; }
    el.textContent = String(message == null ? '' : message);
    dom.show(el);
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () {
      toastTimer = null;
      dom.hide(el);
    }, ms || 2300);
  }

  function setSaveState(state, text) {
    var el = dom.id('save-indicator');
    if (!el) { return; }
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!state) {
      dom.hide(el);
      return;
    }
    if (state === 'saving') {
      el.textContent = text || 'Guardando…';
      dom.show(el);
      return;
    }
    if (state === 'saved') {
      el.textContent = text || 'Guardado';
      dom.show(el);
      saveTimer = setTimeout(function () {
        saveTimer = null;
        dom.hide(el);
      }, 1000);
      return;
    }
    if (state === 'error') {
      el.textContent = text || 'No se pudo guardar';
      dom.show(el);
      el.style.color = '#ff9a9a';
      saveTimer = setTimeout(function () {
        saveTimer = null;
        dom.hide(el);
        el.style.color = '';
      }, 3200);
    }
  }

  /* ---------------------------------------------------- paneles y popovers */

  function panelEls() {
    return dom.qsa('.panel, .popover, .overlay-panel, .quick-menu');
  }

  function closePanels(exceptId) {
    var list = dom.qsa('.panel');
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i].id !== exceptId) { dom.hide(list[i]); }
    }
  }

  function closePopovers(exceptId) {
    var list = dom.qsa('.popover');
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i].id !== exceptId) { dom.hide(list[i]); }
    }
    var overlays = dom.qsa('.overlay-panel');
    for (i = 0; i < overlays.length; i += 1) {
      if (overlays[i].id !== exceptId) { dom.hide(overlays[i]); }
    }
    if (exceptId !== 'quick-menu') { dom.hide(dom.id('quick-menu')); }
    if (exceptId !== 'panel-brushes') { dom.hide(dom.id('panel-brushes')); }
  }

  function closeAllFloating(exceptId) {
    closePanels(exceptId);
    closePopovers(exceptId);
  }

  function openPanel(id) {
    if (!dom.id(id)) { return; }
    if (id !== 'panel-adjustments' && PCW.studio && PCW.studio.cancelAdjust) {
      PCW.studio.cancelAdjust();
    }
    closeAllFloating(id);
    dom.show(dom.id(id));
  }

  function closePanel(id) {
    if (id === 'panel-adjustments' && PCW.studio && PCW.studio.cancelAdjust) {
      PCW.studio.cancelAdjust();
    }
    /* Cerrar el panel de curva sin Aplicar equivale a cancelar la edición:
       se restaura el trazo original en lugar de dejarlo interceptando el
       lienzo sin controles visibles. */
    if (id === 'panel-curve-edit' && PCW.studio && PCW.studio.hasCurveEdit &&
        PCW.studio.hasCurveEdit()) {
      PCW.studio.cancelCurveEdit();
      return;
    }
    dom.hide(dom.id(id));
  }

  function togglePanel(id) {
    var el = dom.id(id);
    if (!el) { return false; }
    if (dom.isHidden(el)) {
      openPanel(id);
      return true;
    }
    closePanel(id);
    return false;
  }

  function isPanelOpen(id) {
    return !dom.isHidden(dom.id(id));
  }

  function closeAll() {
    if (PCW.studio && PCW.studio.hasCurveEdit && PCW.studio.hasCurveEdit()) {
      PCW.studio.cancelCurveEdit();
    }
    var list = panelEls();
    var i;
    for (i = 0; i < list.length; i += 1) {
      dom.hide(list[i]);
    }
    if (PCW.studio && PCW.studio.cancelAdjust) {
      PCW.studio.cancelAdjust();
    }
  }

  /* ---------------------------------------------------------------- slider */

  function initSlider(el, opts) {
    opts = opts || {};
    el = (typeof el === 'string') ? dom.id(el) : el;
    if (!el) { return null; }
    var min = (opts.min != null) ? opts.min : parseFloat(el.getAttribute('data-min'));
    var max = (opts.max != null) ? opts.max : parseFloat(el.getAttribute('data-max'));
    var start = (opts.value != null) ? opts.value : parseFloat(el.getAttribute('data-value'));
    if (isNaN(min)) { min = 0; }
    if (isNaN(max)) { max = 100; }
    if (isNaN(start)) { start = min; }
    var scale = opts.scale || 'linear';
    var step = opts.step || 1;
    var logMin = Math.max(0.0001, min);
    var onChange = opts.onChange || function () {};

    el.innerHTML = '';
    var track = dom.create('div', 'vslider-track');
    var fill = dom.create('div', 'vslider-fill');
    var knob = dom.create('div', 'vslider-knob');
    track.appendChild(fill);
    el.appendChild(track);
    el.appendChild(knob);
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-valuemin', String(min));
    el.setAttribute('aria-valuemax', String(max));

    var value = util.clamp(start, min, max);

    function valueToT(v) {
      if (scale === 'log') {
        if (max <= logMin) { return 0; }
        return Math.log(Math.max(logMin, v) / logMin) / Math.log(max / logMin);
      }
      if (max === min) { return 0; }
      return (v - min) / (max - min);
    }

    function tToValue(t) {
      t = util.clamp(t, 0, 1);
      var v;
      if (scale === 'log') {
        v = logMin * Math.pow(max / logMin, t);
      } else {
        v = min + (max - min) * t;
      }
      if (step) {
        v = Math.round(v / step) * step;
      }
      return util.clamp(v, min, max);
    }

    function paint() {
      var t = valueToT(value);
      var pct = (t * 100) + '%';
      fill.style.height = pct;
      knob.style.bottom = pct;
      el.setAttribute('aria-valuenow', String(value));
      el.setAttribute('data-value', String(value));
      el.title = opts.label ? (opts.label + ': ' + Math.round(value)) : String(Math.round(value));
    }

    function setValue(v, silent) {
      var next = util.clamp(Math.round(v / step) * step, min, max);
      value = next;
      paint();
      if (!silent) { onChange(value); }
    }

    function applyAt(clientY) {
      var rect = el.getBoundingClientRect();
      if (!rect.height) { return; }
      var t = 1 - ((clientY - rect.top) / rect.height);
      setValue(tToValue(t), false);
    }

    var lastTouch = 0;

    function onTouchStart(ev) {
      if (!ev.touches || !ev.touches.length) { return; }
      ev.preventDefault();
      lastTouch = Date.now();
      applyAt(ev.touches[0].clientY);
    }

    function onTouchMove(ev) {
      if (!ev.touches || !ev.touches.length) { return; }
      ev.preventDefault();
      lastTouch = Date.now();
      applyAt(ev.touches[0].clientY);
    }

    function onMouseDown(ev) {
      if (Date.now() - lastTouch < 700) { return; }
      ev.preventDefault();
      applyAt(ev.clientY);

      function move(e) { applyAt(e.clientY); }
      function up() {
        document.removeEventListener('mousemove', move, false);
        document.removeEventListener('mouseup', up, false);
      }
      document.addEventListener('mousemove', move, false);
      document.addEventListener('mouseup', up, false);
    }

    dom.on(el, 'touchstart', onTouchStart, false);
    dom.on(el, 'touchmove', onTouchMove, false);
    dom.on(el, 'mousedown', onMouseDown, false);

    paint();

    var ctrl = {
      el: el,
      setValue: setValue,
      getValue: function () { return value; },
      min: min,
      max: max,
      scale: scale
    };
    el._pcwSlider = ctrl;
    return ctrl;
  }

  function setSlider(el, value, silent) {
    if (typeof el === 'string') { el = dom.id(el); }
    if (!el || !el._pcwSlider) { return; }
    el._pcwSlider.setValue(value, silent !== false);
  }

  function sliderValue(el) {
    if (typeof el === 'string') { el = dom.id(el); }
    return (el && el._pcwSlider) ? el._pcwSlider.getValue() : 0;
  }

  /* ----------------------------------------------------------- entregables */

  function viewerPage(title, inner, extraCss) {
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">' +
      '<title>' + util.escapeHtml(title) + '</title><style>' +
      'body{margin:0;padding:24px;background:#111113;color:#eee;font:14px -apple-system,Helvetica,Arial,sans-serif;text-align:center;}' +
      'h1{font-size:18px;margin:0 0 10px;}p{color:#a9a9b2;font-size:13px;line-height:1.5;}' +
      'img{max-width:100%;height:auto;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.6);margin:14px 0;}' +
      'textarea{width:100%;height:60vh;margin:14px 0;padding:10px;border-radius:8px;border:1px solid #3a3a42;background:#0b0b0d;color:#cfd8dc;font:11px Menlo,Consolas,monospace;}' +
      'button{height:40px;padding:0 16px;border:0;border-radius:9px;background:#2f6fed;color:#fff;font:600 14px -apple-system,Helvetica,Arial,sans-serif;}' +
      '.note{max-width:680px;margin:0 auto;}' + (extraCss || '') +
      '</style></head><body>' + inner + '</body></html>';
  }

  function openViewer(html) {
    var win = null;
    try {
      win = root.open('', '_blank');
    } catch (e) {
      win = null;
    }
    if (!win) { return null; }
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e2) {
      PCW.logError('viewer', e2);
      return null;
    }
    return win;
  }

  function openPending(label) {
    var win = null;
    try {
      win = root.open('', '_blank');
    } catch (e) {
      win = null;
    }
    if (!win) { return null; }
    try {
      win.document.open();
      win.document.write(viewerPage(label || 'Exportar',
        '<div class="note"><h1>' + util.escapeHtml(label || 'Exportar') + '</h1>' +
        '<p>Preparando el archivo… no cierres esta ventana.</p></div>'));
      win.document.close();
    } catch (e2) {
      PCW.logError('viewer-pending', e2);
      return null;
    }
    return win;
  }

  function dataUrlSizeWarning(dataUrl) {
    if (dataUrl.length > 12 * 1024 * 1024) {
      toast('El archivo es grande; Safari 9 puede tardar o fallar al abrirlo.', 4200);
    }
  }

  function writeViewer(win, title, inner) {
    if (!win) { return false; }
    try {
      win.document.open();
      win.document.write(viewerPage(title, inner));
      win.document.close();
      return true;
    } catch (e) {
      PCW.logError('viewer-write', e);
      return false;
    }
  }

  function deliverImage(dataUrl, filename, label, pendingWindow) {
    dataUrlSizeWarning(dataUrl);
    if (PCW.env.hasDownload) {
      try {
        var a = document.createElement('a');
        a.href = dataUrl;
        a.setAttribute('download', filename);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (pendingWindow) { try { pendingWindow.close(); } catch (e0) { /* ignorado */ } }
        toast('Descarga iniciada: ' + filename);
        return true;
      } catch (e) {
        PCW.logError('download', e);
      }
    }
    var inner = '<div class="note"><h1>' + util.escapeHtml(label || 'Exportar') + '</h1>' +
      '<p>Mantén pulsado sobre la imagen y elige <strong>Guardar imagen</strong> (o Compartir). ' +
      'Safari 9 no permite descargar archivos directamente.</p>' +
      '<img src="' + dataUrl + '" alt="Exportación">' +
      '<p>Si la imagen no aparece, el data URL supera el límite de Safari 9.</p></div>';
    if (pendingWindow) {
      if (writeViewer(pendingWindow, label || 'Exportar', inner)) { return true; }
    }
    if (!openViewer(viewerPage(label || 'Exportar', inner))) {
      modal({
        title: 'Exportar',
        body: '<p class="form-note">El navegador bloqueó la ventana de exportación. ' +
          'Vuelve a intentarlo desde el botón Compartir.</p>',
        buttons: [{ label: 'Cerrar', primary: true }]
      });
      return false;
    }
    return true;
  }

  function deliverText(text, filename, mime, label, pendingWindow) {
    if (PCW.env.hasDownload) {
      try {
        if (PCW.env.hasBlob) {
          var blob = new Blob([text], { type: mime || 'text/plain' });
          var url = root.URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.setAttribute('download', filename);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { root.URL.revokeObjectURL(url); }, 4000);
          if (pendingWindow) { try { pendingWindow.close(); } catch (e0) { /* ignorado */ } }
          toast('Descarga iniciada: ' + filename);
          return true;
        }
        var data = 'data:' + (mime || 'text/plain') + ';charset=utf-8,' +
          encodeURIComponent(text);
        var a2 = document.createElement('a');
        a2.href = data;
        a2.setAttribute('download', filename);
        document.body.appendChild(a2);
        a2.click();
        document.body.removeChild(a2);
        if (pendingWindow) { try { pendingWindow.close(); } catch (e1) { /* ignorado */ } }
        toast('Descarga iniciada: ' + filename);
        return true;
      } catch (e) {
        PCW.logError('download-text', e);
      }
    }
    var inner = '<div class="note"><h1>' + util.escapeHtml(label || 'Exportar proyecto') + '</h1>' +
      '<p>Safari 9 no puede guardar archivos directamente. Toca el texto, selecciona todo, ' +
      'copia y pégalo en Notas o en un archivo. El contenido es el respaldo del proyecto.</p>' +
      '<textarea id="export-text" readonly spellcheck="false">' + util.escapeHtml(text) + '</textarea>' +
      '<button id="copy-btn" type="button">Seleccionar todo</button>' +
      '<p>Nombre sugerido: ' + util.escapeHtml(filename) + '</p></div>' +
      '<script>document.getElementById("copy-btn").onclick=function(){' +
      'var t=document.getElementById("export-text");t.focus();t.select();' +
      'try{document.execCommand("copy");this.textContent="Copiado";}catch(e){this.textContent="Selecciona y copia";}};<\/script>';
    if (pendingWindow) {
      if (writeViewer(pendingWindow, label || 'Exportar', inner)) { return true; }
    }
    if (!openViewer(viewerPage(label || 'Exportar', inner))) {
      modal({
        title: 'Exportar',
        body: '<p class="form-note">La ventana de exportación fue bloqueada. ' +
          'Permite las ventanas emergentes y vuelve a intentarlo.</p>',
        buttons: [{ label: 'Cerrar', primary: true }]
      });
      return false;
    }
    return true;
  }

  /* -------------------------------------------------------------- globales */

  function bindGlobal() {
    var scrim = dom.qs('#modal-root .modal-scrim');
    dom.on(scrim, 'click', closeModal);
    dom.on(dom.id('modal-close'), 'click', closeModal);

    document.addEventListener('keydown', function (ev) {
      if (ev.keyCode === 27) {
        if (!dom.isHidden(dom.id('modal-root'))) {
          closeModal();
        } else {
          closeAll();
        }
      }
    }, false);

    dom.on(scrim, 'touchmove', function (ev) {
      ev.preventDefault();
    }, false);

    var gestureBlock = function (ev) {
      if (ev.target && (ev.target.id === 'view-canvas' || ev.target.id === 'color-wheel' ||
          ev.target.className === 'vslider')) {
        ev.preventDefault();
      }
    };
    document.addEventListener('gesturestart', gestureBlock, false);
    document.addEventListener('gesturechange', gestureBlock, false);
  }

  PCW.ui = {
    showScreen: showScreen,
    currentScreen: current,
    modal: modal,
    closeModal: closeModal,
    isModalOpen: function () { return !dom.isHidden(dom.id('modal-root')); },
    confirm: confirm,
    prompt: prompt,
    toast: toast,
    setSaveState: setSaveState,
    openPanel: openPanel,
    closePanel: closePanel,
    togglePanel: togglePanel,
    isPanelOpen: isPanelOpen,
    closePanels: closePanels,
    closePopovers: closePopovers,
    closeAllFloating: closeAllFloating,
    closeAll: closeAll,
    initSlider: initSlider,
    setSlider: setSlider,
    sliderValue: sliderValue,
    deliverImage: deliverImage,
    deliverText: deliverText,
    openViewer: openViewer,
    openPending: openPending,
    bindGlobal: bindGlobal
  };

})(typeof window !== 'undefined' ? window : this);

/* ---- 40-gallery.js ---- */

/* ==========================================================================
   40 — Galería: listado, creación, renombrado, duplicado y borrado.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});
  var dom = PCW.dom;
  var util = PCW.util;
  var model = PCW.model;
  var storage = PCW.storage;
  var ui = PCW.ui;

  var projects = [];
  var inited = false;
  var currentPreset = 'pantalla';
  var refreshing = false;

  var PRESETS = [
    { id: 'pantalla', name: 'Pantalla', w: 1024, h: 768 },
    { id: 'retrato', name: 'Retrato', w: 768, h: 1024 },
    { id: 'cuadrado', name: 'Cuadrado', w: 1024, h: 1024 },
    { id: 'medio', name: 'Medio', w: 1536, h: 1152 },
    { id: 'grande', name: 'Grande', w: 2048, h: 1536 },
    { id: 'extra', name: 'Extra', w: 2560, h: 1920 }
  ];

  function findUp(node, attr) {
    var el = node;
    while (el && el !== document) {
      if (el.getAttribute && el.getAttribute(attr) != null) { return el; }
      el = el.parentNode;
    }
    return null;
  }

  function findProject(projectId) {
    var i;
    for (i = 0; i < projects.length; i += 1) {
      if (projects[i].id === projectId) { return projects[i]; }
    }
    return null;
  }

  function safeFilename(name) {
    var s = String(name || 'proyecto').replace(/[\\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    if (!s) { s = 'proyecto'; }
    return s.substring(0, 48);
  }

  function setStorageNote() {
    var note = dom.id('gallery-storage-note');
    var info = storage.info();
    if (!note) { return; }
    if (info.mode === 'memory') {
      note.textContent = 'Sin persistencia: ' + info.detail;
      note.className = 'storage-note';
      note.style.background = '#2f1717';
      note.style.borderColor = '#5a2424';
      note.style.color = '#ffb1b1';
      dom.show(note);
    } else if (info.mode === 'websql') {
      note.textContent = 'Almacenamiento de respaldo (WebSQL). ' + info.detail;
      dom.show(note);
    } else {
      dom.hide(note);
    }
  }

  function renderEmpty(isEmpty) {
    var empty = dom.id('gallery-empty');
    if (isEmpty) { dom.show(empty); } else { dom.hide(empty); }
  }

  function cardThumb(record) {
    var thumb = dom.create('span', 'card-thumb');
    if (record.thumb) {
      thumb.style.backgroundImage = 'url(' + record.thumb + ')';
    } else {
      thumb.innerHTML = '<svg class="ico thumb-empty" viewBox="0 0 24 24">' +
        '<rect x="3" y="4" width="18" height="16" rx="2"/>' +
        '<path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="8.5" cy="8.5" r="1.4"/></svg>';
    }
    return thumb;
  }

  function renderList() {
    var grid = dom.id('gallery-grid');
    var count = dom.id('gallery-count');
    dom.empty(grid);
    dom.setText(count, projects.length ?
      (projects.length + (projects.length === 1 ? ' lienzo' : ' lienzos')) : '');

    if (!projects.length) {
      renderEmpty(true);
      return;
    }
    renderEmpty(false);

    var i;
    for (i = 0; i < projects.length; i += 1) {
      (function (record) {
        var card = dom.create('div', 'project-card');
        card.setAttribute('data-id', record.id);

        var open = dom.create('button', 'card-open');
        open.type = 'button';
        open.setAttribute('data-open', record.id);
        open.setAttribute('aria-label', 'Abrir ' + (record.name || 'proyecto'));
        open.appendChild(cardThumb(record));

        var meta = dom.create('span', 'card-meta');
        meta.appendChild(dom.create('span', 'card-name', record.name || 'Sin título'));
        meta.appendChild(dom.create('span', 'card-sub',
          util.formatDim(record.width, record.height) + ' · ' +
          util.formatDate(record.updatedAt) + ' · ' +
          (record.layerCount || (record.layers ? record.layers.length : 1)) + ' capas'));
        open.appendChild(meta);

        var menu = dom.create('button', 'card-menu', '⋯');
        menu.type = 'button';
        menu.setAttribute('data-menu', record.id);
        menu.setAttribute('aria-label', 'Opciones de ' + (record.name || 'proyecto'));

        card.appendChild(open);
        card.appendChild(menu);
        grid.appendChild(card);
      }(projects[i]));
    }
  }

  function refresh(cb) {
    if (refreshing) {
      if (cb) { setTimeout(function () { cb(); }, 120); }
      return;
    }
    refreshing = true;
    setStorageNote();
    storage.listProjects(function (err, list) {
      refreshing = false;
      if (err) {
        PCW.logError('gallery:list', err);
        ui.toast('No se pudo leer la galería: ' + err.message, 3200);
        renderList();
        if (cb) { cb(err); }
        return;
      }
      projects = list || [];
      renderList();
      if (cb) { cb(null); }
    });
  }

  function show() {
    ui.showScreen('screen-gallery');
    refresh();
  }

  /* ------------------------------------------------------------ nuevo lienzo */

  function presetById(presetId) {
    var i;
    for (i = 0; i < PRESETS.length; i += 1) {
      if (PRESETS[i].id === presetId) { return PRESETS[i]; }
    }
    return PRESETS[0];
  }

  function budgetNote() {
    var w = parseInt((dom.id('new-width') || {}).value, 10);
    var h = parseInt((dom.id('new-height') || {}).value, 10);
    var note = dom.id('new-budget-note');
    if (!note) { return; }
    if (!w || !h) {
      note.className = 'form-error';
      note.textContent = 'Introduce anchura y altura.';
      return;
    }
    if (!model.validSize(w, h)) {
      note.className = 'form-error';
      note.textContent = 'Dimensiones permitidas: de ' + model.MIN_SIZE +
        ' a ' + model.MAX_SIZE + ' px por lado.';
      return;
    }
    var budget = model.budgetFor(w, h);
    if (budget.overBudget || budget.maxLayers < 1) {
      note.className = 'form-error';
      note.textContent = 'Una capa de ' + util.formatDim(w, h) + ' ocupa ' +
        util.formatBytes(budget.layerBytes) +
        ' y supera el presupuesto de 40 MB. Reduce el tamaño.';
      return;
    }
    note.className = 'form-note';
    note.textContent = util.formatDim(w, h) + ' · ' +
      util.formatBytes(budget.layerBytes) + ' por capa · hasta ' +
      budget.maxLayers + ' capas (' + util.formatBytes(budget.totalBytes) +
      ' de píxeles). Presupuesto duro del shell: 40 MB.';
  }

  function selectPreset(presetId, fillInputs) {
    currentPreset = presetId;
    var preset = presetById(presetId);
    if (fillInputs) {
      dom.id('new-width').value = preset.w;
      dom.id('new-height').value = preset.h;
    }
    var items = dom.qsa('.preset');
    var i;
    for (i = 0; i < items.length; i += 1) {
      if (items[i].getAttribute('data-preset') === presetId) {
        items[i].classList.add('is-selected');
      } else {
        items[i].classList.remove('is-selected');
      }
    }
    budgetNote();
  }

  function openNewCanvas() {
    var presetHtml = '<div class="preset-grid">';
    var i;
    for (i = 0; i < PRESETS.length; i += 1) {
      var b = model.budgetFor(PRESETS[i].w, PRESETS[i].h);
      presetHtml += '<button class="preset' +
        (PRESETS[i].id === 'pantalla' ? ' is-selected' : '') +
        '" type="button" data-preset="' + PRESETS[i].id + '">' +
        '<span class="preset-name">' + PRESETS[i].name + '</span>' +
        '<span class="preset-dim">' + PRESETS[i].w + ' × ' + PRESETS[i].h +
        ' · ' + b.maxLayers + ' capas</span></button>';
    }
    presetHtml += '</div>';

    var body = '<div class="field"><label for="new-name">Nombre</label>' +
      '<input id="new-name" class="input" type="text" value="Sin título" ' +
      'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>' +
      '<div class="panel-subhead" style="padding-left:0;margin-top:16px;">Tamaño</div>' +
      presetHtml +
      '<div class="form-row">' +
      '<div class="field"><label for="new-width">Anchura (px)</label>' +
      '<input id="new-width" class="input" type="number" inputmode="numeric" value="1024"></div>' +
      '<div class="field"><label for="new-height">Altura (px)</label>' +
      '<input id="new-height" class="input" type="number" inputmode="numeric" value="768"></div>' +
      '</div>' +
      '<p id="new-budget-note" class="form-note"></p>' +
      '<p class="form-note">Sin fondo transparente en esta fase: el lienzo empieza en blanco. ' +
      'Los pinceles son propios y el motor de trazo es provisional (Fase 3).</p>';

    var ctrl = ui.modal({
      title: 'Nuevo lienzo',
      body: body,
      width: 620,
      buttons: [
        { label: 'Cancelar' },
        {
          label: 'Crear',
          primary: true,
          onClick: function () {
            var name = dom.id('new-name').value;
            var w = parseInt(dom.id('new-width').value, 10);
            var h = parseInt(dom.id('new-height').value, 10);
            var note = dom.id('new-budget-note');
            if (!w || !h || !model.validSize(w, h)) {
              note.className = 'form-error';
              note.textContent = 'Dimensiones inválidas. Usa de ' + model.MIN_SIZE +
                ' a ' + model.MAX_SIZE + ' px.';
              return false;
            }
            var budget = model.budgetFor(w, h);
            if (budget.overBudget || budget.maxLayers < 1) {
              note.className = 'form-error';
              note.textContent = 'Este tamaño supera el presupuesto de 40 MB por lienzo.';
              return false;
            }
            createCanvas(model.cleanName(name), w, h);
          }
        }
      ]
    });

    var presets = dom.qsa('.preset', ctrl.body);
    for (i = 0; i < presets.length; i += 1) {
      (function (btn) {
        dom.on(btn, 'click', function () {
          selectPreset(btn.getAttribute('data-preset'), true);
        });
      }(presets[i]));
    }

    var wInput = dom.id('new-width');
    var hInput = dom.id('new-height');
    var onCustom = function () {
      var selected = null;
      var j;
      for (j = 0; j < PRESETS.length; j += 1) {
        if (PRESETS[j].w === parseInt(wInput.value, 10) &&
            PRESETS[j].h === parseInt(hInput.value, 10)) {
          selected = PRESETS[j].id;
        }
      }
      currentPreset = selected || '';
      var items = dom.qsa('.preset');
      for (j = 0; j < items.length; j += 1) {
        if (items[j].getAttribute('data-preset') === currentPreset) {
          items[j].classList.add('is-selected');
        } else {
          items[j].classList.remove('is-selected');
        }
      }
      budgetNote();
    };
    dom.on(wInput, 'input', onCustom);
    dom.on(hInput, 'input', onCustom);
    budgetNote();
  }

  function createCanvas(name, w, h) {
    var doc = model.createDoc({ name: name, width: w, height: h });
    var record = model.toRecord(doc, '');
    ui.toast('Creando lienzo…', 1200);
    storage.saveProject(record, { layerData: {} }, function (err) {
      if (err) {
        PCW.logError('gallery:create', err);
        ui.toast('No se pudo guardar el lienzo nuevo: ' + err.message, 3000);
      }
      PCW.studio.open(doc, {});
    });
  }

  /* --------------------------------------------------------------- acciones */

  function openProject(projectId) {
    var record = findProject(projectId);
    if (!record) { return; }
    ui.toast('Abriendo…', 1100);
    storage.loadProject(projectId, function (err, data) {
      if (err) {
        PCW.logError('gallery:open', err);
        ui.modal({
          title: 'No se pudo abrir',
          body: '<p class="form-note">' + util.escapeHtml(err.message) + '</p>',
          buttons: [{ label: 'Cerrar', primary: true }]
        });
        return;
      }
      var doc;
      try {
        doc = model.fromRecord(data.record);
      } catch (e) {
        PCW.logError('gallery:fromRecord', e);
        ui.toast('Proyecto dañado: ' + e.message, 3200);
        return;
      }
      PCW.studio.open(doc, data.layers || {});
    });
  }

  function renameProject(projectId) {
    var record = findProject(projectId);
    if (!record) { return; }
    ui.prompt({
      title: 'Renombrar proyecto',
      label: 'Nombre',
      value: record.name,
      confirmLabel: 'Guardar'
    }, function (value) {
      var next = model.cleanName(value);
      record.name = next;
      record.updatedAt = Date.now();
      storage.saveProject(record, { layerData: {} }, function (err) {
        if (err) {
          ui.toast('No se pudo renombrar: ' + err.message, 3000);
          return;
        }
        refresh();
        ui.toast('Renombrado');
      });
    });
  }

  function duplicateProject(projectId) {
    var record = findProject(projectId);
    if (!record) { return; }
    ui.toast('Duplicando…', 1200);
    storage.loadProject(projectId, function (err, data) {
      if (err) {
        ui.toast('No se pudo duplicar: ' + err.message, 3000);
        return;
      }
      var doc;
      try {
        doc = model.fromRecord(data.record);
      } catch (e) {
        ui.toast('Proyecto dañado: ' + e.message, 3000);
        return;
      }
      doc.id = util.uid('doc');
      doc.name = model.cleanName(doc.name + ' copia');
      doc.createdAt = Date.now();
      doc.updatedAt = Date.now();
      var nextRecord = model.toRecord(doc, data.record.thumb || '');
      storage.saveProject(nextRecord, { layerData: data.layers || {} }, function (err2) {
        if (err2) {
          ui.toast('No se pudo duplicar: ' + err2.message, 3000);
          return;
        }
        refresh();
        ui.toast('Proyecto duplicado');
      });
    });
  }

  function deleteProject(projectId) {
    var record = findProject(projectId);
    if (!record) { return; }
    ui.confirm({
      title: 'Eliminar proyecto',
      message: '“' + record.name + '” se eliminará de este dispositivo. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true
    }, function () {
      storage.deleteProject(projectId, function (err) {
        if (err) {
          ui.toast('No se pudo eliminar: ' + err.message, 3000);
          return;
        }
        refresh();
        ui.toast('Proyecto eliminado');
      });
    });
  }

  function exportProject(projectId) {
    var record = findProject(projectId);
    if (!record) { return; }
    var pending = null;
    if (!PCW.env.hasDownload) {
      try {
        pending = root.open('', '_blank');
        if (pending) {
          pending.document.open();
          pending.document.write('<p style="font:14px Helvetica;color:#888;background:#111;padding:24px;">Preparando exportación…</p>');
          pending.document.close();
        }
      } catch (e) { pending = null; }
    }
    ui.toast('Preparando respaldo…', 1800);
    storage.loadProject(projectId, function (err, data) {
      if (err) {
        if (pending) { try { pending.close(); } catch (e2) { /* ignorado */ } }
        ui.toast('No se pudo exportar: ' + err.message, 3000);
        return;
      }
      var layers = [];
      var i;
      var source = data.record.layers || [];
      for (i = 0; i < source.length; i += 1) {
        layers.push({
          id: source[i].id,
          name: source[i].name,
          data: (data.layers && data.layers[source[i].id]) || ''
        });
      }
      var payload = {
        schema: model.SCHEMA,
        format: 'pcw-json-png-dataurl',
        exportedAt: Date.now(),
        note: 'Respaldo de Procreate Web. Las capas son PNG en data URL.',
        doc: data.record,
        layers: layers
      };
      var text = JSON.stringify(payload);
      ui.deliverText(text, safeFilename(record.name) + '.pcw',
        'application/json', 'Exportar proyecto', pending);
    });
  }

  /* Importa un respaldo .pcw. Siempre crea un proyecto nuevo para no
     sobrescribir el original; las capas se validan antes de escribir. */
  var IMPORT_MAX_BYTES = 80 * 1024 * 1024;

  function importProjectFile(file) {
    if (!file) { return; }
    if (file.size > IMPORT_MAX_BYTES) {
      ui.toast('El archivo supera los 80 MB; no se puede importar', 3200);
      return;
    }
    var reader = new FileReader();
    reader.onerror = function () {
      ui.toast('No se pudo leer el archivo', 3000);
    };
    reader.onload = function () {
      var payload;
      try {
        payload = JSON.parse(String(reader.result || ''));
      } catch (e) {
        ui.toast('El archivo no es un .pcw válido', 3200);
        return;
      }
      var record = payload && (payload.doc || payload.record) ? (payload.doc || payload.record) : payload;
      if (!record || !record.layers) {
        ui.toast('El respaldo no contiene un proyecto', 3200);
        return;
      }
      var doc;
      try {
        doc = model.fromRecord(record);
      } catch (e2) {
        ui.toast('Proyecto inválido: ' + e2.message, 3600);
        return;
      }
      var budget = model.budgetFor(doc.width, doc.height);
      if (budget.overBudget || doc.layers.length > budget.maxLayers) {
        ui.toast('El proyecto no cabe en el presupuesto de 40 MB', 3600);
        return;
      }
      doc.id = util.uid('doc');
      doc.createdAt = Date.now();
      doc.updatedAt = Date.now();
      var layerData = {};
      var source = payload.layers || [];
      var i;
      if (source.length) {
        for (i = 0; i < source.length; i += 1) {
          if (source[i] && source[i].id && typeof source[i].data === 'string' &&
              source[i].data.indexOf('data:image/') === 0) {
            layerData[source[i].id] = source[i].data;
          }
        }
      } else if (payload.layerData) {
        for (i in payload.layerData) {
          if (Object.prototype.hasOwnProperty.call(payload.layerData, i) &&
              typeof payload.layerData[i] === 'string') {
            layerData[i] = payload.layerData[i];
          }
        }
      }
      var missing = 0;
      for (i = 0; i < doc.layers.length; i += 1) {
        if (!layerData[doc.layers[i].id]) { missing += 1; }
      }
      if (missing > 0) {
        ui.toast('Aviso: ' + missing + ' capa(s) llegarán vacías', 3600);
      }
      storage.saveProject(model.toRecord(doc, record.thumb || ''), {
        layerData: layerData
      }, function (err) {
        if (err) {
          ui.toast('No se pudo importar: ' + err.message, 3600);
          return;
        }
        refresh();
        ui.toast('Proyecto importado');
      });
    };
    reader.readAsText(file);
  }

  function projectMenu(projectId) {
    var record = findProject(projectId);
    if (!record) { return; }
    var body = dom.create('div');
    var summary = dom.create('div', 'project-summary');
    var thumb = dom.create('div', 'mini-thumb');
    if (record.thumb) { thumb.style.backgroundImage = 'url(' + record.thumb + ')'; }
    var info = dom.create('div');
    info.appendChild(dom.create('div', 'summary-name', record.name));
    info.appendChild(dom.create('div', 'summary-sub',
      util.formatDim(record.width, record.height) + ' · ' +
      (record.layerCount || 1) + ' capas · ' +
      util.formatDate(record.updatedAt)));
    summary.appendChild(thumb);
    summary.appendChild(info);
    body.appendChild(summary);

    var list = dom.create('ul', 'menu-list');
    var actions = [
      { key: 'open', label: 'Abrir' },
      { key: 'rename', label: 'Renombrar' },
      { key: 'duplicate', label: 'Duplicar' },
      { key: 'export', label: 'Exportar respaldo (.pcw)' },
      { key: 'delete', label: 'Eliminar', danger: true }
    ];
    var i;
    for (i = 0; i < actions.length; i += 1) {
      var li = dom.create('li');
      var btn = dom.create('button', actions[i].danger ? 'danger' : '', actions[i].label);
      btn.type = 'button';
      btn.setAttribute('data-paction', actions[i].key);
      li.appendChild(btn);
      list.appendChild(li);
    }
    body.appendChild(list);

    var ctrl = ui.modal({
      title: 'Proyecto',
      body: body,
      width: 430,
      buttons: [{ label: 'Cerrar' }]
    });

    var buttons = dom.qsa('[data-paction]', ctrl.body);
    var j;
    for (j = 0; j < buttons.length; j += 1) {
      (function (btn) {
        dom.on(btn, 'click', function () {
          var action = btn.getAttribute('data-paction');
          ui.closeModal();
          if (action === 'open') { openProject(projectId); }
          else if (action === 'rename') { renameProject(projectId); }
          else if (action === 'duplicate') { duplicateProject(projectId); }
          else if (action === 'export') { exportProject(projectId); }
          else if (action === 'delete') { deleteProject(projectId); }
        });
      }(buttons[j]));
    }
  }

  /* ------------------------------------------------------------------- init */

  function init() {
    if (inited) { return; }
    inited = true;

    dom.on(dom.id('btn-new-project'), 'click', openNewCanvas);
    dom.on(dom.id('btn-new-project-2'), 'click', openNewCanvas);
    dom.on(dom.id('btn-diag'), 'click', function () {
      PCW.diag.show();
    });

    var importInput = dom.id('file-project');
    if (importInput) {
      dom.on(importInput, 'change', function () {
        var file = importInput.files && importInput.files[0];
        if (file) { importProjectFile(file); }
        importInput.value = '';
      });
    }

    dom.on(dom.id('gallery-grid'), 'click', function (ev) {
      var openEl = findUp(ev.target, 'data-open');
      if (openEl) {
        openProject(openEl.getAttribute('data-open'));
        return;
      }
      var menuEl = findUp(ev.target, 'data-menu');
      if (menuEl) {
        projectMenu(menuEl.getAttribute('data-menu'));
      }
    });
  }

  PCW.gallery = {
    init: init,
    show: show,
    refresh: refresh,
    openNewCanvas: openNewCanvas,
    openProject: openProject,
    getProjects: function () { return projects.slice(0); }
  };

})(typeof window !== 'undefined' ? window : this);

/* ---- 50-studio.js ---- */

/* ==========================================================================
   50 — Estudio: vista, entrada táctil, motor de trazo provisional, capas,
        historial, autoguardado y exportación.
   Fase 3 sustituirá el motor provisional. Lo que hay aquí se prueba, no se
   presenta como equivalente final al motor de Procreate.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});
  var dom = PCW.dom;
  var util = PCW.util;
  var mat = PCW.mat;
  var model = PCW.model;
  var storage = PCW.storage;
  var ui = PCW.ui;

  var SNAPSHOT_LIMIT = 16 * 1024 * 1024;
  var STAMP_CACHE_LIMIT = 6 * 1024 * 1024;
  /* Movimiento mínimo (px CSS) antes de crear la instantánea del trazo. */
  var PENDING_SLOP = 6;

  var st = null;
  var stage = null;
  var viewCanvas = null;
  var viewCtx = null;
  var badge = null;
  var rafId = null;
  var running = false;
  var inited = false;
  var saveTimer = null;
  var gesture = null;
  var pendingStroke = null;
  var lastTouchTime = 0;
  var sizeSlider = null;
  var opacitySlider = null;
  var pointerPressure = 0.5;
  var pointerTiltX = 0;
  var pointerTiltY = 0;

  var stampCache = {};
  var stampOrder = [];
  var stampBytes = 0;

  /* Asistencia de trazo: QuickShape se activa al mantener el dedo quieto al
     final; el reconocimiento de curvas se aplica a petición del usuario. */
  var QUICK_HOLD_MS = 380;
  var quickHoldTimer = null;
  var QUICK_PREF_KEY = 'pcw.quickshape.v1';
  var CURVE_PREF_KEY = 'pcw.curverecognition.v1';

  function readBoolPref(key, fallback) {
    try {
      if (root.localStorage) {
        var raw = root.localStorage.getItem(key);
        if (raw === '0') { return false; }
        if (raw === '1') { return true; }
      }
    } catch (e) { /* almacenamiento no disponible */ }
    return fallback;
  }

  function writeBoolPref(key, value) {
    try {
      if (root.localStorage) { root.localStorage.setItem(key, value ? '1' : '0'); }
    } catch (e) { /* almacenamiento no disponible */ }
  }

  function readQuickShapePref() { return readBoolPref(QUICK_PREF_KEY, true); }
  function readCurvePref() { return readBoolPref(CURVE_PREF_KEY, true); }

  function clearQuickHold() {
    if (quickHoldTimer) {
      clearTimeout(quickHoldTimer);
      quickHoldTimer = null;
    }
  }

  var rafFn = root.requestAnimationFrame || function (cb) {
    return setTimeout(function () { cb(Date.now()); }, 16);
  };
  var cafFn = root.cancelAnimationFrame || function (id) {
    clearTimeout(id);
  };

  function now() {
    return Date.now();
  }

  function safeName(name) {
    var s = String(name || 'lienzo').replace(/[\\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    if (!s) { s = 'lienzo'; }
    return s.substring(0, 48);
  }

  function activeLayer(s) {
    return model.findLayer(s.doc, s.activeLayerId) || s.doc.layers[s.doc.layers.length - 1];
  }

  function layerCanvas(s, layerId) {
    return s.canvases[layerId] || null;
  }

  function layerCtx(s, layerId) {
    return s.ctxs[layerId] || null;
  }

  /* ------------------------------------------------------------ pinceles */

  function quantizeRadius(r) {
    r = Math.max(0.6, r);
    var step;
    if (r < 8) { step = 1; }
    else if (r < 24) { step = 2; }
    else if (r < 64) { step = 4; }
    else { step = 8; }
    return Math.max(1, Math.round(r / step) * step);
  }

  function evictStamps(needed) {
    while (stampBytes + needed > STAMP_CACHE_LIMIT && stampOrder.length) {
      var key = stampOrder.shift();
      var entry = stampCache[key];
      if (entry) {
        stampBytes -= entry.bytes;
        delete stampCache[key];
      }
    }
  }

  function getStamp(brush, color, tool, radius) {
    var qr = quantizeRadius(radius);
    var colorKey = (tool === 'eraser') ? 'er' : color;
    var shapeKey = Math.round((brush.hardness || 0) * 100) + ':' +
      Math.round((brush.grain || 0) * 100) + ':' +
      Math.round((brush.streak || 0) * 100);
    var key = brush.id + '|' + colorKey + '|' + tool + '|' + qr + '|' + shapeKey;
    if (stampCache[key]) { return stampCache[key].canvas; }

    var size = Math.max(2, Math.ceil(qr * 2));
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    var g = c.getContext('2d');
    var cx = size / 2;
    var rgb = util.hexToRgb(color) || { r: 0, g: 0, b: 0 };
    if (tool === 'eraser') { rgb = { r: 255, g: 255, b: 255 }; }

    var hard = util.clamp(brush.hardness, 0, 1);
    var inner = 0.04 + hard * 0.9;
    var grad = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',1)');
    grad.addColorStop(Math.max(0.01, inner - 0.03),
      'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.98)');
    grad.addColorStop(inner, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.6)');
    grad.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);

    if (brush.grain > 0.15 && tool !== 'eraser') {
      g.globalCompositeOperation = 'destination-out';
      var count = Math.min(620, Math.floor(size * size * 0.006 * brush.grain));
      var i;
      for (i = 0; i < count; i += 1) {
        var a = Math.random() * Math.PI * 2;
        var rr = Math.sqrt(Math.random()) * cx * 0.96;
        var px = cx + Math.cos(a) * rr;
        var py = cx + Math.sin(a) * rr;
        var hole = Math.max(0.7, size * 0.018 * Math.random() * (0.5 + brush.grain));
        g.fillStyle = 'rgba(0,0,0,' + (0.18 + Math.random() * 0.5 * brush.grain) + ')';
        g.beginPath();
        g.arc(px, py, hole, 0, Math.PI * 2, false);
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }

    /* Cerdas / vetas: rayas finas que vacían parte de la estampa. Da el
       borde seco de Dry Ink y la textura quebrada de Shale Brush. */
    var streak = brush.streak || 0;
    if (streak > 0.05 && tool !== 'eraser') {
      g.globalCompositeOperation = 'destination-out';
      var lines = Math.max(2, Math.round(size / 5));
      var line;
      for (line = 0; line < lines; line += 1) {
        var lx = (line + 0.5) * (size / lines) + (Math.random() - 0.5) * 1.5;
        var gaps = 2 + Math.floor(Math.random() * 3);
        var gap;
        for (gap = 0; gap < gaps; gap += 1) {
          var gy = Math.random() * size * 0.9;
          var gh = Math.max(1.5, size * (0.05 + Math.random() * 0.16));
          g.fillStyle = 'rgba(0,0,0,' + (0.15 + Math.random() * 0.45 * streak) + ')';
          g.fillRect(lx - 0.5, gy, 1 + Math.random() * 0.9, gh);
        }
      }
      /* Borde irregular: pequeños mordiscos en el contorno. */
      var bites = Math.floor(7 + streak * 10);
      var bite;
      for (bite = 0; bite < bites; bite += 1) {
        var ba = Math.random() * Math.PI * 2;
        var br = cx * (0.72 + Math.random() * 0.26);
        var bs = Math.max(1, size * 0.025);
        g.fillStyle = 'rgba(0,0,0,' + (0.25 + Math.random() * 0.4 * streak) + ')';
        g.beginPath();
        g.arc(cx + Math.cos(ba) * br, cx + Math.sin(ba) * br, bs, 0, Math.PI * 2, false);
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }

    var bytes = size * size * 4;
    evictStamps(bytes);
    stampCache[key] = { canvas: c, bytes: bytes };
    stampOrder.push(key);
    stampBytes += bytes;
    return c;
  }

  function pseudo(seed, index) {
    var x = Math.sin(seed + index * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  /* Puntos extra que genera la guía de simetría. La guía es visual y también
     afecta al trazo: lo que se pinta a un lado aparece en el espejo. */
  function symmetryPoints(s, x, y) {
    var pts = [{ x: x, y: y }];
    var mode = s.symmetry || 'off';
    if (mode === 'off') { return pts; }
    var w = s.doc.width;
    var h = s.doc.height;
    if (mode === 'vertical' || mode === 'quad') {
      pts.push({ x: w - x, y: y });
    }
    if (mode === 'horizontal' || mode === 'quad') {
      pts.push({ x: x, y: h - y });
    }
    if (mode === 'quad') {
      pts.push({ x: w - x, y: h - y });
    }
    return pts;
  }

  function stampAt(s, x, y, factor, alphaFactor, angle) {
    var stroke = s.stroke;
    if (!stroke) { return; }
    /* Presión del lápiz (si el navegador la expone). A presión media el
       tamaño no cambia; por encima engorda y por debajo afina. */
    var pressAmount = s.brush.pressure || 0;
    var pressureValue = (typeof stroke.lastPressure === 'number')
      ? util.clamp(stroke.lastPressure, 0, 1) : 0.5;
    if (pressAmount > 0.01) {
      factor *= 1 - pressAmount * 0.5 + pressAmount * pressureValue;
    }
    var radius = (s.size / 2) * factor;
    if (radius < 0.35) { return; }
    var ctx = layerCtx(s, stroke.layerId);
    if (!ctx) { return; }
    var sprite;
    var alpha = (s.opacity / 100) * alphaFactor;
    if (pressAmount > 0.01) {
      alpha *= 1 - pressAmount * 0.4 * (1 - pressureValue);
    }
    var layer = model.findLayer(s.doc, stroke.layerId);
    var points = symmetryPoints(s, x, y);
    var p;
    var pi;

    for (pi = 0; pi < points.length; pi += 1) {
      p = points[pi];
      if (s.tool === 'smudge') {
        smudgeAt(s, p.x, p.y, radius, alpha);
      } else {
        sprite = getStamp(s.brush, s.color, s.tool, radius);
        var target = s.strokeBufferCtx || ctx;
        target.save();
        if (s.strokeBufferCtx) {
          target.globalCompositeOperation = 'source-over';
        } else if (s.tool === 'eraser') {
          target.globalCompositeOperation = 'destination-out';
        } else if (layer && layer.alphaLock) {
          target.globalCompositeOperation = 'source-atop';
        } else {
          target.globalCompositeOperation = 'source-over';
        }
        target.globalAlpha = util.clamp(alpha, 0, 1);
        target.drawImage(sprite, p.x - radius, p.y - radius, radius * 2, radius * 2);
        target.restore();
        if (s.strokeBufferCtx) {
          s.strokeBufferVersion += 1;
        }
      }

      var b = stroke.bounds;
      if (p.x - radius < b.x0) { b.x0 = p.x - radius; }
      if (p.y - radius < b.y0) { b.y0 = p.y - radius; }
      if (p.x + radius > b.x1) { b.x1 = p.x + radius; }
      if (p.y + radius > b.y1) { b.y1 = p.y + radius; }
      stroke.stampCount += 1;
    }
    stroke.lastDir = angle || 0;
    s.needsRender = true;
  }

  function smudgeAt(s, x, y, radius, alpha) {
    if (!s.composite) { return; }
    var r = Math.max(3, Math.min(radius * 0.7, 46));
    var w = s.doc.width;
    var h = s.doc.height;
    var sx = util.clamp(Math.round(x - r), 0, Math.max(0, w - r * 2));
    var sy = util.clamp(Math.round(y - r), 0, Math.max(0, h - r * 2));
    var patch = s.smudgePatch;
    if (!patch) {
      patch = document.createElement('canvas');
      s.smudgePatch = patch;
    }
    var side = Math.max(2, Math.ceil(r * 2));
    if (patch.width !== side || patch.height !== side) {
      patch.width = side;
      patch.height = side;
    }
    var pg = patch.getContext('2d');
    pg.clearRect(0, 0, side, side);
    pg.drawImage(s.composite, sx, sy, side, side, 0, 0, side, side);
    var ctx = layerCtx(s, s.stroke.layerId);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = util.clamp(alpha * 0.42, 0, 0.5);
    ctx.drawImage(patch, x - r, y - r, side, side);
    ctx.restore();
  }

  /* ---------------------------------------------------------------- vista */

  function stageSize() {
    return {
      w: (stage && stage.clientWidth) ? stage.clientWidth : 956,
      h: (stage && stage.clientHeight) ? stage.clientHeight : 708
    };
  }

  function viewMatrix(s) {
    var size = stageSize();
    var doc = s.doc;
    var flip = s.view.flipX ? -1 : 1;
    var m = mat.identity();
    m = mat.mul(m, mat.translate(size.w / 2 + s.view.tx, size.h / 2 + s.view.ty));
    m = mat.mul(m, mat.rotate(s.view.rotation));
    m = mat.mul(m, mat.scale(s.view.scale * flip, s.view.scale));
    m = mat.mul(m, mat.translate(-doc.width / 2, -doc.height / 2));
    return m;
  }

  function fit() {
    if (!st) { return; }
    var size = stageSize();
    var rot = st.view.rotation || 0;
    var cos = Math.abs(Math.cos(rot));
    var sin = Math.abs(Math.sin(rot));
    var bw = st.doc.width * cos + st.doc.height * sin;
    var bh = st.doc.width * sin + st.doc.height * cos;
    var pad = 70;
    var scale = Math.min((size.w - pad) / bw, (size.h - pad) / bh);
    scale = util.clamp(scale, 0.05, 4);
    st.view.scale = scale;
    st.view.tx = 0;
    st.view.ty = 0;
    syncView(st);
    requestRender();
    updateBadge();
    scheduleSave();
  }

  function resetView() {
    if (!st) { return; }
    st.view.rotation = 0;
    st.view.flipX = false;
    fit();
    updateResetLabel();
    updateBadge();
  }

  function syncView(s) {
    s.doc.view = {
      scale: s.view.scale,
      rotation: s.view.rotation,
      tx: s.view.tx,
      ty: s.view.ty,
      flipX: s.view.flipX
    };
  }

  /* --------------------------------------------------------------- render */

  function resizeCanvas() {
    if (!viewCanvas) { return; }
    var size = stageSize();
    var dpr = Math.min(PCW.env.dpr || 1, 2);
    var pw = Math.max(1, Math.round(size.w * dpr));
    var ph = Math.max(1, Math.round(size.h * dpr));
    if (viewCanvas.width !== pw || viewCanvas.height !== ph) {
      viewCanvas.width = pw;
      viewCanvas.height = ph;
    }
  }

  function newDocCanvas(s) {
    var c = document.createElement('canvas');
    c.width = s.doc.width;
    c.height = s.doc.height;
    return c;
  }

  function drawTransformedLayer(ctx, s, layer) {
    var t = s.transform;
    var b = t.bounds;
    var cx = b.x + b.w / 2;
    var cy = b.y + b.h / 2;
    if (t.base) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(t.base, 0, 0);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(cx + t.tx, cy + t.ty);
    ctx.rotate(t.rotation);
    ctx.scale(t.scale * t.flipX, t.scale * t.flipY);
    ctx.translate(-cx, -cy);
    ctx.drawImage(t.source, 0, 0);
    ctx.restore();
  }

  function drawAdjustLayer(ctx, s) {
    var a = s.adjust;
    var src = a.preview || a.source;
    if (src) { ctx.drawImage(src, 0, 0); }
  }

  function drawStrokeLayer(ctx, s, layer) {
    if (s.strokeViewVersion !== s.strokeBufferVersion) {
      buildStrokeView(s, layer);
    }
    if (s.strokeView) { ctx.drawImage(s.strokeView, 0, 0); }
  }

  function dashLine(ctx, scale) {
    if (ctx.setLineDash) {
      ctx.setLineDash([7 / scale, 5 / scale]);
    }
  }

  function ellipsePath(ctx, cx, cy, rx, ry) {
    if (rx <= 0.1 || ry <= 0.1) { return; }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx, ry);
    ctx.arc(0, 0, 1, 0, Math.PI * 2, false);
    ctx.restore();
  }

  function traceOutline(ctx, outline) {
    if (!outline) { return; }
    var i;
    if (outline.type === 'rect' || outline.type === 'auto') {
      ctx.rect(outline.x, outline.y, outline.w, outline.h);
    } else if (outline.type === 'ellipse') {
      ellipsePath(ctx, outline.x + outline.w / 2, outline.y + outline.h / 2,
        outline.w / 2, outline.h / 2);
    } else if (outline.type === 'lasso' && outline.points && outline.points.length > 1) {
      ctx.moveTo(outline.points[0].x, outline.points[0].y);
      for (i = 1; i < outline.points.length; i += 1) {
        ctx.lineTo(outline.points[i].x, outline.points[i].y);
      }
      ctx.closePath();
    }
  }

  function drawSelectionOverlay(ctx, s, invScale) {
    var scale = Math.max(0.08, s.view.scale);
    var sel = s.selection;
    var draft = s.selectDraft;
    if (!sel && !draft) { return; }

    if (sel && sel.tint) {
      ctx.save();
      ctx.globalAlpha = 0.24;
      ctx.drawImage(sel.tint, 0, 0);
      ctx.restore();
    }

    ctx.save();
    ctx.lineWidth = Math.max(0.8, 1.6 / scale);
    dashLine(ctx, scale);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath();
    if (draft) {
      traceOutline(ctx, selectionDraftOutline(draft));
    } else if (sel) {
      traceOutline(ctx, sel.outline);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    if (ctx.lineDashOffset !== undefined) {
      ctx.lineDashOffset = 7 / scale;
    }
    ctx.beginPath();
    if (draft) {
      traceOutline(ctx, selectionDraftOutline(draft));
    } else if (sel) {
      traceOutline(ctx, sel.outline);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawGuideOverlay(ctx, s, invScale) {
    var mode = s.symmetry || 'off';
    if (mode === 'off') { return; }
    var w = s.doc.width;
    var h = s.doc.height;
    var scale = Math.max(0.08, s.view.scale);
    ctx.save();
    ctx.lineWidth = Math.max(0.7, 1.2 / scale);
    dashLine(ctx, scale);
    ctx.strokeStyle = 'rgba(47,111,237,0.72)';
    ctx.beginPath();
    if (mode === 'vertical' || mode === 'quad') {
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
    }
    if (mode === 'horizontal' || mode === 'quad') {
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  function tracePolyline(ctx, points, closed) {
    if (!points || points.length < 2) { return; }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    var i;
    for (i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    if (closed) { ctx.closePath(); }
    ctx.stroke();
  }

  function drawCurveOverlay(ctx, s, invScale) {
    var ce = s.curveEdit;
    if (!ce) { return; }
    var scale = Math.max(0.08, s.view.scale);
    var sampled = model.sampleBezier(ce.anchors, ce.closed, 12);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash && ctx.setLineDash([]);
    ctx.lineWidth = Math.max(0.8, 1.6 / scale);
    ctx.strokeStyle = 'rgba(47,111,237,0.92)';
    tracePolyline(ctx, sampled, ce.closed);

    var handleRadius = Math.max(2.5, 4.5 / scale);
    var anchorRadius = Math.max(3.5, 6 / scale);
    var i;
    for (i = 0; i < ce.anchors.length; i += 1) {
      var a = ce.anchors[i];
      ctx.strokeStyle = 'rgba(47,111,237,0.45)';
      ctx.lineWidth = Math.max(0.6, 1 / scale);
      ctx.beginPath();
      ctx.moveTo(a.inX, a.inY);
      ctx.lineTo(a.x, a.y);
      ctx.lineTo(a.outX, a.outY);
      ctx.stroke();

      ctx.fillStyle = '#2f6fed';
      ctx.beginPath();
      ctx.arc(a.inX, a.inY, handleRadius, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(a.outX, a.outY, handleRadius, 0, Math.PI * 2, false);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(a.x, a.y, anchorRadius, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.strokeStyle = '#2f6fed';
      ctx.lineWidth = Math.max(0.9, 1.4 / scale);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTransformOverlay(ctx, s, invScale) {
    var t = s.transform;
    if (!t) { return; }
    var scale = Math.max(0.08, s.view.scale);
    var b = t.bounds;
    var p0 = transformLocalPoint(s, b.x, b.y);
    var p1 = transformLocalPoint(s, b.x + b.w, b.y);
    var p2 = transformLocalPoint(s, b.x + b.w, b.y + b.h);
    var p3 = transformLocalPoint(s, b.x, b.y + b.h);
    var cx = b.x + b.w / 2;
    var top = b.y - 46 / (scale * Math.max(0.08, t.scale));
    var pr = transformLocalPoint(s, cx, top);
    var pc = transformLocalPoint(s, cx, b.y);

    ctx.save();
    ctx.lineWidth = Math.max(0.8, 1.3 / scale);
    ctx.strokeStyle = 'rgba(90,150,255,0.95)';
    dashLine(ctx, scale);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.moveTo(pc.x, pc.y);
    ctx.lineTo(pr.x, pr.y);
    ctx.stroke();

    var r = Math.max(4, 9 / scale);
    var pts = [p0, p1, p2, p3, pr];
    var i;
    for (i = 0; i < pts.length; i += 1) {
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2, false);
      ctx.fillStyle = i === 4 ? '#2f6fed' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = Math.max(0.6, 1.4 / scale);
      ctx.strokeStyle = 'rgba(20,40,80,0.9)';
      ctx.stroke();
    }
    ctx.restore();
  }

  function transformLocalPoint(s, x, y) {
    var t = s.transform;
    if (!t) { return { x: x, y: y }; }
    var b = t.bounds;
    var cx = b.x + b.w / 2;
    var cy = b.y + b.h / 2;
    var dx = (x - cx) * t.scale * t.flipX;
    var dy = (y - cy) * t.scale * t.flipY;
    var cos = Math.cos(t.rotation);
    var sin = Math.sin(t.rotation);
    return {
      x: cx + t.tx + dx * cos - dy * sin,
      y: cy + t.ty + dx * sin + dy * cos
    };
  }

  function buildStrokeView(s, layer) {
    if (!s.strokeMasked || !s.strokeBuffer) { return; }
    var w = s.doc.width;
    var h = s.doc.height;
    var mctx = s.strokeMaskedCtx;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, w, h);
    mctx.globalCompositeOperation = 'source-over';
    mctx.globalAlpha = 1;
    mctx.drawImage(s.strokeBuffer, 0, 0);
    if (s.selection && s.selection.mask) {
      mctx.globalCompositeOperation = 'destination-in';
      mctx.drawImage(s.selection.mask, 0, 0);
      mctx.globalCompositeOperation = 'source-over';
    }

    if (!s.strokeView) {
      s.strokeView = newDocCanvas(s);
      s.strokeViewCtx = s.strokeView.getContext('2d');
    }
    var vctx = s.strokeViewCtx;
    var source = s.canvases[layer.id];
    vctx.setTransform(1, 0, 0, 1, 0, 0);
    vctx.clearRect(0, 0, w, h);
    vctx.globalCompositeOperation = 'source-over';
    vctx.globalAlpha = 1;
    if (source) { vctx.drawImage(source, 0, 0); }
    vctx.globalCompositeOperation =
      (s.tool === 'eraser') ? 'destination-out' :
        (layer.alphaLock ? 'source-atop' : 'source-over');
    vctx.drawImage(s.strokeMasked, 0, 0);
    vctx.globalCompositeOperation = 'source-over';
    s.strokeViewVersion = s.strokeBufferVersion;
  }

  function render() {
    if (!st || !viewCtx) { return; }
    resizeCanvas();
    var size = stageSize();
    var dpr = Math.min(PCW.env.dpr || 1, 2);
    var doc = st.doc;
    var ctx = viewCtx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, viewCanvas.width, viewCanvas.height);

    var m = viewMatrix(st);
    ctx.setTransform(dpr * m.a, dpr * m.b, dpr * m.c, dpr * m.d,
      dpr * m.e, dpr * m.f);

    ctx.save();
    var invScale = 1 / Math.max(0.15, st.view.scale);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 26 * invScale;
    ctx.shadowOffsetY = 8 * invScale;
    ctx.fillStyle = doc.background || '#ffffff';
    ctx.fillRect(0, 0, doc.width, doc.height);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, doc.width, doc.height);
    ctx.clip();

    var i;
    for (i = 0; i < doc.layers.length; i += 1) {
      var layer = doc.layers[i];
      if (layer.visible === false || layer.opacity <= 0) { continue; }
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = PCW.env.canvasBlend ?
        (layer.blend || 'source-over') : 'source-over';
      if (st.transform && st.transform.layerId === layer.id) {
        drawTransformedLayer(ctx, st, layer);
      } else if (st.adjust && st.adjust.layerId === layer.id) {
        drawAdjustLayer(ctx, st);
      } else if (st.stroke && st.strokeBuffer && st.stroke.layerId === layer.id) {
        drawStrokeLayer(ctx, st, layer);
      } else {
        var canvas = layerCanvas(st, layer.id);
        if (canvas) { ctx.drawImage(canvas, 0, 0, doc.width, doc.height); }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    ctx.lineWidth = Math.max(0.6, 1 * invScale);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.strokeRect(0, 0, doc.width, doc.height);

    drawGuideOverlay(ctx, st, invScale);
    drawCurveOverlay(ctx, st, invScale);
    drawSelectionOverlay(ctx, st, invScale);
    drawTransformOverlay(ctx, st, invScale);

    scheduleBadge();
  }

  function scheduleBadge() {
    if (st && !st.badgeTimer) {
      st.badgeTimer = setTimeout(function () {
        if (!st) { return; }
        st.badgeTimer = null;
        updateBadge();
      }, 140);
    }
  }

  function updateBadge() {
    if (!st || !badge) { return; }
    var doc = st.doc;
    var budget = model.budgetFor(doc.width, doc.height);
    var profile = budget.maxLayers >= 8 ? 'S' :
      (budget.maxLayers >= 5 ? 'M' : (budget.maxLayers >= 3 ? 'L' : 'XL'));
    var zoom = Math.round(st.view.scale * 100);
    var rot = Math.round((st.view.rotation * 180 / Math.PI) % 360);
    if (rot < 0) { rot += 360; }
    var toolName = st.tool === 'eraser' ? 'Borrador' :
      (st.tool === 'smudge' ? 'Difuminar' :
        (st.tool === 'eyedropper' ? 'Cuentagotas' :
          (st.tool === 'select' ? 'Selección' :
            (st.tool === 'transform' ? 'Transformar' : 'Pincel'))));
    var loadText = st.loading > 0 ? ' · cargando ' + st.loading : '';
    badge.textContent = util.formatDim(doc.width, doc.height) + ' · ' + zoom +
      '% · ' + profile + ' · ' + toolName + (rot ? ' · ' + rot + '°' : '') + loadText;
  }

  function requestRender() {
    if (st) { st.needsRender = true; }
  }

  function loop() {
    if (!running) { return; }
    if (st && st.needsRender) {
      st.needsRender = false;
      try {
        render();
      } catch (e) {
        PCW.logError('studio:render', e);
      }
    }
    rafId = rafFn(loop);
  }

  function startLoop() {
    if (running) { return; }
    running = true;
    rafId = rafFn(loop);
  }

  function stopLoop() {
    running = false;
    if (rafId) {
      cafFn(rafId);
      rafId = null;
    }
  }

  /* ---------------------------------------------------------------- capas */

  function createLayerCanvas(s, layer) {
    var c = document.createElement('canvas');
    c.width = s.doc.width;
    c.height = s.doc.height;
    var ctx = c.getContext('2d');
    s.canvases[layer.id] = c;
    s.ctxs[layer.id] = ctx;
    return c;
  }

  function loadLayerImage(s, layer, dataUrl) {
    var img = new Image();
    s.loading += 1;
    updateBadge();
    img.onload = function () {
      if (st !== s) { return; }
      var ctx = layerCtx(s, layer.id);
      if (ctx) {
        try {
          ctx.drawImage(img, 0, 0, s.doc.width, s.doc.height);
        } catch (e) {
          PCW.logError('studio:layer-image', e);
        }
      }
      s.loading = Math.max(0, s.loading - 1);
      s.needsRender = true;
      updateBadge();
      if (PCW.panels && PCW.panels.updateThumbs) { PCW.panels.updateThumbs(); }
    };
    img.onerror = function () {
      if (st === s) {
        s.loading = Math.max(0, s.loading - 1);
        PCW.log('No se pudo cargar una capa', 'warn');
        updateBadge();
      }
    };
    img.src = dataUrl;
  }

  /* ----------------------------------------------------------- composición */

  function composeTo(s, ctx, dw, dh, withBackground) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (withBackground) {
      ctx.fillStyle = s.doc.background || '#ffffff';
      ctx.fillRect(0, 0, dw, dh);
    }
    var i;
    for (i = 0; i < s.doc.layers.length; i += 1) {
      var layer = s.doc.layers[i];
      if (layer.visible === false || layer.opacity <= 0) { continue; }
      var canvas = s.canvases[layer.id];
      if (!canvas) { continue; }
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = PCW.env.canvasBlend ?
        (layer.blend || 'source-over') : 'source-over';
      ctx.drawImage(canvas, 0, 0, dw, dh);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function makeThumb(s) {
    var maxW = 320;
    var maxH = 240;
    var scale = Math.min(maxW / s.doc.width, maxH / s.doc.height);
    var tw = Math.max(1, Math.round(s.doc.width * scale));
    var th = Math.max(1, Math.round(s.doc.height * scale));
    var c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    var ctx = c.getContext('2d');
    composeTo(s, ctx, tw, th, true);
    try {
      return c.toDataURL('image/jpeg', 0.72);
    } catch (e) {
      PCW.logError('studio:thumb', e);
      return '';
    }
  }

  function buildComposite(s) {
    var c = document.createElement('canvas');
    c.width = s.doc.width;
    c.height = s.doc.height;
    var ctx = c.getContext('2d');
    composeTo(s, ctx, s.doc.width, s.doc.height, true);
    s.composite = c;
    return c;
  }

  /* -------------------------------------------------------------- historial */

  function cropImageData(ctx, full, x, y, w, h) {
    var out = ctx.createImageData(w, h);
    var fullWidth = full.width;
    var rowBytes = w * 4;
    var srcWidthBytes = fullWidth * 4;
    var i;
    for (i = 0; i < h; i += 1) {
      var srcStart = ((y + i) * fullWidth + x) * 4;
      var dstStart = i * rowBytes;
      out.data.set(full.data.subarray(srcStart, srcStart + rowBytes), dstStart);
    }
    return out;
  }

  function clearRedo(s) {
    if (!s.history.redo.length) { return; }
    var i;
    for (i = 0; i < s.history.redo.length; i += 1) {
      s.history.bytes -= s.history.redo[i].bytes;
    }
    s.history.redo = [];
    if (s.history.bytes < 0) { s.history.bytes = 0; }
  }

  function trimHistory(s) {
    while (s.history.bytes > model.HISTORY_BYTES && s.history.undo.length > 1) {
      var entry = s.history.undo.shift();
      s.history.bytes -= entry.bytes;
    }
    if (s.history.bytes < 0) { s.history.bytes = 0; }
  }

  function finishHistory(s) {
    var stroke = s.stroke;
    if (!stroke || !stroke.before || stroke.stampCount < 1) {
      if (stroke && stroke.noHistory && !s.historyWarned) {
        s.historyWarned = true;
        ui.toast('Este lienzo es demasiado grande para deshacer. Exporta a menudo.', 3800);
      }
      return;
    }
    var b = stroke.bounds;
    var x = util.clamp(Math.floor(b.x0) - 2, 0, s.doc.width - 1);
    var y = util.clamp(Math.floor(b.y0) - 2, 0, s.doc.height - 1);
    var x2 = util.clamp(Math.ceil(b.x1) + 2, x + 1, s.doc.width);
    var y2 = util.clamp(Math.ceil(b.y1) + 2, y + 1, s.doc.height);
    var rw = x2 - x;
    var rh = y2 - y;
    if (rw < 1 || rh < 1) { return; }

    var ctx = layerCtx(s, stroke.layerId);
    if (!ctx) { return; }
    var after;
    try {
      after = ctx.getImageData(x, y, rw, rh);
    } catch (e) {
      PCW.logError('studio:history-after', e);
      return;
    }
    var before = cropImageData(ctx, stroke.before, x, y, rw, rh);
    var bytes = before.data.length + after.data.length;
    if (bytes > model.HISTORY_BYTES * 0.8) {
      if (!s.historyWarned) {
        s.historyWarned = true;
        ui.toast('Trazo demasiado grande para el historial; no se podrá deshacer.', 3000);
      }
      return;
    }
    clearRedo(s);
    s.history.undo.push({
      layerId: stroke.layerId,
      rect: { x: x, y: y, w: rw, h: rh },
      before: before,
      after: after,
      bytes: bytes
    });
    s.history.bytes += bytes;
    trimHistory(s);
    syncHistoryUi();
  }

  function historyCounts() {
    if (!st || !st.history) { return { undo: 0, redo: 0, bytes: 0 }; }
    return {
      undo: st.history.undo.length,
      redo: st.history.redo.length,
      bytes: st.history.bytes
    };
  }

  function setHistoryBtn(el, enabled) {
    if (!el) { return; }
    if (enabled) {
      el.classList.remove('is-disabled');
      el.removeAttribute('aria-disabled');
    } else {
      el.classList.add('is-disabled');
      el.setAttribute('aria-disabled', 'true');
    }
  }

  /* Refleja en los botones (barra superior y Quick Menu) si hay pasos
     disponibles. No los deshabilita: al pulsarlos se avisa con un toast. */
  function syncHistoryUi() {
    var counts = historyCounts();
    setHistoryBtn(dom.id('btn-undo'), counts.undo > 0);
    setHistoryBtn(dom.id('btn-redo'), counts.redo > 0);
    var items = document.querySelectorAll('[data-quick="undo"], [data-quick="redo"]');
    var i;
    for (i = 0; i < items.length; i += 1) {
      setHistoryBtn(items[i],
        items[i].getAttribute('data-quick') === 'undo' ?
          counts.undo > 0 : counts.redo > 0);
    }
  }

  function historyEntryFits(s, entry) {
    if (!entry || !entry.rect || !entry.before || !entry.after) { return false; }
    var r = entry.rect;
    /* putImageData recorta lo que sobresale; solo se rechazan rectángulos
       vacíos o con origen fuera del lienzo. */
    return r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 &&
      r.x < s.doc.width && r.y < s.doc.height;
  }

  function applyHistoryEntry(s, entry, data) {
    var ctx = layerCtx(s, entry.layerId);
    if (!ctx || !historyEntryFits(s, entry)) { return false; }
    try {
      ctx.putImageData(data, entry.rect.x, entry.rect.y);
    } catch (e) {
      PCW.logError('studio:history-apply', e);
      return false;
    }
    return true;
  }

  function undo() {
    if (!st) { return false; }
    var s = st;
    if (!s.history.undo.length) {
      syncHistoryUi();
      ui.toast('Nada que deshacer');
      return false;
    }
    /* Se consulta la cima sin sacarla: si la capa ya no existe, el paso
       permanece en el historial en lugar de perderse. */
    var entry = s.history.undo[s.history.undo.length - 1];
    var applied;
    if (entry.type === 'structure' && typeof entry.apply === 'function') {
      applied = entry.apply(false);
    } else {
      applied = applyHistoryEntry(s, entry, entry.before);
    }
    if (!applied) {
      syncHistoryUi();
      ui.toast('No se pudo deshacer este paso');
      return false;
    }
    s.history.undo.pop();
    s.history.redo.push(entry);
    s.composite = null;
    markDirty(s, entry.layerId);
    s.needsRender = true;
    updateBadge();
    syncHistoryUi();
    if (PCW.panels) { PCW.panels.updateThumbs(); }
    return true;
  }

  function redo() {
    if (!st) { return false; }
    var s = st;
    if (!s.history.redo.length) {
      syncHistoryUi();
      ui.toast('Nada que rehacer');
      return false;
    }
    var entry = s.history.redo[s.history.redo.length - 1];
    var applied;
    if (entry.type === 'structure' && typeof entry.apply === 'function') {
      applied = entry.apply(true);
    } else {
      applied = applyHistoryEntry(s, entry, entry.after);
    }
    if (!applied) {
      syncHistoryUi();
      ui.toast('No se pudo rehacer este paso');
      return false;
    }
    s.history.redo.pop();
    s.history.undo.push(entry);
    s.composite = null;
    markDirty(s, entry.layerId);
    s.needsRender = true;
    updateBadge();
    syncHistoryUi();
    if (PCW.panels) { PCW.panels.updateThumbs(); }
    return true;
  }

  function purgeLayerHistory(s, layerId) {
    var i;
    var kept = [];
    for (i = 0; i < s.history.undo.length; i += 1) {
      if (s.history.undo[i].layerId === layerId) {
        s.history.bytes -= s.history.undo[i].bytes;
      } else {
        kept.push(s.history.undo[i]);
      }
    }
    s.history.undo = kept;
    kept = [];
    for (i = 0; i < s.history.redo.length; i += 1) {
      if (s.history.redo[i].layerId === layerId) {
        s.history.bytes -= s.history.redo[i].bytes;
      } else {
        kept.push(s.history.redo[i]);
      }
    }
    s.history.redo = kept;
    if (s.history.bytes < 0) { s.history.bytes = 0; }
    syncHistoryUi();
  }

  /* --------------------------------------------------------------- trazos */

  function inDoc(s, p) {
    return p.x >= 0 && p.y >= 0 && p.x <= s.doc.width && p.y <= s.doc.height;
  }

  function ensureSnapshot(s, stroke) {
    if (stroke.snapshotReady) { return; }
    stroke.snapshotReady = true;
    var bytes = s.doc.width * s.doc.height * 4;
    if (bytes > SNAPSHOT_LIMIT) {
      stroke.noHistory = true;
      return;
    }
    var ctx = layerCtx(s, stroke.layerId);
    if (!ctx) { return; }
    try {
      stroke.before = ctx.getImageData(0, 0, s.doc.width, s.doc.height);
    } catch (e) {
      stroke.noHistory = true;
      PCW.logError('studio:snapshot', e);
    }
  }

  function beginStroke(p) {
    var s = st;
    if (!s) { return; }
    if (!inDoc(s, p)) { return; }
    var layer = activeLayer(s);
    if (!layer) { return; }
    if (layer.visible === false) {
      ui.toast('La capa activa está oculta');
      return;
    }
    if (s.curveEdit) {
      beginCurveDrag(s, p);
      return;
    }
    if (s.tool === 'eyedropper') {
      pickColor(s, p);
      return;
    }
    if (s.tool === 'select') {
      beginSelection(s, p);
      return;
    }
    if (s.tool === 'transform') {
      beginTransformDrag(s, p);
      return;
    }
    if (s.transform) { applyTransform(); }
    if (s.adjust) { cancelAdjust(); }
    if (s.tool === 'smudge') {
      buildComposite(s);
    }
    if (s.selection && s.tool !== 'smudge') {
      if (!s.strokeBuffer) {
        s.strokeBuffer = newDocCanvas(s);
        s.strokeBufferCtx = s.strokeBuffer.getContext('2d');
        s.strokeMasked = newDocCanvas(s);
        s.strokeMaskedCtx = s.strokeMasked.getContext('2d');
        s.strokeView = newDocCanvas(s);
        s.strokeViewCtx = s.strokeView.getContext('2d');
      }
      s.strokeBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
      s.strokeBufferCtx.clearRect(0, 0, s.doc.width, s.doc.height);
      s.strokeBufferVersion = 0;
      s.strokeViewVersion = -1;
    } else {
      s.strokeBuffer = null;
      s.strokeBufferCtx = null;
    }
    s.stroke = {
      layerId: layer.id,
      start: { x: p.x, y: p.y },
      stampPoint: { x: p.x, y: p.y },
      bounds: { x0: p.x, y0: p.y, x1: p.x, y1: p.y },
      stampCount: 0,
      travel: 0,
      seed: Math.random() * 10000,
      snapshotReady: false,
      noHistory: false,
      before: null,
      points: [{ x: p.x, y: p.y }],
      rawPoints: [{ x: p.x, y: p.y, pressure: pointerPressure }],
      lastMoveAt: now(),
      lastPressure: pointerPressure,
      lastTiltX: pointerTiltX,
      lastTiltY: pointerTiltY,
      quickApplied: false,
      quickType: null,
      startedAt: now()
    };
    s.needsRender = true;
    armQuickHold(s);
  }

  function strokeTo(p) {
    var s = st;
    if (!s) { return; }
    if (s.selectDraft) {
      updateSelection(s, p);
      return;
    }
    if (s.transform && s.transform.drag) {
      updateTransformDrag(s, p);
      return;
    }
    if (s.curveEdit) {
      updateCurveDrag(s, p);
      return;
    }
    if (!s.stroke) { return; }
    var stroke = s.stroke;
    /* Si QuickShape ya ajustó la forma, el trazo queda congelado hasta que
       se levante el dedo. */
    if (stroke.quickApplied || stroke.curveFrozen) { return; }

    /* Muestras crudas para reconocimiento y edición Bézier. */
    stroke.lastMoveAt = now();
    stroke.lastPressure = pointerPressure;
    stroke.lastTiltX = pointerTiltX;
    stroke.lastTiltY = pointerTiltY;
    var lastRaw = stroke.rawPoints[stroke.rawPoints.length - 1];
    if (!lastRaw || model.distance(lastRaw, p) >= 1.2) {
      if (stroke.rawPoints.length < 700) {
        stroke.rawPoints.push({ x: p.x, y: p.y, pressure: pointerPressure });
      }
      if (stroke.points.length < 700) {
        stroke.points.push({ x: p.x, y: p.y });
      }
    }

    /* 1) Filtro de movimiento: media móvil de las últimas muestras. */
    var motion = s.brush.motionFilter || 0;
    var raw = p;
    if (motion > 0.01) {
      var windowSize = 1 + Math.round(motion * 8);
      if (!stroke.mf) { stroke.mf = []; }
      stroke.mf.push({ x: p.x, y: p.y });
      if (stroke.mf.length > windowSize) { stroke.mf.shift(); }
      raw = model.averagePoints(stroke.mf) || p;
    }

    /* 2) Estabilización: seguimiento exponencial con retardo controlado. */
    var stabilize = s.brush.stabilize || 0;
    if (stabilize > 0.01) {
      if (!stroke.stabilized) {
        stroke.stabilized = { x: raw.x, y: raw.y };
      }
      var sFollow = 1 - Math.min(0.92, stabilize * 0.92);
      stroke.stabilized.x += (raw.x - stroke.stabilized.x) * sFollow;
      stroke.stabilized.y += (raw.y - stroke.stabilized.y) * sFollow;
      raw = { x: stroke.stabilized.x, y: stroke.stabilized.y };
    }

    /* 3) StreamLine: suavizado adicional de líneas y curvas. */
    var streamline = s.brush.streamline || 0;
    if (streamline > 0.01) {
      if (!stroke.smooth) {
        stroke.smooth = { x: raw.x, y: raw.y };
      }
      var follow = 1 - Math.min(0.9, streamline * 0.9);
      stroke.smooth.x += (raw.x - stroke.smooth.x) * follow;
      stroke.smooth.y += (raw.y - stroke.smooth.y) * follow;
      raw = { x: stroke.smooth.x, y: stroke.smooth.y };
    }
    p = raw;
    armQuickHold(s);

    var from = stroke.stampPoint;
    var dx = p.x - from.x;
    var dy = p.y - from.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.01) { return; }
    var speedFactor = 1;
    var brushSpeed = s.brush.speed || 0;
    if (brushSpeed > 0) {
      var stampTime = now();
      if (stroke.lastPoint) {
        var adx = p.x - stroke.lastPoint.x;
        var ady = p.y - stroke.lastPoint.y;
        var adist = Math.sqrt(adx * adx + ady * ady);
        var adt = Math.max(1, stampTime - stroke.lastTime);
        var instant = adist / adt;
        stroke.speedAvg = (stroke.speedAvg == null)
          ? instant
          : (stroke.speedAvg * 0.65 + instant * 0.35);
        var normSpeed = util.clamp((stroke.speedAvg - 0.5) / 3.5, 0, 1);
        speedFactor = 1 - brushSpeed * 0.7 * normSpeed;
      }
      stroke.lastPoint = { x: p.x, y: p.y };
      stroke.lastTime = stampTime;
    }
    var spacing = Math.max(0.7, s.size * (s.brush.spacing || 0.1));
    if (dist < spacing) { return; }

    ensureSnapshot(s, stroke);
    var ux = dx / dist;
    var uy = dy / dist;
    var angle = Math.atan2(dy, dx);
    var moved = 0;
    while (moved + spacing <= dist) {
      moved += spacing;
      var x = from.x + ux * moved;
      var y = from.y + uy * moved;
      var index = stroke.stampCount;
      var lateral = (pseudo(stroke.seed, index) - 0.5) * (s.brush.jitter || 0) * s.size;
      var along = (pseudo(stroke.seed + 7, index) - 0.5) * (s.brush.scatter || 0) * s.size;
      var sx = x - uy * lateral + ux * along;
      var sy = y + ux * lateral + uy * along;
      var factor = 1;
      var taper = s.brush.taper || 0;
      if (taper > 0) {
        var taperDist = Math.max(2, s.size * 2.2);
        var progress = Math.min(1, (stroke.travel + moved) / taperDist);
        factor = 0.55 + 0.45 * progress;
      }
      factor = factor * speedFactor;
      var alpha = 1;
      stampAt(s, sx, sy, factor, alpha, angle);
    }
    stroke.travel += moved;
    stroke.stampPoint = {
      x: from.x + ux * moved,
      y: from.y + uy * moved
    };
    s.needsRender = true;
  }

  /* --------------------------------------- QuickShape y corrección de formas */

  function shapeLabel(shape) {
    if (!shape) { return 'forma'; }
    if (shape.type === 'line') { return 'línea'; }
    if (shape.type === 'rect') { return shape.square ? 'cuadrado' : 'rectángulo'; }
    if (shape.type === 'ellipse') { return 'elipse'; }
    if (shape.type === 'triangle') { return 'triángulo'; }
    if (shape.type === 'polygon') { return 'polígono de ' + shape.sides + ' lados'; }
    if (shape.type === 'curve') { return 'curva'; }
    return 'forma';
  }

  function quickShapeAllowed(s, shape) {
    var correction = s.brush.shapeCorrection == null ? 1 : s.brush.shapeCorrection;
    if (correction <= 0.01) { return false; }
    var minimum = 0.92 - correction * 0.6;
    return shape.confidence >= minimum;
  }

  function clearStrokeForShape(s, stroke) {
    var w = s.doc.width;
    var h = s.doc.height;
    if (s.strokeBufferCtx) {
      s.strokeBufferCtx.save();
      s.strokeBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
      s.strokeBufferCtx.globalAlpha = 1;
      s.strokeBufferCtx.globalCompositeOperation = 'source-over';
      s.strokeBufferCtx.clearRect(0, 0, w, h);
      s.strokeBufferCtx.restore();
      s.strokeBufferVersion += 1;
      s.strokeViewVersion = -1;
      if (s.strokeViewCtx) {
        s.strokeViewCtx.clearRect(0, 0, w, h);
      }
      return true;
    }
    if (!stroke.before) { return false; }
    var ctx = layerCtx(s, stroke.layerId);
    if (!ctx) { return false; }
    try {
      ctx.putImageData(stroke.before, 0, 0);
    } catch (e) {
      PCW.logError('studio:quickshape-clear', e);
      return false;
    }
    return true;
  }

  function stampPathSegment(s, a, b, spacing) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) { return; }
    var steps = Math.max(1, Math.ceil(len / spacing));
    var angle = Math.atan2(dy, dx);
    var i;
    for (i = 0; i <= steps; i += 1) {
      var t = i / steps;
      stampAt(s, a.x + dx * t, a.y + dy * t, 1, 1, angle);
    }
  }

  function drawShapeStamps(s, shape, spacing) {
    var i;
    if (shape.type === 'ellipse') {
      var perimeter = Math.PI * (3 * (shape.rx + shape.ry) -
        Math.sqrt((3 * shape.rx + shape.ry) * (shape.rx + 3 * shape.ry)));
      var count = Math.max(24, Math.ceil(perimeter / spacing));
      var prev = null;
      for (i = 0; i <= count; i += 1) {
        var ang = (i / count) * Math.PI * 2;
        var pt = {
          x: shape.cx + Math.cos(ang) * shape.rx,
          y: shape.cy + Math.sin(ang) * shape.ry
        };
        if (prev) { stampPathSegment(s, prev, pt, spacing); }
        prev = pt;
      }
      return;
    }
    var pts = shape.points || [];
    if (shape.type === 'line') {
      if (pts.length >= 2) { stampPathSegment(s, pts[0], pts[1], spacing); }
      return;
    }
    if (shape.type === 'rect') {
      pts = [
        { x: shape.x, y: shape.y },
        { x: shape.x + shape.w, y: shape.y },
        { x: shape.x + shape.w, y: shape.y + shape.h },
        { x: shape.x, y: shape.y + shape.h }
      ];
    }
    if (pts.length < 2) { return; }
    for (i = 0; i < pts.length; i += 1) {
      stampPathSegment(s, pts[i], pts[(i + 1) % pts.length], spacing);
    }
  }

  function applyShapeToStroke(s, shape) {
    var stroke = s.stroke;
    if (!stroke || !shape) { return false; }
    if (!clearStrokeForShape(s, stroke)) { return false; }
    stroke.bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    stroke.stampCount = 0;
    var spacing = Math.max(0.8, s.size * (s.brush.spacing || 0.1));
    drawShapeStamps(s, shape, spacing);
    if (stroke.stampCount === 0) { return false; }
    stroke.quickType = shape.type;
    s.lastQuickShape = { type: shape.type, confidence: shape.confidence };
    s.needsRender = true;
    return true;
  }

  function tryQuickShape(s) {
    var stroke = s.stroke;
    if (!stroke || stroke.quickApplied) { return false; }
    if (s.tool !== 'brush' && s.tool !== 'eraser') { return false; }
    if (!s.quickShape) { return false; }
    var shape = model.quickShapeForPoints(stroke.points, s.size);
    if (!shape || !quickShapeAllowed(s, shape)) { return false; }
    if (!applyShapeToStroke(s, shape)) { return false; }
    stroke.quickApplied = true;
    return true;
  }

  function armQuickHold(s) {
    if (!s || !s.quickShape || !s.stroke || s.stroke.quickApplied) { return; }
    if (s.tool !== 'brush' && s.tool !== 'eraser') { return; }
    if (s.curveEdit) { return; }
    var stroke = s.stroke;
    var anchor = stroke.rawPoints[stroke.rawPoints.length - 1];
    if (quickHoldTimer && stroke.holdAnchor && anchor &&
        model.distance(stroke.holdAnchor, anchor) < 2) {
      return;
    }
    clearQuickHold();
    stroke.holdAnchor = anchor ? { x: anchor.x, y: anchor.y } : null;
    quickHoldTimer = setTimeout(function () {
      quickHoldTimer = null;
      if (st !== s || s.stroke !== stroke || stroke.quickApplied) { return; }
      if (tryQuickShape(s)) {
        ui.toast('QuickShape: ' + shapeLabel({ type: stroke.quickType }), 1400);
      }
    }, QUICK_HOLD_MS);
  }

  /* Cierra el trazo hasta el último punto crudo aunque el filtro vaya con
     retardo. Evita que un trazo con estabilización alta quede corto. */
  function flushStrokeFilters(s, stroke) {
    if (!stroke || stroke.quickApplied) { return; }
    var last = stroke.rawPoints[stroke.rawPoints.length - 1];
    if (!last) { return; }
    var from = stroke.stampPoint;
    var d = model.distance(from, last);
    var spacing = Math.max(0.8, s.size * (s.brush.spacing || 0.1));
    if (d < spacing) { return; }
    var limit = Math.max(8, s.size * 3);
    if (d > limit) {
      var t = limit / d;
      last = { x: from.x + (last.x - from.x) * t, y: from.y + (last.y - from.y) * t };
    }
    stampPathSegment(s, from, last, spacing);
    stroke.stampPoint = { x: last.x, y: last.y };
    s.needsRender = true;
  }

  function endStroke() {
    var s = st;
    if (!s) { return; }
    if (s.curveEdit) {
      s.curveEdit.drag = null;
      s.needsRender = true;
      return;
    }
    if (s.selectDraft) {
      finishSelection(s);
      return;
    }
    if (s.transform && s.transform.drag) {
      s.transform.drag = null;
      return;
    }
    clearQuickHold();
    if (!s.stroke) { return; }
    var stroke = s.stroke;
    if (stroke.stampCount === 0) {
      ensureSnapshot(s, stroke);
      stampAt(s, stroke.start.x, stroke.start.y, 1, 1, 0);
    }
    flushStrokeFilters(s, stroke);
    if (!stroke.quickApplied && s.quickShape &&
        now() - (stroke.lastMoveAt || stroke.startedAt) >= QUICK_HOLD_MS) {
      tryQuickShape(s);
    }
    if (s.strokeBuffer) { commitStrokeBuffer(s); }
    finishHistory(s);
    s.lastStrokeInfo = {
      layerId: stroke.layerId,
      tool: s.tool,
      points: stroke.points.slice(0),
      rawPoints: stroke.rawPoints.slice(0),
      quickType: stroke.quickType || null,
      startedAt: stroke.startedAt
    };
    s.stroke = null;
    s.composite = null;
    s.strokeBuffer = null;
    s.strokeBufferCtx = null;
    s.strokeView = null;
    s.strokeViewCtx = null;
    s.strokeViewVersion = -1;
    markDirty(s, stroke.layerId);
    s.needsRender = true;
    if (PCW.panels) {
      PCW.panels.updateThumbs();
      PCW.panels.sync();
    }
  }

  function commitStrokeBuffer(s) {
    if (!s.strokeBuffer || !s.strokeMasked) { return; }
    buildStrokeView(s, activeLayer(s));
    var layer = model.findLayer(s.doc, s.stroke.layerId);
    var ctx = layerCtx(s, s.stroke.layerId);
    if (!ctx || !layer) { return; }
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation =
      (s.tool === 'eraser') ? 'destination-out' :
        (layer.alphaLock ? 'source-atop' : 'source-over');
    ctx.drawImage(s.strokeMasked, 0, 0);
    ctx.restore();
  }

  function cancelStroke() {
    var s = st;
    pendingStroke = null;
    clearQuickHold();
    if (!s) { return; }
    if (s.curveEdit) {
      s.curveEdit.drag = null;
      s.needsRender = true;
      return;
    }
    if (s.selectDraft) {
      s.selectDraft = null;
      s.needsRender = true;
      return;
    }
    if (s.transform && s.transform.drag) {
      s.transform.drag = null;
      return;
    }
    if (!s.stroke) { return; }
    var stroke = s.stroke;
    if (stroke.before) {
      var ctx = layerCtx(s, stroke.layerId);
      if (ctx) {
        try {
          ctx.putImageData(stroke.before, 0, 0);
        } catch (e) {
          PCW.logError('studio:cancel', e);
        }
      }
    }
    s.stroke = null;
    s.composite = null;
    s.strokeBuffer = null;
    s.strokeBufferCtx = null;
    s.strokeView = null;
    s.strokeViewCtx = null;
    s.strokeViewVersion = -1;
    s.needsRender = true;
  }

  /* -------------------------------------------------------------- color */

  function pickColor(s, p) {
    var comp = buildComposite(s);
    var x = util.clamp(Math.floor(p.x), 0, s.doc.width - 1);
    var y = util.clamp(Math.floor(p.y), 0, s.doc.height - 1);
    var ctx = comp.getContext('2d');
    var data;
    try {
      data = ctx.getImageData(x, y, 1, 1).data;
    } catch (e) {
      PCW.logError('studio:pick', e);
      return;
    }
    var hex = util.rgbToHex(data[0], data[1], data[2]);
    setColor(hex, true);
    setTool('brush');
    ui.toast('Color tomado: ' + hex);
  }

  function eyedropper() {
    if (!st) { return; }
    if (st.tool === 'eyedropper') {
      setTool('brush');
      return;
    }
    setTool('eyedropper');
    ui.toast('Cuentagotas: toca el lienzo');
  }

  /* ------------------------------------------------------------ selección */

  function selectionDraftOutline(draft) {
    var x0 = Math.min(draft.start.x, draft.current.x);
    var y0 = Math.min(draft.start.y, draft.current.y);
    var x1 = Math.max(draft.start.x, draft.current.x);
    var y1 = Math.max(draft.start.y, draft.current.y);
    if (draft.mode === 'lasso') {
      return { type: 'lasso', points: draft.points };
    }
    return {
      type: draft.mode === 'ellipse' ? 'ellipse' : 'rect',
      x: x0, y: y0, w: x1 - x0, h: y1 - y0
    };
  }

  function maskBounds(mask, w, h) {
    var data;
    try {
      data = mask.getContext('2d').getImageData(0, 0, w, h).data;
    } catch (e) {
      PCW.logError('studio:selection-bounds', e);
      return { x: 0, y: 0, w: w, h: h };
    }
    var x0 = w;
    var y0 = h;
    var x1 = -1;
    var y1 = -1;
    var x;
    var y;
    for (y = 0; y < h; y += 1) {
      for (x = 0; x < w; x += 1) {
        if (data[(y * w + x) * 4 + 3] > 8) {
          if (x < x0) { x0 = x; }
          if (x > x1) { x1 = x; }
          if (y < y0) { y0 = y; }
          if (y > y1) { y1 = y; }
        }
      }
    }
    if (x1 < x0 || y1 < y0) { return null; }
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  function buildSelectionTint(s, mask) {
    var c = newDocCanvas(s);
    var g = c.getContext('2d');
    g.fillStyle = '#2f6fed';
    g.fillRect(0, 0, s.doc.width, s.doc.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'source-over';
    return c;
  }

  function installSelection(s, mask, outline, bounds) {
    s.selection = {
      mask: mask,
      tint: buildSelectionTint(s, mask),
      outline: outline,
      bounds: bounds
    };
    s.needsRender = true;
  }

  /* Combina la máscara nueva con la selección existente según el modo elegido.
     'new' sustituye, 'add' une y 'subtract' recorta. */
  function combineSelectionMask(s, mask) {
    var op = s.selection ? (s.selectOp || 'new') : 'new';
    if (op === 'new') { return mask; }
    var combined = newDocCanvas(s);
    var g = combined.getContext('2d');
    g.drawImage(s.selection.mask, 0, 0);
    g.globalCompositeOperation = op === 'subtract' ? 'destination-out' :
      (op === 'intersect' ? 'destination-in' : 'source-over');
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'source-over';
    return combined;
  }

  function beginSelection(s, p) {
    if (s.selectMode === 'auto') {
      autoSelectAt(s, p);
      return;
    }
    if (!inDoc(s, p)) { return; }
    s.selectDraft = {
      mode: s.selectMode,
      start: { x: p.x, y: p.y },
      current: { x: p.x, y: p.y },
      points: [{ x: p.x, y: p.y }],
      last: { x: p.x, y: p.y }
    };
    s.needsRender = true;
  }

  function updateSelection(s, p) {
    var draft = s.selectDraft;
    if (!draft) { return; }
    p = {
      x: util.clamp(p.x, 0, s.doc.width),
      y: util.clamp(p.y, 0, s.doc.height)
    };
    draft.current = p;
    if (draft.mode === 'lasso') {
      var dx = p.x - draft.last.x;
      var dy = p.y - draft.last.y;
      if (dx * dx + dy * dy > 4) {
        draft.points.push({ x: p.x, y: p.y });
        draft.last = p;
      }
    }
    s.needsRender = true;
  }

  function finishSelection(s) {
    var draft = s.selectDraft;
    if (!draft) { return; }
    var outline = selectionDraftOutline(draft);
    if (outline.w < 2 && outline.type !== 'lasso') {
      s.selectDraft = null;
      ui.toast('La selección es demasiado pequeña');
      return;
    }
    if (outline.type === 'lasso' && outline.points.length < 3) {
      s.selectDraft = null;
      ui.toast('El lazo necesita un recorrido mayor');
      return;
    }

    var mask = newDocCanvas(s);
    var g = mask.getContext('2d');
    g.fillStyle = '#ffffff';
    if (outline.type === 'rect') {
      g.fillRect(outline.x, outline.y, outline.w, outline.h);
    } else if (outline.type === 'ellipse') {
      g.beginPath();
      ellipsePath(g, outline.x + outline.w / 2, outline.y + outline.h / 2,
        outline.w / 2, outline.h / 2);
      g.fill();
    } else {
      g.beginPath();
      g.moveTo(outline.points[0].x, outline.points[0].y);
      var i;
      for (i = 1; i < outline.points.length; i += 1) {
        g.lineTo(outline.points[i].x, outline.points[i].y);
      }
      g.closePath();
      g.fill();
    }

    var bounds = outline.type === 'lasso' ?
      maskBounds(mask, s.doc.width, s.doc.height) :
      { x: outline.x, y: outline.y, w: outline.w, h: outline.h };
    if (!bounds || bounds.w < 1 || bounds.h < 1) {
      s.selectDraft = null;
      ui.toast('La selección quedó vacía');
      return;
    }
    var op = s.selection ? (s.selectOp || 'new') : 'new';
    if (op !== 'new') {
      mask = combineSelectionMask(s, mask);
      bounds = maskBounds(mask, s.doc.width, s.doc.height);
      if (!bounds) {
        s.selection = null;
        s.selectDraft = null;
        s.needsRender = true;
        ui.toast('La selección quedó vacía');
        return;
      }
      outline = { type: 'auto', x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
    }
    installSelection(s, mask, outline, bounds);
    s.selectDraft = null;
    setTool('brush');
    s.needsRender = true;
    ui.toast(op === 'add' ? 'Selección añadida' :
      (op === 'subtract' ? 'Selección recortada' : 'Selección activa: dibuja dentro o usa Acciones → Rellenar selección'), 2800);
  }

  function colorTolerance(threshold) {
    return Math.round(4 + util.clamp(threshold, 0, 100) * 2.4);
  }

  function autoSelectAt(s, p) {
    var x = util.clamp(Math.floor(p.x), 0, s.doc.width - 1);
    var y = util.clamp(Math.floor(p.y), 0, s.doc.height - 1);
    var comp = buildComposite(s);
    var data;
    try {
      data = comp.getContext('2d').getImageData(0, 0, s.doc.width, s.doc.height).data;
    } catch (e) {
      PCW.logError('studio:auto-select', e);
      ui.toast('No se pudo leer el lienzo para seleccionar');
      return;
    }
    var region = util.floodRegion(data, s.doc.width, s.doc.height, x, y,
      colorTolerance(s.dropThreshold), null, null);
    if (!region) {
      ui.toast('No se encontró una zona seleccionable');
      return;
    }
    var mask = newDocCanvas(s);
    var g = mask.getContext('2d');
    var img = g.createImageData(s.doc.width, s.doc.height);
    var i;
    for (i = 0; i < s.doc.width * s.doc.height; i += 1) {
      if (region.mask[i]) {
        img.data[i * 4] = 255;
        img.data[i * 4 + 1] = 255;
        img.data[i * 4 + 2] = 255;
        img.data[i * 4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    var bounds = {
      x: region.x0, y: region.y0,
      w: region.x1 - region.x0 + 1,
      h: region.y1 - region.y0 + 1
    };
    var op = s.selection ? (s.selectOp || 'new') : 'new';
    if (op !== 'new') {
      mask = combineSelectionMask(s, mask);
      bounds = maskBounds(mask, s.doc.width, s.doc.height);
      if (!bounds) {
        s.selection = null;
        s.needsRender = true;
        ui.toast('La selección quedó vacía');
        return;
      }
    }
    installSelection(s, mask,
      { type: 'auto', x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }, bounds);
    setTool('brush');
    s.needsRender = true;
    ui.toast(op === 'add' ? 'Selección añadida' :
      (op === 'subtract' ? 'Selección recortada' :
        'Selección automática: ' + region.count + ' píxeles'), 2400);
  }

  function setSelectMode(mode) {
    if (!st) { return; }
    if (st.transform) { applyTransform(); }
    if (st.adjust) { cancelAdjust(); }
    st.selectMode = mode;
    setTool('select');
    if (mode === 'auto') {
      ui.toast('Selección automática: toca una zona del lienzo');
    } else if (mode === 'lasso') {
      ui.toast('Lazo: dibuja el contorno de la selección');
    } else {
      ui.toast('Selección: arrastra sobre el lienzo');
    }
  }

  function setSelectOp(op) {
    if (!st) { return; }
    var allowed = { new: true, add: true, subtract: true, intersect: true };
    st.selectOp = allowed[op] ? op : 'new';
    ui.toast(st.selectOp === 'add' ? 'Modo añadir: la próxima selección se sumará' :
      (st.selectOp === 'subtract' ? 'Modo restar: la próxima selección se recortará' :
        (st.selectOp === 'intersect' ? 'Modo intersección: solo quedará el área común' :
          'Modo nueva selección')));
  }

  function invertSelection() {
    if (!st || !st.selection) {
      ui.toast('No hay selección activa');
      return;
    }
    var s = st;
    var mask = newDocCanvas(s);
    var g = mask.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s.doc.width, s.doc.height);
    g.globalCompositeOperation = 'destination-out';
    g.drawImage(s.selection.mask, 0, 0);
    g.globalCompositeOperation = 'source-over';
    var bounds = maskBounds(mask, s.doc.width, s.doc.height);
    if (!bounds) {
      s.selection = null;
      s.needsRender = true;
      ui.toast('La selección invertida quedó vacía');
      return;
    }
    installSelection(s, mask,
      { type: 'auto', x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }, bounds);
    s.needsRender = true;
    ui.toast('Selección invertida');
  }

  function clearSelection() {
    if (!st) { return; }
    st.selection = null;
    st.selectDraft = null;
    st.needsRender = true;
    ui.toast('Selección eliminada');
  }

  function duplicateSelectionToLayer() {
    if (!st) { return; }
    var s = st;
    if (!s.selection) {
      ui.toast('No hay selección activa');
      return;
    }
    var source = activeLayer(s);
    if (!source) { return; }
    var layer = model.addLayer(s.doc, { name: 'Selección' });
    if (!layer) {
      ui.toast('Límite de capas alcanzado para este tamaño');
      return;
    }
    var target = createLayerCanvas(s, layer);
    var tg = target.getContext('2d');
    var src = s.canvases[source.id];
    if (src) {
      tg.drawImage(src, 0, 0);
      tg.globalCompositeOperation = 'destination-in';
      tg.drawImage(s.selection.mask, 0, 0);
      tg.globalCompositeOperation = 'source-over';
    }
    s.activeLayerId = layer.id;
    s.doc.activeLayerId = layer.id;
    s.dirty[layer.id] = true;
    s.dirtyGen += 1;
    s.needsRender = true;
    if (PCW.panels) { PCW.panels.sync(); }
    scheduleSave();
    ui.toast('Selección duplicada en una capa nueva');
  }

  /* ------------------------------------------------------------ transformar */

  function contentBounds(canvas, w, h) {
    var ctx = canvas.getContext('2d');
    var data;
    try {
      data = ctx.getImageData(0, 0, w, h).data;
    } catch (e) {
      PCW.logError('studio:transform-bounds', e);
      return null;
    }
    var x0 = w;
    var y0 = h;
    var x1 = -1;
    var y1 = -1;
    var x;
    var y;
    for (y = 0; y < h; y += 1) {
      var row = y * w;
      for (x = 0; x < w; x += 1) {
        if (data[(row + x) * 4 + 3] > 2) {
          if (x < x0) { x0 = x; }
          if (x > x1) { x1 = x; }
          if (y < y0) { y0 = y; }
          if (y > y1) { y1 = y; }
        }
      }
    }
    if (x1 < x0 || y1 < y0) { return null; }
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  function startTransform() {
    if (!st) { return false; }
    var s = st;
    if (s.transform) {
      setTool('transform');
      return true;
    }
    if (s.adjust) { cancelAdjust(); }
    if (s.selectDraft) { s.selectDraft = null; }
    var layer = activeLayer(s);
    if (!layer || layer.visible === false) {
      ui.toast('La capa activa no está disponible');
      return false;
    }
    var src = s.canvases[layer.id];
    if (!src) { return false; }
    var useSelection = !!s.selection;
    var bounds = useSelection ? s.selection.bounds :
      contentBounds(src, s.doc.width, s.doc.height);
    if (!bounds) {
      ui.toast('La capa está vacía; no hay nada que transformar');
      return false;
    }
    var source = newDocCanvas(s);
    var sg = source.getContext('2d');
    sg.drawImage(src, 0, 0);
    var base = null;
    if (useSelection) {
      sg.globalCompositeOperation = 'destination-in';
      sg.drawImage(s.selection.mask, 0, 0);
      sg.globalCompositeOperation = 'source-over';
      base = newDocCanvas(s);
      var bg = base.getContext('2d');
      bg.drawImage(src, 0, 0);
      bg.globalCompositeOperation = 'destination-out';
      bg.drawImage(s.selection.mask, 0, 0);
      bg.globalCompositeOperation = 'source-over';
    }
    var before = null;
    var bytes = s.doc.width * s.doc.height * 4;
    if (bytes * 2 <= model.HISTORY_BYTES * 0.8) {
      try {
        before = src.getContext('2d').getImageData(0, 0, s.doc.width, s.doc.height);
      } catch (e) {
        PCW.logError('studio:transform-snapshot', e);
      }
    }
    s.transform = {
      layerId: layer.id,
      source: source,
      base: base,
      selection: useSelection,
      selectionMask: useSelection ? s.selection.mask : null,
      before: before,
      bounds: bounds,
      tx: 0, ty: 0, scale: 1, rotation: 0,
      flipX: 1, flipY: 1,
      drag: null
    };
    setTool('transform');
    s.needsRender = true;
    ui.toast(useSelection ?
      'Transformar selección: arrastra para mover; esquinas para escalar; tirador superior para rotar' :
      'Transformar: arrastra para mover; esquinas para escalar; tirador superior para rotar', 3200);
    return true;
  }

  function beginTransformDrag(s, p) {
    var t = s.transform;
    if (!t) { return; }
    var b = t.bounds;
    var scale = Math.max(0.08, s.view.scale);
    var hitR = 20 / scale;
    var corners = [
      transformLocalPoint(s, b.x, b.y),
      transformLocalPoint(s, b.x + b.w, b.y),
      transformLocalPoint(s, b.x + b.w, b.y + b.h),
      transformLocalPoint(s, b.x, b.y + b.h)
    ];
    var top = b.y - 46 / (scale * Math.max(0.08, t.scale));
    var rotate = transformLocalPoint(s, b.x + b.w / 2, top);
    var cx = b.x + b.w / 2 + t.tx;
    var cy = b.y + b.h / 2 + t.ty;
    var i;
    for (i = 0; i < corners.length; i += 1) {
      if (distance(p, corners[i]) <= hitR) {
        t.drag = {
          mode: 'scale',
          start: p,
          startScale: t.scale,
          startDist: Math.max(1, distance(p, { x: cx, y: cy }))
        };
        return;
      }
    }
    if (distance(p, rotate) <= hitR) {
      t.drag = {
        mode: 'rotate',
        startAngle: Math.atan2(p.y - cy, p.x - cx),
        startRotation: t.rotation
      };
      return;
    }
    var local = inverseTransformPoint(s, p.x, p.y);
    if (local.x >= b.x && local.x <= b.x + b.w &&
        local.y >= b.y && local.y <= b.y + b.h) {
      t.drag = { mode: 'move', start: p, startTx: t.tx, startTy: t.ty };
    }
  }

  function inverseTransformPoint(s, x, y) {
    var t = s.transform;
    var b = t.bounds;
    var cx = b.x + b.w / 2;
    var cy = b.y + b.h / 2;
    var dx = x - cx - t.tx;
    var dy = y - cy - t.ty;
    var cos = Math.cos(-t.rotation);
    var sin = Math.sin(-t.rotation);
    var rx = dx * cos - dy * sin;
    var ry = dx * sin + dy * cos;
    return {
      x: cx + rx / (t.scale * t.flipX),
      y: cy + ry / (t.scale * t.flipY)
    };
  }

  function updateTransformDrag(s, p) {
    var t = s.transform;
    var d = t && t.drag;
    if (!d) { return; }
    var b = t.bounds;
    var cx = b.x + b.w / 2 + t.tx;
    var cy = b.y + b.h / 2 + t.ty;
    if (d.mode === 'move') {
      t.tx = d.startTx + (p.x - d.start.x);
      t.ty = d.startTy + (p.y - d.start.y);
    } else if (d.mode === 'scale') {
      var dist = Math.max(1, distance(p, { x: cx, y: cy }));
      t.scale = util.clamp(d.startScale * (dist / d.startDist), 0.05, 8);
    } else if (d.mode === 'rotate') {
      var ang = Math.atan2(p.y - cy, p.x - cx);
      t.rotation = d.startRotation + (ang - d.startAngle);
    }
    s.needsRender = true;
  }

  function applyTransform() {
    if (!st || !st.transform) { return; }
    var s = st;
    var t = s.transform;
    var layer = model.findLayer(s.doc, t.layerId);
    var ctx = layerCtx(s, t.layerId);
    if (!ctx || !layer) {
      s.transform = null;
      return;
    }
    var unchanged = !t.tx && !t.ty && t.scale === 1 &&
      t.rotation === 0 && t.flipX === 1 && t.flipY === 1;
    if (unchanged) {
      s.transform = null;
      setTool('brush');
      s.needsRender = true;
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s.doc.width, s.doc.height);
    if (t.base) { ctx.drawImage(t.base, 0, 0); }
    var b = t.bounds;
    var cx = b.x + b.w / 2;
    var cy = b.y + b.h / 2;
    ctx.save();
    ctx.translate(cx + t.tx, cy + t.ty);
    ctx.rotate(t.rotation);
    ctx.scale(t.scale * t.flipX, t.scale * t.flipY);
    ctx.translate(-cx, -cy);
    ctx.drawImage(t.source, 0, 0);
    ctx.restore();
    if (t.selection) {
      s.selection = null;
      s.selectDraft = null;
    }

    if (t.before) {
      pushFullHistory(s, t.layerId, t.before);
    } else if (!s.historyWarned) {
      s.historyWarned = true;
      ui.toast('Transformación aplicada; no cabe en el historial de deshacer.', 3200);
    }
    s.transform = null;
    setTool('brush');
    markDirty(s, layer.id);
    s.needsRender = true;
    if (PCW.panels) { PCW.panels.sync(); }
    ui.toast('Transformación aplicada');
  }

  function cancelTransform() {
    if (!st || !st.transform) { return; }
    st.transform = null;
    setTool('brush');
    st.needsRender = true;
    ui.toast('Transformación cancelada');
  }

  function flipTransform(axis) {
    if (!st || !st.transform) { return; }
    if (axis === 'h') { st.transform.flipX *= -1; }
    else { st.transform.flipY *= -1; }
    st.needsRender = true;
  }

  function resetTransform() {
    if (!st || !st.transform) { return; }
    st.transform.tx = 0;
    st.transform.ty = 0;
    st.transform.scale = 1;
    st.transform.rotation = 0;
    st.transform.flipX = 1;
    st.transform.flipY = 1;
    st.needsRender = true;
  }

  function pushFullHistory(s, layerId, before) {
    var ctx = layerCtx(s, layerId);
    if (!ctx) { return; }
    var after;
    try {
      after = ctx.getImageData(0, 0, s.doc.width, s.doc.height);
    } catch (e) {
      PCW.logError('studio:history-full', e);
      return;
    }
    var bytes = before.data.length + after.data.length;
    if (bytes > model.HISTORY_BYTES * 0.8) {
      if (!s.historyWarned) {
        s.historyWarned = true;
        ui.toast('Cambio demasiado grande para el historial; no se podrá deshacer.', 3000);
      }
      return;
    }
    clearRedo(s);
    s.history.undo.push({
      layerId: layerId,
      rect: { x: 0, y: 0, w: s.doc.width, h: s.doc.height },
      before: before,
      after: after,
      bytes: bytes
    });
    s.history.bytes += bytes;
    trimHistory(s);
    syncHistoryUi();
    s.historyWarned = false;
  }

  /* --------------------------------------------------------------- ajustes */

  function startAdjust() {
    if (!st) { return false; }
    var s = st;
    if (s.adjust) { return true; }
    if (s.transform) { applyTransform(); }
    if (s.selectDraft) { s.selectDraft = null; }
    var layer = activeLayer(s);
    if (!layer || layer.visible === false) {
      ui.toast('La capa activa no está disponible');
      return false;
    }
    var src = s.canvases[layer.id];
    if (!src) { return false; }
    var source = newDocCanvas(s);
    source.getContext('2d').drawImage(src, 0, 0);
    var before = null;
    var bytes = s.doc.width * s.doc.height * 4;
    if (bytes * 2 <= model.HISTORY_BYTES * 0.8) {
      try {
        before = src.getContext('2d').getImageData(0, 0, s.doc.width, s.doc.height);
      } catch (e) {
        PCW.logError('studio:adjust-snapshot', e);
      }
    }
    s.adjust = {
      layerId: layer.id,
      source: source,
      before: before,
      preview: null,
      previewReady: false,
      timer: null,
      values: {
        brightness: 0, contrast: 0, saturation: 0, hue: 0,
        temperature: 0, sharpen: 0, blur: 0, noise: 0
      },
      bw: false,
      invert: false
    };
    s.needsRender = true;
    return true;
  }

  function scheduleAdjustPreview(s) {
    if (!s.adjust) { return; }
    if (s.adjust.timer) { clearTimeout(s.adjust.timer); }
    s.adjust.timer = setTimeout(function () {
      if (!st || st !== s || !s.adjust) { return; }
      s.adjust.timer = null;
      buildAdjustPreview(s);
    }, 110);
  }

  function buildAdjustPreview(s) {
    var a = s.adjust;
    if (!a) { return; }
    var w = s.doc.width;
    var h = s.doc.height;
    var canvas = a.preview;
    if (!canvas) {
      canvas = newDocCanvas(s);
      a.preview = canvas;
    }
    var g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.drawImage(a.source, 0, 0);
    var v = a.values;
    var needs = a.bw || a.invert || v.brightness || v.contrast ||
      v.saturation || v.hue || v.temperature || v.sharpen || v.blur || v.noise;
    if (!needs) {
      a.previewReady = true;
      s.needsRender = true;
      return;
    }
    var img;
    try {
      img = g.getImageData(0, 0, w, h);
    } catch (e) {
      PCW.logError('studio:adjust-read', e);
      return;
    }
    var data = img.data;
    if (v.blur > 0) {
      boxBlur(data, w, h, Math.round(v.blur));
    }
    var bri = v.brightness * 1.6;
    var con = v.contrast * 2.2;
    var conF = (259 * (con + 255)) / (255 * (259 - con));
    var sat = 1 + v.saturation / 100;
    var noise = v.noise * 1.25;
    var temp = v.temperature * 0.9;
    var hueRad = (v.hue * Math.PI) / 180;
    var hc = Math.cos(hueRad);
    var hs = Math.sin(hueRad);
    var hm = [
      0.213 + hc * 0.787 - hs * 0.213,
      0.715 - hc * 0.715 - hs * 0.715,
      0.072 - hc * 0.072 + hs * 0.928,
      0.213 - hc * 0.213 + hs * 0.143,
      0.715 + hc * 0.285 + hs * 0.140,
      0.072 - hc * 0.072 - hs * 0.283,
      0.213 - hc * 0.213 - hs * 0.787,
      0.715 - hc * 0.715 + hs * 0.715,
      0.072 + hc * 0.928 + hs * 0.072
    ];
    var useHue = Math.abs(v.hue) > 0.01;
    var i;
    for (i = 0; i < data.length; i += 4) {
      var r = data[i];
      var gg = data[i + 1];
      var b = data[i + 2];
      if (useHue) {
        var hr = hm[0] * r + hm[1] * gg + hm[2] * b;
        var hg = hm[3] * r + hm[4] * gg + hm[5] * b;
        var hb = hm[6] * r + hm[7] * gg + hm[8] * b;
        r = hr;
        gg = hg;
        b = hb;
      }
      if (temp) {
        r += temp;
        gg += temp * 0.12;
        b -= temp;
      }
      r = conF * (r - 128) + 128 + bri;
      gg = conF * (gg - 128) + 128 + bri;
      b = conF * (b - 128) + 128 + bri;
      var gray = 0.299 * r + 0.587 * gg + 0.114 * b;
      r = gray + (r - gray) * sat;
      gg = gray + (gg - gray) * sat;
      b = gray + (b - gray) * sat;
      if (noise > 0) {
        var n = (pseudo(i * 0.013, i) - 0.5) * noise * 2;
        r += n;
        gg += n;
        b += n;
      }
      if (a.bw) {
        r = gg = b = 0.299 * r + 0.587 * gg + 0.114 * b;
      }
      if (a.invert) {
        r = 255 - r;
        gg = 255 - gg;
        b = 255 - b;
      }
      data[i] = r;
      data[i + 1] = gg;
      data[i + 2] = b;
    }
    if (v.sharpen > 0) {
      sharpenData(data, w, h, (v.sharpen / 100) * 1.4);
    }
    try {
      g.putImageData(img, 0, 0);
    } catch (e2) {
      PCW.logError('studio:adjust-write', e2);
      return;
    }
    a.previewReady = true;
    s.needsRender = true;
  }

  /* Enfoque por máscara de desenfoque (unsharp) con núcleo 3×3. */
  function sharpenData(data, w, h, amount) {
    if (amount <= 0 || w < 3 || h < 3) { return; }
    var src = new Uint8ClampedArray(data);
    var x;
    var y;
    var c;
    for (y = 1; y < h - 1; y += 1) {
      for (x = 1; x < w - 1; x += 1) {
        var i = (y * w + x) * 4;
        for (c = 0; c < 3; c += 1) {
          var center = src[i + c];
          var sum = center * 4 -
            src[i - 4 + c] - src[i + 4 + c] -
            src[i - w * 4 + c] - src[i + w * 4 + c];
          data[i + c] = center + sum * amount * 0.5;
        }
      }
    }
  }

  function boxBlur(data, w, h, radius) {
    if (radius < 1) { return; }
    radius = Math.min(radius, 24);
    var tmp = new Uint8ClampedArray(data.length);
    var window = radius * 2 + 1;
    var x;
    var y;
    var c;
    for (y = 0; y < h; y += 1) {
      var row = y * w;
      for (c = 0; c < 4; c += 1) {
        var sum = 0;
        for (x = -radius; x <= radius; x += 1) {
          sum += data[(row + util.clamp(x, 0, w - 1)) * 4 + c];
        }
        for (x = 0; x < w; x += 1) {
          tmp[(row + x) * 4 + c] = sum / window;
          sum -= data[(row + util.clamp(x - radius, 0, w - 1)) * 4 + c];
          sum += data[(row + util.clamp(x + radius + 1, 0, w - 1)) * 4 + c];
        }
      }
    }
    for (x = 0; x < w; x += 1) {
      for (c = 0; c < 4; c += 1) {
        var sum2 = 0;
        for (y = -radius; y <= radius; y += 1) {
          sum2 += tmp[(util.clamp(y, 0, h - 1) * w + x) * 4 + c];
        }
        for (y = 0; y < h; y += 1) {
          data[(y * w + x) * 4 + c] = sum2 / window;
          sum2 -= tmp[(util.clamp(y - radius, 0, h - 1) * w + x) * 4 + c];
          sum2 += tmp[(util.clamp(y + radius + 1, 0, h - 1) * w + x) * 4 + c];
        }
      }
    }
  }

  function setAdjustValue(key, value) {
    if (!st || !st.adjust) { return; }
    st.adjust.values[key] = value;
    scheduleAdjustPreview(st);
  }

  function setAdjustPreset(name) {
    if (!st || !st.adjust) { return; }
    var a = st.adjust;
    if (name === 'bw') {
      a.bw = !a.bw;
    } else if (name === 'invert') {
      a.invert = !a.invert;
    } else if (name === 'reset') {
      a.values = {
        brightness: 0, contrast: 0, saturation: 0, hue: 0,
        temperature: 0, sharpen: 0, blur: 0, noise: 0
      };
      a.bw = false;
      a.invert = false;
    }
    scheduleAdjustPreview(st);
  }

  function applyAdjust() {
    if (!st || !st.adjust) { return; }
    var s = st;
    var a = s.adjust;
    if (!a.previewReady) { buildAdjustPreview(s); }
    var layer = model.findLayer(s.doc, a.layerId);
    var ctx = layerCtx(s, a.layerId);
    if (!ctx || !layer) {
      s.adjust = null;
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s.doc.width, s.doc.height);
    ctx.drawImage(a.preview || a.source, 0, 0);
    if (a.before) {
      pushFullHistory(s, a.layerId, a.before);
    }
    s.adjust = null;
    markDirty(s, layer.id);
    s.needsRender = true;
    if (PCW.panels) { PCW.panels.sync(); }
    ui.toast('Ajustes aplicados');
  }

  function cancelAdjust() {
    if (!st || !st.adjust) { return; }
    if (st.adjust.timer) { clearTimeout(st.adjust.timer); }
    st.adjust = null;
    st.needsRender = true;
    if (PCW.panels) { PCW.panels.sync(); }
  }

  /* ------------------------------------------------------- relleno / color */

  function setDropThreshold(value) {
    if (!st) { return; }
    st.dropThreshold = util.clamp(Math.round(value), 0, 100);
  }

  function pointFromClient(clientX, clientY) {
    if (!st || !viewCanvas) { return null; }
    var rect = rectOf(viewCanvas);
    if (clientX < rect.left || clientY < rect.top ||
        clientX > rect.right || clientY > rect.bottom) {
      return null;
    }
    var m = mat.invert(viewMatrix(st));
    return mat.apply(m, clientX - rect.left, clientY - rect.top);
  }

  function colorDrop(clientX, clientY) {
    if (!st) { return false; }
    var s = st;
    var p = pointFromClient(clientX, clientY);
    if (!p) { return false; }
    if (s.transform) { applyTransform(); }
    if (s.adjust) { cancelAdjust(); }
    var layer = activeLayer(s);
    if (!layer) { return false; }
    if (layer.visible === false) {
      ui.toast('La capa activa está oculta');
      return false;
    }
    if (p.x < 0 || p.y < 0 || p.x >= s.doc.width || p.y >= s.doc.height) {
      ui.toast('Suelta el color dentro del lienzo');
      return false;
    }
    var ctx = layerCtx(s, layer.id);
    if (!ctx) { return false; }
    var comp = buildComposite(s);
    var sourceData;
    var targetData;
    var maskData = null;
    try {
      sourceData = comp.getContext('2d')
        .getImageData(0, 0, s.doc.width, s.doc.height).data;
      targetData = ctx.getImageData(0, 0, s.doc.width, s.doc.height);
    } catch (e) {
      PCW.logError('studio:color-drop-read', e);
      ui.toast('El lienzo es demasiado grande para rellenar aquí');
      return false;
    }
    if (s.selection && s.selection.mask) {
      maskData = s.selection.mask.getContext('2d')
        .getImageData(0, 0, s.doc.width, s.doc.height).data;
    }
    var alphaData = layer.alphaLock ? targetData.data : null;
    var sx = util.clamp(Math.floor(p.x), 0, s.doc.width - 1);
    var sy = util.clamp(Math.floor(p.y), 0, s.doc.height - 1);
    var region = util.floodRegion(sourceData, s.doc.width, s.doc.height, sx, sy,
      colorTolerance(s.dropThreshold), maskData, alphaData);
    if (!region) {
      ui.toast('No se encontró una zona cerrada que rellenar');
      return false;
    }
    if (maskData) {
      var inSelection = false;
      for (var k = region.y0; k <= region.y1 && !inSelection; k += 1) {
        for (var j = region.x0; j <= region.x1; j += 1) {
          if (region.mask[k * s.doc.width + j]) { inSelection = true; break; }
        }
      }
      if (!inSelection) {
        ui.toast('La zona está fuera de la selección');
        return false;
      }
    }
    var rgb = util.hexToRgb(s.color) || { r: 28, g: 28, b: 30 };
    var bw = region.x1 - region.x0 + 1;
    var bh = region.y1 - region.y0 + 1;
    var before = null;
    try {
      before = ctx.getImageData(region.x0, region.y0, bw, bh);
    } catch (e2) {
      PCW.logError('studio:color-drop-before', e2);
    }
    var data = targetData.data;
    var x;
    var y;
    for (y = region.y0; y <= region.y1; y += 1) {
      var row = y * s.doc.width;
      for (x = region.x0; x <= region.x1; x += 1) {
        var idx = row + x;
        if (!region.mask[idx]) { continue; }
        var i4 = idx * 4;
        data[i4] = rgb.r;
        data[i4 + 1] = rgb.g;
        data[i4 + 2] = rgb.b;
        data[i4 + 3] = 255;
      }
    }
    ctx.putImageData(targetData, 0, 0, region.x0, region.y0, bw, bh);
    if (before) { pushRegionHistory(s, layer.id, region.x0, region.y0, bw, bh, before); }
    markDirty(s, layer.id);
    s.needsRender = true;
    if (PCW.panels) {
      PCW.panels.updateThumbs();
      PCW.panels.sync();
    }
    ui.toast('ColorDrop: ' + region.count + ' píxeles rellenados', 2000);
    return true;
  }

  function fillLayer() {
    if (!st) { return; }
    fillActive(true);
  }

  function fillSelection() {
    if (!st) { return; }
    if (!st.selection) {
      ui.toast('No hay selección activa');
      return;
    }
    fillActive(false);
  }

  function fillActive(wholeLayer) {
    var s = st;
    var layer = activeLayer(s);
    if (!layer) { return; }
    if (layer.visible === false) {
      ui.toast('La capa activa está oculta');
      return;
    }
    var ctx = layerCtx(s, layer.id);
    if (!ctx) { return; }
    var w = s.doc.width;
    var h = s.doc.height;
    var before;
    try {
      before = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      PCW.logError('studio:fill-before', e);
      ui.toast('No se pudo leer la capa');
      return;
    }
    var after = ctx.createImageData(w, h);
    var src = before.data;
    var dst = after.data;
    var rgb = util.hexToRgb(s.color) || { r: 28, g: 28, b: 30 };
    var maskData = null;
    if (!wholeLayer && s.selection) {
      maskData = s.selection.mask.getContext('2d').getImageData(0, 0, w, h).data;
    }
    var i;
    for (i = 0; i < w * h; i += 1) {
      var i4 = i * 4;
      var allowed = wholeLayer || !maskData || maskData[i4 + 3] > 0;
      if (layer.alphaLock && src[i4 + 3] === 0) { allowed = false; }
      if (allowed) {
        dst[i4] = rgb.r;
        dst[i4 + 1] = rgb.g;
        dst[i4 + 2] = rgb.b;
        dst[i4 + 3] = 255;
      } else {
        dst[i4] = src[i4];
        dst[i4 + 1] = src[i4 + 1];
        dst[i4 + 2] = src[i4 + 2];
        dst[i4 + 3] = src[i4 + 3];
      }
    }
    ctx.putImageData(after, 0, 0);
    pushRegionHistory(s, layer.id, 0, 0, w, h, before);
    markDirty(s, layer.id);
    s.needsRender = true;
    if (PCW.panels) {
      PCW.panels.updateThumbs();
      PCW.panels.sync();
    }
    ui.toast(wholeLayer ? 'Capa rellenada' : 'Selección rellenada');
  }

  function clearActiveLayer() {
    if (!st) { return; }
    var s = st;
    var layer = activeLayer(s);
    if (!layer) { return; }
    var ctx = layerCtx(s, layer.id);
    if (!ctx) { return; }
    var w = s.doc.width;
    var h = s.doc.height;
    var before;
    try {
      before = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      PCW.logError('studio:clear-before', e);
      return;
    }
    ctx.clearRect(0, 0, w, h);
    pushRegionHistory(s, layer.id, 0, 0, w, h, before);
    markDirty(s, layer.id);
    s.needsRender = true;
    if (PCW.panels) {
      PCW.panels.updateThumbs();
      PCW.panels.sync();
    }
    ui.toast('Capa vaciada');
  }

  function pushRegionHistory(s, layerId, x, y, w, h, before) {
    var ctx = layerCtx(s, layerId);
    if (!ctx) { return; }
    var after;
    try {
      after = ctx.getImageData(x, y, w, h);
    } catch (e) {
      PCW.logError('studio:region-history', e);
      return;
    }
    var bytes = before.data.length + after.data.length;
    if (bytes > model.HISTORY_BYTES * 0.8) {
      if (!s.historyWarned) {
        s.historyWarned = true;
        ui.toast('Cambio demasiado grande para deshacer.', 3000);
      }
      return;
    }
    clearRedo(s);
    s.history.undo.push({
      layerId: layerId,
      rect: { x: x, y: y, w: w, h: h },
      before: before,
      after: after,
      bytes: bytes
    });
    s.history.bytes += bytes;
    trimHistory(s);
    syncHistoryUi();
  }

  function toggleAlphaLock() {
    if (!st) { return; }
    var layer = activeLayer(st);
    if (!layer) { return; }
    layer.alphaLock = !layer.alphaLock;
    if (PCW.panels) { PCW.panels.syncActive(); }
    scheduleSave();
    ui.toast(layer.alphaLock ? 'Bloqueo alfa activado' : 'Bloqueo alfa desactivado');
  }

  function resetDropThreshold() {
    return st ? st.dropThreshold : 12;
  }

  function setSymmetry(mode) {
    if (!st) { return; }
    var allowed = { off: true, vertical: true, horizontal: true, quad: true };
    var next = allowed[mode] ? mode : 'off';
    st.symmetry = next;
    st.doc.symmetry = next;
    st.needsRender = true;
    scheduleSave();
    ui.toast(next === 'off' ? 'Guía de simetría desactivada' :
      (next === 'quad' ? 'Simetría en cuadrícula (4 ejes)' :
        (next === 'vertical' ? 'Simetría vertical' : 'Simetría horizontal')));
  }

  /* ------------------------------------------------- fusión de capas */

  function mergeUpperInto(s, target, uppers) {
    var ctx = layerCtx(s, target.id);
    if (!ctx || !uppers.length) { return false; }
    var w = s.doc.width;
    var h = s.doc.height;
    var before = null;
    if (w * h * 4 <= model.HISTORY_BYTES * 0.45) {
      try {
        before = ctx.getImageData(0, 0, w, h);
      } catch (e) {
        PCW.logError('studio:merge-snapshot', e);
      }
    }
    var removed = [];
    var i;
    for (i = 0; i < uppers.length; i += 1) {
      var layer = model.findLayer(s.doc, uppers[i]);
      if (!layer || layer.id === target.id) { continue; }
      removed.push({
        layer: layer,
        canvas: s.canvases[layer.id] || null,
        index: model.layerIndex(s.doc, layer.id)
      });
    }
    removed.sort(function (a, b) { return a.index - b.index; });
    if (!removed.length) { return false; }

    for (i = 0; i < removed.length; i += 1) {
      if (!removed[i].canvas) { continue; }
      ctx.save();
      ctx.globalAlpha = removed[i].layer.opacity;
      ctx.globalCompositeOperation = removed[i].layer.blend || 'source-over';
      ctx.drawImage(removed[i].canvas, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    for (i = removed.length - 1; i >= 0; i -= 1) {
      var id = removed[i].layer.id;
      model.removeLayer(s.doc, id);
      delete s.canvases[id];
      delete s.ctxs[id];
      delete s.dirty[id];
      if (s.removedLayerIds.indexOf(id) < 0) { s.removedLayerIds.push(id); }
      purgeLayerHistory(s, id);
    }
    s.doc.activeLayerId = target.id;
    s.activeLayerId = target.id;
    s.dirty[target.id] = true;
    s.dirtyGen += 1;
    s.needsRender = true;

    if (before) {
      var entry = {
        type: 'structure',
        layerId: target.id,
        bytes: before.data.length,
        apply: function (isRedo) {
          var tctx = layerCtx(s, target.id);
          if (!tctx) { return false; }
          var j;
          if (!isRedo) {
            try {
              tctx.putImageData(before, 0, 0);
            } catch (e2) {
              PCW.logError('studio:merge-undo', e2);
              return false;
            }
            for (j = 0; j < removed.length; j += 1) {
              var r = removed[j];
              if (model.layerIndex(s.doc, r.layer.id) < 0) {
                var at = Math.min(r.index, s.doc.layers.length);
                s.doc.layers.splice(at, 0, r.layer);
              }
              if (r.canvas) {
                s.canvases[r.layer.id] = r.canvas;
                s.ctxs[r.layer.id] = r.canvas.getContext('2d');
              }
              s.dirty[r.layer.id] = true;
              var k = s.removedLayerIds.indexOf(r.layer.id);
              if (k >= 0) { s.removedLayerIds.splice(k, 1); }
            }
          } else {
            for (j = removed.length - 1; j >= 0; j -= 1) {
              var rr = removed[j];
              model.removeLayer(s.doc, rr.layer.id);
              delete s.canvases[rr.layer.id];
              delete s.ctxs[rr.layer.id];
              delete s.dirty[rr.layer.id];
              if (s.removedLayerIds.indexOf(rr.layer.id) < 0) {
                s.removedLayerIds.push(rr.layer.id);
              }
            }
            tctx.setTransform(1, 0, 0, 1, 0, 0);
            tctx.clearRect(0, 0, w, h);
            for (j = 0; j < removed.length; j += 1) {
              var r2 = removed[j];
              if (!r2.canvas) { continue; }
              tctx.save();
              tctx.globalAlpha = r2.layer.opacity;
              tctx.globalCompositeOperation = r2.layer.blend || 'source-over';
              tctx.drawImage(r2.canvas, 0, 0);
              tctx.restore();
            }
          }
          s.doc.activeLayerId = target.id;
          s.activeLayerId = target.id;
          s.dirty[target.id] = true;
          s.dirtyGen += 1;
          s.doc.updatedAt = now();
          s.needsRender = true;
          if (PCW.panels) { PCW.panels.sync(); }
          scheduleSave();
          return true;
        }
      };
      clearRedo(s);
      s.history.undo.push(entry);
      s.history.bytes += entry.bytes;
      trimHistory(s);
      syncHistoryUi();
    } else if (!s.historyWarned) {
      s.historyWarned = true;
      ui.toast('Capas combinadas; el resultado no cabe en el historial.', 3200);
    }
    if (PCW.panels) { PCW.panels.sync(); }
    scheduleSave();
    return true;
  }

  function mergeDown() {
    if (!st) { return false; }
    var s = st;
    var idx = model.layerIndex(s.doc, s.activeLayerId);
    if (idx <= 0) {
      ui.toast('No hay ninguna capa debajo');
      return false;
    }
    var upper = s.doc.layers[idx];
    if (upper.visible === false) {
      ui.toast('La capa activa está oculta; muéstrala antes de combinar');
      return false;
    }
    var target = s.doc.layers[idx - 1];
    if (!mergeUpperInto(s, target, [upper.id])) { return false; }
    ui.toast('Capa combinada hacia abajo');
    return true;
  }

  function mergeVisible() {
    if (!st) { return false; }
    var s = st;
    var target = null;
    var uppers = [];
    var i;
    for (i = 0; i < s.doc.layers.length; i += 1) {
      var layer = s.doc.layers[i];
      if (layer.visible === false || layer.opacity <= 0) { continue; }
      if (!target) { target = layer; continue; }
      uppers.push(layer.id);
    }
    if (!target || !uppers.length) {
      ui.toast('No hay varias capas visibles que combinar');
      return false;
    }
    if (!mergeUpperInto(s, target, uppers)) { return false; }
    ui.toast('Capas visibles combinadas');
    return true;
  }

  /* ------------------------------------------- redimensionar / recortar */

  function applyCanvasResize(nw, nh, opts) {
    if (!st) { return false; }
    var s = st;
    nw = Math.round(nw);
    nh = Math.round(nh);
    opts = opts || {};
    if (!model.validSize(nw, nh)) {
      ui.toast('Dimensiones fuera de rango (64 a 4096 px)');
      return false;
    }
    var budget = model.budgetFor(nw, nh);
    if (budget.overBudget) {
      ui.toast('Ese tamaño supera el presupuesto de 40 MB');
      return false;
    }
    if (budget.maxLayers < s.doc.layers.length) {
      ui.toast('Con ese tamaño solo caben ' + budget.maxLayers + ' capas; reduce capas primero');
      return false;
    }
    var oldW = s.doc.width;
    var oldH = s.doc.height;
    if (nw === oldW && nh === oldH) { return true; }

    var drawW = opts.scale ? nw : oldW;
    var drawH = opts.scale ? nh : oldH;
    var dx;
    var dy;
    if (typeof opts.offsetX === 'number') {
      dx = -opts.offsetX;
      dy = -opts.offsetY;
    } else {
      var anchor = opts.anchor || 'center';
      dx = anchor.indexOf('left') >= 0 ? 0 :
        (anchor.indexOf('right') >= 0 ? nw - drawW : (nw - drawW) / 2);
      dy = anchor.indexOf('top') >= 0 ? 0 :
        (anchor.indexOf('bottom') >= 0 ? nh - drawH : (nh - drawH) / 2);
    }
    dx = Math.round(dx);
    dy = Math.round(dy);

    var nextCanvases = {};
    var nextCtxs = {};
    var i;
    for (i = 0; i < s.doc.layers.length; i += 1) {
      var layer = s.doc.layers[i];
      var old = s.canvases[layer.id];
      var nc = document.createElement('canvas');
      nc.width = nw;
      nc.height = nh;
      var g = nc.getContext('2d');
      if (old) {
        g.drawImage(old, 0, 0, oldW, oldH, dx, dy, drawW, drawH);
      }
      nextCanvases[layer.id] = nc;
      nextCtxs[layer.id] = g;
      s.dirty[layer.id] = true;
    }

    s.canvases = nextCanvases;
    s.ctxs = nextCtxs;
    s.doc.width = nw;
    s.doc.height = nh;
    s.doc.updatedAt = now();
    s.doc.thumb = '';
    s.dirtyGen += 1;
    s.selection = null;
    s.selectDraft = null;
    s.transform = null;
    s.adjust = null;
    s.stroke = null;
    s.strokeBuffer = null;
    s.strokeBufferCtx = null;
    s.strokeMasked = null;
    s.strokeMaskedCtx = null;
    s.strokeView = null;
    s.strokeViewCtx = null;
    s.composite = null;
    s.smudgePatch = null;
    s.history = { undo: [], redo: [], bytes: 0 };
    syncHistoryUi();
    fit();
    s.needsRender = true;
    scheduleSave();
    if (PCW.panels) { PCW.panels.sync(); }
    if (PCW.gallery) { PCW.gallery.refresh(); }
    return true;
  }

  function cropToSelection() {
    if (!st) { return false; }
    var s = st;
    if (!s.selection) {
      ui.toast('No hay selección activa');
      return false;
    }
    var b = s.selection.bounds || maskBounds(s.selection.mask, s.doc.width, s.doc.height);
    if (!b) {
      ui.toast('La selección está vacía');
      return false;
    }
    if (b.w < model.MIN_SIZE || b.h < model.MIN_SIZE) {
      ui.toast('La selección es demasiado pequeña (mínimo ' + model.MIN_SIZE + ' px)');
      return false;
    }
    if (!applyCanvasResize(b.w, b.h, { offsetX: b.x, offsetY: b.y })) { return false; }
    ui.toast('Lienzo recortado a la selección');
    return true;
  }

  /* --------------------------------------- curvas y edición Bézier */

  /* Copia completa de la capa. finishHistory recorta su propia región a
     partir de una instantánea de lienzo entero; reutilizar el before de una
     entrada de historial (ya recortado) corrompería el resultado. */
  function captureLayerSnapshot(s, layerId) {
    var ctx = layerCtx(s, layerId);
    if (!ctx) { return null; }
    try {
      return ctx.getImageData(0, 0, s.doc.width, s.doc.height);
    } catch (e) {
      PCW.logError('studio:snapshot-temp', e);
      return null;
    }
  }

  function makeTemporaryStroke(info, before) {
    var pts = info.points || [];
    var start = pts.length ? { x: pts[0].x, y: pts[0].y } : { x: 0, y: 0 };
    return {
      layerId: info.layerId,
      start: { x: start.x, y: start.y },
      stampPoint: { x: start.x, y: start.y },
      bounds: { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
      stampCount: 0,
      points: pts,
      rawPoints: pts,
      before: before,
      quickApplied: false,
      snapshotReady: true,
      noHistory: false,
      lastPressure: 0.5,
      lastMoveAt: now(),
      startedAt: now()
    };
  }

  function curveHit(s, p) {
    var ce = s.curveEdit;
    if (!ce) { return null; }
    var scale = Math.max(0.08, s.view.scale);
    /* Radio en píxeles de pantalla convertido a coordenadas del lienzo. Se
       elige el objetivo más cercano: con anclas densas los manejadores
       quedan a pocos píxeles y una prioridad fija los volvería inalcanzables
       o, al revés, impediría mover el ancla. */
    var radius = Math.max(5, 9 / scale);
    var best = null;
    var bestDist = Infinity;
    var i;
    for (i = ce.anchors.length - 1; i >= 0; i -= 1) {
      var a = ce.anchors[i];
      var da = model.distance(p, a);
      if (da <= radius && da < bestDist) {
        bestDist = da;
        best = { kind: 'anchor', index: i };
      }
      var din = model.distance(p, { x: a.inX, y: a.inY });
      if (din <= radius && din < bestDist) {
        bestDist = din;
        best = { kind: 'in', index: i };
      }
      var dout = model.distance(p, { x: a.outX, y: a.outY });
      if (dout <= radius && dout < bestDist) {
        bestDist = dout;
        best = { kind: 'out', index: i };
      }
    }
    return best;
  }

  function beginCurveDrag(s, p) {
    var hit = curveHit(s, p);
    if (!hit) { return false; }
    s.curveEdit.drag = hit;
    s.needsRender = true;
    return true;
  }

  function updateCurveDrag(s, p) {
    var ce = s.curveEdit;
    if (!ce || !ce.drag) { return; }
    var a = ce.anchors[ce.drag.index];
    if (!a) { return; }
    if (ce.drag.kind === 'anchor') {
      var dx = p.x - a.x;
      var dy = p.y - a.y;
      a.x = p.x;
      a.y = p.y;
      a.inX += dx;
      a.inY += dy;
      a.outX += dx;
      a.outY += dy;
    } else if (ce.drag.kind === 'in') {
      a.inX = p.x;
      a.inY = p.y;
    } else {
      a.outX = p.x;
      a.outY = p.y;
    }
    s.needsRender = true;
  }

  function startCurveEdit() {
    var s = st;
    if (!s) { return false; }
    if (s.curveEdit) {
      ui.toast('Ya hay una curva en edición');
      return false;
    }
    if (!s.curveRecognition) {
      ui.toast('El reconocimiento de curvas está desactivado');
      return false;
    }
    var info = s.lastStrokeInfo;
    if (!info) {
      ui.toast('Dibuja un trazo antes de editarlo');
      return false;
    }
    var entry = s.history.undo[s.history.undo.length - 1];
    if (!entry || entry.layerId !== info.layerId || !entry.before) {
      ui.toast('El último trazo ya no se puede editar');
      return false;
    }
    var b = model.pointBounds(info.points);
    var diag = b ? Math.sqrt(b.w * b.w + b.h * b.h) : 100;
    var epsilon = Math.max(3.5, s.size * 0.4, diag * 0.015);
    var curve = model.curveForPoints(info.points, { epsilon: epsilon, steps: 10 });
    /* Demasiadas anclas hacen imposible tocar un manejador con el dedo.
       Se relaja la simplificación hasta dejar una densidad editable. */
    var guard = 0;
    while (curve && curve.anchors.length > 24 && guard < 6) {
      epsilon *= 1.7;
      curve = model.curveForPoints(info.points, { epsilon: epsilon, steps: 10 });
      guard += 1;
    }
    if (!curve || curve.anchors.length < 2) {
      ui.toast('No se pudo crear una curva editable');
      return false;
    }
    if (!undo()) {
      ui.toast('No se pudo preparar la edición');
      return false;
    }
    var snapshot = captureLayerSnapshot(s, info.layerId);
    if (!snapshot) {
      if (s.history.redo.length) { redo(); }
      ui.toast('No se pudo preparar la edición');
      return false;
    }
    s.curveEdit = {
      layerId: info.layerId,
      tool: info.tool || 'brush',
      before: snapshot,
      anchors: curve.anchors,
      closed: curve.closed,
      drag: null
    };
    s.needsRender = true;
    if (PCW.panels && PCW.panels.openCurveEdit) { PCW.panels.openCurveEdit(); }
    ui.toast('Edita las anclas y los manejadores; luego Aplicar', 3200);
    return true;
  }

  function applyCurveEdit() {
    var s = st;
    if (!s || !s.curveEdit) { return false; }
    var ce = s.curveEdit;
    var sampled = model.sampleBezier(ce.anchors, ce.closed, 10);
    if (sampled.length < 2) {
      ui.toast('La curva está vacía');
      return false;
    }
    var before = ce.before;
    var stroke = makeTemporaryStroke({
      layerId: ce.layerId,
      points: sampled
    }, before);
    var previousTool = s.tool;
    s.tool = ce.tool;
    s.stroke = stroke;
    var spacing = Math.max(0.8, s.size * (s.brush.spacing || 0.1));
    var i;
    for (i = 0; i < sampled.length - 1; i += 1) {
      stampPathSegment(s, sampled[i], sampled[i + 1], spacing);
    }
    if (ce.closed && sampled.length > 2) {
      stampPathSegment(s, sampled[sampled.length - 1], sampled[0], spacing);
    }
    stroke.quickApplied = true;
    stroke.quickType = 'curve';
    finishHistory(s);
    s.lastStrokeInfo = {
      layerId: ce.layerId,
      tool: ce.tool,
      points: sampled,
      rawPoints: sampled,
      quickType: 'curve',
      startedAt: now()
    };
    s.stroke = null;
    s.curveEdit = null;
    s.tool = previousTool;
    markDirty(s, ce.layerId);
    s.needsRender = true;
    syncHistoryUi();
    if (PCW.panels) {
      PCW.panels.closeCurveEdit();
      PCW.panels.sync();
    }
    ui.toast('Curva aplicada');
    return true;
  }

  function cancelCurveEdit() {
    var s = st;
    if (!s || !s.curveEdit) { return false; }
    s.curveEdit = null;
    s.stroke = null;
    s.needsRender = true;
    if (s.history.redo.length) { redo(); }
    if (PCW.panels) {
      PCW.panels.closeCurveEdit();
      PCW.panels.sync();
    }
    ui.toast('Edición de curva cancelada');
    return true;
  }

  function correctLastShape() {
    var s = st;
    if (!s) { return false; }
    var info = s.lastStrokeInfo;
    if (!info) {
      ui.toast('Dibuja un trazo antes de corregirlo');
      return false;
    }
    var entry = s.history.undo[s.history.undo.length - 1];
    if (!entry || entry.layerId !== info.layerId || !entry.before) {
      ui.toast('El último trazo ya no se puede corregir');
      return false;
    }
    var shape = model.quickShapeForPoints(info.points, s.size);
    if (!shape) {
      ui.toast('No se reconoce una forma geométrica');
      return false;
    }
    if (!undo()) { return false; }
    var snapshot = captureLayerSnapshot(s, info.layerId);
    if (!snapshot) {
      if (s.history.redo.length) { redo(); }
      ui.toast('No se pudo corregir la forma');
      return false;
    }
    var stroke = makeTemporaryStroke(info, snapshot);
    var previousTool = s.tool;
    s.tool = info.tool || 'brush';
    s.stroke = stroke;
    var ok = applyShapeToStroke(s, shape);
    s.tool = previousTool;
    if (!ok) {
      s.stroke = null;
      if (s.history.redo.length) { redo(); }
      ui.toast('No se pudo corregir la forma');
      return false;
    }
    stroke.quickApplied = true;
    finishHistory(s);
    s.lastStrokeInfo = {
      layerId: info.layerId,
      tool: info.tool || 'brush',
      points: stroke.points,
      rawPoints: stroke.rawPoints,
      quickType: shape.type,
      startedAt: now()
    };
    s.stroke = null;
    markDirty(s, info.layerId);
    s.needsRender = true;
    syncHistoryUi();
    if (PCW.panels) { PCW.panels.sync(); }
    ui.toast('Forma corregida: ' + shapeLabel(shape));
    return true;
  }

  function setQuickShape(on) {
    if (!st) { return; }
    st.quickShape = !!on;
    writeBoolPref(QUICK_PREF_KEY, st.quickShape);
    if (!st.quickShape) { clearQuickHold(); }
    if (PCW.panels && PCW.panels.syncQuickShape) { PCW.panels.syncQuickShape(); }
    ui.toast(st.quickShape ?
      'QuickShape activado: mantén el dedo al final del trazo' :
      'QuickShape desactivado');
  }

  function getQuickShape() {
    return st ? !!st.quickShape : readQuickShapePref();
  }

  function setCurveRecognition(on) {
    if (!st) { return; }
    st.curveRecognition = !!on;
    writeBoolPref(CURVE_PREF_KEY, st.curveRecognition);
    if (PCW.panels && PCW.panels.syncQuickShape) { PCW.panels.syncQuickShape(); }
    ui.toast(st.curveRecognition ?
      'Reconocimiento de curvas activado' :
      'Reconocimiento de curvas desactivado');
  }

  function getCurveRecognition() {
    return st ? !!st.curveRecognition : readCurvePref();
  }

  function openCanvasSettings() {
    if (!st) { return; }
    var s = st;
    var esc = util.escapeHtml;
    var anchors = [
      { id: 'top-left', label: 'Arriba izquierda' },
      { id: 'top', label: 'Arriba' },
      { id: 'top-right', label: 'Arriba derecha' },
      { id: 'left', label: 'Izquierda' },
      { id: 'center', label: 'Centro' },
      { id: 'right', label: 'Derecha' },
      { id: 'bottom-left', label: 'Abajo izquierda' },
      { id: 'bottom', label: 'Abajo' },
      { id: 'bottom-right', label: 'Abajo derecha' }
    ];
    var anchorHtml = '';
    var ai;
    for (ai = 0; ai < anchors.length; ai += 1) {
      anchorHtml += '<option value="' + anchors[ai].id + '"' +
        (anchors[ai].id === 'center' ? ' selected' : '') + '>' +
        anchors[ai].label + '</option>';
    }
    ui.modal({
      title: 'Configuración del lienzo',
      width: 430,
      body: '<label class="field"><span class="field-label" style="display:block;margin-bottom:6px;color:#9a9aa3;font-size:11px;">Nombre</span>' +
        '<input id="canvas-name" class="input" type="text" value="' + esc(s.doc.name) + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>' +
        '<label class="field" style="display:block;margin-top:12px"><span class="field-label" style="display:block;margin-bottom:6px;color:#9a9aa3;font-size:11px;">Color de fondo</span>' +
        '<input id="canvas-bg" class="input" type="text" value="' + esc(s.doc.background || '#ffffff') + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>' +
        '<div style="display:flex;margin-top:12px;">' +
        '<label class="field" style="flex:1;margin-right:8px;"><span class="field-label" style="display:block;margin-bottom:6px;color:#9a9aa3;font-size:11px;">Anchura</span>' +
        '<input id="canvas-width" class="input" type="number" min="64" max="4096" value="' + s.doc.width + '"></label>' +
        '<label class="field" style="flex:1;"><span class="field-label" style="display:block;margin-bottom:6px;color:#9a9aa3;font-size:11px;">Altura</span>' +
        '<input id="canvas-height" class="input" type="number" min="64" max="4096" value="' + s.doc.height + '"></label>' +
        '</div>' +
        '<label class="field" style="display:block;margin-top:12px"><span class="field-label" style="display:block;margin-bottom:6px;color:#9a9aa3;font-size:11px;">Anclaje al cambiar el tamaño</span>' +
        '<select id="canvas-anchor" class="select">' + anchorHtml + '</select></label>' +
        '<label class="field" style="display:flex;align-items:center;margin-top:12px;color:#c7c7cc;font-size:12px;">' +
        '<input id="canvas-scale" type="checkbox" style="margin-right:8px;"> Escalar el contenido al nuevo tamaño</label>' +
        '<p class="form-note">Dimensiones actuales: ' + s.doc.width + ' × ' + s.doc.height +
        '. Redimensionar cambia el lienzo de todas las capas y reinicia el historial. Para recortar a una zona, usa «Recortar a selección» en Acciones.</p>',
      focus: '#canvas-name',
      buttons: [
        { label: 'Cancelar' },
        {
          label: 'Aplicar',
          primary: true,
          onClick: function () {
            var nameEl = dom.id('canvas-name');
            var bgEl = dom.id('canvas-bg');
            var wEl = dom.id('canvas-width');
            var hEl = dom.id('canvas-height');
            var anchorEl = dom.id('canvas-anchor');
            var scaleEl = dom.id('canvas-scale');
            var rgb = util.parseHexColor(bgEl ? bgEl.value : '');
            if (!rgb) {
              ui.toast('Color de fondo inválido; usa #RRGGBB');
              return false;
            }
            var nw = parseInt(wEl ? wEl.value : '', 10);
            var nh = parseInt(hEl ? hEl.value : '', 10);
            if (nw !== s.doc.width || nh !== s.doc.height) {
              if (!applyCanvasResize(nw, nh, {
                anchor: anchorEl ? anchorEl.value : 'center',
                scale: !!(scaleEl && scaleEl.checked)
              })) {
                return false;
              }
            }
            var name = model.cleanName(nameEl ? nameEl.value : s.doc.name);
            s.doc.name = name;
            s.doc.background = util.rgbToHex(rgb.r, rgb.g, rgb.b);
            s.needsRender = true;
            scheduleSave();
            if (PCW.gallery) { PCW.gallery.refresh(); }
            ui.toast('Lienzo actualizado');
            return true;
          }
        }
      ]
    });
  }



  function rectOf(el) {
    return el.getBoundingClientRect();
  }

  function pointsFromTouches(touches, rect) {
    var out = [];
    var i;
    for (i = 0; i < touches.length; i += 1) {
      out.push({
        x: touches[i].clientX - rect.left,
        y: touches[i].clientY - rect.top,
        id: touches[i].identifier
      });
    }
    return out;
  }

  function midPoint(points) {
    var x = 0;
    var y = 0;
    var i;
    for (i = 0; i < points.length; i += 1) {
      x += points[i].x;
      y += points[i].y;
    }
    return { x: x / points.length, y: y / points.length };
  }

  function distance(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function angleOf(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  function snapshotView(s) {
    return {
      scale: s.view.scale,
      rotation: s.view.rotation,
      tx: s.view.tx,
      ty: s.view.ty
    };
  }

  function resetGestureBaseline(points) {
    if (!gesture) { return; }
    var a = points[0];
    var b = points[1] || points[0];
    gesture.startDist = Math.max(1, distance(a, b));
    gesture.startAngle = angleOf(a, b);
    gesture.startMid = midPoint(points);
    gesture.startView = snapshotView(st);
  }

  function startGesture(points) {
    if (!st) { return; }
    var i;
    gesture = {
      startTime: now(),
      startPoints: {},
      active: {},
      startDist: 1,
      startAngle: 0,
      startMid: midPoint(points),
      startView: snapshotView(st),
      moved: false,
      maxFingers: points.length,
      fingers: points.length
    };
    for (i = 0; i < points.length; i += 1) {
      gesture.startPoints[String(points[i].id)] = {
        x: points[i].x,
        y: points[i].y
      };
      gesture.active[String(points[i].id)] = true;
    }
    resetGestureBaseline(points);
  }

  /* Registra la posición inicial de cada dedo y marca el gesto como
     desplazado si alguno supera el margen de un toque. El umbral se mide
     por dedo: antes bastaba un temblor de 1-2 px para anular deshacer y
     rehacer en el iPad. */
  function trackGesturePoints(points) {
    if (!gesture) { return; }
    var i;
    var p;
    var start;
    for (i = 0; i < points.length; i += 1) {
      p = points[i];
      start = gesture.startPoints[String(p.id)];
      if (!start) {
        gesture.startPoints[String(p.id)] = { x: p.x, y: p.y };
        gesture.active[String(p.id)] = true;
      } else if (distance(p, start) > util.GESTURE_TAP_SLOP) {
        gesture.moved = true;
      }
    }
    if (points.length > gesture.maxFingers) {
      gesture.maxFingers = points.length;
    }
    gesture.fingers = points.length;
  }

  function updateGesture(points) {
    if (!gesture || points.length < 2) { return; }
    /* Un toque no debe mover ni ampliar el lienzo por el temblor natural
       de los dedos: solo se aplica la vista cuando ya hay desplazamiento. */
    if (!gesture.moved) { return; }
    var a = points[0];
    var b = points[1];
    var dist = Math.max(1, distance(a, b));
    var angle = angleOf(a, b);
    var mid = midPoint(points);
    var scale = gesture.startView.scale * (dist / gesture.startDist);
    scale = util.clamp(scale, 0.05, 8);
    var rotation = gesture.startView.rotation + (angle - gesture.startAngle);
    var tx = gesture.startView.tx + (mid.x - gesture.startMid.x);
    var ty = gesture.startView.ty + (mid.y - gesture.startMid.y);

    st.view.scale = scale;
    st.view.rotation = rotation;
    st.view.tx = tx;
    st.view.ty = ty;
    st.needsRender = true;
    updateBadge();
  }

  /* Descuenta los dedos que se levantan usando changedTouches. No depende de
     ev.touches, que en algunas versiones de Safari no es fiable al soltar. */
  function dropGestureTouches(ev) {
    if (!gesture) { return 0; }
    var changed = ev.changedTouches || [];
    var i;
    var id;
    for (i = 0; i < changed.length; i += 1) {
      id = String(changed[i].identifier);
      delete gesture.active[id];
    }
    if (!changed.length && (!ev.touches || ev.touches.length === 0)) {
      gesture.active = {};
    }
    var left = 0;
    for (id in gesture.active) {
      if (Object.prototype.hasOwnProperty.call(gesture.active, id)) {
        left += 1;
      }
    }
    return left;
  }

  function endGesture() {
    if (!gesture) { return; }
    var g = gesture;
    gesture = null;
    var action = util.tapHistoryAction(g.maxFingers, g.moved,
      now() - g.startTime);
    if (action === 'redo') {
      redo();
      return;
    }
    if (action === 'undo') {
      undo();
      return;
    }
    if (st && g.moved) {
      syncView(st);
      scheduleSave();
      updateBadge();
    }
  }

  function documentPoint(points, s) {
    var m = mat.invert(viewMatrix(s));
    return mat.apply(m, points[0].x, points[0].y);
  }

  /* Safari moderno y el Apple Pencil exponen la fuerza del toque en
     Touch.force. Safari 9 no siempre la ofrece; en ese caso se usa 0.5 y el
     tamaño no se altera por presión. */
  function readTouchDynamics(ev) {
    var touch = ev.touches && ev.touches.length ? ev.touches[0] : null;
    if (!touch) { return; }
    if (typeof touch.force === 'number' && touch.force > 0.001) {
      pointerPressure = util.clamp(touch.force, 0.05, 1);
    } else {
      pointerPressure = 0.5;
    }
    if (typeof touch.altitudeAngle === 'number') {
      pointerTiltX = touch.altitudeAngle;
    }
    if (typeof touch.azimuthAngle === 'number') {
      pointerTiltY = touch.azimuthAngle;
    }
  }

  function beginPendingStroke(p) {
    pendingStroke = null;
    beginStroke(p);
  }

  function onTouchStart(ev) {
    if (!st) { return; }
    ev.preventDefault();
    lastTouchTime = now();
    readTouchDynamics(ev);
    var rect = rectOf(viewCanvas);
    var points = pointsFromTouches(ev.touches, rect);

    if (points.length >= 2) {
      /* Cualquier segundo dedo cancela el trazo pendiente sin haber tomado
         la instantánea completa del lienzo: así el gesto de deshacer o
         rehacer responde rápido en el iPad mini 1. */
      pendingStroke = null;
      if (st.stroke || st.selectDraft || (st.transform && st.transform.drag)) {
        cancelStroke();
      }
      if (gesture) {
        trackGesturePoints(points);
        resetGestureBaseline(points);
      } else {
        startGesture(points);
      }
      return;
    }
    if (points.length === 1 && !gesture && !st.stroke && !st.selectDraft &&
        !(st.transform && st.transform.drag)) {
      var p = documentPoint(points, st);
      if (st.curveEdit) {
        beginCurveDrag(st, p);
        return;
      }
      if (st.tool === 'eyedropper' || st.tool === 'select' ||
          st.tool === 'transform') {
        beginStroke(p);
      } else if (inDoc(st, p)) {
        pendingStroke = { point: p, time: now() };
      }
    }
  }

  function onTouchMove(ev) {
    if (!st) { return; }
    ev.preventDefault();
    lastTouchTime = now();
    readTouchDynamics(ev);
    var rect = rectOf(viewCanvas);
    var points = pointsFromTouches(ev.touches, rect);
    if (gesture) {
      trackGesturePoints(points);
      if (points.length >= 2) { updateGesture(points); }
      return;
    }
    if (st.curveEdit && st.curveEdit.drag && points.length === 1) {
      updateCurveDrag(st, documentPoint(points, st));
      return;
    }
    if (pendingStroke && points.length === 1) {
      var p0 = documentPoint(points, st);
      if (distance(p0, pendingStroke.point) > PENDING_SLOP) {
        var start = pendingStroke.point;
        pendingStroke = null;
        beginStroke(start);
        if (st.stroke || st.selectDraft ||
            (st.transform && st.transform.drag)) {
          strokeTo(p0);
        }
      }
      return;
    }
    if (st.stroke && points.length === 1) {
      var p = documentPoint(points, st);
      strokeTo(p);
    } else if (points.length === 1 &&
        (st.selectDraft || (st.transform && st.transform.drag))) {
      var p2 = documentPoint(points, st);
      strokeTo(p2);
    } else if (st.stroke && points.length >= 2) {
      cancelStroke();
      startGesture(points);
    }
  }

  function onTouchEnd(ev) {
    if (!st) { return; }
    ev.preventDefault();
    lastTouchTime = now();
    if (gesture) {
      if (dropGestureTouches(ev) === 0) { endGesture(); }
      return;
    }
    if (pendingStroke) {
      if (!ev.touches || ev.touches.length === 0) {
        var p = pendingStroke.point;
        beginPendingStroke(p);
        if (st.stroke) { endStroke(); }
      }
      return;
    }
    if (st.stroke || st.selectDraft || (st.transform && st.transform.drag) ||
        (st.curveEdit && st.curveEdit.drag)) {
      if (!ev.touches || ev.touches.length === 0) { endStroke(); }
    }
  }

  function onTouchCancel(ev) {
    if (!st) { return; }
    ev.preventDefault();
    pendingStroke = null;
    if (gesture) { endGesture(); return; }
    if (st.stroke) { cancelStroke(); }
  }

  function onMouseDown(ev) {
    if (!st) { return; }
    if (now() - lastTouchTime < 700) { return; }
    if (ev.button !== 0) { return; }
    ev.preventDefault();
    var rect = rectOf(viewCanvas);
    var m = mat.invert(viewMatrix(st));
    var p = mat.apply(m, ev.clientX - rect.left, ev.clientY - rect.top);
    beginStroke(p);

    function move(e) {
      if (!st) { return; }
      var p2 = mat.apply(m, e.clientX - rect.left, e.clientY - rect.top);
      if (st.stroke) { strokeTo(p2); }
      else if (st.selectDraft || (st.transform && st.transform.drag)) { strokeTo(p2); }
    }

    function up() {
      document.removeEventListener('mousemove', move, false);
      document.removeEventListener('mouseup', up, false);
      if (st && (st.stroke || st.selectDraft ||
          (st.transform && st.transform.drag))) {
        endStroke();
      }
    }

    document.addEventListener('mousemove', move, false);
    document.addEventListener('mouseup', up, false);
  }

  function onWheel(ev) {
    if (!st) { return; }
    ev.preventDefault();
    var factor = ev.deltaY < 0 ? 1.12 : 0.89;
    st.view.scale = util.clamp(st.view.scale * factor, 0.05, 8);
    st.needsRender = true;
    updateBadge();
    scheduleSave();
  }

  /* -------------------------------------------------------------- guardado */

  function markDirty(s, layerId) {
    s.dirty[layerId] = true;
    s.dirtyGen += 1;
    s.doc.updatedAt = now();
    scheduleSave();
  }

  function scheduleSave() {
    if (!st) { return; }
    if (saveTimer) { clearTimeout(saveTimer); }
    saveTimer = setTimeout(function () {
      saveTimer = null;
      if (!st) { return; }
      if (st.stroke) {
        scheduleSave();
        return;
      }
      saveNow(st);
    }, 1600);
  }

  function buildRecord(s) {
    syncView(s);
    s.doc.updatedAt = now();
    var thumb = s.loading > 0 ? (s.doc.thumb || '') : makeThumb(s);
    var record = model.toRecord(s.doc, thumb);
    if (thumb) { s.doc.thumb = thumb; }
    return record;
  }

  function saveNow(s) {
    if (!s || !s.doc) { return; }
    if (s.saving) {
      s.savePending = true;
      return;
    }
    s.saving = true;
    var record = buildRecord(s);
    var layerData = {};
    var key;
    for (key in s.dirty) {
      if (Object.prototype.hasOwnProperty.call(s.dirty, key) && s.canvases[key]) {
        try {
          layerData[key] = s.canvases[key].toDataURL('image/png');
        } catch (e) {
          PCW.logError('studio:layer-data', e);
        }
      }
    }
    var removed = s.removedLayerIds.slice(0);
    var gen = s.dirtyGen;
    if (st === s) { ui.setSaveState('saving'); }

    storage.saveProject(record, {
      layerData: layerData,
      removedLayerIds: removed
    }, function (err) {
      s.saving = false;
      if (st === s) {
        if (err) {
          PCW.logError('studio:save', err);
          s.savePending = false;
          ui.setSaveState('error', 'No se pudo guardar');
          ui.toast('No se pudo guardar: ' + err.message, 3200);
        } else {
          if (s.dirtyGen === gen) {
            s.dirty = {};
          }
          if (removed.length) {
            var keep = [];
            var i;
            for (i = 0; i < s.removedLayerIds.length; i += 1) {
              if (removed.indexOf(s.removedLayerIds[i]) < 0) {
                keep.push(s.removedLayerIds[i]);
              }
            }
            s.removedLayerIds = keep;
          }
          ui.setSaveState('saved');
        }
        if (!err && (s.savePending || (s.dirtyGen !== gen))) {
          s.savePending = false;
          setTimeout(function () {
            if (st === s) { saveNow(s); }
          }, 700);
        }
      } else if (!err) {
        if (s.closing) {
          if (s.savePending || (s.dirtyGen !== gen)) {
            s.savePending = false;
            setTimeout(function () {
              if (s.closing) { saveNow(s); }
            }, 250);
          } else {
            s.canvases = {};
            s.ctxs = {};
            s.composite = null;
            s.smudgePatch = null;
            s.history = null;
            if (PCW.ui.currentScreen() === 'screen-gallery' && PCW.gallery) {
              PCW.gallery.refresh();
            }
          }
        } else if (PCW.ui.currentScreen() === 'screen-gallery' && PCW.gallery) {
          PCW.gallery.refresh();
        }
      }
    });
  }

  /* ----------------------------------------------------------------- open */

  function open(doc, layerData) {
    pendingStroke = null;
    gesture = null;
    if (st) {
      var previous = st;
      if (previous.transform) { applyTransform(); }
      if (previous.adjust) { cancelAdjust(); }
      previous.closing = true;
      st = null;
      stopLoop();
      saveNow(previous);
    }
    closeModalIfAny();
    st = {
      doc: doc,
      canvases: {},
      ctxs: {},
      activeLayerId: doc.activeLayerId,
      brush: model.resolveBrush(doc.brushId || 'pencil-6b'),
      size: util.clamp(doc.brushSize || 24, 1, 400),
      opacity: util.clamp(doc.brushOpacity || 85, 1, 100),
      color: doc.color || '#1c1c1e',
      tool: 'brush',
      view: {
        scale: (doc.view && doc.view.scale) || 1,
        rotation: (doc.view && doc.view.rotation) || 0,
        tx: (doc.view && doc.view.tx) || 0,
        ty: (doc.view && doc.view.ty) || 0,
        flipX: !!(doc.view && doc.view.flipX)
      },
      dirty: {},
      dirtyGen: 0,
      removedLayerIds: [],
      history: { undo: [], redo: [], bytes: 0 },
      composite: null,
      smudgePatch: null,
      stroke: null,
      selection: null,
      selectMode: 'rect',
      selectOp: 'new',
      selectDraft: null,
      transform: null,
      adjust: null,
      adjustTimer: null,
      dropThreshold: 12,
      symmetry: doc.symmetry || 'off',
      quickShape: readQuickShapePref(),
      curveRecognition: readCurvePref(),
      curveEdit: null,
      lastStrokeInfo: null,
      strokeBuffer: null,
      strokeBufferCtx: null,
      strokeMasked: null,
      strokeMaskedCtx: null,
      strokeView: null,
      strokeViewCtx: null,
      strokeBufferVersion: 0,
      strokeViewVersion: -1,
      needsRender: true,
      loading: 0,
      saving: false,
      savePending: false,
      historyWarned: false,
      badgeTimer: null
    };

    if (model.layerIndex(doc, doc.activeLayerId) < 0) {
      doc.activeLayerId = doc.layers[doc.layers.length - 1].id;
      st.activeLayerId = doc.activeLayerId;
    }

    var i;
    for (i = 0; i < doc.layers.length; i += 1) {
      createLayerCanvas(st, doc.layers[i]);
    }
    for (i = 0; i < doc.layers.length; i += 1) {
      if (layerData && layerData[doc.layers[i].id]) {
        loadLayerImage(st, doc.layers[i], layerData[doc.layers[i].id]);
      }
    }

    ui.showScreen('screen-studio');
    resizeCanvas();
    fit();
    updateResetLabel();

    syncSidebar();
    if (PCW.panels) { PCW.panels.sync(); }
    updateBadge();
    startLoop();
    requestRender();
    syncHistoryUi();
  }

  function closeModalIfAny() {
    if (PCW.ui && PCW.ui.isModalOpen()) { PCW.ui.closeModal(); }
  }

  function close() {
    var s = st;
    pendingStroke = null;
    gesture = null;
    if (!s) {
      ui.showScreen('screen-gallery');
      syncHistoryUi();
      return;
    }
    if (s.transform) { applyTransform(); }
    if (s.adjust) { cancelAdjust(); }
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    s.closing = true;
    st = null;
    stopLoop();
    saveNow(s);
    if (s.badgeTimer) { clearTimeout(s.badgeTimer); }
    s.composite = null;
    s.smudgePatch = null;
    s.history = null;
    if (viewCanvas) {
      viewCanvas.width = 1;
      viewCanvas.height = 1;
    }
    ui.showScreen('screen-gallery');
    syncHistoryUi();
    if (PCW.gallery) {
      PCW.gallery.refresh();
      setTimeout(function () { PCW.gallery.refresh(); }, 500);
    }
  }

  function flush() {
    if (!st) { return; }
    if (st.transform) { applyTransform(); }
    if (st.adjust) { cancelAdjust(); }
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveNow(st);
  }

  /* -------------------------------------------------------------- acciones */

  function setTool(tool) {
    if (!st) { return; }
    pendingStroke = null;
    st.tool = tool;
    syncToolButtons();
    updateBadge();
  }

  function syncToolButtons() {
    var map = {
      brush: 'btn-brush',
      smudge: 'btn-smudge',
      eraser: 'btn-eraser',
      eyedropper: 'btn-modify',
      select: 'btn-selection',
      transform: 'btn-transform'
    };
    var key;
    for (key in map) {
      if (Object.prototype.hasOwnProperty.call(map, key)) {
        var el = dom.id(map[key]);
        if (!el) { continue; }
        if (st && st.tool === key) {
          el.classList.add('is-active');
        } else {
          el.classList.remove('is-active');
        }
      }
    }
  }

  function setBrush(brushId, keepSize) {
    if (!st) { return; }
    var brush = model.resolveBrush(brushId);
    st.brush = brush;
    st.doc.brushId = brush.id;
    st.tool = 'brush';
    if (!keepSize) {
      st.size = brush.size;
      st.opacity = Math.round(brush.opacity * 100);
      st.doc.brushSize = st.size;
      st.doc.brushOpacity = st.opacity;
    }
    syncSidebar();
    if (PCW.panels) { PCW.panels.sync(); }
    scheduleSave();
  }

  function setSize(value) {
    if (!st) { return; }
    st.size = util.clamp(Math.round(value), 1, 400);
    st.doc.brushSize = st.size;
    syncSidebar();
    scheduleSave();
  }

  function setOpacity(value) {
    if (!st) { return; }
    st.opacity = util.clamp(Math.round(value), 1, 100);
    st.doc.brushOpacity = st.opacity;
    syncSidebar();
    scheduleSave();
  }

  /* Estudio de pincel: los ajustes se guardan por pincel y sobreviven al
     reinicio. «Restablecer» vuelve a los valores de la biblioteca. */
  var BRUSH_SETTINGS = [
    { key: 'size', label: 'Tamaño', min: 1, max: 400, scale: 1, unit: 'px' },
    { key: 'opacity', label: 'Opacidad', min: 1, max: 100, scale: 0.01, unit: '%' },
    { key: 'hardness', label: 'Dureza', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'spacing', label: 'Espaciado', min: 1, max: 50, scale: 0.01, unit: '%' },
    { key: 'jitter', label: 'Dispersión lateral', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'scatter', label: 'Dispersión longitudinal', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'taper', label: 'Afinado del trazo', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'grain', label: 'Grano', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'streak', label: 'Cerdas / vetas', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'speed', label: 'Grosor por velocidad', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'stabilize', label: 'Estabilización', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'streamline', label: 'Suavizado StreamLine', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'motionFilter', label: 'Filtro de movimiento', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'shapeCorrection', label: 'Corrección geométrica', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'pressure', label: 'Presión del lápiz', min: 0, max: 100, scale: 0.01, unit: '%' }
  ];

  function brushSettingDef(key) {
    var i;
    for (i = 0; i < BRUSH_SETTINGS.length; i += 1) {
      if (BRUSH_SETTINGS[i].key === key) { return BRUSH_SETTINGS[i]; }
    }
    return null;
  }

  function brushSettingDisplay(key) {
    if (!st) { return 0; }
    var b = st.brush;
    /* Tamaño y opacidad viven en el estado de la herramienta; el resto son
       parámetros del pincel. La barra lateral y el estudio deben mostrar el
       mismo valor. */
    if (key === 'size') { return Math.round(st.size); }
    if (key === 'opacity') { return Math.round(st.opacity); }
    return Math.round((b[key] || 0) * 100);
  }

  function getBrushSettings() {
    var out = [];
    var i;
    for (i = 0; i < BRUSH_SETTINGS.length; i += 1) {
      out.push({
        key: BRUSH_SETTINGS[i].key,
        label: BRUSH_SETTINGS[i].label,
        min: BRUSH_SETTINGS[i].min,
        max: BRUSH_SETTINGS[i].max,
        unit: BRUSH_SETTINGS[i].unit,
        value: brushSettingDisplay(BRUSH_SETTINGS[i].key)
      });
    }
    return out;
  }

  function setBrushSetting(key, displayValue) {
    if (!st) { return; }
    var def = brushSettingDef(key);
    if (!def) { return; }
    var shown = util.clamp(Math.round(displayValue), def.min, def.max);
    var real = shown * def.scale;
    model.setBrushOverride(st.brush.id, key, real);
    st.brush = model.resolveBrush(st.brush.id);
    if (key === 'size') {
      st.size = shown;
      st.doc.brushSize = shown;
    } else if (key === 'opacity') {
      st.opacity = shown;
      st.doc.brushOpacity = shown;
    }
    syncSidebar();
    if (PCW.panels && PCW.panels.syncBrushSettings) { PCW.panels.syncBrushSettings(); }
    scheduleSave();
  }

  function resetBrushSettings() {
    if (!st) { return; }
    model.clearBrushOverride(st.brush.id);
    st.brush = model.resolveBrush(st.brush.id);
    st.size = util.clamp(Math.round(st.brush.size), 1, 400);
    st.opacity = util.clamp(Math.round(st.brush.opacity * 100), 1, 100);
    st.doc.brushSize = st.size;
    st.doc.brushOpacity = st.opacity;
    syncSidebar();
    if (PCW.panels && PCW.panels.syncBrushSettings) { PCW.panels.syncBrushSettings(); }
    scheduleSave();
    ui.toast('Pincel restablecido');
  }

  function setColor(hex, commit) {
    if (!st) { return; }
    var rgb = util.parseHexColor(hex);
    if (!rgb) { return; }
    var clean = util.rgbToHex(rgb.r, rgb.g, rgb.b);
    st.color = clean;
    st.doc.color = clean;
    syncSidebar();
    if (PCW.panels) {
      PCW.panels.syncColor();
      if (commit) { PCW.panels.addRecentColor(clean); }
    }
    if (commit) { scheduleSave(); }
  }

  function syncSidebar() {
    if (!st) { return; }
    var sizeEl = dom.id('size-value');
    var opEl = dom.id('opacity-value');
    dom.setText(sizeEl, String(st.size));
    dom.setText(opEl, String(st.opacity));
    if (sizeSlider) { sizeSlider.setValue(st.size, true); }
    if (opacitySlider) { opacitySlider.setValue(st.opacity, true); }

    var dot = dom.id('brush-preview-dot');
    if (dot) {
      var d = util.clamp(st.size, 4, 40);
      dot.style.width = d + 'px';
      dot.style.height = d + 'px';
      dot.style.background = st.color;
      dot.style.boxShadow = '0 0 ' + Math.round((1 - st.brush.hardness) * 10) +
        'px rgba(255,255,255,0.12)';
      dot.style.borderColor = 'rgba(255,255,255,0.28)';
    }
    var fill = dom.id('color-chip-fill');
    if (fill) { fill.style.background = st.color; }
    syncToolButtons();
    updateBadge();
  }

  /* --------------------------------------------------------------- capas UI */

  function addLayer() {
    if (!st) { return; }
    var layer = model.addLayer(st.doc, {});
    if (!layer) {
      ui.toast('Límite de capas alcanzado para este tamaño');
      return;
    }
    createLayerCanvas(st, layer);
    st.activeLayerId = layer.id;
    st.dirty[layer.id] = true;
    st.dirtyGen += 1;
    st.needsRender = true;
    if (PCW.panels) { PCW.panels.sync(); }
    scheduleSave();
    ui.toast('Capa añadida');
  }

  function duplicateLayer() {
    if (!st) { return; }
    var source = activeLayer(st);
    if (!source) { return; }
    var layer = model.duplicateLayerMeta(st.doc, source.id);
    if (!layer) {
      ui.toast('Límite de capas alcanzado para este tamaño');
      return;
    }
    var copyCanvas = createLayerCanvas(st, layer);
    var src = st.canvases[source.id];
    if (src) {
      copyCanvas.getContext('2d').drawImage(src, 0, 0);
    }
    st.activeLayerId = layer.id;
    st.dirty[layer.id] = true;
    st.dirtyGen += 1;
    st.needsRender = true;
    if (PCW.panels) { PCW.panels.sync(); }
    scheduleSave();
    ui.toast('Capa duplicada');
  }

  function removeLayer() {
    if (!st) { return; }
    var layer = activeLayer(st);
    if (!layer) { return; }
    if (st.doc.layers.length <= 1) {
      ui.toast('Debe quedar al menos una capa');
      return;
    }
    var id = layer.id;
    if (!model.removeLayer(st.doc, id)) { return; }
    delete st.canvases[id];
    delete st.ctxs[id];
    delete st.dirty[id];
    st.removedLayerIds.push(id);
    purgeLayerHistory(st, id);
    st.activeLayerId = st.doc.activeLayerId;
    st.needsRender = true;
    if (PCW.panels) { PCW.panels.sync(); }
    scheduleSave();
    ui.toast('Capa eliminada');
  }

  function moveLayer(direction) {
    if (!st) { return; }
    var layer = activeLayer(st);
    if (!layer) { return; }
    if (!model.moveLayer(st.doc, layer.id, direction)) { return; }
    st.needsRender = true;
    if (PCW.panels) { PCW.panels.sync(); }
    scheduleSave();
  }

  /* ------------------------------------------------------ importar imagen */

  var IMAGE_MAX_BYTES = 20 * 1024 * 1024;

  function imageLayerName(fileName) {
    var base = String(fileName || '').replace(/\.[^.\/\\]+$/, '')
      .replace(/^\s+|\s+$/g, '');
    if (!base) { base = 'Imagen'; }
    if (base.length > 24) { base = base.substring(0, 24); }
    return base;
  }

  function pushImageHistory(s, layer, x, y, w, h) {
    if (w * h * 8 > model.HISTORY_BYTES * 0.8) {
      if (!s.historyWarned) {
        s.historyWarned = true;
        ui.toast('Imagen insertada; es demasiado grande para deshacer.', 3200);
      }
      return;
    }
    var ctx = layerCtx(s, layer.id);
    if (!ctx) { return; }
    var after;
    var before;
    try {
      after = ctx.getImageData(x, y, w, h);
      before = ctx.createImageData(w, h);
    } catch (e) {
      PCW.logError('studio:import-history', e);
      return;
    }
    clearRedo(s);
    var bytes = before.data.length + after.data.length;
    s.history.undo.push({
      layerId: layer.id,
      rect: { x: x, y: y, w: w, h: h },
      before: before,
      after: after,
      bytes: bytes
    });
    s.history.bytes += bytes;
    trimHistory(s);
    syncHistoryUi();
  }

  function placeImage(img, fileName) {
    if (!st) { return; }
    var layer = model.addLayer(st.doc, { name: imageLayerName(fileName) });
    if (!layer) {
      ui.toast('Límite de capas alcanzado para este tamaño');
      return;
    }
    var canvas = createLayerCanvas(st, layer);
    var ctx = canvas.getContext('2d');
    var dw = st.doc.width;
    var dh = st.doc.height;
    var scale = Math.min(1, dw / img.width, dh / img.height);
    var w = Math.max(1, Math.round(img.width * scale));
    var h = Math.max(1, Math.round(img.height * scale));
    var x = Math.round((dw - w) / 2);
    var y = Math.round((dh - h) / 2);
    try {
      ctx.drawImage(img, x, y, w, h);
    } catch (e) {
      PCW.logError('studio:import-draw', e);
      model.removeLayer(st.doc, layer.id);
      delete st.canvases[layer.id];
      delete st.ctxs[layer.id];
      st.activeLayerId = st.doc.activeLayerId;
      ui.toast('No se pudo colocar la imagen');
      return;
    }
    st.activeLayerId = layer.id;
    st.dirty[layer.id] = true;
    st.dirtyGen += 1;
    st.needsRender = true;
    pushImageHistory(st, layer, x, y, w, h);
    if (PCW.panels) { PCW.panels.sync(); }
    scheduleSave();
    ui.toast('Imagen insertada en ' + layer.name);
  }

  function importImage(file) {
    if (!st || !file) { return; }
    var type = String(file.type || '');
    if (type && type.indexOf('image/') !== 0) {
      ui.toast('Ese archivo no es una imagen');
      return;
    }
    if (file.size && file.size > IMAGE_MAX_BYTES) {
      ui.toast('La imagen supera 20 MB; usa una copia más pequeña', 3200);
      return;
    }
    if (!model.canAddLayer(st.doc)) {
      ui.toast('Límite de capas alcanzado para este tamaño');
      return;
    }
    var pending = st;
    ui.toast('Insertando imagen…', 2200);
    var reader = new FileReader();
    reader.onerror = function () {
      PCW.logError('studio:import-read', reader.error);
      ui.toast('No se pudo leer el archivo');
    };
    reader.onload = function () {
      if (st !== pending) { return; }
      var img = new Image();
      img.onload = function () {
        img.onload = null;
        img.onerror = null;
        if (st !== pending) { return; }
        placeImage(img, file.name);
      };
      img.onerror = function () {
        ui.toast('La imagen no se pudo decodificar');
      };
      try {
        img.src = String(reader.result);
      } catch (e) {
        PCW.logError('studio:import-src', e);
        ui.toast('La imagen no se pudo decodificar');
      }
    };
    try {
      reader.readAsDataURL(file);
    } catch (e2) {
      PCW.logError('studio:import-open', e2);
      ui.toast('El navegador no permite leer ese archivo');
    }
  }

  function setActiveLayer(layerId) {
    if (!st) { return; }
    if (model.layerIndex(st.doc, layerId) < 0) { return; }
    if (st.transform) { applyTransform(); }
    if (st.adjust) { cancelAdjust(); }
    st.activeLayerId = layerId;
    st.doc.activeLayerId = layerId;
    if (PCW.panels) { PCW.panels.sync(); }
    scheduleSave();
  }

  function setLayerVisible(layerId, visible) {
    if (!st) { return; }
    var layer = model.findLayer(st.doc, layerId);
    if (!layer) { return; }
    layer.visible = !!visible;
    st.needsRender = true;
    if (PCW.panels) { PCW.panels.sync(); }
    scheduleSave();
  }

  function setLayerOpacity(value) {
    if (!st) { return; }
    var layer = activeLayer(st);
    if (!layer) { return; }
    layer.opacity = util.clamp(value / 100, 0, 1);
    st.needsRender = true;
    if (PCW.panels) { PCW.panels.syncActive(); }
    scheduleSave();
  }

  function setLayerBlend(blend) {
    if (!st) { return; }
    var layer = activeLayer(st);
    if (!layer) { return; }
    layer.blend = blend;
    st.needsRender = true;
    if (PCW.panels) { PCW.panels.syncActive(); }
    scheduleSave();
  }

  function getLayerCanvas(layerId) {
    return st ? st.canvases[layerId] : null;
  }

  function getState() {
    return st;
  }

  /* -------------------------------------------------------------- exportar */

  function exportImage(kind) {
    if (!st) { return; }
    var label = kind === 'jpeg' ? 'Compartir JPEG' : 'Compartir PNG';
    var pending = PCW.env.hasDownload ? null : ui.openPending(label);
    ui.toast('Generando ' + (kind === 'jpeg' ? 'JPEG' : 'PNG') + '…', 1600);
    var c = document.createElement('canvas');
    c.width = st.doc.width;
    c.height = st.doc.height;
    var ctx = c.getContext('2d');
    composeTo(st, ctx, c.width, c.height, true);
    var url;
    try {
      if (kind === 'jpeg') {
        url = c.toDataURL('image/jpeg', 0.92);
      } else {
        url = c.toDataURL('image/png');
      }
    } catch (e) {
      if (pending) { try { pending.close(); } catch (e0) { /* ignorado */ } }
      PCW.logError('studio:export-image', e);
      ui.toast('No se pudo generar la imagen: ' + e.message, 3200);
      return;
    }
    ui.deliverImage(url, safeName(st.doc.name) + (kind === 'jpeg' ? '.jpg' : '.png'),
      label, pending);
  }

  function exportProject() {
    if (!st) { return; }
    var pending = PCW.env.hasDownload ? null : ui.openPending('Exportar proyecto');
    ui.toast('Preparando respaldo…', 1800);
    var record = buildRecord(st);
    var layers = [];
    var i;
    for (i = 0; i < st.doc.layers.length; i += 1) {
      var layer = st.doc.layers[i];
      var data = '';
      if (st.canvases[layer.id]) {
        try {
          data = st.canvases[layer.id].toDataURL('image/png');
        } catch (e) {
          PCW.logError('studio:export-layer', e);
        }
      }
      layers.push({
        id: layer.id,
        name: layer.name,
        data: data
      });
    }
    var payload = {
      schema: model.SCHEMA,
      format: 'pcw-json-png-dataurl',
      exportedAt: Date.now(),
      note: 'Respaldo de Procreate Web (shell). Capas PNG en data URL.',
      doc: record,
      layers: layers
    };
    ui.deliverText(JSON.stringify(payload), safeName(st.doc.name) + '.pcw',
      'application/json', 'Exportar proyecto', pending);
  }

  function flipView() {
    if (!st) { return; }
    st.view.flipX = !st.view.flipX;
    st.needsRender = true;
    syncView(st);
    updateBadge();
    scheduleSave();
    ui.toast('Vista volteada (solo vista)');
  }

  function rotateView() {
    if (!st) { return; }
    st.view.rotation += Math.PI / 2;
    st.needsRender = true;
    syncView(st);
    updateBadge();
    updateResetLabel();
    scheduleSave();
  }

  function updateResetLabel() {
    if (!st) { return; }
    var deg = Math.round((st.view.rotation * 180 / Math.PI) % 360);
    if (deg < 0) { deg += 360; }
    var btn = dom.id('btn-reset-view');
    if (btn) { btn.textContent = deg + '°'; }
  }

  /* ------------------------------------------------------------------ init */

  function resize() {
    if (!st) { return; }
    resizeCanvas();
    st.needsRender = true;
  }

  function init() {
    if (inited) { return; }
    inited = true;
    stage = dom.id('stage');
    viewCanvas = dom.id('view-canvas');
    badge = dom.id('stage-badge');
    if (!viewCanvas) { return; }
    viewCtx = viewCanvas.getContext('2d');

    sizeSlider = ui.initSlider('size-slider', {
      min: 1,
      max: 400,
      value: 24,
      scale: 'log',
      step: 1,
      label: 'Tamaño',
      onChange: function (v) {
        if (st) { setSize(v); }
      }
    });
    opacitySlider = ui.initSlider('opacity-slider', {
      min: 1,
      max: 100,
      value: 85,
      scale: 'linear',
      step: 1,
      label: 'Opacidad',
      onChange: function (v) {
        if (st) { setOpacity(v); }
      }
    });

    dom.on(viewCanvas, 'touchstart', onTouchStart, false);
    dom.on(viewCanvas, 'touchmove', onTouchMove, false);
    dom.on(viewCanvas, 'touchend', onTouchEnd, false);
    dom.on(viewCanvas, 'touchcancel', onTouchCancel, false);
    dom.on(viewCanvas, 'mousedown', onMouseDown, false);
    dom.on(viewCanvas, 'wheel', onWheel, false);

    dom.on(dom.id('btn-gallery'), 'click', close);
    dom.on(dom.id('btn-fit'), 'click', fit);
    dom.on(dom.id('btn-reset-view'), 'click', resetView);
    dom.on(dom.id('btn-smudge'), 'click', function () { setTool('smudge'); });
    dom.on(dom.id('btn-eraser'), 'click', function () { setTool('eraser'); });
    dom.on(dom.id('btn-modify'), 'click', eyedropper);

    root.addEventListener('resize', resize, false);
    root.addEventListener('orientationchange', function () {
      setTimeout(resize, 220);
    }, false);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { flush(); }
    }, false);

    root.addEventListener('beforeunload', function () {
      flush();
    }, false);

    if (PCW.events) {
      PCW.events.on('error', function (payload) {
        if (payload && payload.context) {
          /* Los errores quedan en PCW.logs para el informe de diagnóstico. */
        }
      });
    }
  }

  PCW.paint = {
    preview: function (canvas, brush) {
      if (!canvas) { return; }
      var w = canvas.width;
      var h = canvas.height;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f4f4f4';
      ctx.fillRect(0, 0, w, h);
      var radius = Math.min(brush.size / 2, h * 0.34);
      var sprite = getStamp(brush, '#2b2b2b', 'brush', radius);
      var x;
      for (x = 8; x < w - 6; x += Math.max(1.2, radius * 0.22)) {
        var t = (x - 8) / Math.max(1, w - 14);
        var y = h / 2 + Math.sin(t * Math.PI * 2.4) * h * 0.18;
        var alpha = 0.55 + 0.35 * Math.sin(t * Math.PI);
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
      }
      ctx.globalAlpha = 1;
    },
    stamp: getStamp
  };

  PCW.studio = {
    init: init,
    open: open,
    close: close,
    flush: flush,
    fit: fit,
    resetView: resetView,
    resize: resize,
    requestRender: requestRender,
    updateBadge: updateBadge,
    setTool: setTool,
    setBrush: setBrush,
    setSize: setSize,
    setOpacity: setOpacity,
    getBrushSettings: getBrushSettings,
    setBrushSetting: setBrushSetting,
    resetBrushSettings: resetBrushSettings,
    setColor: setColor,
    addRecentColor: function (hex) {
      if (!st) { return; }
      var list = [hex];
      var i;
      for (i = 0; i < st.doc.recentColors.length; i += 1) {
        if (st.doc.recentColors[i] !== hex) {
          list.push(st.doc.recentColors[i]);
        }
        if (list.length >= 16) { break; }
      }
      st.doc.recentColors = list;
      scheduleSave();
    },
    undo: undo,
    redo: redo,
    canUndo: function () { return historyCounts().undo > 0; },
    canRedo: function () { return historyCounts().redo > 0; },
    historyInfo: historyCounts,
    addLayer: addLayer,
    importImage: importImage,
    duplicateLayer: duplicateLayer,
    removeLayer: removeLayer,
    moveLayer: moveLayer,
    mergeDown: mergeDown,
    mergeVisible: mergeVisible,
    applyCanvasResize: applyCanvasResize,
    cropToSelection: cropToSelection,
    setSymmetry: setSymmetry,
    getSymmetry: function () { return st ? (st.symmetry || 'off') : 'off'; },
    setQuickShape: setQuickShape,
    getQuickShape: getQuickShape,
    setCurveRecognition: setCurveRecognition,
    getCurveRecognition: getCurveRecognition,
    correctLastShape: correctLastShape,
    startCurveEdit: startCurveEdit,
    applyCurveEdit: applyCurveEdit,
    cancelCurveEdit: cancelCurveEdit,
    hasCurveEdit: function () { return !!(st && st.curveEdit); },
    setActiveLayer: setActiveLayer,
    setLayerVisible: setLayerVisible,
    setLayerOpacity: setLayerOpacity,
    setLayerBlend: setLayerBlend,
    toggleAlphaLock: toggleAlphaLock,
    getLayerCanvas: getLayerCanvas,
    getState: getState,
    getActiveLayer: function () { return st ? activeLayer(st) : null; },
    setSelectMode: setSelectMode,
    setSelectOp: setSelectOp,
    invertSelection: invertSelection,
    clearSelection: clearSelection,
    duplicateSelectionToLayer: duplicateSelectionToLayer,
    hasSelection: function () { return !!(st && st.selection); },
    startTransform: startTransform,
    applyTransform: applyTransform,
    cancelTransform: cancelTransform,
    flipTransform: flipTransform,
    resetTransform: resetTransform,
    startAdjust: startAdjust,
    setAdjustValue: setAdjustValue,
    setAdjustPreset: setAdjustPreset,
    applyAdjust: applyAdjust,
    cancelAdjust: cancelAdjust,
    fillLayer: fillLayer,
    fillSelection: fillSelection,
    clearActiveLayer: clearActiveLayer,
    colorDrop: colorDrop,
    setDropThreshold: setDropThreshold,
    getDropThreshold: resetDropThreshold,
    pointFromClient: pointFromClient,
    openCanvasSettings: openCanvasSettings,
    exportImage: exportImage,
    exportProject: exportProject,
    flipView: flipView,
    rotateView: rotateView,
    updateResetLabel: updateResetLabel,
    syncSidebar: syncSidebar,
    syncToolButtons: syncToolButtons
  };

})(typeof window !== 'undefined' ? window : this);

/* ---- 60-panels.js ---- */

/* ==========================================================================
   60 — Paneles: capas, color, biblioteca de pinceles, acciones y Quick Menu.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});
  var dom = PCW.dom;
  var util = PCW.util;
  var model = PCW.model;
  var ui = PCW.ui;

  var inited = false;
  var currentSet = 'Todos';
  var wheelHsv = { h: 210, s: 0.1, v: 0.12 };
  var dragging = false;
  var dragMode = null;

  var WHEEL_SIZE = 260;
  var WHEEL_CENTER = 130;
  var RING_OUTER = 129;
  var RING_INNER = 99;
  var SQUARE_SIZE = 176;
  var SQUARE_X = 42;
  var SQUARE_Y = 42;
  var wheelRing = null;

  function findUp(node, attr) {
    var el = node;
    while (el && el !== document) {
      if (el.getAttribute && el.getAttribute(attr) != null) { return el; }
      el = el.parentNode;
    }
    return null;
  }

  function studioState() {
    return PCW.studio ? PCW.studio.getState() : null;
  }

  function activeLayer() {
    return PCW.studio ? PCW.studio.getActiveLayer() : null;
  }

  /* ---------------------------------------------------------------- capas */

  function eyeSvg(visible) {
    if (!visible) {
      return '<svg class="ico" viewBox="0 0 24 24"><path d="M3 3l18 18"/>' +
        '<path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-2.4 3.1"/>' +
        '<path d="M6.3 7.9A17 17 0 0 0 3 12s4 6 9 6a9 9 0 0 0 4.2-1"/></svg>';
    }
    return '<svg class="ico" viewBox="0 0 24 24"><path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12z"/>' +
      '<circle cx="12" cy="12" r="2.6"/></svg>';
  }

  function drawLayerThumb(canvasEl, layer) {
    if (!canvasEl) { return; }
    var s = studioState();
    if (!s) { return; }
    var cw = canvasEl.width;
    var ch = canvasEl.height;
    var ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, cw, ch);
    var cell = 7;
    var x;
    var y;
    for (y = 0; y < ch; y += cell) {
      for (x = 0; x < cw; x += cell) {
        var odd = ((x / cell) + (y / cell)) % 2;
        ctx.fillStyle = odd ? '#dcdcdc' : '#f4f4f4';
        ctx.fillRect(x, y, cell, cell);
      }
    }
    var source = PCW.studio.getLayerCanvas(layer.id);
    if (!source) { return; }
    var scale = Math.min(cw / s.doc.width, ch / s.doc.height);
    var dw = s.doc.width * scale;
    var dh = s.doc.height * scale;
    ctx.globalAlpha = layer.visible === false ? 0.3 : 1;
    ctx.drawImage(source, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    ctx.globalAlpha = 1;
  }

  function renderLayers() {
    var s = studioState();
    var list = dom.id('layers-list');
    dom.empty(list);
    if (!s) { return; }
    var i;
    for (i = s.doc.layers.length - 1; i >= 0; i -= 1) {
      var layer = s.doc.layers[i];
      var row = dom.create('div', 'layer-row' +
        (layer.id === s.activeLayerId ? ' is-active' : ''));
      row.setAttribute('data-layer', layer.id);

      var vis = dom.create('button', 'layer-vis' +
        (layer.visible === false ? ' is-off' : ''));
      vis.type = 'button';
      vis.setAttribute('data-vis', layer.id);
      vis.setAttribute('aria-label', layer.visible === false ? 'Mostrar capa' : 'Ocultar capa');
      vis.innerHTML = eyeSvg(layer.visible !== false);

      var thumb = document.createElement('canvas');
      thumb.className = 'layer-thumb';
      thumb.width = 58;
      thumb.height = 44;

      var info = dom.create('div', 'layer-info');
      info.appendChild(dom.create('span', 'layer-name', layer.name));
      info.appendChild(dom.create('span', 'layer-sub',
        model.blendLabel(layer.blend) + ' · ' + Math.round(layer.opacity * 100) + '%'));

      row.appendChild(vis);
      row.appendChild(thumb);
      row.appendChild(info);
      list.appendChild(row);
      drawLayerThumb(thumb, layer);
    }
  }

  function updateThumbs() {
    var s = studioState();
    if (!s) { return; }
    var rows = dom.qsa('.layer-row');
    var i;
    for (i = 0; i < rows.length; i += 1) {
      var layerId = rows[i].getAttribute('data-layer');
      var layer = model.findLayer(s.doc, layerId);
      if (!layer) { continue; }
      drawLayerThumb(dom.qs('canvas', rows[i]), layer);
    }
  }

  function syncLayerControls() {
    var s = studioState();
    if (!s) { return; }
    var layer = activeLayer();
    if (!layer) { return; }
    var blend = dom.id('layer-blend');
    var opacity = dom.id('layer-opacity');
    var label = dom.id('layer-opacity-value');
    if (blend) { blend.value = layer.blend || 'source-over'; }
    if (opacity) { opacity.value = Math.round(layer.opacity * 100); }
    if (label) { label.textContent = Math.round(layer.opacity * 100) + '%'; }
    var lock = dom.id('btn-alpha-lock');
    if (lock) {
      lock.textContent = 'Bloqueo alfa: ' + (layer.alphaLock ? 'activado' : 'desactivado');
      if (layer.alphaLock) { lock.classList.add('is-on'); }
      else { lock.classList.remove('is-on'); }
    }
  }

  function updateActiveSub() {
    var s = studioState();
    if (!s) { return; }
    var layer = activeLayer();
    if (!layer) { return; }
    var rows = dom.qsa('.layer-row');
    var text = model.blendLabel(layer.blend) + ' · ' +
      Math.round(layer.opacity * 100) + '%';
    var i;
    for (i = 0; i < rows.length; i += 1) {
      if (rows[i].getAttribute('data-layer') === layer.id) {
        var sub = dom.qs('.layer-sub', rows[i]);
        if (sub) { sub.textContent = text; }
        return;
      }
    }
  }

  function syncActive() {
    syncLayerControls();
    updateActiveSub();
  }

  function sync() {
    var s = studioState();
    if (!s) { return; }
    syncLayerControls();
    renderLayers();
    syncColor();
    if (ui.isPanelOpen('panel-brushes')) { renderBrushes(); }
    if (ui.isPanelOpen('panel-brush-settings')) { renderBrushSettings(); }
    syncQuickShape();
  }

  /* ---------------------------------------------------------------- color */

  function hsvHex() {
    return util.hsvToHex(wheelHsv.h, wheelHsv.s, wheelHsv.v);
  }

  function ensureRing() {
    if (wheelRing) { return wheelRing; }
    var c = document.createElement('canvas');
    c.width = WHEEL_SIZE;
    c.height = WHEEL_SIZE;
    var g = c.getContext('2d');
    var i;
    var segments = 180;
    for (i = 0; i < segments; i += 1) {
      var a0 = (i * 360 / segments) * Math.PI / 180;
      var a1 = ((i + 1) * 360 / segments) * Math.PI / 180 + 0.012;
      g.beginPath();
      g.arc(WHEEL_CENTER, WHEEL_CENTER, (RING_OUTER + RING_INNER) / 2, a0, a1, false);
      g.lineWidth = RING_OUTER - RING_INNER;
      g.strokeStyle = 'hsl(' + Math.round(i * 360 / segments) + ',88%,52%)';
      g.stroke();
    }
    wheelRing = c;
    return c;
  }

  function drawWheel() {
    var canvasEl = dom.id('color-wheel');
    if (!canvasEl) { return; }
    var ctx = canvasEl.getContext('2d');
    var size = WHEEL_SIZE;
    var cx = WHEEL_CENTER;
    var cy = WHEEL_CENTER;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(ensureRing(), 0, 0);
    ctx.fillStyle = 'hsl(' + Math.round(wheelHsv.h) + ',100%,50%)';
    ctx.fillRect(SQUARE_X, SQUARE_Y, SQUARE_SIZE, SQUARE_SIZE);

    var white = ctx.createLinearGradient(SQUARE_X, 0, SQUARE_X + SQUARE_SIZE, 0);
    white.addColorStop(0, 'rgba(255,255,255,1)');
    white.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = white;
    ctx.fillRect(SQUARE_X, SQUARE_Y, SQUARE_SIZE, SQUARE_SIZE);

    var black = ctx.createLinearGradient(0, SQUARE_Y, 0, SQUARE_Y + SQUARE_SIZE);
    black.addColorStop(0, 'rgba(0,0,0,0)');
    black.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = black;
    ctx.fillRect(SQUARE_X, SQUARE_Y, SQUARE_SIZE, SQUARE_SIZE);

    var hr = (RING_OUTER + RING_INNER) / 2;
    var ha = wheelHsv.h * Math.PI / 180;
    var hx = cx + Math.cos(ha) * hr;
    var hy = cy + Math.sin(ha) * hr;
    ctx.beginPath();
    ctx.arc(hx, hy, 8, 0, Math.PI * 2, false);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, hy, 7, 0, Math.PI * 2, false);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    var sx = SQUARE_X + wheelHsv.s * SQUARE_SIZE;
    var sy = SQUARE_Y + (1 - wheelHsv.v) * SQUARE_SIZE;
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2, false);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2, false);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  function syncColor() {
    var s = studioState();
    if (!s) { return; }
    var hex = s.color || '#1c1c1e';
    var input = dom.id('color-hex');
    var swatch = dom.id('color-swatch');
    if (input && input !== document.activeElement) { input.value = hex; }
    if (swatch) { swatch.style.background = hex; }
    if (!dragging) {
      var rgb = util.parseHexColor(hex);
      if (rgb) { wheelHsv = util.rgbToHsv(rgb.r, rgb.g, rgb.b); }
    }
    if (ui.isPanelOpen('panel-color')) { drawWheel(); }
    if (!dragging) { renderSwatches(); }
  }

  function applyWheel() {
    PCW.studio.setColor(hsvHex(), false);
  }

  function wheelModeAt(x, y) {
    var dx = x - WHEEL_CENTER;
    var dy = y - WHEEL_CENTER;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d >= RING_INNER && d <= RING_OUTER + 6) { return 'hue'; }
    if (x >= SQUARE_X && x <= SQUARE_X + SQUARE_SIZE &&
        y >= SQUARE_Y && y <= SQUARE_Y + SQUARE_SIZE) {
      return 'sv';
    }
    return null;
  }

  function wheelPoint(ev) {
    var canvasEl = dom.id('color-wheel');
    var rect = canvasEl.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) * (WHEEL_SIZE / Math.max(1, rect.width)),
      y: (ev.clientY - rect.top) * (WHEEL_SIZE / Math.max(1, rect.height))
    };
  }

  function wheelUpdate(p) {
    if (dragMode === 'hue') {
      var ang = Math.atan2(p.y - WHEEL_CENTER, p.x - WHEEL_CENTER) * 180 / Math.PI;
      wheelHsv.h = (ang + 360) % 360;
      applyWheel();
    } else if (dragMode === 'sv') {
      wheelHsv.s = util.clamp((p.x - SQUARE_X) / SQUARE_SIZE, 0, 1);
      wheelHsv.v = util.clamp(1 - (p.y - SQUARE_Y) / SQUARE_SIZE, 0, 1);
      applyWheel();
    }
  }

  function commitWheel() {
    if (!dragging) { return; }
    dragging = false;
    dragMode = null;
    PCW.studio.setColor(hsvHex(), true);
  }

  function onWheelTouchStart(ev) {
    if (!ev.touches || !ev.touches.length) { return; }
    ev.preventDefault();
    var p = wheelPoint(ev.touches[0]);
    dragMode = wheelModeAt(p.x, p.y);
    if (!dragMode) { return; }
    dragging = true;
    wheelUpdate(p);
  }

  function onWheelTouchMove(ev) {
    if (!dragging || !ev.touches || !ev.touches.length) { return; }
    ev.preventDefault();
    wheelUpdate(wheelPoint(ev.touches[0]));
  }

  function onWheelTouchEnd(ev) {
    if (!dragging) { return; }
    ev.preventDefault();
    commitWheel();
  }

  function onWheelMouseDown(ev) {
    ev.preventDefault();
    var p = wheelPoint(ev);
    dragMode = wheelModeAt(p.x, p.y);
    if (!dragMode) { return; }
    dragging = true;
    wheelUpdate(p);

    function move(e) { wheelUpdate(wheelPoint(e)); }
    function up() {
      document.removeEventListener('mousemove', move, false);
      document.removeEventListener('mouseup', up, false);
      commitWheel();
    }
    document.addEventListener('mousemove', move, false);
    document.addEventListener('mouseup', up, false);
  }

  function applyHexInput() {
    var input = dom.id('color-hex');
    if (!input) { return; }
    var rgb = util.parseHexColor(input.value);
    if (!rgb) {
      var s = studioState();
      input.value = s ? s.color : '#1c1c1e';
      ui.toast('Color hexagonal inválido');
      return;
    }
    PCW.studio.setColor(util.rgbToHex(rgb.r, rgb.g, rgb.b), true);
  }

  function renderSwatches() {
    var s = studioState();
    if (!s) { return; }
    var recent = dom.id('recent-colors');
    var base = dom.id('base-palette');
    var current = (s.color || '').toLowerCase();
    dom.empty(recent);
    dom.empty(base);

    var i;
    for (i = 0; i < s.doc.recentColors.length; i += 1) {
      recent.appendChild(makeSwatch(s.doc.recentColors[i], current));
    }
    for (i = 0; i < s.doc.palette.length; i += 1) {
      base.appendChild(makeSwatch(s.doc.palette[i], current));
    }
  }

  function makeSwatch(hex, current) {
    var sw = dom.create('button', 'swatch' +
      (String(hex).toLowerCase() === current ? ' is-active' : ''));
    sw.type = 'button';
    sw.setAttribute('data-color', hex);
    sw.setAttribute('aria-label', hex);
    sw.style.background = hex;
    return sw;
  }

  function addRecentColor(hex) {
    if (!PCW.studio) { return; }
    PCW.studio.addRecentColor(hex);
    renderSwatches();
  }

  /* -------------------------------------------------------------- pinceles */

  function renderBrushes() {
    var setsEl = dom.id('brush-sets');
    var grid = dom.id('brush-grid');
    if (!setsEl || !grid) { return; }
    dom.empty(setsEl);
    dom.empty(grid);

    var sets = model.brushSets();
    var i;
    for (i = 0; i < sets.length; i += 1) {
      (function (name) {
        var btn = dom.create('button', 'brush-set' +
          (name === currentSet ? ' is-active' : ''), name);
        btn.type = 'button';
        btn.setAttribute('data-set', name);
        dom.on(btn, 'click', function () {
          currentSet = name;
          renderBrushes();
        });
        setsEl.appendChild(btn);
      }(sets[i]));
    }

    var s = studioState();
    var activeId = s ? s.brush.id : '';
    for (i = 0; i < model.BRUSHES.length; i += 1) {
      var brush = model.BRUSHES[i];
      if (currentSet !== 'Todos' && brush.set !== currentSet) { continue; }
      (function (b) {
        var item = dom.create('button', 'brush-item' +
          (b.id === activeId ? ' is-active' : ''));
        item.type = 'button';
        item.setAttribute('data-brush', b.id);
        var canvasEl = document.createElement('canvas');
        canvasEl.width = 160;
        canvasEl.height = 56;
        item.appendChild(canvasEl);
        item.appendChild(dom.create('span', '', b.name));
        grid.appendChild(item);
        PCW.paint.preview(canvasEl, model.resolveBrush(b.id));
      }(brush));
    }
  }

  function openBrushes() {
    ui.openPanel('panel-brushes');
    renderBrushes();
  }

  function toggleBrushes() {
    if (ui.isPanelOpen('panel-brushes')) {
      ui.closePanel('panel-brushes');
      return;
    }
    PCW.studio.setTool('brush');
    openBrushes();
  }

  function renderBrushSettings() {
    var body = dom.id('brush-settings-body');
    var title = dom.id('brush-settings-title');
    var s = studioState();
    if (!body || !s) { return; }
    dom.empty(body);
    if (title) { title.textContent = 'Ajustar: ' + s.brush.name; }
    var list = PCW.studio.getBrushSettings();
    var i;
    for (i = 0; i < list.length; i += 1) {
      (function (item) {
        var label = dom.create('label', 'row-label');
        label.appendChild(document.createTextNode(item.label + ' '));
        var out = dom.create('span', '', String(item.value) + item.unit);
        out.setAttribute('data-brush-value', item.key);
        label.appendChild(out);
        var input = dom.create('input', 'range');
        input.type = 'range';
        input.min = String(item.min);
        input.max = String(item.max);
        input.value = String(item.value);
        input.setAttribute('data-brush-setting', item.key);
        dom.on(input, 'input', function () {
          var v = parseInt(input.value, 10);
          out.textContent = String(v) + item.unit;
          PCW.studio.setBrushSetting(item.key, v);
        });
        label.appendChild(input);
        body.appendChild(label);
      }(list[i]));
    }

    var assist = dom.create('div', 'assist-toggles');
    var qsRow = dom.create('label', 'assist-row');
    var qs = dom.create('input');
    qs.type = 'checkbox';
    qs.id = 'brush-quickshape';
    qs.checked = !!s.quickShape;
    qsRow.appendChild(qs);
    qsRow.appendChild(document.createTextNode(' QuickShape al mantener el dedo'));
    assist.appendChild(qsRow);

    var curveRow = dom.create('label', 'assist-row');
    var curve = dom.create('input');
    curve.type = 'checkbox';
    curve.id = 'brush-curve-recognition';
    curve.checked = !!s.curveRecognition;
    curveRow.appendChild(curve);
    curveRow.appendChild(document.createTextNode(' Reconocimiento de curvas'));
    assist.appendChild(curveRow);
    body.appendChild(assist);

    dom.on(qs, 'change', function () {
      PCW.studio.setQuickShape(qs.checked);
    });
    dom.on(curve, 'change', function () {
      PCW.studio.setCurveRecognition(curve.checked);
    });
  }

  function syncQuickShape() {
    var s = studioState();
    if (!s) { return; }
    var qs = dom.id('brush-quickshape');
    if (qs) { qs.checked = !!s.quickShape; }
    var curve = dom.id('brush-curve-recognition');
    if (curve) { curve.checked = !!s.curveRecognition; }
    var qsLabel = dom.id('btn-quickshape');
    if (qsLabel) {
      qsLabel.textContent = 'QuickShape: ' + (s.quickShape ? 'Activado' : 'Desactivado');
    }
    var curveLabel = dom.id('btn-curve-recognition');
    if (curveLabel) {
      curveLabel.textContent = 'Reconocer curvas: ' +
        (s.curveRecognition ? 'Activado' : 'Desactivado');
    }
  }

  function openCurveEdit() {
    ui.openPanel('panel-curve-edit');
  }

  function closeCurveEdit() {
    ui.closePanel('panel-curve-edit');
  }

  function openBrushSettings() {
    var s = studioState();
    if (!s) { return; }
    ui.openPanel('panel-brush-settings');
    renderBrushSettings();
  }

  function syncBrushSettings() {
    if (!ui.isPanelOpen('panel-brush-settings')) { return; }
    var s = studioState();
    if (!s) { return; }
    var list = PCW.studio.getBrushSettings();
    var i;
    for (i = 0; i < list.length; i += 1) {
      var key = list[i].key;
      var input = dom.qs('[data-brush-setting="' + key + '"]');
      var out = dom.qs('[data-brush-value="' + key + '"]');
      if (input) { input.value = String(list[i].value); }
      if (out) { out.textContent = String(list[i].value) + list[i].unit; }
    }
    var title = dom.id('brush-settings-title');
    if (title) { title.textContent = 'Ajustar: ' + s.brush.name; }
  }

  /* -------------------------------------------------------------- acciones */

  function openLayers() {
    ui.openPanel('panel-layers');
    sync();
  }

  function openColor() {
    ui.openPanel('panel-color');
    syncColor();
    syncDropThreshold();
    drawWheel();
  }

  /* ColorDrop: mantener pulsado el círculo de color y arrastrarlo al lienzo. */

  var dropDrag = null;
  var lastColorDropTouch = 0;

  function showDropIndicator(x, y) {
    var box = dom.id('color-drop-indicator');
    if (!box) { return; }
    var s = studioState();
    var dot = dom.id('color-drop-dot');
    if (dot && s) { dot.style.background = s.color; }
    box.style.left = x + 'px';
    box.style.top = y + 'px';
    dom.show(box);
  }

  function hideDropIndicator() {
    dom.hide(dom.id('color-drop-indicator'));
  }

  function beginColorDrop(x, y) {
    dropDrag = { startX: x, startY: y, x: x, y: y, active: false };
  }

  function moveColorDrop(x, y) {
    if (!dropDrag) { return; }
    dropDrag.x = x;
    dropDrag.y = y;
    var dx = x - dropDrag.startX;
    var dy = y - dropDrag.startY;
    if (!dropDrag.active && dx * dx + dy * dy > 64) {
      dropDrag.active = true;
      ui.closeAll();
    }
    if (dropDrag.active) { showDropIndicator(x, y); }
  }

  function finishColorDrop() {
    var d = dropDrag;
    dropDrag = null;
    hideDropIndicator();
    if (!d) { return; }
    if (d.active) {
      PCW.studio.colorDrop(d.x, d.y);
    } else {
      openColor();
    }
  }

  function onColorDropMove(ev) {
    moveColorDrop(ev.clientX, ev.clientY);
  }

  function onColorDropUp(ev) {
    document.removeEventListener('mousemove', onColorDropMove, false);
    document.removeEventListener('mouseup', onColorDropUp, false);
    moveColorDrop(ev.clientX, ev.clientY);
    finishColorDrop();
  }

  function syncDropThreshold() {
    var s = studioState();
    var range = dom.id('drop-threshold');
    var label = dom.id('drop-threshold-value');
    if (!s || !range) { return; }
    range.value = PCW.studio.getDropThreshold();
    if (label) { label.textContent = String(range.value); }
  }

  function syncAdjustControls() {
    var s = studioState();
    if (!s || !s.adjust) { return; }
    var map = {
      brightness: 'adj-brightness',
      contrast: 'adj-contrast',
      saturation: 'adj-saturation',
      hue: 'adj-hue',
      temperature: 'adj-temperature',
      sharpen: 'adj-sharpen',
      blur: 'adj-blur',
      noise: 'adj-noise'
    };
    var key;
    for (key in map) {
      if (Object.prototype.hasOwnProperty.call(map, key)) {
        var el = dom.id(map[key]);
        var out = dom.id(map[key] + '-value');
        if (el) { el.value = s.adjust.values[key]; }
        if (out) { out.textContent = String(s.adjust.values[key]); }
      }
    }
  }

  function openAdjustments() {
    if (!PCW.studio.startAdjust()) { return false; }
    ui.openPanel('panel-adjustments');
    syncAdjustControls();
    return true;
  }

  function syncSelectOps() {
    var s = studioState();
    var op = (s && s.selectOp) || 'new';
    var items = dom.qsa('#panel-selection .select-op');
    var i;
    for (i = 0; i < items.length; i += 1) {
      if (items[i].getAttribute('data-select-op') === op) {
        items[i].classList.add('is-active');
      } else {
        items[i].classList.remove('is-active');
      }
    }
  }

  function openSelectionPanel() {
    var s = studioState();
    if (!s) { return; }
    ui.openPanel('panel-selection');
    var modes = dom.qsa('#panel-selection .select-mode');
    var i;
    for (i = 0; i < modes.length; i += 1) {
      if (modes[i].getAttribute('data-select') === s.selectMode) {
        modes[i].classList.add('is-active');
      } else {
        modes[i].classList.remove('is-active');
      }
    }
    syncSelectOps();
  }

  function openTransformPanel() {
    if (!PCW.studio.startTransform()) { return false; }
    ui.openPanel('panel-transform');
    return true;
  }

  function doAction(action) {
    if (action === 'flip') { PCW.studio.flipView(); }
    else if (action === 'rotate') { PCW.studio.rotateView(); }
    else if (action === 'fit') { PCW.studio.fit(); }
    else if (action === 'fill-layer') { PCW.studio.fillLayer(); }
    else if (action === 'fill-selection') { PCW.studio.fillSelection(); }
    else if (action === 'clear-layer') { PCW.studio.clearActiveLayer(); }
    else if (action === 'merge-down') {
      ui.closeAll();
      if (PCW.studio.mergeDown()) { ui.toast('Capa combinada'); }
      return;
    }
    else if (action === 'merge-visible') {
      ui.closeAll();
      if (PCW.studio.mergeVisible()) { ui.toast('Capas visibles combinadas'); }
      return;
    }
    else if (action === 'crop-selection') {
      ui.closeAll();
      PCW.studio.cropToSelection();
      return;
    }
    else if (action === 'correct-shape') {
      ui.closeAll();
      PCW.studio.correctLastShape();
      return;
    }
    else if (action === 'edit-curve') {
      ui.closeAll();
      PCW.studio.startCurveEdit();
      return;
    }
    else if (action === 'toggle-quickshape') {
      PCW.studio.setQuickShape(!PCW.studio.getQuickShape());
      syncQuickShape();
      return;
    }
    else if (action === 'toggle-curve') {
      PCW.studio.setCurveRecognition(!PCW.studio.getCurveRecognition());
      syncQuickShape();
      return;
    }
    else if (action === 'canvas-settings') {
      ui.closeAll();
      PCW.studio.openCanvasSettings();
      return;
    }
    else if (action === 'export-png') { PCW.studio.exportImage('png'); }
    else if (action === 'export-jpeg') { PCW.studio.exportImage('jpeg'); }
    else if (action === 'export-project') { PCW.studio.exportProject(); }
    else if (action === 'diag') { PCW.diag.show(); }
    ui.closeAll();
  }

  function doQuick(action) {
    dom.hide(dom.id('quick-menu'));
    if (action === 'brushes') { openBrushes(); }
    else if (action === 'layers') { openLayers(); }
    else if (action === 'color') { openColor(); }
    else if (action === 'undo') { PCW.studio.undo(); }
    else if (action === 'redo') { PCW.studio.redo(); }
    else if (action === 'flip') { PCW.studio.flipView(); }
    else if (action === 'fit') { PCW.studio.fit(); }
    else if (action === 'gallery') { PCW.studio.close(); }
  }

  /* ------------------------------------------------------------------ init */

  /* Atajos de teclado para escritorio; en el iPad no interfieren. */
  function onHistoryKey(ev) {
    if (!PCW.studio || !PCW.ui || PCW.ui.currentScreen() !== 'screen-studio') {
      return;
    }
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) { return; }
    var key = String(ev.key || '').toLowerCase();
    var code = ev.keyCode || 0;
    if (key === 'z' || code === 90) {
      ev.preventDefault();
      if (ev.shiftKey) { PCW.studio.redo(); } else { PCW.studio.undo(); }
    } else if (key === 'y' || code === 89) {
      ev.preventDefault();
      PCW.studio.redo();
    }
  }

  function init() {
    if (inited) { return; }
    inited = true;

    dom.on(dom.id('btn-undo'), 'click', function () { PCW.studio.undo(); });
    dom.on(dom.id('btn-redo'), 'click', function () { PCW.studio.redo(); });
    document.addEventListener('keydown', onHistoryKey, false);

    dom.on(dom.id('btn-layers'), 'click', openLayers);
    var colorBtn = dom.id('btn-color');
    dom.on(colorBtn, 'click', function (ev) {
      if (Date.now() - lastColorDropTouch < 700) { return; }
      if (ev.detail === 0) { openColor(); }
    });
    dom.on(colorBtn, 'mousedown', function (ev) {
      if (ev.button !== 0 || Date.now() - lastColorDropTouch < 800) { return; }
      beginColorDrop(ev.clientX, ev.clientY);
      document.addEventListener('mousemove', onColorDropMove, false);
      document.addEventListener('mouseup', onColorDropUp, false);
    }, false);
    dom.on(colorBtn, 'touchstart', function (ev) {
      if (!ev.touches || ev.touches.length !== 1) { return; }
      lastColorDropTouch = Date.now();
      beginColorDrop(ev.touches[0].clientX, ev.touches[0].clientY);
    }, false);
    dom.on(colorBtn, 'touchmove', function (ev) {
      if (!dropDrag || !ev.touches || ev.touches.length !== 1) { return; }
      ev.preventDefault();
      moveColorDrop(ev.touches[0].clientX, ev.touches[0].clientY);
    }, false);
    dom.on(colorBtn, 'touchend', function (ev) {
      if (!dropDrag) { return; }
      ev.preventDefault();
      finishColorDrop();
    }, false);
    dom.on(colorBtn, 'touchcancel', function () {
      dropDrag = null;
      hideDropIndicator();
    }, false);

    dom.on(dom.id('btn-brush'), 'click', toggleBrushes);
    dom.on(dom.id('btn-actions'), 'click', function () {
      syncQuickShape();
      ui.togglePanel('popover-actions');
    });
    dom.on(dom.id('btn-adjustments'), 'click', function () {
      if (ui.isPanelOpen('panel-adjustments')) {
        ui.closePanel('panel-adjustments');
        return;
      }
      openAdjustments();
    });
    dom.on(dom.id('btn-selection'), 'click', function () {
      if (ui.isPanelOpen('panel-selection')) {
        ui.closePanel('panel-selection');
        return;
      }
      openSelectionPanel();
    });
    dom.on(dom.id('btn-transform'), 'click', function () {
      if (ui.isPanelOpen('panel-transform')) {
        ui.closePanel('panel-transform');
        return;
      }
      openTransformPanel();
    });
    dom.on(dom.id('btn-quick'), 'click', function () {
      ui.togglePanel('quick-menu');
    });

    var closers = dom.qsa('[data-close]');
    var i;
    for (i = 0; i < closers.length; i += 1) {
      (function (btn) {
        dom.on(btn, 'click', function () {
          ui.closePanel(btn.getAttribute('data-close'));
        });
      }(closers[i]));
    }

    dom.on(dom.id('btn-layer-add'), 'click', function () { PCW.studio.addLayer(); });
    dom.on(dom.id('btn-layer-dup'), 'click', function () { PCW.studio.duplicateLayer(); });
    dom.on(dom.id('btn-layer-up'), 'click', function () { PCW.studio.moveLayer(1); });
    dom.on(dom.id('btn-layer-down'), 'click', function () { PCW.studio.moveLayer(-1); });
    dom.on(dom.id('btn-layer-del'), 'click', function () {
      var s = studioState();
      if (!s) { return; }
      ui.confirm({
        title: 'Eliminar capa',
        message: 'Se eliminará la capa activa. Esta acción no se puede deshacer desde el historial.',
        confirmLabel: 'Eliminar',
        danger: true
      }, function () { PCW.studio.removeLayer(); });
    });

    dom.on(dom.id('layer-blend'), 'change', function () {
      PCW.studio.setLayerBlend(this.value);
    });
    dom.on(dom.id('layer-opacity'), 'input', function () {
      var label = dom.id('layer-opacity-value');
      if (label) { label.textContent = this.value + '%'; }
      PCW.studio.setLayerOpacity(parseInt(this.value, 10));
    });

    dom.on(dom.id('layers-list'), 'click', function (ev) {
      var visEl = findUp(ev.target, 'data-vis');
      if (visEl) {
        var s = studioState();
        if (!s) { return; }
        var layerId = visEl.getAttribute('data-vis');
        var layer = model.findLayer(s.doc, layerId);
        if (layer) { PCW.studio.setLayerVisible(layerId, layer.visible === false); }
        return;
      }
      var row = findUp(ev.target, 'data-layer');
      if (row) { PCW.studio.setActiveLayer(row.getAttribute('data-layer')); }
    });

    var wheel = dom.id('color-wheel');
    dom.on(wheel, 'touchstart', onWheelTouchStart, false);
    dom.on(wheel, 'touchmove', onWheelTouchMove, false);
    dom.on(wheel, 'touchend', onWheelTouchEnd, false);
    dom.on(wheel, 'touchcancel', onWheelTouchEnd, false);
    dom.on(wheel, 'mousedown', onWheelMouseDown, false);

    var hex = dom.id('color-hex');
    dom.on(hex, 'change', applyHexInput);
    dom.on(hex, 'blur', applyHexInput);
    dom.on(hex, 'keydown', function (ev) {
      if (ev.keyCode === 13) {
        ev.preventDefault();
        applyHexInput();
        try { hex.blur(); } catch (e) { /* ignorado */ }
      }
    });

    var recent = dom.id('recent-colors');
    var base = dom.id('base-palette');
    var swatchHandler = function (ev) {
      var sw = findUp(ev.target, 'data-color');
      if (sw) { PCW.studio.setColor(sw.getAttribute('data-color'), true); }
    };
    dom.on(recent, 'click', swatchHandler);
    dom.on(base, 'click', swatchHandler);

    dom.on(dom.id('brush-sets'), 'click', function (ev) {
      var setEl = findUp(ev.target, 'data-set');
      if (!setEl) { return; }
      currentSet = setEl.getAttribute('data-set');
      renderBrushes();
    });
    dom.on(dom.id('brush-grid'), 'click', function (ev) {
      var item = findUp(ev.target, 'data-brush');
      if (!item) { return; }
      var id = item.getAttribute('data-brush');
      PCW.studio.setBrush(id, false);
      ui.closePanel('panel-brushes');
      ui.toast('Pincel: ' + model.resolveBrush(id).name);
    });
    var brushStudio = dom.id('btn-brush-studio');
    if (brushStudio) { dom.on(brushStudio, 'click', openBrushSettings); }
    var brushReset = dom.id('btn-brush-reset');
    if (brushReset) {
      dom.on(brushReset, 'click', function () {
        PCW.studio.resetBrushSettings();
        renderBrushSettings();
      });
    }
    var brushDone = dom.id('btn-brush-done');
    if (brushDone) {
      dom.on(brushDone, 'click', function () { ui.closePanel('panel-brush-settings'); });
    }
    var curveApply = dom.id('btn-curve-apply');
    if (curveApply) {
      dom.on(curveApply, 'click', function () { PCW.studio.applyCurveEdit(); });
    }
    var curveCancel = dom.id('btn-curve-cancel');
    if (curveCancel) {
      dom.on(curveCancel, 'click', function () { PCW.studio.cancelCurveEdit(); });
    }

    dom.on(dom.id('quick-menu'), 'click', function (ev) {
      var item = findUp(ev.target, 'data-quick');
      if (item) { doQuick(item.getAttribute('data-quick')); }
    });

    dom.on(dom.id('popover-actions'), 'click', function (ev) {
      var sym = findUp(ev.target, 'data-symmetry');
      if (sym) {
        PCW.studio.setSymmetry(sym.getAttribute('data-symmetry'));
        ui.closeAll();
        return;
      }
      var item = findUp(ev.target, 'data-action');
      if (item) { doAction(item.getAttribute('data-action')); }
    });

    var fileInput = dom.id('file-image');
    if (fileInput) {
      dom.on(fileInput, 'change', function () {
        var file = fileInput.files && fileInput.files[0];
        ui.closeAll();
        if (file) { PCW.studio.importImage(file); }
        fileInput.value = '';
      });
    }

    dom.on(dom.id('btn-alpha-lock'), 'click', function () {
      PCW.studio.toggleAlphaLock();
    });

    var dropRange = dom.id('drop-threshold');
    if (dropRange) {
      dom.on(dropRange, 'input', function () {
        PCW.studio.setDropThreshold(parseInt(dropRange.value, 10));
        var label = dom.id('drop-threshold-value');
        if (label) { label.textContent = String(dropRange.value); }
      });
    }

    var adjSliders = ['brightness', 'contrast', 'saturation', 'hue',
      'temperature', 'sharpen', 'blur', 'noise'];
    for (i = 0; i < adjSliders.length; i += 1) {
      (function (key) {
        var el = dom.id('adj-' + key);
        var out = dom.id('adj-' + key + '-value');
        if (!el) { return; }
        dom.on(el, 'input', function () {
          var v = parseInt(el.value, 10);
          if (out) { out.textContent = String(v); }
          PCW.studio.setAdjustValue(key, v);
        });
      }(adjSliders[i]));
    }

    var adjPanel = dom.id('panel-adjustments');
    if (adjPanel) {
      dom.on(adjPanel, 'click', function (ev) {
        var preset = findUp(ev.target, 'data-adjust-preset');
        if (preset) {
          PCW.studio.setAdjustPreset(preset.getAttribute('data-adjust-preset'));
          syncAdjustControls();
        }
      });
    }
    dom.on(dom.id('btn-adjust-apply'), 'click', function () {
      PCW.studio.applyAdjust();
      ui.closePanel('panel-adjustments');
    });
    dom.on(dom.id('btn-adjust-cancel'), 'click', function () {
      PCW.studio.cancelAdjust();
      ui.closePanel('panel-adjustments');
    });

    var selectionPanel = dom.id('panel-selection');
    if (selectionPanel) {
      dom.on(selectionPanel, 'click', function (ev) {
        var modeEl = findUp(ev.target, 'data-select');
        if (modeEl) {
          PCW.studio.setSelectMode(modeEl.getAttribute('data-select'));
          var modes = dom.qsa('#panel-selection .select-mode');
          var k;
          for (k = 0; k < modes.length; k += 1) {
            if (modes[k] === modeEl) { modes[k].classList.add('is-active'); }
            else { modes[k].classList.remove('is-active'); }
          }
          ui.closePanel('panel-selection');
          return;
        }
        var opEl = findUp(ev.target, 'data-select-op');
        if (opEl) {
          PCW.studio.setSelectOp(opEl.getAttribute('data-select-op'));
          syncSelectOps();
          ui.closePanel('panel-selection');
          return;
        }
        var actEl = findUp(ev.target, 'data-selection-action');
        if (actEl) {
          var act = actEl.getAttribute('data-selection-action');
          if (act === 'invert') { PCW.studio.invertSelection(); }
          else if (act === 'duplicate') { PCW.studio.duplicateSelectionToLayer(); }
          else if (act === 'clear') { PCW.studio.clearSelection(); }
          ui.closePanel('panel-selection');
        }
      });
    }

    var transformPanel = dom.id('panel-transform');
    if (transformPanel) {
      dom.on(transformPanel, 'click', function (ev) {
        var item = findUp(ev.target, 'data-transform-action');
        if (!item) { return; }
        var act = item.getAttribute('data-transform-action');
        if (act === 'apply') {
          PCW.studio.applyTransform();
          ui.closePanel('panel-transform');
        } else if (act === 'cancel') {
          PCW.studio.cancelTransform();
          ui.closePanel('panel-transform');
        } else if (act === 'flip-h') {
          PCW.studio.flipTransform('h');
        } else if (act === 'flip-v') {
          PCW.studio.flipTransform('v');
        } else if (act === 'reset') {
          PCW.studio.resetTransform();
        }
      });
    }

    drawWheel();
  }

  PCW.panels = {
    init: init,
    sync: sync,
    syncActive: syncActive,
    updateThumbs: updateThumbs,
    syncColor: syncColor,
    addRecentColor: addRecentColor,
    openLayers: openLayers,
    openColor: openColor,
    openBrushes: openBrushes,
    renderBrushes: renderBrushes,
    syncQuickShape: syncQuickShape,
    openCurveEdit: openCurveEdit,
    closeCurveEdit: closeCurveEdit,
    syncBrushSettings: syncBrushSettings
  };

})(typeof window !== 'undefined' ? window : this);

/* ---- 70-diag.js ---- */

/* ==========================================================================
   70 — Diagnóstico del dispositivo: canvas, memoria, almacenamiento, táctil.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});
  var dom = PCW.dom;
  var util = PCW.util;
  var ui = PCW.ui;

  var inited = false;
  var returnScreen = 'screen-gallery';
  var measuring = false;
  var measureTimer = null;
  var measureInterval = null;
  var failCount = 0;

  function stamp() {
    var d = new Date();
    return util.pad2(d.getHours()) + ':' + util.pad2(d.getMinutes()) + ':' +
      util.pad2(d.getSeconds());
  }

  function log(text) {
    var el = dom.id('diag-log');
    if (!el) { return; }
    el.textContent += (el.textContent ? '\n' : '') + '[' + stamp() + '] ' + text;
    el.scrollTop = el.scrollHeight;
  }

  function clearLog() {
    var el = dom.id('diag-log');
    if (el) { el.textContent = ''; }
  }

  function check(label, ok, detail) {
    if (!ok) { failCount += 1; }
    log((ok ? 'OK   ' : 'FALLO') + ' · ' + label + (detail ? ' — ' + detail : ''));
  }

  function show() {
    var current = ui.currentScreen();
    if (current !== 'screen-diag') { returnScreen = current; }
    ui.showScreen('screen-diag');
    dom.setText(dom.id('diag-log'), '');
    run();
  }

  function back() {
    ui.showScreen(returnScreen || 'screen-gallery');
    if (returnScreen === 'screen-studio' && PCW.studio) {
      PCW.studio.resize();
      PCW.studio.requestRender();
      PCW.studio.updateBadge();
    } else if (PCW.gallery) {
      PCW.gallery.refresh();
    }
  }

  function envReport() {
    var env = PCW.env;
    log('Procreate Web ' + PCW.version + ' · build ' + PCW.build);
    log('UA: ' + env.ua);
    log('iOS detectado: ' + (env.isIOS ? env.iosVersion : 'no') +
      ' · Safari: ' + (env.isSafari ? 'sí' : 'no') +
      ' · plataforma: ' + env.platform);
    log('Pantalla: ' + env.screenW + '×' + env.screenH +
      ' · ventana: ' + root.innerWidth + '×' + root.innerHeight +
      ' · DPR: ' + env.dpr);
    log('Táctil: ' + (env.hasTouch ? 'sí' : 'no') +
      ' · maxTouchPoints: ' + (navigator.maxTouchPoints || 0) +
      ' · orientación: ' + ((screen.orientation && screen.orientation.type) || 'n/d'));
    log('Web app a pantalla completa: ' + (navigator.standalone ? 'sí' : 'no'));
  }

  function storageReport() {
    var info = PCW.storage.info();
    log('Almacenamiento activo: ' + info.label + ' (' + info.mode + ')');
    log('Persistencia: ' + (info.persisted ? 'sí' : 'NO'));
    log(info.detail);
    log('localStorage escribible: ' + testLocalStorage());
  }

  function testLocalStorage() {
    try {
      root.localStorage.setItem('pcw_probe', '1');
      var ok = root.localStorage.getItem('pcw_probe') === '1';
      root.localStorage.removeItem('pcw_probe');
      return ok ? 'sí' : 'no';
    } catch (e) {
      return 'no (' + e.message + ')';
    }
  }

  function budgetReport() {
    var presets = [
      ['S · Pantalla', 1024, 768],
      ['M · Medio', 1536, 1152],
      ['L · Grande', 2048, 1536],
      ['XL · Extra', 2560, 1920]
    ];
    log('Presupuesto duro de capas: ' + util.formatBytes(PCW.model.BUDGET_BYTES) +
      ' · historial: ' + util.formatBytes(PCW.model.HISTORY_BYTES));
    var i;
    for (i = 0; i < presets.length; i += 1) {
      var b = PCW.model.budgetFor(presets[i][1], presets[i][2]);
      log(presets[i][0] + ': ' + presets[i][1] + '×' + presets[i][2] +
        ' · ' + util.formatBytes(b.layerBytes) + '/capa · ' +
        b.maxLayers + ' capas · ' + util.formatBytes(b.totalBytes));
    }
  }

  function historyReport() {
    log('--- Historial ---');
    if (!PCW.studio || !PCW.studio.historyInfo || !PCW.studio.getState()) {
      log('Ningún lienzo abierto.');
      return;
    }
    var h = PCW.studio.historyInfo();
    log('Deshacer: ' + h.undo + ' · Rehacer: ' + h.redo + ' · ' +
      util.formatBytes(h.bytes) + ' de ' +
      util.formatBytes(PCW.model.HISTORY_BYTES));
    log('Gestos: 2 dedos deshacer · 3 dedos rehacer · margen ' +
      util.GESTURE_TAP_SLOP + ' px por dedo · límite ' +
      util.GESTURE_TAP_MS + ' ms');
  }

  function canvasTest(label, w, h) {
    var t0 = Date.now();
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');
    if (!ctx) {
      check('Canvas ' + label, false, 'sin contexto 2D');
      return null;
    }
    ctx.fillStyle = '#ff3366';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,128,255,0.5)';
    ctx.fillRect(w * 0.25, h * 0.25, w * 0.5, h * 0.5);
    var px = ctx.getImageData(0, 0, 1, 1).data;
    var elapsed = Date.now() - t0;
    var ok = px[0] > 0 && px[2] > 0;
    check('Canvas ' + label, ok, w + '×' + h + ' · ' + elapsed + ' ms · píxel ' +
      px[0] + ',' + px[1] + ',' + px[2]);
    return { canvas: c, ms: elapsed };
  }

  function blendTest() {
    try {
      var c = document.createElement('canvas');
      c.width = 8;
      c.height = 8;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 8, 8);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(0, 0, 8, 8);
      var px = ctx.getImageData(0, 0, 1, 1).data;
      check('Fusión multiply real', px[0] === 0 && px[2] === 0,
        'resultado ' + px[0] + ',' + px[1] + ',' + px[2] + ' (esperado 0,0,0)');
    } catch (e) {
      check('Fusión multiply real', false, e.message);
    }
  }

  function dataUrlTest() {
    try {
      var c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      var ctx = c.getContext('2d');
      var i;
      for (i = 0; i < 40; i += 1) {
        ctx.fillStyle = 'hsl(' + (i * 9) + ',70%,50%)';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 120, 90);
      }
      var url = c.toDataURL('image/png');
      check('toDataURL PNG 512×512', url.indexOf('data:image/png') === 0,
        util.formatBytes(url.length) + ' de cadena');
      var t0 = Date.now();
      c.toDataURL('image/jpeg', 0.8);
      log('toDataURL JPEG 512×512: ' + (Date.now() - t0) + ' ms');
    } catch (e) {
      check('toDataURL PNG 512×512', false, e.message);
    }
  }

  function featureReport() {
    check('IndexedDB presente', !!PCW.env.hasIndexedDB);
    check('WebSQL presente', !!PCW.env.hasWebSQL);
    check('atributo download', !!PCW.env.hasDownload);
    check('Blob + createObjectURL', !!PCW.env.hasBlob);
    check('modos de fusión canvas', !!PCW.env.canvasBlend);
    check('touch events', !!PCW.env.hasTouch);

    try {
      var probe = document.createElement('div');
      probe.style.display = '-webkit-flex';
      probe.style.display = 'flex';
      document.body.appendChild(probe);
      var display = root.getComputedStyle ? root.getComputedStyle(probe).display : probe.style.display;
      document.body.removeChild(probe);
      check('Flexbox', display === 'flex' || display === '-webkit-flex', 'display=' + display);
    } catch (e) {
      check('Flexbox', false, e.message);
    }
  }

  function runCanvasSuite() {
    failCount = 0;
    var aggressive = dom.id('diag-aggressive') && dom.id('diag-aggressive').checked;
    log('--- Canvas ---');
    var basic = canvasTest('S 1024×768', 1024, 768);
    canvasTest('M 1536×1152', 1536, 1152);
    canvasTest('L 2048×1536', 2048, 1536);
    canvasTest('XL 2560×1920', 2560, 1920);
    if (aggressive) {
      log('Modo agresivo activado: si Safari se cierra, el límite está por debajo.');
      canvasTest('3072×2304', 3072, 2304);
      canvasTest('4096×4096', 4096, 4096);
    } else {
      log('Prueba agresiva desactivada (marca la casilla para 3072 y 4096 px).');
    }
    if (basic && basic.canvas) {
      basic.canvas = null;
    }
    blendTest();
    dataUrlTest();
  }

  function testIDB() {
    if (!PCW.env.hasIndexedDB) {
      log('IndexedDB: omitido');
      return;
    }
    var finished = false;
    var timer = setTimeout(function () {
      if (finished) { return; }
      finished = true;
      check('IndexedDB escritura/lectura/reapertura', false, 'timeout de 4 s');
    }, 4000);

    function done(ok, detail) {
      if (finished) { return; }
      finished = true;
      clearTimeout(timer);
      check('IndexedDB escritura/lectura/reapertura', ok, detail);
    }

    var req;
    try {
      req = root.indexedDB.open('pcw_diag', 1);
    } catch (e) {
      done(false, e.message);
      return;
    }
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'k' });
      }
    };
    req.onerror = function () {
      done(false, 'error al abrir');
    };
    req.onsuccess = function () {
      var db = req.result;
      try {
        var tx = db.transaction(['kv'], 'readwrite');
        tx.objectStore('kv').put({ k: 'probe', v: 42 });
        tx.oncomplete = function () {
          try {
            var tx2 = db.transaction(['kv'], 'readonly');
            var get = tx2.objectStore('kv').get('probe');
            get.onsuccess = function () {
              var ok = get.result && get.result.v === 42;
              try { db.close(); } catch (e2) { /* ignorado */ }
              try { root.indexedDB.deleteDatabase('pcw_diag'); } catch (e3) { /* ignorado */ }
              done(ok, ok ? 'valor verificado' : 'lectura distinta');
            };
          } catch (e4) {
            done(false, e4.message);
          }
        };
        tx.onerror = function () {
          done(false, 'error de escritura');
        };
      } catch (e5) {
        done(false, e5.message);
      }
    };
  }

  function testWebSQL() {
    if (!PCW.env.hasWebSQL) {
      log('WebSQL: no disponible');
      return;
    }
    var finished = false;
    var timer = setTimeout(function () {
      if (!finished) {
        finished = true;
        check('WebSQL prueba', false, 'timeout');
      }
    }, 4000);
    try {
      var db = root.openDatabase('pcw_diag_ws', '1.0', 'diag', 1024 * 1024);
      db.transaction(function (tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS t (k TEXT PRIMARY KEY, v TEXT)');
        tx.executeSql('INSERT OR REPLACE INTO t (k, v) VALUES (?, ?)', ['probe', 'ok']);
        tx.executeSql('SELECT v FROM t WHERE k = ?', ['probe'], function (tx2, rs) {
          var ok = rs.rows.length && rs.rows.item(0).v === 'ok';
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            check('WebSQL prueba', !!ok, ok ? 'valor verificado' : 'lectura distinta');
          }
        });
      }, function (err) {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          check('WebSQL prueba', false, (err && err.message) || 'error');
        }
      });
    } catch (e) {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        check('WebSQL prueba', false, e.message);
      }
    }
  }

  function finishReport() {
    log('--- Resumen ---');
    log('Fallos detectados en esta ejecución: ' + failCount);
    log('Guarda este informe y pásalo al desarrollo. Los límites de canvas no se ' +
      'prometen hasta probarlos en el iPad mini 1 real.');
  }

  function run() {
    clearLog();
    log('Banco de diagnóstico. No modifica proyectos.');
    envReport();
    storageReport();
    budgetReport();
    historyReport();
    log('--- Características ---');
    runCanvasSuite();
    featureReport();
    log('--- Almacenamiento ---');
    testIDB();
    testWebSQL();
    setTimeout(finishReport, 4300);
  }

  function measureTouch() {
    if (measuring) { return; }
    measuring = true;
    var count = 0;
    var moves = 0;
    var start = Date.now();
    var btn = dom.id('diag-touch');
    var first = null;
    var maxDist = 0;

    function onMove(ev) {
      if (!ev.touches || !ev.touches.length) { return; }
      count += 1;
      var t = ev.touches[0];
      if (!first) {
        first = { x: t.clientX, y: t.clientY };
      } else {
        var dx = t.clientX - first.x;
        var dy = t.clientY - first.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxDist) { maxDist = d; }
      }
    }

    document.addEventListener('touchmove', onMove, false);
    ui.toast('Desliza el dedo por la pantalla durante 3 segundos', 3200);

    measureInterval = setInterval(function () {
      var remain = Math.max(0, 3 - Math.floor((Date.now() - start) / 1000));
      if (btn) { btn.textContent = 'Midiendo… ' + remain + ' s'; }
    }, 300);

    measureTimer = setTimeout(function () {
      document.removeEventListener('touchmove', onMove, false);
      clearInterval(measureInterval);
      measureInterval = null;
      measuring = false;
      if (btn) { btn.textContent = 'Medir entrada táctil (3 s)'; }
      var seconds = (Date.now() - start) / 1000;
      log('Entrada táctil: ' + count + ' touchmove en ' + seconds.toFixed(1) +
        ' s · ' + (count / seconds).toFixed(1) + ' eventos/s · recorrido máx ' +
        Math.round(maxDist) + ' px');
      log('Referencia: por debajo de ~50 eventos/s el trazo puede verse a saltos.');
    }, 3000);
  }

  function saveReport() {
    var text = dom.id('diag-log').textContent;
    ui.deliverText(text, 'diagnostico-procreate-web.txt', 'text/plain',
      'Informe de diagnóstico');
  }

  function init() {
    if (inited) { return; }
    inited = true;
    dom.on(dom.id('diag-run'), 'click', run);
    dom.on(dom.id('diag-touch'), 'click', measureTouch);
    dom.on(dom.id('diag-save'), 'click', saveReport);
    dom.on(dom.id('btn-diag-back'), 'click', back);
  }

  PCW.diag = {
    init: init,
    show: show,
    back: back,
    run: run,
    measureTouch: measureTouch,
    saveReport: saveReport
  };

})(typeof window !== 'undefined' ? window : this);

/* ---- 80-app.js ---- */

/* ==========================================================================
   80 — Arranque: orden de inicialización, errores globales y diagnóstico.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});
  var dom = PCW.dom;
  var ui = PCW.ui;

  var booted = false;
  var errorToasted = false;

  function wantsDiag() {
    return String(root.location.search || '').indexOf('diag=1') >= 0;
  }

  function installErrorHandlers() {
    root.onerror = function (message, source, line, column, error) {
      PCW.logError('window', error || new Error(message + ' @' + source + ':' + line));
      if (!errorToasted) {
        errorToasted = true;
        ui.toast('Error inesperado. Abre Diagnóstico para ver el detalle.', 4200);
      }
      return false;
    };

    document.addEventListener('contextmenu', function (ev) {
      var el = ev.target;
      if (el && (el.id === 'view-canvas' || el.id === 'color-wheel')) {
        ev.preventDefault();
      }
    }, false);
  }

  function revealStorage(info) {
    if (!info) { return; }
    if (info.mode === 'memory') {
      ui.toast('Sin persistencia: los proyectos se perderán al cerrar.', 4200);
    }
  }

  function boot() {
    if (booted) { return; }
    booted = true;

    installErrorHandlers();
    ui.bindGlobal();

    PCW.gallery.init();
    PCW.studio.init();
    PCW.panels.init();
    PCW.diag.init();

    ui.showScreen('screen-gallery');
    dom.setText(dom.id('gallery-count'), '');
    dom.id('gallery-empty').classList.add('is-hidden');

    PCW.storage.init(function (err, info) {
      if (err) {
        PCW.logError('boot:storage', err);
        ui.toast('Almacenamiento no disponible: ' + err.message, 4200);
      }
      revealStorage(info);
      PCW.gallery.refresh();
      if (wantsDiag()) {
        setTimeout(function () { PCW.diag.show(); }, 200);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, false);
  } else {
    setTimeout(boot, 0);
  }

  PCW.app = {
    boot: boot,
    wantsDiag: wantsDiag
  };

})(typeof window !== 'undefined' ? window : this);
