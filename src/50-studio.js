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

  /* ---------------------------------------------------------------- trazo */

  /* Perfil de afinado propio: 0 en la punta, 1 en el cuerpo. «Forma de punta»
     agudiza o redondea la transición sin cambiar el diámetro del pincel. */
  function taperCurve(progress, tip) {
    var p = util.clamp(progress, 0, 1);
    var eased = p * p * (3 - 2 * p);
    var sharp = 1 + util.clamp(tip == null ? 0.35 : tip, 0, 1) * 1.6;
    return Math.pow(eased, sharp);
  }

  function taperLengthFor(s) {
    var length = s.brush.taperLength == null ? 0.35 : s.brush.taperLength;
    var factor = 0.6 + util.clamp(length, 0, 1) * 4.4;
    return Math.max(2, s.size * factor);
  }

  /* La presión y la velocidad del punto modulan la profundidad del afinado.
     En Safari 9 la presión es neutra y manda la velocidad (afinado táctil). */
  function taperDepthFor(s, depth, pressure, speedNorm) {
    var d = util.clamp(depth, 0, 1);
    if (d <= 0.001) { return 0; }
    var press = s.brush.taperPressure == null ? 0.5 : s.brush.taperPressure;
    var touch = s.brush.taperTouch == null ? 0.5 : s.brush.taperTouch;
    var pr = util.clamp(pressure == null ? 0.5 : pressure, 0, 1);
    var sp = util.clamp(speedNorm == null ? 0 : speedNorm, 0, 1);
    var scale = 1;
    if (press > 0.001) { scale *= 1 + press * (0.5 - pr) * 0.8; }
    if (touch > 0.001) { scale *= 1 + touch * (sp - 0.5) * 0.8; }
    return util.clamp(d * scale, 0, 1);
  }

  function taperSizeFactor(depth, curve) {
    /* Con el afinado al 100 % la punta conserva un 18 % del diámetro: sigue
       siendo visible, pero termina en punta en lugar de quedar roma. */
    return 1 - depth * 0.82 * (1 - curve);
  }

  function taperAlphaFactor(s, curve) {
    var opacity = s.brush.taperOpacity == null ? 0.3 : s.brush.taperOpacity;
    return 1 - util.clamp(opacity, 0, 1) * 0.9 * (1 - curve);
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
      rawPoints: [{ x: p.x, y: p.y, pressure: pointerPressure, speed: 1, speedNorm: 0 }],
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
        stroke.rawPoints.push({ x: p.x, y: p.y, pressure: pointerPressure, speed: 1, speedNorm: 0 });
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
      /* Expresión del filtro: recupera la desviación lenta que la media móvil
         recorta (curvas amplias y gesto natural), pero no el temblor rápido:
         solo se reinyecta la media de largo plazo del detalle eliminado. */
      var expression = s.brush.motionExpression || 0;
      if (expression > 0.01) {
        if (!stroke.mfDetail) { stroke.mfDetail = []; }
        stroke.mfDetail.push({ x: p.x - raw.x, y: p.y - raw.y });
        var detailWindow = Math.max(6, windowSize * 4);
        if (stroke.mfDetail.length > detailWindow) { stroke.mfDetail.shift(); }
        var detail = model.averagePoints(stroke.mfDetail);
        if (detail) {
          raw = {
            x: raw.x + detail.x * expression,
            y: raw.y + detail.y * expression
          };
        }
      }
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
    var normSpeed = 0;
    var brushSpeed = s.brush.speed || 0;
    var touchTaper = s.brush.taperTouch || 0;
    if (brushSpeed > 0.001 || touchTaper > 0.001) {
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
        normSpeed = util.clamp((stroke.speedAvg - 0.5) / 3.5, 0, 1);
        if (brushSpeed > 0.001) {
          speedFactor = 1 - brushSpeed * 0.7 * normSpeed;
        }
      }
      stroke.lastPoint = { x: p.x, y: p.y };
      stroke.lastTime = stampTime;
    }
    var lastRawPoint = stroke.rawPoints[stroke.rawPoints.length - 1];
    if (lastRawPoint) {
      lastRawPoint.speed = speedFactor;
      lastRawPoint.speedNorm = normSpeed;
    }
    var spacing = Math.max(0.7, s.size * (s.brush.spacing || 0.1));
    if (dist < spacing) { return; }

    ensureSnapshot(s, stroke);
    var ux = dx / dist;
    var uy = dy / dist;
    var angle = Math.atan2(dy, dx);
    var moved = 0;
    var taperDist = taperLengthFor(s);
    while (moved + spacing <= dist) {
      moved += spacing;
      var x = from.x + ux * moved;
      var y = from.y + uy * moved;
      var index = stroke.stampCount;
      var lateral = (pseudo(stroke.seed, index) - 0.5) * (s.brush.jitter || 0) * s.size;
      var along = (pseudo(stroke.seed + 7, index) - 0.5) * (s.brush.scatter || 0) * s.size;
      var sx = x - uy * lateral + ux * along;
      var sy = y + ux * lateral + uy * along;
      var progress = Math.min(1, (stroke.travel + moved) / taperDist);
      var taper = taperCurve(progress, s.brush.taperTip);
      var depth = taperDepthFor(s, s.brush.taper || 0, pointerPressure, normSpeed);
      var factor = taperSizeFactor(depth, taper) * speedFactor;
      var alpha = taperAlphaFactor(s, taper);
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

  /* ------------------------------------------- suavizado al soltar el trazo */

  /* Expresión del filtro: la curva suave pierde la desviación lenta del gesto
     (curvas amplias, intención del trazo) junto con el temblor. Aquí se mide
     esa desviación contra los puntos crudos, se filtra para conservar solo su
     componente lenta y se reinyecta según el porcentaje. El temblor rápido
     queda fuera del filtro y no vuelve. */
  function restoreExpression(s, sampled, raw, amount) {
    var n = sampled.length;
    var rn = raw.length;
    if (n < 3 || rn < 3 || amount <= 0.001) { return sampled; }
    var residual = [];
    var ri = 0;
    var i;
    var j;
    for (i = 0; i < n; i += 1) {
      var q = sampled[i];
      while (ri + 1 < rn) {
        var d0 = model.distance(raw[ri], q);
        var d1 = model.distance(raw[ri + 1], q);
        if (d1 <= d0) { ri += 1; } else { break; }
      }
      residual.push({ x: raw[ri].x - q.x, y: raw[ri].y - q.y });
    }
    /* Media móvil: cubre ~24 px reales de trazo. Conserva la ondulación
       natural de la mano (longitudes de onda de ~50 px o más) y descarta el
       temblor rápido de 6-11 px, que queda fuera de la ventana. */
    var span = 0;
    for (i = 1; i < n; i += 1) {
      span += model.distance(sampled[i - 1], sampled[i]);
    }
    span = (n > 1) ? span / (n - 1) : 1;
    var window = Math.max(2, Math.round(12 / Math.max(0.25, span)));
    window = Math.min(window, Math.max(2, Math.floor(n / 4)));
    var cap = Math.max(1.5, s.size * 0.6);
    var out = [];
    for (i = 0; i < n; i += 1) {
      var lo = Math.max(0, i - window);
      var hi = Math.min(n - 1, i + window);
      var sx = 0;
      var sy = 0;
      var count = 0;
      for (j = lo; j <= hi; j += 1) {
        sx += residual[j].x;
        sy += residual[j].y;
        count += 1;
      }
      var dx = (sx / count) * amount;
      var dy = (sy / count) * amount;
      var mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > cap) {
        dx = (dx / mag) * cap;
        dy = (dy / mag) * cap;
      }
      var base = sampled[i];
      out.push({ x: base.x + dx, y: base.y + dy });
    }
    return out;
  }

  /* Asocia a cada punto de la curva suave la presión y la velocidad capturadas
     en el punto crudo más cercano. El índice avanza de forma monótona para no
     recorrer la lista completa en cada muestra. */
  function strokeMetaForCurve(raw, sampled) {
    var meta = [];
    var ri = 0;
    var n = raw.length;
    var i;
    for (i = 0; i < sampled.length; i += 1) {
      var q = sampled[i];
      while (ri + 1 < n) {
        var d0 = model.distance(raw[ri], q);
        var d1 = model.distance(raw[ri + 1], q);
        if (d1 <= d0) { ri += 1; } else { break; }
      }
      var r = raw[ri] || {};
      meta.push({
        pressure: (typeof r.pressure === 'number') ? r.pressure : 0.5,
        speed: (typeof r.speed === 'number') ? r.speed : 1,
        speedNorm: (typeof r.speedNorm === 'number') ? r.speedNorm : 0
      });
    }
    return meta;
  }

  /* Reestampa una polilínea conservando calado, textura determinista,
     presión y velocidad del pincel. La separación se acumula entre segmentos
     para que no aparezcan huecos ni dobles sellos en las uniones. */
  function stampSmoothedPath(s, stroke, points, meta) {
    if (!points || points.length < 2) { return false; }
    var spacing = Math.max(0.7, s.size * (s.brush.spacing || 0.1));
    var taperDist = taperLengthFor(s);
    var tip = s.brush.taperTip;
    var startDepth = s.brush.taper || 0;
    var endDepth = s.brush.taperEnd == null ? startDepth : s.brush.taperEnd;
    var jitter = s.brush.jitter || 0;
    var scatter = s.brush.scatter || 0;
    var totalLength = 0;
    var travelled = 0;
    var carry = 0;
    var stampIndex = 0;
    var lastX = null;
    var lastY = null;
    var i;
    for (i = 0; i < points.length - 1; i += 1) {
      totalLength += model.distance(points[i], points[i + 1]);
    }
    for (i = 0; i < points.length - 1; i += 1) {
      var a = points[i];
      var b = points[i + 1];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.001) { continue; }
      var ux = dx / len;
      var uy = dy / len;
      var angle = Math.atan2(dy, dx);
      var pos = carry;
      while (pos <= len + 0.001) {
        var t = util.clamp(pos / len, 0, 1);
        var x = a.x + dx * t;
        var y = a.y + dy * t;
        /* Evita repetir el sello exacto en la unión de dos segmentos: la
           opacidad se acumularía y dejaría puntos más oscuros. */
        if (lastX == null || Math.abs(x - lastX) > 0.01 ||
            Math.abs(y - lastY) > 0.01) {
          var ma = meta[i] || { pressure: 0.5, speed: 1, speedNorm: 0 };
          var mb = meta[i + 1] || ma;
          var pressure = ma.pressure + (mb.pressure - ma.pressure) * t;
          var pointSpeed = ma.speed + (mb.speed - ma.speed) * t;
          var speedNorm = ma.speedNorm + (mb.speedNorm - ma.speedNorm) * t;
          stroke.lastPressure = pressure;
          var lateral = (pseudo(stroke.seed, stampIndex) - 0.5) * jitter * s.size;
          var along = (pseudo(stroke.seed + 7, stampIndex) - 0.5) * scatter * s.size;
          var sx = x - uy * lateral + ux * along;
          var sy = y + ux * lateral + uy * along;
          var distance = travelled + pos;
          var startCurve = taperCurve(distance / taperDist, tip);
          var endCurve = taperCurve((totalLength - distance) / taperDist, tip);
          var depthStart = taperDepthFor(s, startDepth, pressure, speedNorm);
          var depthEnd = taperDepthFor(s, endDepth, pressure, speedNorm);
          var factor = taperSizeFactor(depthStart, startCurve) *
            taperSizeFactor(depthEnd, endCurve) * pointSpeed;
          var alpha = taperAlphaFactor(s, startCurve) *
            taperAlphaFactor(s, endCurve);
          stampAt(s, sx, sy, factor, alpha, angle);
          lastX = x;
          lastY = y;
          stampIndex += 1;
        }
        if (pos >= len) { break; }
        pos += spacing;
      }
      carry = pos - len;
      travelled += len;
    }
    /* Si todos los segmentos eran degenerados, deja al menos un sello. */
    if (stampIndex === 0) {
      stampAt(s, points[0].x, points[0].y, 1, 1, 0);
      stampIndex = 1;
    }
    stroke.stampPoint = { x: points[points.length - 1].x, y: points[points.length - 1].y };
    stroke.travel = travelled;
    return stampIndex > 0;
  }

  /* Suavizado posterior al soltar: reconstruye el trazo sobre una curva
     Catmull-Rom que conserva la intención del dibujo (también las curvas
     amplias) y elimina el temblor de alta frecuencia que los filtros en vivo
     no alcanzan. Reutiliza el snapshot inicial, así que el deshacer sigue
     funcionando. Aunque no haya filtros, reestampa para aplicar el afinado
     final y la opacidad de las puntas. */
  function smoothStrokeOnRelease(s, stroke) {
    if (!stroke || stroke.quickApplied) { return false; }
    if (s.tool !== 'brush' && s.tool !== 'eraser') { return false; }
    var raw = stroke.rawPoints;
    if (!raw || raw.length < 5 || stroke.stampCount < 1) { return false; }
    var strength = Math.max(
      s.brush.stabilize || 0,
      s.brush.streamline || 0,
      (s.brush.motionFilter || 0) * 0.5
    );
    var endTaper = s.brush.taperEnd == null ?
      (s.brush.taper || 0) : s.brush.taperEnd;
    var opacityTaper = s.brush.taperOpacity == null ? 0.3 : s.brush.taperOpacity;
    var doSmooth = strength > 0.02;
    var needsTaper = (s.brush.taper || 0) > 0.01 ||
      endTaper > 0.01 || opacityTaper > 0.01;
    if (!doSmooth && !needsTaper) { return false; }
    var rawLength = model.pathLength(raw);
    if (rawLength < Math.max(8, s.size * 0.9)) { return false; }
    var sampled;
    if (doSmooth) {
      /* La expresión pertenece al Filtro de movimiento: solo se aplica si
         dicho filtro está activo. 0 = máximo suavizado; 100 = máxima
         naturalidad. */
      var motionExpression = (s.brush.motionFilter || 0) > 0.01
        ? util.clamp(s.brush.motionExpression == null ? 0.45 : s.brush.motionExpression, 0, 1)
        : 0;
      /* Prefiltro sobre los puntos crudos (espaciado ~1,2 px): elimina el
         temblor de alta frecuencia antes de ajustar la curva. Conserva los
         extremos y la forma general, incluidas las curvas amplias. La
         expresión NO debilita este filtro: solo reinyecta después su
         componente lenta, de modo que el temblor nunca vuelve. */
      var amount = util.clamp(0.32 + strength * 0.55, 0.3, 0.85);
      var smoothed = model.smoothPoints(raw, amount, 2);
      var epsilon = Math.max(1, s.size * 0.12) +
        strength * Math.max(1.5, s.size * 0.35);
      epsilon = Math.min(epsilon, 8);
      var curve = model.curveForPoints(smoothed, {
        epsilon: epsilon,
        steps: 6,
        closed: false
      });
      if (!curve || !curve.sampled || curve.sampled.length < 2) { return false; }
      sampled = curve.sampled;
      /* La expresión recupera además la desviación lenta que el filtro
         eliminó, sin reinyectar el temblor rápido. */
      if (motionExpression > 0.01) {
        sampled = restoreExpression(s, sampled, raw, motionExpression * 0.85);
      }
      /* Nunca sustituyas el trazo por una versión mucho más corta: indica que
         la simplificación se comió parte del dibujo intencional. */
      if (model.pathLength(sampled) < rawLength * 0.6) { return false; }
    } else {
      /* Sin filtros: se conserva la geometría cruda y solo se reestampa para
         aplicar el afinado de las dos puntas y su opacidad. */
      sampled = [];
      for (var r = 0; r < raw.length; r += 1) {
        sampled.push({ x: raw[r].x, y: raw[r].y });
      }
    }
    /* Protección de rendimiento en iPad: limita muestras manteniendo el final. */
    if (sampled.length > 1600) {
      var reduced = [];
      var step = Math.ceil(sampled.length / 1600);
      for (var k = 0; k < sampled.length; k += step) { reduced.push(sampled[k]); }
      var tail = sampled[sampled.length - 1];
      if (reduced[reduced.length - 1] !== tail) { reduced.push(tail); }
      sampled = reduced;
    }
    if (!clearStrokeForShape(s, stroke)) { return false; }
    stroke.bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    stroke.stampCount = 0;
    stroke.travel = 0;
    var meta = strokeMetaForCurve(raw, sampled);
    if (!stampSmoothedPath(s, stroke, sampled, meta)) { return false; }
    /* El editor de curvas parte de los puntos finales, no de los crudos:
       así no reintroduce el temblor que se acaba de eliminar. */
    stroke.points = sampled;
    s.needsRender = true;
    return true;
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
    if (!stroke.quickApplied) { smoothStrokeOnRelease(s, stroke); }
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
    { key: 'taper', label: 'Afinado inicial', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'taperEnd', label: 'Afinado final', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'taperLength', label: 'Longitud del afinado', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'taperOpacity', label: 'Opacidad del afinado', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'taperPressure', label: 'Afinado por presión', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'taperTouch', label: 'Afinado táctil', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'taperTip', label: 'Forma de punta', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'grain', label: 'Grano', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'streak', label: 'Cerdas / vetas', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'speed', label: 'Grosor por velocidad', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'stabilize', label: 'Estabilización', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'streamline', label: 'Suavizado StreamLine', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'motionFilter', label: 'Filtro de movimiento', min: 0, max: 100, scale: 0.01, unit: '%' },
    { key: 'motionExpression', label: 'Expresión del filtro', min: 0, max: 100, scale: 0.01, unit: '%' },
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
