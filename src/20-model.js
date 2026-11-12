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
    { id: 'pencil-6b', name: 'Lápiz 6B', set: 'Boceto', category: 'pencil',
      size: 9, opacity: 0.92, hardness: 0.55, spacing: 0.10,
      jitter: 0.25, scatter: 0.12, taper: 0.65, grain: 0.25 },
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
      historyLimit: opts.historyLimit || 0
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

  function getBrush(brushId) {
    var i;
    for (i = 0; i < BRUSHES.length; i += 1) {
      if (BRUSHES[i].id === brushId) { return BRUSHES[i]; }
    }
    return BRUSHES[0];
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
    doc.thumb = record.thumb || '';
    return doc;
  }

  function estimateProjectBytes(doc, layerCount) {
    var count = layerCount || doc.layers.length;
    return bytesForLayer(doc.width, doc.height) * count;
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
    brushSets: brushSets,
    blendLabel: blendLabel,
    copyLayerMeta: copyLayerMeta,
    toRecord: toRecord,
    fromRecord: fromRecord,
    validSize: validSize,
    estimateProjectBytes: estimateProjectBytes,
    cleanName: cleanName
  };

})(typeof window !== 'undefined' ? window : this);
