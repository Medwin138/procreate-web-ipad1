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
