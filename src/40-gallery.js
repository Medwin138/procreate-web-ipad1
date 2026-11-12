/* ==========================================================================
   40 — Galería: listado, creación, renombrado, duplicado y borrado.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});
  var dom = PCW.dom;
  var util = PCW.util;
  var model = PCW.model;
  var storage = PCW.storage;
  var ui = PCW.ui;

  var projects = [];
  var inited = false;
  var currentPreset = 'pantalla';
  var refreshing = false;

  var PRESETS = [
    { id: 'pantalla', name: 'Pantalla', w: 1024, h: 768 },
    { id: 'retrato', name: 'Retrato', w: 768, h: 1024 },
    { id: 'cuadrado', name: 'Cuadrado', w: 1024, h: 1024 },
    { id: 'medio', name: 'Medio', w: 1536, h: 1152 },
    { id: 'grande', name: 'Grande', w: 2048, h: 1536 },
    { id: 'extra', name: 'Extra', w: 2560, h: 1920 }
  ];

  function findUp(node, attr) {
    var el = node;
    while (el && el !== document) {
      if (el.getAttribute && el.getAttribute(attr) != null) { return el; }
      el = el.parentNode;
    }
    return null;
  }

  function findProject(projectId) {
    var i;
    for (i = 0; i < projects.length; i += 1) {
      if (projects[i].id === projectId) { return projects[i]; }
    }
    return null;
  }

  function safeFilename(name) {
    var s = String(name || 'proyecto').replace(/[\\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    if (!s) { s = 'proyecto'; }
    return s.substring(0, 48);
  }

  function setStorageNote() {
    var note = dom.id('gallery-storage-note');
    var info = storage.info();
    if (!note) { return; }
    if (info.mode === 'memory') {
      note.textContent = 'Sin persistencia: ' + info.detail;
      note.className = 'storage-note';
      note.style.background = '#2f1717';
      note.style.borderColor = '#5a2424';
      note.style.color = '#ffb1b1';
      dom.show(note);
    } else if (info.mode === 'websql') {
      note.textContent = 'Almacenamiento de respaldo (WebSQL). ' + info.detail;
      dom.show(note);
    } else {
      dom.hide(note);
    }
  }

  function renderEmpty(isEmpty) {
    var empty = dom.id('gallery-empty');
    if (isEmpty) { dom.show(empty); } else { dom.hide(empty); }
  }

  function cardThumb(record) {
    var thumb = dom.create('span', 'card-thumb');
    if (record.thumb) {
      thumb.style.backgroundImage = 'url(' + record.thumb + ')';
    } else {
      thumb.innerHTML = '<svg class="ico thumb-empty" viewBox="0 0 24 24">' +
        '<rect x="3" y="4" width="18" height="16" rx="2"/>' +
        '<path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="8.5" cy="8.5" r="1.4"/></svg>';
    }
    return thumb;
  }

  function renderList() {
    var grid = dom.id('gallery-grid');
    var count = dom.id('gallery-count');
    dom.empty(grid);
    dom.setText(count, projects.length ?
      (projects.length + (projects.length === 1 ? ' lienzo' : ' lienzos')) : '');

    if (!projects.length) {
      renderEmpty(true);
      return;
    }
    renderEmpty(false);

    var i;
    for (i = 0; i < projects.length; i += 1) {
      (function (record) {
        var card = dom.create('div', 'project-card');
        card.setAttribute('data-id', record.id);

        var open = dom.create('button', 'card-open');
        open.type = 'button';
        open.setAttribute('data-open', record.id);
        open.setAttribute('aria-label', 'Abrir ' + (record.name || 'proyecto'));
        open.appendChild(cardThumb(record));

        var meta = dom.create('span', 'card-meta');
        meta.appendChild(dom.create('span', 'card-name', record.name || 'Sin título'));
        meta.appendChild(dom.create('span', 'card-sub',
          util.formatDim(record.width, record.height) + ' · ' +
          util.formatDate(record.updatedAt) + ' · ' +
          (record.layerCount || (record.layers ? record.layers.length : 1)) + ' capas'));
        open.appendChild(meta);

        var menu = dom.create('button', 'card-menu', '⋯');
        menu.type = 'button';
        menu.setAttribute('data-menu', record.id);
        menu.setAttribute('aria-label', 'Opciones de ' + (record.name || 'proyecto'));

        card.appendChild(open);
        card.appendChild(menu);
        grid.appendChild(card);
      }(projects[i]));
    }
  }

  function refresh(cb) {
    if (refreshing) {
      if (cb) { setTimeout(function () { cb(); }, 120); }
      return;
    }
    refreshing = true;
    setStorageNote();
    storage.listProjects(function (err, list) {
      refreshing = false;
      if (err) {
        PCW.logError('gallery:list', err);
        ui.toast('No se pudo leer la galería: ' + err.message, 3200);
        renderList();
        if (cb) { cb(err); }
        return;
      }
      projects = list || [];
      renderList();
      if (cb) { cb(null); }
    });
  }

  function show() {
    ui.showScreen('screen-gallery');
    refresh();
  }

  /* ------------------------------------------------------------ nuevo lienzo */

  function presetById(presetId) {
    var i;
    for (i = 0; i < PRESETS.length; i += 1) {
      if (PRESETS[i].id === presetId) { return PRESETS[i]; }
    }
    return PRESETS[0];
  }

  function budgetNote() {
    var w = parseInt((dom.id('new-width') || {}).value, 10);
    var h = parseInt((dom.id('new-height') || {}).value, 10);
    var note = dom.id('new-budget-note');
    if (!note) { return; }
    if (!w || !h) {
      note.className = 'form-error';
      note.textContent = 'Introduce anchura y altura.';
      return;
    }
    if (!model.validSize(w, h)) {
      note.className = 'form-error';
      note.textContent = 'Dimensiones permitidas: de ' + model.MIN_SIZE +
        ' a ' + model.MAX_SIZE + ' px por lado.';
      return;
    }
    var budget = model.budgetFor(w, h);
    if (budget.overBudget || budget.maxLayers < 1) {
      note.className = 'form-error';
      note.textContent = 'Una capa de ' + util.formatDim(w, h) + ' ocupa ' +
        util.formatBytes(budget.layerBytes) +
        ' y supera el presupuesto de 40 MB. Reduce el tamaño.';
      return;
    }
    note.className = 'form-note';
    note.textContent = util.formatDim(w, h) + ' · ' +
      util.formatBytes(budget.layerBytes) + ' por capa · hasta ' +
      budget.maxLayers + ' capas (' + util.formatBytes(budget.totalBytes) +
      ' de píxeles). Presupuesto duro del shell: 40 MB.';
  }

  function selectPreset(presetId, fillInputs) {
    currentPreset = presetId;
    var preset = presetById(presetId);
    if (fillInputs) {
      dom.id('new-width').value = preset.w;
      dom.id('new-height').value = preset.h;
    }
    var items = dom.qsa('.preset');
    var i;
    for (i = 0; i < items.length; i += 1) {
      if (items[i].getAttribute('data-preset') === presetId) {
        items[i].classList.add('is-selected');
      } else {
        items[i].classList.remove('is-selected');
      }
    }
    budgetNote();
  }

  function openNewCanvas() {
    var presetHtml = '<div class="preset-grid">';
    var i;
    for (i = 0; i < PRESETS.length; i += 1) {
      var b = model.budgetFor(PRESETS[i].w, PRESETS[i].h);
      presetHtml += '<button class="preset' +
        (PRESETS[i].id === 'pantalla' ? ' is-selected' : '') +
        '" type="button" data-preset="' + PRESETS[i].id + '">' +
        '<span class="preset-name">' + PRESETS[i].name + '</span>' +
        '<span class="preset-dim">' + PRESETS[i].w + ' × ' + PRESETS[i].h +
        ' · ' + b.maxLayers + ' capas</span></button>';
    }
    presetHtml += '</div>';

    var body = '<div class="field"><label for="new-name">Nombre</label>' +
      '<input id="new-name" class="input" type="text" value="Sin título" ' +
      'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>' +
      '<div class="panel-subhead" style="padding-left:0;margin-top:16px;">Tamaño</div>' +
      presetHtml +
      '<div class="form-row">' +
      '<div class="field"><label for="new-width">Anchura (px)</label>' +
      '<input id="new-width" class="input" type="number" inputmode="numeric" value="1024"></div>' +
      '<div class="field"><label for="new-height">Altura (px)</label>' +
      '<input id="new-height" class="input" type="number" inputmode="numeric" value="768"></div>' +
      '</div>' +
      '<p id="new-budget-note" class="form-note"></p>' +
      '<p class="form-note">Sin fondo transparente en esta fase: el lienzo empieza en blanco. ' +
      'Los pinceles son propios y el motor de trazo es provisional (Fase 3).</p>';

    var ctrl = ui.modal({
      title: 'Nuevo lienzo',
      body: body,
      width: 620,
      buttons: [
        { label: 'Cancelar' },
        {
          label: 'Crear',
          primary: true,
          onClick: function () {
            var name = dom.id('new-name').value;
            var w = parseInt(dom.id('new-width').value, 10);
            var h = parseInt(dom.id('new-height').value, 10);
            var note = dom.id('new-budget-note');
            if (!w || !h || !model.validSize(w, h)) {
              note.className = 'form-error';
              note.textContent = 'Dimensiones inválidas. Usa de ' + model.MIN_SIZE +
                ' a ' + model.MAX_SIZE + ' px.';
              return false;
            }
            var budget = model.budgetFor(w, h);
            if (budget.overBudget || budget.maxLayers < 1) {
              note.className = 'form-error';
              note.textContent = 'Este tamaño supera el presupuesto de 40 MB por lienzo.';
              return false;
            }
            createCanvas(model.cleanName(name), w, h);
          }
        }
      ]
    });

    var presets = dom.qsa('.preset', ctrl.body);
    for (i = 0; i < presets.length; i += 1) {
      (function (btn) {
        dom.on(btn, 'click', function () {
          selectPreset(btn.getAttribute('data-preset'), true);
        });
      }(presets[i]));
    }

    var wInput = dom.id('new-width');
    var hInput = dom.id('new-height');
    var onCustom = function () {
      var selected = null;
      var j;
      for (j = 0; j < PRESETS.length; j += 1) {
        if (PRESETS[j].w === parseInt(wInput.value, 10) &&
            PRESETS[j].h === parseInt(hInput.value, 10)) {
          selected = PRESETS[j].id;
        }
      }
      currentPreset = selected || '';
      var items = dom.qsa('.preset');
      for (j = 0; j < items.length; j += 1) {
        if (items[j].getAttribute('data-preset') === currentPreset) {
          items[j].classList.add('is-selected');
        } else {
          items[j].classList.remove('is-selected');
        }
      }
      budgetNote();
    };
    dom.on(wInput, 'input', onCustom);
    dom.on(hInput, 'input', onCustom);
    budgetNote();
  }

  function createCanvas(name, w, h) {
    var doc = model.createDoc({ name: name, width: w, height: h });
    var record = model.toRecord(doc, '');
    ui.toast('Creando lienzo…', 1200);
    storage.saveProject(record, { layerData: {} }, function (err) {
      if (err) {
        PCW.logError('gallery:create', err);
        ui.toast('No se pudo guardar el lienzo nuevo: ' + err.message, 3000);
      }
      PCW.studio.open(doc, {});
    });
  }

  /* --------------------------------------------------------------- acciones */

  function openProject(projectId) {
    var record = findProject(projectId);
    if (!record) { return; }
    ui.toast('Abriendo…', 1100);
    storage.loadProject(projectId, function (err, data) {
      if (err) {
        PCW.logError('gallery:open', err);
        ui.modal({
          title: 'No se pudo abrir',
          body: '<p class="form-note">' + util.escapeHtml(err.message) + '</p>',
          buttons: [{ label: 'Cerrar', primary: true }]
        });
        return;
      }
      var doc;
      try {
        doc = model.fromRecord(data.record);
      } catch (e) {
        PCW.logError('gallery:fromRecord', e);
        ui.toast('Proyecto dañado: ' + e.message, 3200);
        return;
      }
      PCW.studio.open(doc, data.layers || {});
    });
  }

  function renameProject(projectId) {
    var record = findProject(projectId);
    if (!record) { return; }
    ui.prompt({
      title: 'Renombrar proyecto',
      label: 'Nombre',
      value: record.name,
      confirmLabel: 'Guardar'
    }, function (value) {
      var next = model.cleanName(value);
      record.name = next;
      record.updatedAt = Date.now();
      storage.saveProject(record, { layerData: {} }, function (err) {
        if (err) {
          ui.toast('No se pudo renombrar: ' + err.message, 3000);
          return;
        }
        refresh();
        ui.toast('Renombrado');
      });
    });
  }

  function duplicateProject(projectId) {
    var record = findProject(projectId);
    if (!record) { return; }
    ui.toast('Duplicando…', 1200);
    storage.loadProject(projectId, function (err, data) {
      if (err) {
        ui.toast('No se pudo duplicar: ' + err.message, 3000);
        return;
      }
      var doc;
      try {
        doc = model.fromRecord(data.record);
      } catch (e) {
        ui.toast('Proyecto dañado: ' + e.message, 3000);
        return;
      }
      doc.id = util.uid('doc');
      doc.name = model.cleanName(doc.name + ' copia');
      doc.createdAt = Date.now();
      doc.updatedAt = Date.now();
      var nextRecord = model.toRecord(doc, data.record.thumb || '');
      storage.saveProject(nextRecord, { layerData: data.layers || {} }, function (err2) {
        if (err2) {
          ui.toast('No se pudo duplicar: ' + err2.message, 3000);
          return;
        }
        refresh();
        ui.toast('Proyecto duplicado');
      });
    });
  }

  function deleteProject(projectId) {
    var record = findProject(projectId);
    if (!record) { return; }
    ui.confirm({
      title: 'Eliminar proyecto',
      message: '“' + record.name + '” se eliminará de este dispositivo. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true
    }, function () {
      storage.deleteProject(projectId, function (err) {
        if (err) {
          ui.toast('No se pudo eliminar: ' + err.message, 3000);
          return;
        }
        refresh();
        ui.toast('Proyecto eliminado');
      });
    });
  }

  function exportProject(projectId) {
    var record = findProject(projectId);
    if (!record) { return; }
    var pending = null;
    if (!PCW.env.hasDownload) {
      try {
        pending = root.open('', '_blank');
        if (pending) {
          pending.document.open();
          pending.document.write('<p style="font:14px Helvetica;color:#888;background:#111;padding:24px;">Preparando exportación…</p>');
          pending.document.close();
        }
      } catch (e) { pending = null; }
    }
    ui.toast('Preparando respaldo…', 1800);
    storage.loadProject(projectId, function (err, data) {
      if (err) {
        if (pending) { try { pending.close(); } catch (e2) { /* ignorado */ } }
        ui.toast('No se pudo exportar: ' + err.message, 3000);
        return;
      }
      var layers = [];
      var i;
      var source = data.record.layers || [];
      for (i = 0; i < source.length; i += 1) {
        layers.push({
          id: source[i].id,
          name: source[i].name,
          data: (data.layers && data.layers[source[i].id]) || ''
        });
      }
      var payload = {
        schema: model.SCHEMA,
        format: 'pcw-json-png-dataurl',
        exportedAt: Date.now(),
        note: 'Respaldo de Procreate Web. Las capas son PNG en data URL.',
        doc: data.record,
        layers: layers
      };
      var text = JSON.stringify(payload);
      ui.deliverText(text, safeFilename(record.name) + '.pcw',
        'application/json', 'Exportar proyecto', pending);
    });
  }

  function projectMenu(projectId) {
    var record = findProject(projectId);
    if (!record) { return; }
    var body = dom.create('div');
    var summary = dom.create('div', 'project-summary');
    var thumb = dom.create('div', 'mini-thumb');
    if (record.thumb) { thumb.style.backgroundImage = 'url(' + record.thumb + ')'; }
    var info = dom.create('div');
    info.appendChild(dom.create('div', 'summary-name', record.name));
    info.appendChild(dom.create('div', 'summary-sub',
      util.formatDim(record.width, record.height) + ' · ' +
      (record.layerCount || 1) + ' capas · ' +
      util.formatDate(record.updatedAt)));
    summary.appendChild(thumb);
    summary.appendChild(info);
    body.appendChild(summary);

    var list = dom.create('ul', 'menu-list');
    var actions = [
      { key: 'open', label: 'Abrir' },
      { key: 'rename', label: 'Renombrar' },
      { key: 'duplicate', label: 'Duplicar' },
      { key: 'export', label: 'Exportar respaldo (.pcw)' },
      { key: 'delete', label: 'Eliminar', danger: true }
    ];
    var i;
    for (i = 0; i < actions.length; i += 1) {
      var li = dom.create('li');
      var btn = dom.create('button', actions[i].danger ? 'danger' : '', actions[i].label);
      btn.type = 'button';
      btn.setAttribute('data-paction', actions[i].key);
      li.appendChild(btn);
      list.appendChild(li);
    }
    body.appendChild(list);

    var ctrl = ui.modal({
      title: 'Proyecto',
      body: body,
      width: 430,
      buttons: [{ label: 'Cerrar' }]
    });

    var buttons = dom.qsa('[data-paction]', ctrl.body);
    var j;
    for (j = 0; j < buttons.length; j += 1) {
      (function (btn) {
        dom.on(btn, 'click', function () {
          var action = btn.getAttribute('data-paction');
          ui.closeModal();
          if (action === 'open') { openProject(projectId); }
          else if (action === 'rename') { renameProject(projectId); }
          else if (action === 'duplicate') { duplicateProject(projectId); }
          else if (action === 'export') { exportProject(projectId); }
          else if (action === 'delete') { deleteProject(projectId); }
        });
      }(buttons[j]));
    }
  }

  /* ------------------------------------------------------------------- init */

  function init() {
    if (inited) { return; }
    inited = true;

    dom.on(dom.id('btn-new-project'), 'click', openNewCanvas);
    dom.on(dom.id('btn-new-project-2'), 'click', openNewCanvas);
    dom.on(dom.id('btn-diag'), 'click', function () {
      PCW.diag.show();
    });

    dom.on(dom.id('gallery-grid'), 'click', function (ev) {
      var openEl = findUp(ev.target, 'data-open');
      if (openEl) {
        openProject(openEl.getAttribute('data-open'));
        return;
      }
      var menuEl = findUp(ev.target, 'data-menu');
      if (menuEl) {
        projectMenu(menuEl.getAttribute('data-menu'));
      }
    });
  }

  PCW.gallery = {
    init: init,
    show: show,
    refresh: refresh,
    openNewCanvas: openNewCanvas,
    openProject: openProject,
    getProjects: function () { return projects.slice(0); }
  };

})(typeof window !== 'undefined' ? window : this);
