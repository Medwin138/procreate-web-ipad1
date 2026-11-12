/* ==========================================================================
   70 — Diagnóstico del dispositivo: canvas, memoria, almacenamiento, táctil.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});
  var dom = PCW.dom;
  var util = PCW.util;
  var ui = PCW.ui;

  var inited = false;
  var returnScreen = 'screen-gallery';
  var measuring = false;
  var measureTimer = null;
  var measureInterval = null;
  var failCount = 0;

  function stamp() {
    var d = new Date();
    return util.pad2(d.getHours()) + ':' + util.pad2(d.getMinutes()) + ':' +
      util.pad2(d.getSeconds());
  }

  function log(text) {
    var el = dom.id('diag-log');
    if (!el) { return; }
    el.textContent += (el.textContent ? '\n' : '') + '[' + stamp() + '] ' + text;
    el.scrollTop = el.scrollHeight;
  }

  function clearLog() {
    var el = dom.id('diag-log');
    if (el) { el.textContent = ''; }
  }

  function check(label, ok, detail) {
    if (!ok) { failCount += 1; }
    log((ok ? 'OK   ' : 'FALLO') + ' · ' + label + (detail ? ' — ' + detail : ''));
  }

  function show() {
    var current = ui.currentScreen();
    if (current !== 'screen-diag') { returnScreen = current; }
    ui.showScreen('screen-diag');
    dom.setText(dom.id('diag-log'), '');
    run();
  }

  function back() {
    ui.showScreen(returnScreen || 'screen-gallery');
    if (returnScreen === 'screen-studio' && PCW.studio) {
      PCW.studio.resize();
      PCW.studio.requestRender();
      PCW.studio.updateBadge();
    } else if (PCW.gallery) {
      PCW.gallery.refresh();
    }
  }

  function envReport() {
    var env = PCW.env;
    log('Procreate Web ' + PCW.version + ' · build ' + PCW.build);
    log('UA: ' + env.ua);
    log('iOS detectado: ' + (env.isIOS ? env.iosVersion : 'no') +
      ' · Safari: ' + (env.isSafari ? 'sí' : 'no') +
      ' · plataforma: ' + env.platform);
    log('Pantalla: ' + env.screenW + '×' + env.screenH +
      ' · ventana: ' + root.innerWidth + '×' + root.innerHeight +
      ' · DPR: ' + env.dpr);
    log('Táctil: ' + (env.hasTouch ? 'sí' : 'no') +
      ' · maxTouchPoints: ' + (navigator.maxTouchPoints || 0) +
      ' · orientación: ' + ((screen.orientation && screen.orientation.type) || 'n/d'));
    log('Web app a pantalla completa: ' + (navigator.standalone ? 'sí' : 'no'));
  }

  function storageReport() {
    var info = PCW.storage.info();
    log('Almacenamiento activo: ' + info.label + ' (' + info.mode + ')');
    log('Persistencia: ' + (info.persisted ? 'sí' : 'NO'));
    log(info.detail);
    log('localStorage escribible: ' + testLocalStorage());
  }

  function testLocalStorage() {
    try {
      root.localStorage.setItem('pcw_probe', '1');
      var ok = root.localStorage.getItem('pcw_probe') === '1';
      root.localStorage.removeItem('pcw_probe');
      return ok ? 'sí' : 'no';
    } catch (e) {
      return 'no (' + e.message + ')';
    }
  }

  function budgetReport() {
    var presets = [
      ['S · Pantalla', 1024, 768],
      ['M · Medio', 1536, 1152],
      ['L · Grande', 2048, 1536],
      ['XL · Extra', 2560, 1920]
    ];
    log('Presupuesto duro de capas: ' + util.formatBytes(PCW.model.BUDGET_BYTES) +
      ' · historial: ' + util.formatBytes(PCW.model.HISTORY_BYTES));
    var i;
    for (i = 0; i < presets.length; i += 1) {
      var b = PCW.model.budgetFor(presets[i][1], presets[i][2]);
      log(presets[i][0] + ': ' + presets[i][1] + '×' + presets[i][2] +
        ' · ' + util.formatBytes(b.layerBytes) + '/capa · ' +
        b.maxLayers + ' capas · ' + util.formatBytes(b.totalBytes));
    }
  }

  function historyReport() {
    log('--- Historial ---');
    if (!PCW.studio || !PCW.studio.historyInfo || !PCW.studio.getState()) {
      log('Ningún lienzo abierto.');
      return;
    }
    var h = PCW.studio.historyInfo();
    log('Deshacer: ' + h.undo + ' · Rehacer: ' + h.redo + ' · ' +
      util.formatBytes(h.bytes) + ' de ' +
      util.formatBytes(PCW.model.HISTORY_BYTES));
    log('Gestos: 2 dedos deshacer · 3 dedos rehacer · margen ' +
      util.GESTURE_TAP_SLOP + ' px por dedo · límite ' +
      util.GESTURE_TAP_MS + ' ms');
  }

  function canvasTest(label, w, h) {
    var t0 = Date.now();
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');
    if (!ctx) {
      check('Canvas ' + label, false, 'sin contexto 2D');
      return null;
    }
    ctx.fillStyle = '#ff3366';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,128,255,0.5)';
    ctx.fillRect(w * 0.25, h * 0.25, w * 0.5, h * 0.5);
    var px = ctx.getImageData(0, 0, 1, 1).data;
    var elapsed = Date.now() - t0;
    var ok = px[0] > 0 && px[2] > 0;
    check('Canvas ' + label, ok, w + '×' + h + ' · ' + elapsed + ' ms · píxel ' +
      px[0] + ',' + px[1] + ',' + px[2]);
    return { canvas: c, ms: elapsed };
  }

  function blendTest() {
    try {
      var c = document.createElement('canvas');
      c.width = 8;
      c.height = 8;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 8, 8);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(0, 0, 8, 8);
      var px = ctx.getImageData(0, 0, 1, 1).data;
      check('Fusión multiply real', px[0] === 0 && px[2] === 0,
        'resultado ' + px[0] + ',' + px[1] + ',' + px[2] + ' (esperado 0,0,0)');
    } catch (e) {
      check('Fusión multiply real', false, e.message);
    }
  }

  function dataUrlTest() {
    try {
      var c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      var ctx = c.getContext('2d');
      var i;
      for (i = 0; i < 40; i += 1) {
        ctx.fillStyle = 'hsl(' + (i * 9) + ',70%,50%)';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 120, 90);
      }
      var url = c.toDataURL('image/png');
      check('toDataURL PNG 512×512', url.indexOf('data:image/png') === 0,
        util.formatBytes(url.length) + ' de cadena');
      var t0 = Date.now();
      c.toDataURL('image/jpeg', 0.8);
      log('toDataURL JPEG 512×512: ' + (Date.now() - t0) + ' ms');
    } catch (e) {
      check('toDataURL PNG 512×512', false, e.message);
    }
  }

  function featureReport() {
    check('IndexedDB presente', !!PCW.env.hasIndexedDB);
    check('WebSQL presente', !!PCW.env.hasWebSQL);
    check('atributo download', !!PCW.env.hasDownload);
    check('Blob + createObjectURL', !!PCW.env.hasBlob);
    check('modos de fusión canvas', !!PCW.env.canvasBlend);
    check('touch events', !!PCW.env.hasTouch);

    try {
      var probe = document.createElement('div');
      probe.style.display = '-webkit-flex';
      probe.style.display = 'flex';
      document.body.appendChild(probe);
      var display = root.getComputedStyle ? root.getComputedStyle(probe).display : probe.style.display;
      document.body.removeChild(probe);
      check('Flexbox', display === 'flex' || display === '-webkit-flex', 'display=' + display);
    } catch (e) {
      check('Flexbox', false, e.message);
    }
  }

  function runCanvasSuite() {
    failCount = 0;
    var aggressive = dom.id('diag-aggressive') && dom.id('diag-aggressive').checked;
    log('--- Canvas ---');
    var basic = canvasTest('S 1024×768', 1024, 768);
    canvasTest('M 1536×1152', 1536, 1152);
    canvasTest('L 2048×1536', 2048, 1536);
    canvasTest('XL 2560×1920', 2560, 1920);
    if (aggressive) {
      log('Modo agresivo activado: si Safari se cierra, el límite está por debajo.');
      canvasTest('3072×2304', 3072, 2304);
      canvasTest('4096×4096', 4096, 4096);
    } else {
      log('Prueba agresiva desactivada (marca la casilla para 3072 y 4096 px).');
    }
    if (basic && basic.canvas) {
      basic.canvas = null;
    }
    blendTest();
    dataUrlTest();
  }

  function testIDB() {
    if (!PCW.env.hasIndexedDB) {
      log('IndexedDB: omitido');
      return;
    }
    var finished = false;
    var timer = setTimeout(function () {
      if (finished) { return; }
      finished = true;
      check('IndexedDB escritura/lectura/reapertura', false, 'timeout de 4 s');
    }, 4000);

    function done(ok, detail) {
      if (finished) { return; }
      finished = true;
      clearTimeout(timer);
      check('IndexedDB escritura/lectura/reapertura', ok, detail);
    }

    var req;
    try {
      req = root.indexedDB.open('pcw_diag', 1);
    } catch (e) {
      done(false, e.message);
      return;
    }
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'k' });
      }
    };
    req.onerror = function () {
      done(false, 'error al abrir');
    };
    req.onsuccess = function () {
      var db = req.result;
      try {
        var tx = db.transaction(['kv'], 'readwrite');
        tx.objectStore('kv').put({ k: 'probe', v: 42 });
        tx.oncomplete = function () {
          try {
            var tx2 = db.transaction(['kv'], 'readonly');
            var get = tx2.objectStore('kv').get('probe');
            get.onsuccess = function () {
              var ok = get.result && get.result.v === 42;
              try { db.close(); } catch (e2) { /* ignorado */ }
              try { root.indexedDB.deleteDatabase('pcw_diag'); } catch (e3) { /* ignorado */ }
              done(ok, ok ? 'valor verificado' : 'lectura distinta');
            };
          } catch (e4) {
            done(false, e4.message);
          }
        };
        tx.onerror = function () {
          done(false, 'error de escritura');
        };
      } catch (e5) {
        done(false, e5.message);
      }
    };
  }

  function testWebSQL() {
    if (!PCW.env.hasWebSQL) {
      log('WebSQL: no disponible');
      return;
    }
    var finished = false;
    var timer = setTimeout(function () {
      if (!finished) {
        finished = true;
        check('WebSQL prueba', false, 'timeout');
      }
    }, 4000);
    try {
      var db = root.openDatabase('pcw_diag_ws', '1.0', 'diag', 1024 * 1024);
      db.transaction(function (tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS t (k TEXT PRIMARY KEY, v TEXT)');
        tx.executeSql('INSERT OR REPLACE INTO t (k, v) VALUES (?, ?)', ['probe', 'ok']);
        tx.executeSql('SELECT v FROM t WHERE k = ?', ['probe'], function (tx2, rs) {
          var ok = rs.rows.length && rs.rows.item(0).v === 'ok';
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            check('WebSQL prueba', !!ok, ok ? 'valor verificado' : 'lectura distinta');
          }
        });
      }, function (err) {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          check('WebSQL prueba', false, (err && err.message) || 'error');
        }
      });
    } catch (e) {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        check('WebSQL prueba', false, e.message);
      }
    }
  }

  function finishReport() {
    log('--- Resumen ---');
    log('Fallos detectados en esta ejecución: ' + failCount);
    log('Guarda este informe y pásalo al desarrollo. Los límites de canvas no se ' +
      'prometen hasta probarlos en el iPad mini 1 real.');
  }

  function run() {
    clearLog();
    log('Banco de diagnóstico. No modifica proyectos.');
    envReport();
    storageReport();
    budgetReport();
    historyReport();
    log('--- Características ---');
    runCanvasSuite();
    featureReport();
    log('--- Almacenamiento ---');
    testIDB();
    testWebSQL();
    setTimeout(finishReport, 4300);
  }

  function measureTouch() {
    if (measuring) { return; }
    measuring = true;
    var count = 0;
    var moves = 0;
    var start = Date.now();
    var btn = dom.id('diag-touch');
    var first = null;
    var maxDist = 0;

    function onMove(ev) {
      if (!ev.touches || !ev.touches.length) { return; }
      count += 1;
      var t = ev.touches[0];
      if (!first) {
        first = { x: t.clientX, y: t.clientY };
      } else {
        var dx = t.clientX - first.x;
        var dy = t.clientY - first.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxDist) { maxDist = d; }
      }
    }

    document.addEventListener('touchmove', onMove, false);
    ui.toast('Desliza el dedo por la pantalla durante 3 segundos', 3200);

    measureInterval = setInterval(function () {
      var remain = Math.max(0, 3 - Math.floor((Date.now() - start) / 1000));
      if (btn) { btn.textContent = 'Midiendo… ' + remain + ' s'; }
    }, 300);

    measureTimer = setTimeout(function () {
      document.removeEventListener('touchmove', onMove, false);
      clearInterval(measureInterval);
      measureInterval = null;
      measuring = false;
      if (btn) { btn.textContent = 'Medir entrada táctil (3 s)'; }
      var seconds = (Date.now() - start) / 1000;
      log('Entrada táctil: ' + count + ' touchmove en ' + seconds.toFixed(1) +
        ' s · ' + (count / seconds).toFixed(1) + ' eventos/s · recorrido máx ' +
        Math.round(maxDist) + ' px');
      log('Referencia: por debajo de ~50 eventos/s el trazo puede verse a saltos.');
    }, 3000);
  }

  function saveReport() {
    var text = dom.id('diag-log').textContent;
    ui.deliverText(text, 'diagnostico-procreate-web.txt', 'text/plain',
      'Informe de diagnóstico');
  }

  function init() {
    if (inited) { return; }
    inited = true;
    dom.on(dom.id('diag-run'), 'click', run);
    dom.on(dom.id('diag-touch'), 'click', measureTouch);
    dom.on(dom.id('diag-save'), 'click', saveReport);
    dom.on(dom.id('btn-diag-back'), 'click', back);
  }

  PCW.diag = {
    init: init,
    show: show,
    back: back,
    run: run,
    measureTouch: measureTouch,
    saveReport: saveReport
  };

})(typeof window !== 'undefined' ? window : this);
