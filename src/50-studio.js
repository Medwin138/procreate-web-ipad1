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

  var stampCache = {};
  var stampOrder = [];
  var stampBytes = 0;

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
    var key = brush.id + '|' + colorKey + '|' + tool + '|' + qr;
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

  function stampAt(s, x, y, factor, alphaFactor, angle) {
    var stroke = s.stroke;
    if (!stroke) { return; }
    var radius = (s.size / 2) * factor;
    if (radius < 0.35) { return; }
    var ctx = layerCtx(s, stroke.layerId);
    if (!ctx) { return; }
    var sprite;
    var alpha = (s.opacity / 100) * alphaFactor;
    var layer = model.findLayer(s.doc, stroke.layerId);

    if (s.tool === 'smudge') {
      smudgeAt(s, x, y, radius, alpha);
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
      target.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
      target.restore();
      if (s.strokeBufferCtx) {
        s.strokeBufferVersion += 1;
      }
    }

    var b = stroke.bounds;
    if (x - radius < b.x0) { b.x0 = x - radius; }
    if (y - radius < b.y0) { b.y0 = y - radius; }
    if (x + radius > b.x1) { b.x1 = x + radius; }
    if (y + radius > b.y1) { b.y1 = y + radius; }
    stroke.stampCount += 1;
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
    if (!applyHistoryEntry(s, entry, entry.before)) {
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
    if (!applyHistoryEntry(s, entry, entry.after)) {
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
      startedAt: now()
    };
    s.needsRender = true;
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
    if (!s.stroke) { return; }
    var stroke = s.stroke;
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

  function endStroke() {
    var s = st;
    if (!s) { return; }
    if (s.selectDraft) {
      finishSelection(s);
      return;
    }
    if (s.transform && s.transform.drag) {
      s.transform.drag = null;
      return;
    }
    if (!s.stroke) { return; }
    var stroke = s.stroke;
    if (stroke.stampCount === 0) {
      ensureSnapshot(s, stroke);
      stampAt(s, stroke.start.x, stroke.start.y, 1, 1, 0);
    }
    if (s.strokeBuffer) { commitStrokeBuffer(s); }
    finishHistory(s);
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
    if (!s) { return; }
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
    g.globalCompositeOperation = op === 'subtract' ? 'destination-out' : 'source-over';
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
    var allowed = { new: true, add: true, subtract: true };
    st.selectOp = allowed[op] ? op : 'new';
    ui.toast(st.selectOp === 'add' ? 'Modo añadir: la próxima selección se sumará' :
      (st.selectOp === 'subtract' ? 'Modo restar: la próxima selección se recortará' :
        'Modo nueva selección'));
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
    var bounds = contentBounds(src, s.doc.width, s.doc.height);
    if (!bounds) {
      ui.toast('La capa está vacía; no hay nada que transformar');
      return false;
    }
    var source = newDocCanvas(s);
    source.getContext('2d').drawImage(src, 0, 0);
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
      before: before,
      bounds: bounds,
      tx: 0, ty: 0, scale: 1, rotation: 0,
      flipX: 1, flipY: 1,
      drag: null
    };
    setTool('transform');
    s.needsRender = true;
    ui.toast('Transformar: arrastra para mover; esquinas para escalar; tirador superior para rotar', 3200);
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
      values: { brightness: 0, contrast: 0, saturation: 0, blur: 0, noise: 0 },
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
      v.saturation || v.blur || v.noise;
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
    var i;
    for (i = 0; i < data.length; i += 4) {
      var r = data[i];
      var gg = data[i + 1];
      var b = data[i + 2];
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
    try {
      g.putImageData(img, 0, 0);
    } catch (e2) {
      PCW.logError('studio:adjust-write', e2);
      return;
    }
    a.previewReady = true;
    s.needsRender = true;
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
      a.values = { brightness: 0, contrast: 0, saturation: 0, blur: 0, noise: 0 };
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

  function openCanvasSettings() {
    if (!st) { return; }
    var s = st;
    var esc = util.escapeHtml;
    ui.modal({
      title: 'Configuración del lienzo',
      width: 420,
      body: '<label class="field"><span class="field-label" style="display:block;margin-bottom:6px;color:#9a9aa3;font-size:11px;">Nombre</span>' +
        '<input id="canvas-name" class="input" type="text" value="' + esc(s.doc.name) + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>' +
        '<label class="field" style="display:block;margin-top:12px"><span class="field-label" style="display:block;margin-bottom:6px;color:#9a9aa3;font-size:11px;">Color de fondo</span>' +
        '<input id="canvas-bg" class="input" type="text" value="' + esc(s.doc.background || '#ffffff') + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>' +
        '<p class="form-note">Dimensiones actuales: ' + s.doc.width + ' × ' + s.doc.height +
        '. Cambiar el tamaño no está disponible en esta versión.</p>',
      focus: '#canvas-name',
      buttons: [
        { label: 'Cancelar' },
        {
          label: 'Guardar',
          primary: true,
          onClick: function () {
            var nameEl = dom.id('canvas-name');
            var bgEl = dom.id('canvas-bg');
            var rgb = util.parseHexColor(bgEl ? bgEl.value : '');
            if (!rgb) {
              ui.toast('Color de fondo inválido; usa #RRGGBB');
              return false;
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

  function beginPendingStroke(p) {
    pendingStroke = null;
    beginStroke(p);
  }

  function onTouchStart(ev) {
    if (!st) { return; }
    ev.preventDefault();
    lastTouchTime = now();
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
    var rect = rectOf(viewCanvas);
    var points = pointsFromTouches(ev.touches, rect);
    if (gesture) {
      trackGesturePoints(points);
      if (points.length >= 2) { updateGesture(points); }
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
    if (st.stroke || st.selectDraft || (st.transform && st.transform.drag)) {
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
      brush: model.getBrush(doc.brushId || 'pencil-6b'),
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
    var brush = model.getBrush(brushId);
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
