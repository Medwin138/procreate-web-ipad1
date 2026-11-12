/* ==========================================================================
   10 — Almacenamiento: IndexedDB → WebSQL → memoria.
   Todas las operaciones tienen timeout y verificación de lectura.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});
  var util = PCW.util;

  var mode = 'pending';
  var idb = null;
  var wdb = null;
  var initStarted = false;
  var initQueue = [];

  var mem = {
    projects: {},
    layers: {},
    kv: {}
  };

  function later(fn) {
    setTimeout(fn, 0);
  }

  function guard(cb, ms) {
    var done = false;
    var timer = setTimeout(function () {
      if (!done) {
        done = true;
        cb(new Error('Tiempo de espera agotado (' + ms + ' ms)'));
      }
    }, ms || 8000);
    return function (err, res) {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      cb(err, res);
    };
  }

  function finishInit() {
    var queue = initQueue.slice(0);
    initQueue = [];
    var i;
    for (i = 0; i < queue.length; i += 1) {
      queue[i](null, {
        mode: mode,
        label: label(),
        detail: detail()
      });
    }
  }

  function label() {
    if (mode === 'idb') { return 'IndexedDB'; }
    if (mode === 'websql') { return 'WebSQL'; }
    if (mode === 'memory') { return 'Memoria (sin persistencia)'; }
    return 'Iniciando';
  }

  function detail() {
    if (mode === 'idb') {
      return 'Los proyectos persisten en este navegador. Safari 9 puede desalojarlos; exporta respaldos.';
    }
    if (mode === 'websql') {
      return 'IndexedDB falló; se usa WebSQL como respaldo. Exporta respaldos con frecuencia.';
    }
    if (mode === 'memory') {
      return 'Sin almacenamiento persistente disponible. Al cerrar la pestaña se pierden los proyectos.';
    }
    return '';
  }

  /* ----------------------------------------------------------- IndexedDB */

  function openIDB(cb) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) { return; }
      done = true;
      cb(new Error('IndexedDB no respondió al abrir'));
    }, 4000);

    function end(err, db) {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      cb(err, db);
    }

    var req;
    try {
      req = root.indexedDB.open('pcw', 1);
    } catch (e) {
      end(e);
      return;
    }

    req.onupgradeneeded = function () {
      var db = req.result;
      try {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('layers')) {
          var store = db.createObjectStore('layers', { keyPath: 'key' });
          store.createIndex('projectId', 'projectId', { unique: false });
        }
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'k' });
        }
      } catch (e) {
        end(e);
      }
    };

    req.onsuccess = function () {
      end(null, req.result);
    };

    req.onerror = function () {
      end(req.error || new Error('Error al abrir IndexedDB'));
    };

    req.onblocked = function () {
      end(new Error('IndexedDB bloqueado por otra pestaña'));
    };
  }

  function idbTx(stores, txMode, work, cb) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) { return; }
      done = true;
      cb(new Error('Transacción IndexedDB sin respuesta'));
    }, 8000);

    function end(err) {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      cb(err || null);
    }

    var tx;
    try {
      tx = idb.transaction(stores, txMode);
    } catch (e) {
      end(e);
      return;
    }

    tx.oncomplete = function () { end(null); };
    tx.onerror = function () { end(tx.error || new Error('Error de transacción IndexedDB')); };
    tx.onabort = function () { end(tx.error || new Error('Transacción IndexedDB abortada')); };

    try {
      work(tx);
    } catch (e2) {
      end(e2);
      try { tx.abort(); } catch (e3) { /* ignorado */ }
    }
  }

  function idbGet(store, key, cb) {
    var out = null;
    idbTx([store], 'readonly', function (tx) {
      var req = tx.objectStore(store).get(key);
      req.onsuccess = function () { out = req.result; };
    }, function (err) {
      cb(err, out);
    });
  }

  function idbPut(store, value, cb) {
    idbTx([store], 'readwrite', function (tx) {
      tx.objectStore(store).put(value);
    }, cb);
  }

  function idbListProjects(cb) {
    var list = [];
    idbTx(['projects'], 'readonly', function (tx) {
      var req = tx.objectStore('projects').openCursor();
      req.onsuccess = function () {
        var cursor = req.result;
        if (cursor) {
          list.push(cursor.value);
          cursor.continue();
        }
      };
    }, function (err) {
      if (err) { cb(err); return; }
      list.sort(function (a, b) {
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
      cb(null, list);
    });
  }

  function idbSaveProject(record, layerData, removedIds, cb) {
    var tx;
    try {
      tx = idb.transaction(['projects', 'layers'], 'readwrite');
    } catch (e) {
      cb(e);
      return;
    }

    var done = false;
    var timer = setTimeout(function () {
      if (!done) { done = true; cb(new Error('Guardado IndexedDB sin respuesta')); }
    }, 10000);

    function end(err) {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      if (err) { cb(err); return; }
      idbGet('projects', record.id, function (err2, saved) {
        if (err2) { cb(err2); return; }
        if (!saved || saved.updatedAt !== record.updatedAt) {
          cb(new Error('Verificación de guardado fallida'));
          return;
        }
        cb(null);
      });
    }

    tx.oncomplete = function () { end(null); };
    tx.onerror = function () { end(tx.error || new Error('Error al guardar proyecto')); };
    tx.onabort = function () { end(tx.error || new Error('Guardado abortado')); };

    try {
      tx.objectStore('projects').put(record);
      var layerStore = tx.objectStore('layers');
      var layerId;
      for (layerId in layerData) {
        if (Object.prototype.hasOwnProperty.call(layerData, layerId)) {
          layerStore.put({
            key: record.id + '/' + layerId,
            projectId: record.id,
            layerId: layerId,
            data: layerData[layerId]
          });
        }
      }
      var i;
      for (i = 0; i < removedIds.length; i += 1) {
        layerStore.delete(record.id + '/' + removedIds[i]);
      }
    } catch (e2) {
      end(e2);
      try { tx.abort(); } catch (e3) { /* ignorado */ }
    }
  }

  function idbLoadProject(projectId, cb) {
    var record = null;
    var layers = {};
    idbTx(['projects'], 'readonly', function (tx) {
      var req = tx.objectStore('projects').get(projectId);
      req.onsuccess = function () { record = req.result; };
    }, function (err) {
      if (err) { cb(err); return; }
      if (!record) { cb(new Error('Proyecto no encontrado')); return; }
      idbTx(['layers'], 'readonly', function (tx2) {
        var store = tx2.objectStore('layers');
        var index = store.index('projectId');
        var req2 = index.openCursor(IDBKeyRange.only(projectId));
        req2.onsuccess = function () {
          var cursor = req2.result;
          if (cursor) {
            layers[cursor.value.layerId] = cursor.value.data;
            cursor.continue();
          }
        };
      }, function (err2) {
        if (err2) { cb(err2); return; }
        cb(null, { record: record, layers: layers });
      });
    });
  }

  function idbDeleteProject(projectId, cb) {
    idbTx(['projects', 'layers'], 'readwrite', function (tx) {
      tx.objectStore('projects').delete(projectId);
      var index = tx.objectStore('layers').index('projectId');
      var req = index.openCursor(IDBKeyRange.only(projectId));
      req.onsuccess = function () {
        var cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    }, cb);
  }

  /* --------------------------------------------------------------- WebSQL */

  function openWS() {
    if (typeof root.openDatabase !== 'function') { return null; }
    try {
      return root.openDatabase('pcw_ws', '1.0', 'Procreate Web', 8 * 1024 * 1024);
    } catch (e) {
      return null;
    }
  }

  function wsRun(sql, args, cb) {
    var done = guard(cb || function () {}, 8000);
    wdb.transaction(function (tx) {
      tx.executeSql(sql, args || [], function () {
        done(null);
      }, function (tx2, err) {
        done(err || new Error('Error SQL'));
        return true;
      });
    }, function (err) {
      done(err || new Error('Error de transacción WebSQL'));
    }, function () {
      done(null);
    });
  }

  function wsInit(cb) {
    wdb = openWS();
    if (!wdb) { cb(new Error('WebSQL no disponible')); return; }
    var done = guard(cb, 8000);
    wdb.transaction(function (tx) {
      tx.executeSql('CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, json TEXT, updatedAt INTEGER)');
      tx.executeSql('CREATE TABLE IF NOT EXISTS layers (key TEXT PRIMARY KEY, projectId TEXT, data TEXT)');
      tx.executeSql('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
      tx.executeSql('CREATE INDEX IF NOT EXISTS layers_project ON layers (projectId)');
    }, function (err) {
      done(err || new Error('No se pudo crear el esquema WebSQL'));
    }, function () {
      var stamp = String(Date.now());
      wdb.transaction(function (tx2) {
        tx2.executeSql('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', ['__test', stamp]);
        tx2.executeSql('SELECT v FROM kv WHERE k = ?', ['__test'], function (tx3, rs) {
          if (!rs.rows.length || rs.rows.item(0).v !== stamp) {
            done(new Error('Verificación WebSQL fallida'));
          }
        });
      }, function (err2) {
        done(err2 || new Error('Error de prueba WebSQL'));
      }, function () {
        done(null);
      });
    });
  }

  function wsListProjects(cb) {
    var done = guard(cb, 8000);
    var rows = [];
    wdb.transaction(function (tx) {
      tx.executeSql('SELECT json FROM projects ORDER BY updatedAt DESC', [], function (tx2, rs) {
        var i;
        for (i = 0; i < rs.rows.length; i += 1) {
          try {
            rows.push(JSON.parse(rs.rows.item(i).json));
          } catch (e) { /* registro corrupto */ }
        }
      }, function (tx3, err) {
        done(err);
        return true;
      });
    }, function (err) {
      done(err);
    }, function () {
      done(null, rows);
    });
  }

  function wsSaveProject(record, layerData, removedIds, cb) {
    var done = guard(cb, 12000);
    var json = JSON.stringify(record);
    wdb.transaction(function (tx) {
      tx.executeSql(
        'INSERT OR REPLACE INTO projects (id, json, updatedAt) VALUES (?, ?, ?)',
        [record.id, json, record.updatedAt]
      );
      var layerId;
      for (layerId in layerData) {
        if (Object.prototype.hasOwnProperty.call(layerData, layerId)) {
          tx.executeSql(
            'INSERT OR REPLACE INTO layers (key, projectId, data) VALUES (?, ?, ?)',
            [record.id + '/' + layerId, record.id, layerData[layerId]]
          );
        }
      }
      var i;
      for (i = 0; i < removedIds.length; i += 1) {
        tx.executeSql('DELETE FROM layers WHERE key = ?', [record.id + '/' + removedIds[i]]);
      }
    }, function (err) {
      done(err || new Error('Error al guardar en WebSQL'));
    }, function () {
      wdb.transaction(function (tx2) {
        tx2.executeSql('SELECT updatedAt FROM projects WHERE id = ?', [record.id], function (tx3, rs) {
          if (!rs.rows.length || rs.rows.item(0).updatedAt !== record.updatedAt) {
            done(new Error('Verificación WebSQL del proyecto fallida'));
          }
        });
      }, function (err2) {
        done(err2);
      }, function () {
        done(null);
      });
    });
  }

  function wsLoadProject(projectId, cb) {
    var done = guard(cb, 10000);
    var record = null;
    var layers = {};
    wdb.transaction(function (tx) {
      tx.executeSql('SELECT json FROM projects WHERE id = ?', [projectId], function (tx2, rs) {
        if (rs.rows.length) {
          try { record = JSON.parse(rs.rows.item(0).json); } catch (e) { record = null; }
        }
      });
      tx.executeSql('SELECT layerId, data FROM layers WHERE projectId = ?', [projectId], function (tx3, rs2) {
        var i;
        for (i = 0; i < rs2.rows.length; i += 1) {
          layers[rs2.rows.item(i).layerId] = rs2.rows.item(i).data;
        }
      });
    }, function (err) {
      done(err);
    }, function () {
      if (!record) {
        done(new Error('Proyecto no encontrado'));
      } else {
        done(null, { record: record, layers: layers });
      }
    });
  }

  function wsDeleteProject(projectId, cb) {
    var done = guard(cb, 8000);
    wdb.transaction(function (tx) {
      tx.executeSql('DELETE FROM projects WHERE id = ?', [projectId]);
      tx.executeSql('DELETE FROM layers WHERE projectId = ?', [projectId]);
    }, function (err) {
      done(err);
    }, function () {
      done(null);
    });
  }

  /* ------------------------------------------------------------- Memoria */

  function memList(cb) {
    var list = [];
    var id;
    for (id in mem.projects) {
      if (Object.prototype.hasOwnProperty.call(mem.projects, id)) {
        list.push(mem.projects[id]);
      }
    }
    list.sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    later(function () { cb(null, list); });
  }

  function memSave(record, layerData, removedIds, cb) {
    var copy = JSON.parse(JSON.stringify(record));
    mem.projects[record.id] = copy;
    var layerId;
    for (layerId in layerData) {
      if (Object.prototype.hasOwnProperty.call(layerData, layerId)) {
        mem.layers[record.id + '/' + layerId] = {
          projectId: record.id,
          layerId: layerId,
          data: layerData[layerId]
        };
      }
    }
    var i;
    for (i = 0; i < removedIds.length; i += 1) {
      delete mem.layers[record.id + '/' + removedIds[i]];
    }
    later(function () { cb(null); });
  }

  function memLoad(projectId, cb) {
    var record = mem.projects[projectId];
    if (!record) {
      later(function () { cb(new Error('Proyecto no encontrado')); });
      return;
    }
    var layers = {};
    var key;
    for (key in mem.layers) {
      if (Object.prototype.hasOwnProperty.call(mem.layers, key)) {
        if (mem.layers[key].projectId === projectId) {
          layers[mem.layers[key].layerId] = mem.layers[key].data;
        }
      }
    }
    later(function () {
      cb(null, { record: JSON.parse(JSON.stringify(record)), layers: layers });
    });
  }

  function memDelete(projectId, cb) {
    delete mem.projects[projectId];
    var key;
    var remove = [];
    for (key in mem.layers) {
      if (Object.prototype.hasOwnProperty.call(mem.layers, key) &&
          mem.layers[key].projectId === projectId) {
        remove.push(key);
      }
    }
    var i;
    for (i = 0; i < remove.length; i += 1) {
      delete mem.layers[remove[i]];
    }
    later(function () { cb(null); });
  }

  /* ------------------------------------------------------------------ init */

  function tryWebSQL() {
    wsInit(function (err) {
      if (err) {
        idb = null;
        wdb = null;
        mode = 'memory';
      } else {
        mode = 'websql';
      }
      PCW.log('Almacenamiento: ' + label(), mode === 'memory' ? 'warn' : 'info');
      finishInit();
    });
  }

  function tryIDB() {
    openIDB(function (err, db) {
      if (err) {
        PCW.log('IndexedDB no disponible: ' + err.message, 'warn');
        tryWebSQL();
        return;
      }
      idb = db;
      var stamp = Date.now();
      idbPut('kv', { k: '__test', v: stamp }, function (putErr) {
        if (putErr) {
          PCW.log('IndexedDB falló al escribir: ' + putErr.message, 'warn');
          try { idb.close(); } catch (e) { /* ignorado */ }
          idb = null;
          tryWebSQL();
          return;
        }
        idbGet('kv', '__test', function (getErr, res) {
          if (getErr || !res || res.v !== stamp) {
            PCW.log('IndexedDB no superó la verificación de lectura', 'warn');
            try { idb.close(); } catch (e2) { /* ignorado */ }
            idb = null;
            tryWebSQL();
            return;
          }
          mode = 'idb';
          PCW.log('Almacenamiento: IndexedDB');
          finishInit();
        });
      });
    });
  }

  function init(cb) {
    if (mode !== 'pending') {
      if (cb) {
        later(function () {
          cb(null, { mode: mode, label: label(), detail: detail() });
        });
      }
      return;
    }
    if (cb) { initQueue.push(cb); }
    if (initStarted) { return; }
    initStarted = true;
    if (!PCW.env.hasIndexedDB && !PCW.env.hasWebSQL) {
      mode = 'memory';
      PCW.log('Sin IndexedDB ni WebSQL: modo memoria', 'warn');
      finishInit();
      return;
    }
    if (PCW.env.hasIndexedDB) {
      tryIDB();
    } else {
      tryWebSQL();
    }
  }

  /* ------------------------------------------------------------------- API */

  function saveProject(record, opts, cb) {
    opts = opts || {};
    var layerData = opts.layerData || {};
    var removedIds = opts.removedLayerIds || [];
    var copy = util.copy(record);
    copy.updatedAt = Date.now();
    record.updatedAt = copy.updatedAt;
    copy.layerCount = copy.layers ? copy.layers.length : 0;

    if (mode === 'idb') {
      idbSaveProject(copy, layerData, removedIds, cb || function () {});
    } else if (mode === 'websql') {
      wsSaveProject(copy, layerData, removedIds, cb || function () {});
    } else {
      memSave(copy, layerData, removedIds, cb || function () {});
    }
  }

  function listProjects(cb) {
    if (mode === 'idb') { idbListProjects(cb); return; }
    if (mode === 'websql') { wsListProjects(cb); return; }
    memList(cb);
  }

  function loadProject(projectId, cb) {
    if (mode === 'idb') { idbLoadProject(projectId, cb); return; }
    if (mode === 'websql') { wsLoadProject(projectId, cb); return; }
    memLoad(projectId, cb);
  }

  function deleteProject(projectId, cb) {
    if (mode === 'idb') { idbDeleteProject(projectId, cb || function () {}); return; }
    if (mode === 'websql') { wsDeleteProject(projectId, cb || function () {}); return; }
    memDelete(projectId, cb || function () {});
  }

  function saveSettings(settings, cb) {
    var json = JSON.stringify(settings || {});
    if (mode === 'idb') {
      idbPut('kv', { k: 'settings', v: json }, cb || function () {});
      return;
    }
    if (mode === 'websql') {
      wsRun('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', ['settings', json], cb || function () {});
      return;
    }
    mem.kv.settings = json;
    if (cb) { later(function () { cb(null); }); }
  }

  function loadSettings(cb) {
    function parse(value) {
      try {
        return value ? JSON.parse(value) : {};
      } catch (e) {
        return {};
      }
    }
    if (mode === 'idb') {
      idbGet('kv', 'settings', function (err, res) {
        cb(err, parse(res && res.v));
      });
      return;
    }
    if (mode === 'websql') {
      var done = guard(cb, 8000);
      wdb.transaction(function (tx) {
        tx.executeSql('SELECT v FROM kv WHERE k = ?', ['settings'], function (tx2, rs) {
          done(null, parse(rs.rows.length ? rs.rows.item(0).v : ''));
        });
      }, function (err) {
        done(err);
      });
      return;
    }
    cb(null, parse(mem.kv.settings));
  }

  function info() {
    return {
      mode: mode,
      label: label(),
      detail: detail(),
      persisted: mode === 'idb' || mode === 'websql'
    };
  }

  PCW.storage = {
    init: init,
    info: info,
    saveProject: saveProject,
    listProjects: listProjects,
    loadProject: loadProject,
    deleteProject: deleteProject,
    saveSettings: saveSettings,
    loadSettings: loadSettings,
    _memory: mem
  };

})(typeof window !== 'undefined' ? window : this);
