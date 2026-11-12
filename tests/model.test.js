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
  assert.strictEqual(model.BRUSHES.length, 27);
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

console.log('\n' + tests + ' pruebas superadas.');
