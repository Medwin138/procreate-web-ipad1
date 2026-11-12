/* ==========================================================================
   Pruebas de Node para el núcleo y el modelo (sin DOM).
   Ejecutar: node tests/model.test.js
   ========================================================================== */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout
};
vm.createContext(sandbox);

function load(file) {
  var code = fs.readFileSync(path.join(root, 'src', file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

load('00-core.js');
load('20-model.js');

var PCW = sandbox.PCW;
var util = PCW.util;
var model = PCW.model;
var tests = 0;

function ok(label, fn) {
  fn();
  tests += 1;
  console.log('ok ' + tests + ' — ' + label);
}

ok('hex/rgb/hsv convierten y vuelven a convertir', function () {
  var rgb = util.hexToRgb('#ff8000');
  assert.strictEqual(rgb.r, 255);
  assert.strictEqual(rgb.g, 128);
  assert.strictEqual(rgb.b, 0);
  assert.strictEqual(util.rgbToHex(255, 128, 0), '#ff8000');
  assert.strictEqual(util.hsvToHex(120, 1, 1), '#00ff00');
  var hsv = util.rgbToHsv(255, 0, 0);
  assert.strictEqual(Math.round(hsv.h), 0);
  assert.strictEqual(hsv.s, 1);
  assert.strictEqual(hsv.v, 1);
  var i;
  for (i = 0; i < 40; i += 1) {
    var r = Math.floor(Math.random() * 256);
    var g = Math.floor(Math.random() * 256);
    var b = Math.floor(Math.random() * 256);
    var hex = util.rgbToHex(r, g, b);
    var back = util.hexToRgb(hex);
    assert.strictEqual(back.r, r);
    assert.strictEqual(back.g, g);
    assert.strictEqual(back.b, b);
  }
});

ok('parseHexColor rechaza valores inválidos', function () {
  assert.strictEqual(util.parseHexColor('nope'), null);
  assert.strictEqual(util.parseHexColor('#12'), null);
  var short = util.parseHexColor('#abc');
  assert.strictEqual(short.r, 170);
  assert.strictEqual(short.g, 187);
  assert.strictEqual(short.b, 204);
});

ok('matriz: inversa devuelve el punto original', function () {
  var m = PCW.mat.translate(120, 40);
  m = PCW.mat.mul(m, PCW.mat.rotate(0.37));
  m = PCW.mat.mul(m, PCW.mat.scale(2.3, 0.8));
  var p = PCW.mat.apply(m, 17, -9);
  var back = PCW.mat.apply(PCW.mat.invert(m), p.x, p.y);
  assert.ok(Math.abs(back.x - 17) < 1e-9, 'x=' + back.x);
  assert.ok(Math.abs(back.y + 9) < 1e-9, 'y=' + back.y);
});

ok('presupuestos por tamaño coinciden con el diseño', function () {
  assert.strictEqual(model.budgetFor(1024, 768).maxLayers, 8);
  assert.strictEqual(model.budgetFor(1536, 1152).maxLayers, 5);
  assert.strictEqual(model.budgetFor(2048, 1536).maxLayers, 3);
  assert.strictEqual(model.budgetFor(2560, 1920).maxLayers, 2);
  assert.strictEqual(model.budgetFor(4096, 4096).maxLayers, 0);
  assert.ok(model.budgetFor(4096, 4096).overBudget);
  assert.strictEqual(model.bytesForLayer(1024, 768), 3145728);
});

ok('documento nuevo: una capa y campos coherentes', function () {
  var doc = model.createDoc({ name: '  Prueba  ', width: 1024, height: 768 });
  assert.strictEqual(doc.name, 'Prueba');
  assert.strictEqual(doc.layers.length, 1);
  assert.strictEqual(doc.activeLayerId, doc.layers[0].id);
  assert.strictEqual(doc.schema, 'pcw/1');
  assert.strictEqual(doc.layers[0].name, 'Capa 1');
  assert.strictEqual(doc.view.flipX, false);
  assert.strictEqual(doc.background, '#ffffff');
});

ok('añadir capas respeta el límite del perfil S', function () {
  var doc = model.createDoc({ width: 1024, height: 768 });
  var i;
  for (i = 2; i <= 8; i += 1) {
    var layer = model.addLayer(doc);
    assert.ok(layer, 'capa ' + i);
    assert.strictEqual(layer.name, 'Capa ' + i);
  }
  assert.strictEqual(doc.layers.length, 8);
  assert.strictEqual(model.canAddLayer(doc), false);
  assert.strictEqual(model.addLayer(doc), null);
});

ok('duplicar, mover y eliminar capas mantiene el orden', function () {
  var doc = model.createDoc({ width: 1024, height: 768 });
  var second = model.addLayer(doc);
  var third = model.addLayer(doc);
  assert.strictEqual(model.layerIndex(doc, third.id), 2);
  assert.strictEqual(model.moveLayer(doc, third.id, -1), true);
  assert.strictEqual(model.layerIndex(doc, third.id), 1);
  assert.strictEqual(model.moveLayer(doc, third.id, -1), true);
  assert.strictEqual(model.layerIndex(doc, third.id), 0);
  assert.strictEqual(model.moveLayer(doc, third.id, -1), false);

  var copy = model.duplicateLayerMeta(doc, second.id);
  assert.ok(copy);
  assert.strictEqual(copy.name, 'Capa 2 copia');
  assert.strictEqual(doc.activeLayerId, copy.id);

  var count = doc.layers.length;
  assert.strictEqual(model.removeLayer(doc, copy.id), true);
  assert.strictEqual(doc.layers.length, count - 1);
  assert.notStrictEqual(doc.activeLayerId, copy.id);
});

ok('no se puede eliminar la última capa', function () {
  var doc = model.createDoc({ width: 1024, height: 768 });
  assert.strictEqual(model.removeLayer(doc, doc.layers[0].id), false);
  assert.strictEqual(doc.layers.length, 1);
});

ok('serialización y deserialización conservan metadatos', function () {
  var doc = model.createDoc({
    name: 'Retrato',
    width: 1536,
    height: 1152,
    color: '#ff0000'
  });
  model.addLayer(doc);
  doc.view.scale = 0.75;
  doc.view.rotation = 1.2;
  doc.view.flipX = true;
  doc.recentColors = ['#ff0000', '#00ff00'];
  var record = model.toRecord(doc, 'data:image/jpeg;base64,AAAA');
  assert.strictEqual(record.layerCount, 2);
  assert.strictEqual(record.thumb.indexOf('data:image/jpeg') === 0, true);
  assert.strictEqual(record.layers.length, 2);

  var restored = model.fromRecord(record);
  assert.strictEqual(restored.name, 'Retrato');
  assert.strictEqual(restored.width, 1536);
  assert.strictEqual(restored.layers.length, 2);
  assert.strictEqual(restored.view.flipX, true);
  assert.ok(Math.abs(restored.view.rotation - 1.2) < 1e-9);
  assert.strictEqual(restored.recentColors.length, 2);
  assert.strictEqual(restored.recentColors[0], '#ff0000');
  assert.strictEqual(restored.recentColors[1], '#00ff00');
});

ok('fromRecord rechaza dimensiones y registros inválidos', function () {
  assert.throws(function () {
    model.fromRecord({ id: 'x', width: 10, height: 10, layers: [] });
  }, /Dimensiones inválidas/);
  assert.throws(function () {
    model.fromRecord(null);
  }, /inválido/);
});

ok('pinceles propios: ids únicos, sets y etiquetas de mezcla', function () {
  var seen = {};
  var i;
  for (i = 0; i < model.BRUSHES.length; i += 1) {
    assert.ok(!seen[model.BRUSHES[i].id], 'id repetido');
    seen[model.BRUSHES[i].id] = true;
  }
  assert.strictEqual(model.BRUSHES.length, 29);
  assert.strictEqual(model.BRUSH_SETS.length, 11);
  var sets = model.brushSets();
  assert.strictEqual(sets[0], 'Todos');
  assert.strictEqual(sets.length, 12);
  var used = {};
  for (i = 0; i < model.BRUSHES.length; i += 1) {
    used[model.BRUSHES[i].set] = true;
  }
  for (i = 0; i < model.BRUSH_SETS.length; i += 1) {
    assert.ok(used[model.BRUSH_SETS[i]], 'set sin pinceles');
  }
  assert.strictEqual(model.blendLabel('multiply'), 'Multiplicar');
  assert.strictEqual(model.blendLabel('desconocido'), 'desconocido');
  assert.strictEqual(model.getBrush('no-existe').id, model.BRUSHES[0].id);
  var studioPen = model.getBrush('studio-pen');
  assert.strictEqual(studioPen.name, 'Pluma de estudio');
  assert.strictEqual(studioPen.set, 'Entintado');
  assert.ok(studioPen.speed > 0);
  var gpen = model.getBrush('gpen-manga');
  assert.strictEqual(gpen.name, 'G-Pen manga');
  assert.ok(gpen.speed > studioPen.speed);
});

ok('pinceles Dry Ink, Shale Brush y 6B Pencil están en la biblioteca', function () {
  var dry = model.getBrush('dry-ink');
  assert.strictEqual(dry.name, 'Dry Ink');
  assert.strictEqual(dry.set, 'Entintado');
  assert.ok(dry.streak > 0.5);
  var shale = model.getBrush('shale-brush');
  assert.strictEqual(shale.name, 'Shale Brush');
  assert.strictEqual(shale.set, 'Artístico');
  assert.ok(shale.grain > 0.7);
  var pencil = model.getBrush('pencil-6b');
  assert.strictEqual(pencil.name, '6B Pencil');
  assert.ok(pencil.grain > 0.3);
});

ok('los ajustes de pincel se resuelven sin mutar la biblioteca', function () {
  var original = model.getBrush('dry-ink').size;
  var before = model.resolveBrush('dry-ink');
  assert.strictEqual(before.size, original);
  assert.strictEqual(before.motionExpression, 0.45);
  assert.strictEqual(before.taperEnd, model.getBrush('dry-ink').taper);
  assert.strictEqual(before.taperOpacity, 0.3);
  assert.strictEqual(model.setBrushOverride('dry-ink', 'size', 55), true);
  assert.strictEqual(model.resolveBrush('dry-ink').size, 55);
  assert.strictEqual(model.setBrushOverride('dry-ink', 'motionExpression', 0.8), true);
  assert.strictEqual(model.resolveBrush('dry-ink').motionExpression, 0.8);
  assert.strictEqual(model.setBrushOverride('dry-ink', 'taperEnd', 0.2), true);
  assert.strictEqual(model.resolveBrush('dry-ink').taperEnd, 0.2);
  assert.strictEqual(model.setBrushOverride('dry-ink', 'taper', 0.4), true);
  assert.strictEqual(model.resolveBrush('dry-ink').taper, 0.4);
  assert.strictEqual(model.resolveBrush('dry-ink').taperEnd, 0.2);
  model.clearBrushOverride('dry-ink');
  assert.strictEqual(model.setBrushOverride('dry-ink', 'taper', 0.4), true);
  assert.strictEqual(model.resolveBrush('dry-ink').taperEnd, 0.4);
  model.clearBrushOverride('dry-ink');
  assert.strictEqual(model.getBrush('dry-ink').size, original);
  assert.strictEqual(model.setBrushOverride('dry-ink', 'inventado', 1), false);
  model.clearBrushOverride('dry-ink');
  assert.strictEqual(model.resolveBrush('dry-ink').size, original);
  assert.strictEqual(model.resolveBrush('dry-ink').motionExpression, 0.45);
  assert.strictEqual(model.resolveBrush('dry-ink').taperEnd,
    model.getBrush('dry-ink').taper);
});

ok('la guía de simetría se guarda y se valida al deserializar', function () {
  var doc = model.createDoc({ width: 1024, height: 768 });
  assert.strictEqual(doc.symmetry, 'off');
  doc.symmetry = 'quad';
  var record = model.toRecord(doc, '');
  assert.strictEqual(record.symmetry, 'quad');
  assert.strictEqual(model.fromRecord(record).symmetry, 'quad');
  record.symmetry = 'inventada';
  assert.strictEqual(model.fromRecord(record).symmetry, 'off');
});

ok('nombres: recorte, vacío y caracteres permitidos', function () {
  assert.strictEqual(model.cleanName(''), 'Sin título');
  assert.strictEqual(model.cleanName('   '), 'Sin título');
  var long = new Array(100).join('a');
  assert.strictEqual(model.cleanName(long).length, 60);
});

ok('historial y presupuesto usan los bytes declarados', function () {
  assert.strictEqual(model.HISTORY_BYTES, 12 * 1024 * 1024);
  assert.strictEqual(model.BUDGET_BYTES, 40 * 1024 * 1024);
  var doc = model.createDoc({ width: 1024, height: 768 });
  assert.strictEqual(model.estimateProjectBytes(doc), 3145728);
});

ok('floodRegion termina y respeta umbral, límites y máscaras alfa', function () {
  var w = 12;
  var h = 12;
  var data = new Uint8ClampedArray(w * h * 4);
  var i;
  for (i = 0; i < w * h; i += 1) {
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }
  var x;
  var y;
  for (y = 0; y < h; y += 1) {
    for (x = 0; x < w; x += 1) {
      if (x < 2 || x > 9 || y < 2 || y > 9) {
        var p = (y * w + x) * 4;
        data[p] = 0;
        data[p + 1] = 0;
        data[p + 2] = 0;
      }
    }
  }
  var region = util.floodRegion(data, w, h, 5, 5, 10, null, null);
  assert.ok(region);
  assert.strictEqual(region.count, 64);
  assert.deepStrictEqual(
    { x0: region.x0, y0: region.y0, x1: region.x1, y1: region.y1 },
    { x0: 2, y0: 2, x1: 9, y1: 9 }
  );
  assert.strictEqual(util.floodRegion(data, w, h, -1, 5, 10, null, null), null);
  assert.strictEqual(util.floodRegion(data, w, h, w, h, 10, null, null), null);

  var allowB = new Uint8ClampedArray(w * h * 4);
  for (i = 0; i < w * h; i += 1) {
    allowB[i * 4 + 3] = (i % w === 6) ? 0 : 255;
  }
  var blocked = util.floodRegion(data, w, h, 4, 5, 10, null, allowB);
  assert.ok(blocked);
  assert.strictEqual(blocked.count, 32);
  assert.strictEqual(blocked.x1, 5);
});

ok('tapHistoryAction distingue toque de gesto', function () {
  assert.strictEqual(util.tapHistoryAction(2, false, 120), 'undo');
  assert.strictEqual(util.tapHistoryAction(3, false, 120), 'redo');
  assert.strictEqual(util.tapHistoryAction(2, true, 120), null);
  assert.strictEqual(util.tapHistoryAction(3, true, 120), null);
  assert.strictEqual(util.tapHistoryAction(1, false, 120), null);
  assert.strictEqual(util.tapHistoryAction(4, false, 120), null);
  assert.strictEqual(util.tapHistoryAction(3, false, util.GESTURE_TAP_MS + 1), null);
  assert.ok(util.GESTURE_TAP_SLOP >= 10);
});

/* ---------------------------------------------------------------- trazos */

function straightLine(x0, y0, x1, y1, count, jitter) {
  var pts = [];
  var i;
  for (i = 0; i <= count; i += 1) {
    var t = i / count;
    var wobble = (i === 0 || i === count) ? 0 : Math.sin(i * 1.7) * jitter;
    pts.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t + wobble });
  }
  return pts;
}

function closedFromCorners(corners, perEdge) {
  var pts = [];
  var e;
  var i;
  for (e = 0; e < corners.length; e += 1) {
    var a = corners[e];
    var b = corners[(e + 1) % corners.length];
    for (i = 0; i < perEdge; i += 1) {
      var t = i / perEdge;
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  pts.push({ x: corners[0].x, y: corners[0].y });
  return pts;
}

function ellipsePoints(cx, cy, rx, ry, count, wobble) {
  var pts = [];
  var i;
  for (i = 0; i <= count; i += 1) {
    var a = (i / count) * Math.PI * 2;
    var f = 1 + (wobble || 0) * Math.sin(i * 2.3);
    pts.push({ x: cx + Math.cos(a) * rx * f, y: cy + Math.sin(a) * ry * f });
  }
  return pts;
}

ok('geometría: distancia, longitud, caja y punto-segmento', function () {
  assert.strictEqual(model.distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.strictEqual(model.pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }]), 5);
  var box = model.pointBounds([{ x: 10, y: 20 }, { x: -5, y: 40 }]);
  assert.strictEqual(box.x, -5);
  assert.strictEqual(box.y, 20);
  assert.strictEqual(box.w, 15);
  assert.strictEqual(box.h, 20);
  assert.strictEqual(model.pointSegmentDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5);
  assert.strictEqual(model.pointSegmentDistance({ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5);
  assert.strictEqual(model.pointBounds([]), null);
});

ok('simplifyRdp conserva esquinas y elimina puntos redundantes', function () {
  var line = straightLine(0, 0, 100, 0, 50, 0);
  var simplified = model.simplifyRdp(line, 1);
  assert.strictEqual(simplified.length, 2);

  var corner = [];
  var i;
  for (i = 0; i <= 20; i += 1) { corner.push({ x: i * 5, y: 0 }); }
  for (i = 1; i <= 20; i += 1) { corner.push({ x: 100, y: i * 5 }); }
  var kept = model.simplifyRdp(corner, 1);
  assert.strictEqual(kept.length, 3);
  assert.strictEqual(kept[1].x, 100);
  assert.strictEqual(kept[1].y, 0);
  assert.strictEqual(model.simplifyRdp([], 1).length, 0);
  var single = model.simplifyRdp([{ x: 1, y: 2 }], 1);
  assert.strictEqual(single.length, 1);
  assert.strictEqual(single[0].x, 1);
  assert.strictEqual(single[0].y, 2);
});

ok('smoothPoints reduce el temblor y conserva los extremos', function () {
  var noisy = straightLine(0, 0, 200, 0, 60, 6);
  var smoothed = model.smoothPoints(noisy, 1, 3);
  assert.strictEqual(smoothed.length, noisy.length);
  assert.ok(model.distance(smoothed[0], noisy[0]) < 1e-6);
  assert.ok(model.distance(smoothed[smoothed.length - 1], noisy[noisy.length - 1]) < 1e-6);
  var before = 0;
  var after = 0;
  var i;
  for (i = 1; i < noisy.length - 1; i += 1) {
    before += Math.abs(noisy[i].y);
    after += Math.abs(smoothed[i].y);
  }
  assert.ok(after < before * 0.6, 'el temblor debe bajar: ' + after + ' vs ' + before);
  assert.strictEqual(model.averagePoints([{ x: 0, y: 0 }, { x: 4, y: 8 }]).x, 2);
  assert.strictEqual(model.averagePoints([]), null);
});

ok('quickShapeForPoints reconoce línea recta', function () {
  var pts = straightLine(40, 300, 420, 300, 70, 1.5);
  var shape = model.quickShapeForPoints(pts, 20);
  assert.ok(shape);
  assert.strictEqual(shape.type, 'line');
  assert.strictEqual(shape.closed, false);
  assert.strictEqual(shape.points.length, 2);
  assert.ok(shape.confidence > 0.7, 'confianza ' + shape.confidence);
  assert.strictEqual(Math.round(shape.points[0].y), 300);
});

ok('quickShapeForPoints reconoce cuadrado y rectángulo', function () {
  var square = model.quickShapeForPoints(
    closedFromCorners([{ x: 100, y: 100 }, { x: 300, y: 100 },
      { x: 300, y: 300 }, { x: 100, y: 300 }], 24), 12);
  assert.ok(square);
  assert.strictEqual(square.type, 'rect');
  assert.strictEqual(square.square, true);
  assert.ok(Math.abs(square.x - 100) < 1 && Math.abs(square.w - 200) < 1);
  assert.ok(square.confidence > 0.8);

  var rect = model.quickShapeForPoints(
    closedFromCorners([{ x: 80, y: 120 }, { x: 400, y: 120 },
      { x: 400, y: 280 }, { x: 80, y: 280 }], 24), 12);
  assert.ok(rect);
  assert.strictEqual(rect.type, 'rect');
  assert.strictEqual(rect.square, false);
});

ok('quickShapeForPoints reconoce elipses y no las confunde con rectángulos', function () {
  var circle = model.quickShapeForPoints(ellipsePoints(200, 200, 120, 120, 72, 0), 10);
  assert.ok(circle);
  assert.strictEqual(circle.type, 'ellipse');
  assert.ok(Math.abs(circle.rx - 120) < 2 && Math.abs(circle.ry - 120) < 2);

  var oval = model.quickShapeForPoints(ellipsePoints(220, 180, 160, 90, 72, 0.004), 10);
  assert.ok(oval);
  assert.strictEqual(oval.type, 'ellipse');
  assert.ok(oval.rx > oval.ry);
});

ok('quickShapeForPoints reconoce triángulos y polígonos regulares', function () {
  var triangle = model.quickShapeForPoints(
    closedFromCorners([{ x: 150, y: 80 }, { x: 320, y: 320 }, { x: 60, y: 320 }], 28), 12);
  assert.ok(triangle);
  assert.strictEqual(triangle.type, 'triangle');
  assert.strictEqual(triangle.points.length, 3);

  var corners = [];
  var i;
  for (i = 0; i < 5; i += 1) {
    var a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    corners.push({ x: 200 + Math.cos(a) * 120, y: 200 + Math.sin(a) * 120 });
  }
  var pentagon = model.quickShapeForPoints(closedFromCorners(corners, 20), 12);
  assert.ok(pentagon);
  assert.strictEqual(pentagon.type, 'polygon');
  assert.strictEqual(pentagon.sides, 5);
  assert.ok(pentagon.confidence > 0.8);
});

ok('quickShapeForPoints no inventa formas en un garabato', function () {
  var scribble = [];
  var i;
  for (i = 0; i <= 60; i += 1) {
    var t = i / 60;
    scribble.push({
      x: 100 + Math.sin(t * 18) * 90,
      y: 100 + Math.cos(t * 13) * 70
    });
  }
  assert.strictEqual(model.quickShapeForPoints(scribble, 10), null);
  assert.strictEqual(model.quickShapeForPoints([{ x: 0, y: 0 }], 10), null);
});

ok('curveForPoints crea anclas Bézier editables y muestrea la curva', function () {
  var wave = [];
  var i;
  for (i = 0; i <= 80; i += 1) {
    var t = i / 80;
    wave.push({ x: 50 + t * 300, y: 200 + Math.sin(t * Math.PI * 2) * 60 });
  }
  var curve = model.curveForPoints(wave, { epsilon: 4, steps: 10 });
  assert.ok(curve);
  assert.ok(curve.anchors.length >= 3);
  assert.strictEqual(curve.closed, false);
  var a = curve.anchors[1];
  assert.strictEqual(typeof a.inX, 'number');
  assert.strictEqual(typeof a.outX, 'number');
  assert.ok(model.distance(a, { x: a.outX, y: a.outY }) > 4);

  var sampled = curve.sampled;
  assert.ok(sampled.length >= curve.anchors.length * 3);
  assert.ok(model.distance(sampled[0], curve.anchors[0]) < 1.5);
  assert.ok(model.distance(sampled[sampled.length - 1],
    curve.anchors[curve.anchors.length - 1]) < 1.5);

  var loop = model.curveForPoints(
    closedFromCorners([{ x: 0, y: 0 }, { x: 100, y: 0 },
      { x: 100, y: 100 }, { x: 0, y: 100 }], 10), { epsilon: 6, steps: 8 });
  assert.ok(loop);
  assert.strictEqual(loop.closed, true);
  assert.ok(loop.anchors.length >= 4);
  assert.strictEqual(model.curveForPoints([{ x: 0, y: 0 }], {}), null);
});

ok('sampleBezier interpola extremos y líneas rectas', function () {
  var anchors = model.catmullRomToBezier(
    [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }], false).anchors;
  var pts = model.sampleBezier(anchors, false, 12);
  assert.ok(pts.length >= 24);
  assert.ok(Math.abs(pts[0].x) < 0.01);
  assert.ok(Math.abs(pts[pts.length - 1].x - 100) < 0.01);
  var i;
  for (i = 0; i < pts.length; i += 1) {
    assert.ok(Math.abs(pts[i].y) < 0.01, 'una recta debe seguir recta');
  }
  var mid = model.bezierPoint(
    { x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 }, 0.5);
  assert.strictEqual(Math.round(mid.x), 50);
  assert.strictEqual(mid.y, 75);
});

console.log('\n' + tests + ' pruebas superadas.');
