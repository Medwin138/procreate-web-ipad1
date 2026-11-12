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
        PCW.paint.preview(canvasEl, b);
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
      ui.toast('Pincel: ' + model.getBrush(id).name);
    });

    dom.on(dom.id('quick-menu'), 'click', function (ev) {
      var item = findUp(ev.target, 'data-quick');
      if (item) { doQuick(item.getAttribute('data-quick')); }
    });

    dom.on(dom.id('popover-actions'), 'click', function (ev) {
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

    var adjSliders = ['brightness', 'contrast', 'saturation', 'blur', 'noise'];
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
    renderBrushes: renderBrushes
  };

})(typeof window !== 'undefined' ? window : this);
