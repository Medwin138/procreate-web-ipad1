'use strict';
/* Comprueba que cada id usado desde src/*.js existe en index.html y avisa de
   ids del HTML que no se mencionan en ningún módulo. */
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '..');

var DYNAMIC = {
  'prompt-input': true,
  'new-width': true,
  'new-height': true,
  'new-budget-note': true,
  'new-name': true,
  'canvas-name': true,
  'canvas-bg': true,
  'canvas-width': true,
  'canvas-height': true,
  'canvas-anchor': true,
  'canvas-scale': true,
  'brush-quickshape': true,
  'brush-curve-recognition': true
};

var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var htmlIds = {};
var m;
var re = /\bid\s*=\s*"([^"]+)"/g;
while ((m = re.exec(html)) !== null) {
  htmlIds[m[1]] = true;
}

var srcDir = path.join(root, 'src');
var files = fs.readdirSync(srcDir).filter(function (f) { return /\.js$/.test(f); });
var direct = {};
var mentioned = {};
var codeAll = '';

files.forEach(function (file) {
  var code = fs.readFileSync(path.join(srcDir, file), 'utf8');
  codeAll += '\n' + code;
  var r = /(?:dom\.id|\bid)\(\s*'([^']+)'\s*\)/g;
  while ((m = r.exec(code)) !== null) {
    direct[m[1]] = file;
  }
});

Object.keys(htmlIds).forEach(function (id) {
  if (codeAll.indexOf("'" + id + "'") >= 0) { mentioned[id] = true; }
});

var missing = [];
Object.keys(direct).forEach(function (id) {
  if (!htmlIds[id] && !DYNAMIC[id]) { missing.push(id + ' (' + direct[id] + ')'); }
});

var unreferenced = [];
Object.keys(htmlIds).forEach(function (id) {
  if (!direct[id] && !mentioned[id]) { unreferenced.push(id); }
});

console.log('IDs en index.html: ' + Object.keys(htmlIds).length);
console.log('IDs usados con dom.id/id(): ' + Object.keys(direct).length);
console.log('IDs dinámicos permitidos: ' + Object.keys(DYNAMIC).length);
if (unreferenced.length) {
  console.log('HTML sin mención en src (revisar si es intencional):');
  unreferenced.forEach(function (id) { console.log('  - ' + id); });
}
if (missing.length) {
  console.log('Faltan en el HTML:');
  missing.forEach(function (item) { console.log('  - ' + item); });
  process.exit(1);
}
console.log('Todos los ids usados existen en index.html.');
