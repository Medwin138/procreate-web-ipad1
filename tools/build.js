/* ==========================================================================
   build.js — concatena los módulos ES5 y comprueba que no se cuelen
   características no soportadas por Safari 9.
   Uso: node tools/build.js
   ========================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var srcDir = path.join(root, 'src');
var outDir = path.join(root, 'dist');
var outFile = path.join(outDir, 'app.js');

var FILES = [
  '00-core.js',
  '10-storage.js',
  '20-model.js',
  '30-ui.js',
  '40-gallery.js',
  '50-studio.js',
  '60-panels.js',
  '70-diag.js',
  '80-app.js'
];

var FORBIDDEN = [
  { name: 'let', re: /(^|[^.\w$])let\s+[A-Za-z_$]/ },
  { name: 'const', re: /(^|[^.\w$])const\s+[A-Za-z_$]/ },
  { name: 'arrow function', re: /=>/ },
  { name: 'template literal', re: /`/ },
  { name: 'class', re: /(^|[^.\w$])class\s+[A-Za-z_$]/ },
  { name: 'async', re: /(^|[^.\w$])async\s+/ },
  { name: 'await', re: /(^|[^.\w$])await\s+/ },
  { name: 'spread', re: /\.\.\./ },
  { name: 'generator', re: /function\s*\*/ },
  { name: 'Object.assign', re: /\bObject\.assign\s*\(/ },
  { name: 'Array.from', re: /\bArray\.from\s*\(/ },
  { name: 'includes', re: /\.includes\s*\(/ },
  { name: 'Promise', re: /\bPromise\b/ },
  { name: 'Symbol', re: /\bSymbol\b/ },
  { name: 'fetch', re: /(^|[^.\w$])fetch\s*\(/ },
  { name: 'default parameter', re: /function\s*[A-Za-z_$]*\s*\([^)]*=[^)]*\)/ }
];

function stripCommentsAndStrings(code) {
  var out = '';
  var i = 0;
  var len = code.length;
  var state = 'code';
  var quote = '';

  while (i < len) {
    var ch = code.charAt(i);
    var next = code.charAt(i + 1);

    if (state === 'code') {
      if (ch === '/' && next === '/') {
        state = 'line-comment';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        state = 'block-comment';
        i += 2;
        continue;
      }
      if (ch === '"' || ch === "'") {
        state = 'string';
        quote = ch;
        out += ch;
        i += 1;
        continue;
      }
      out += ch;
      i += 1;
    } else if (state === 'line-comment') {
      if (ch === '\n') {
        state = 'code';
        out += '\n';
      }
      i += 1;
    } else if (state === 'block-comment') {
      if (ch === '*' && next === '/') {
        state = 'code';
        i += 2;
      } else {
        i += 1;
      }
    } else if (state === 'string') {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) {
        state = 'code';
      }
      i += 1;
    } else {
      i += 1;
    }
  }
  return out;
}

function lineOf(code, index) {
  var before = code.substring(0, index);
  return before.split('\n').length;
}

function scan(file, code) {
  var clean = stripCommentsAndStrings(code);
  var problems = [];
  var i;
  var j;
  for (i = 0; i < FORBIDDEN.length; i += 1) {
    var rule = FORBIDDEN[i];
    var match = rule.re.exec(clean);
    if (match) {
      problems.push({
        rule: rule.name,
        line: lineOf(clean, match.index)
      });
    }
  }
  if (problems.length) {
    problems.sort(function (a, b) { return a.line - b.line; });
    var lines = ['ES5 no compatible en ' + file + ':'];
    for (j = 0; j < problems.length; j += 1) {
      lines.push('  línea ' + problems[j].line + ': ' + problems[j].rule);
    }
    throw new Error(lines.join('\n'));
  }
}

function build() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }

  var parts = [];
  var totalLines = 0;
  var i;

  parts.push('/* Procreate Web ' + require(path.join(root, 'package.json')).version +
    ' — build ' + new Date().toISOString() + ' — ES5 estricto */');

  for (i = 0; i < FILES.length; i += 1) {
    var file = FILES[i];
    var full = path.join(srcDir, file);
    if (!fs.existsSync(full)) {
      throw new Error('Falta el módulo ' + file);
    }
    var code = fs.readFileSync(full, 'utf8');
    scan(file, code);
    totalLines += code.split('\n').length;
    parts.push('/* ---- ' + file + ' ---- */');
    parts.push(code.replace(/\s+$/, ''));
  }

  fs.writeFileSync(outFile, parts.join('\n\n') + '\n', 'utf8');
  var size = fs.statSync(outFile).size;
  console.log('Build OK: ' + path.relative(root, outFile) +
    ' (' + (size / 1024).toFixed(1) + ' KB, ' + totalLines + ' líneas fuente)');
  console.log('Comprobación ES5: ' + FILES.length + ' módulos sin let/const/arrow/class/plantillas.');
}

try {
  build();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
