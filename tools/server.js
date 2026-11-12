/* ==========================================================================
   server.js — servidor estático para desarrollo en LAN.
   Uso: node tools/server.js  ·  http://IP:8090
   ========================================================================== */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var os = require('os');

var ROOT = path.resolve(__dirname, '..');
var PORT = parseInt(process.env.PORT || '8090', 10);
var HOST = process.env.HOST || '0.0.0.0';

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.pcw': 'application/json; charset=utf-8'
};

function safePath(requestUrl) {
  var raw = String(requestUrl || '/');
  var cut = raw.search(/[?#]/);
  if (cut >= 0) { raw = raw.slice(0, cut); }
  var pathname = decodeURIComponent(raw || '/');
  if (pathname === '/') { pathname = '/index.html'; }
  if (pathname.indexOf('\0') >= 0) { return null; }
  var resolved = path.resolve(ROOT, '.' + pathname);
  var prefix = ROOT + path.sep;
  if (resolved !== ROOT && resolved.indexOf(prefix) !== 0) { return null; }
  return resolved;
}

function serve(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Método no permitido');
    return;
  }

  var filePath = safePath(req.url);
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Ruta no permitida');
    return;
  }

  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No encontrado: ' + req.url);
      return;
    }

    var ext = path.extname(filePath).toLowerCase();
    var headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    };

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    var stream = fs.createReadStream(filePath);
    stream.on('error', function () {
      res.destroy();
    });
    stream.pipe(res);
  });
}

function lanAddresses() {
  var list = [];
  var interfaces = os.networkInterfaces();
  var name;
  for (name in interfaces) {
    if (!Object.prototype.hasOwnProperty.call(interfaces, name)) { continue; }
    var iface = interfaces[name];
    var i;
    for (i = 0; i < iface.length; i += 1) {
      var entry = iface[i];
      if (entry.family === 'IPv4' && !entry.internal) {
        list.push(entry.address);
      }
    }
  }
  return list;
}

http.createServer(serve).listen(PORT, HOST, function () {
  console.log('Procreate Web · servidor de desarrollo');
  console.log('Raíz: ' + ROOT);
  console.log('Local: http://localhost:' + PORT + '/');
  var list = lanAddresses();
  var i;
  for (i = 0; i < list.length; i += 1) {
    console.log('LAN:   http://' + list[i] + ':' + PORT + '/  (iPad en la misma red)');
  }
  console.log('Diagnóstico: http://localhost:' + PORT + '/?diag=1');
});
