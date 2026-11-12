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
    motionFilter: true, motionExpression: true, shapeCorrection: true, pressure: true,
    taperEnd: true, taperLength: true, taperOpacity: true,
    taperPressure: true, taperTouch: true, taperTip: true
  };
  var BRUSH_EXTRA_DEFAULTS = {
    stabilize: 0.18,
    streamline: 0.2,
    motionFilter: 0.2,
    motionExpression: 0.45,
    shapeCorrection: 1,
    pressure: 0.35,
    taperLength: 0.35,
    taperOpacity: 0.3,
    taperPressure: 0.5,
    taperTouch: 0.5,
    taperTip: 0.35
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
    /* Cada pincel hereda su afinado inicial como afinado final mientras el
       usuario no configure otro valor en el estudio. */
    if (typeof out.taperEnd !== 'number') {
      out.taperEnd = (typeof out.taper === 'number') ? out.taper : 0.5;
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
      /* Si el usuario cambia el afinado inicial y aún no ha fijado el final,
         el final sigue al inicial. */
      if (typeof override.taper === 'number' &&
          typeof override.taperEnd !== 'number') {
        out.taperEnd = out.taper;
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
