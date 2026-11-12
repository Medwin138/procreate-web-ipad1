/* ==========================================================================
   30 — UI común: pantallas, modales, avisos, sliders, paneles y entrega.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});
  var dom = PCW.dom;
  var util = PCW.util;

  var currentScreen = 'screen-gallery';
  var toastTimer = null;
  var saveTimer = null;
  var modalOnClose = null;
  var activeSlider = null;

  function showScreen(id) {
    var screens = dom.qsa('.screen');
    var i;
    for (i = 0; i < screens.length; i += 1) {
      if (screens[i].id === id) {
        dom.show(screens[i]);
      } else {
        dom.hide(screens[i]);
      }
    }
    if (id === 'screen-studio') {
      closeModal();
      closePopovers();
    }
    currentScreen = id;
    PCW.events.emit('screen', id);
  }

  function current() {
    return currentScreen;
  }

  /* --------------------------------------------------------------- modales */

  function closeModal() {
    var rootEl = dom.id('modal-root');
    var body = dom.id('modal-body');
    var foot = dom.id('modal-foot');
    if (!rootEl || dom.isHidden(rootEl)) { return; }
    dom.hide(rootEl);
    dom.empty(body);
    dom.empty(foot);
    var cb = modalOnClose;
    modalOnClose = null;
    if (cb) { cb(); }
  }

  function modal(opts) {
    opts = opts || {};
    closeModal();
    var rootEl = dom.id('modal-root');
    var card = dom.id('modal-card');
    var title = dom.id('modal-title');
    var body = dom.id('modal-body');
    var foot = dom.id('modal-foot');

    dom.setText(title, opts.title || '');
    dom.empty(body);
    if (typeof opts.body === 'string') {
      body.innerHTML = opts.body;
    } else if (opts.body) {
      body.appendChild(opts.body);
    }
    dom.empty(foot);
    if (opts.width) { card.style.width = opts.width + 'px'; }
    else { card.style.width = ''; }
    modalOnClose = opts.onClose || null;

    var ctrl = {
      root: rootEl,
      card: card,
      body: body,
      foot: foot,
      close: closeModal
    };

    var buttons = opts.buttons || [];
    var i;
    for (i = 0; i < buttons.length; i += 1) {
      (function (spec) {
        var btn = dom.create('button', 'text-btn' +
          (spec.primary ? ' strong' : '') +
          (spec.danger ? ' danger' : ''), spec.label);
        btn.type = 'button';
        if (spec.danger) {
          btn.style.color = '#ff7a7a';
        }
        dom.on(btn, 'click', function () {
          var keep = false;
          if (spec.onClick) {
            keep = spec.onClick(ctrl);
          }
          if (keep !== false) { closeModal(); }
        });
        foot.appendChild(btn);
      }(buttons[i]));
    }

    dom.show(rootEl);
    if (opts.focus) {
      setTimeout(function () {
        var field = dom.qs(opts.focus, body);
        if (field) {
          try { field.focus(); } catch (e) { /* ignorado */ }
        }
      }, 60);
    }
    return ctrl;
  }

  function confirm(opts, cb) {
    opts = opts || {};
    return modal({
      title: opts.title || 'Confirmar',
      body: '<p class="form-note" style="margin-top:0;font-size:13px;color:#d8d8de;">' +
        util.escapeHtml(opts.message || '') + '</p>',
      width: 420,
      buttons: [
        { label: opts.cancelLabel || 'Cancelar' },
        {
          label: opts.confirmLabel || 'Continuar',
          primary: !opts.danger,
          danger: !!opts.danger,
          onClick: function () {
            if (cb) { cb(); }
          }
        }
      ]
    });
  }

  function prompt(opts, cb) {
    opts = opts || {};
    var bodyHtml = '<label class="field"><span class="field-label" style="display:block;margin-bottom:6px;color:#9a9aa3;font-size:11px;">' +
      util.escapeHtml(opts.label || 'Nombre') +
      '</span><input id="prompt-input" class="input" type="text" value="' +
      util.escapeHtml(opts.value || '') + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>' +
      (opts.note ? '<p class="form-note">' + util.escapeHtml(opts.note) + '</p>' : '');
    return modal({
      title: opts.title || 'Editar',
      body: bodyHtml,
      width: 420,
      focus: '#prompt-input',
      buttons: [
        { label: 'Cancelar' },
        {
          label: opts.confirmLabel || 'Guardar',
          primary: true,
          onClick: function (ctrl) {
            var input = dom.id('prompt-input');
            if (cb) { cb(input ? input.value : '', ctrl); }
          }
        }
      ]
    });
  }

  /* ---------------------------------------------------------------- avisos */

  function toast(message, ms) {
    var el = dom.id('toast');
    if (!el) { return; }
    el.textContent = String(message == null ? '' : message);
    dom.show(el);
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () {
      toastTimer = null;
      dom.hide(el);
    }, ms || 2300);
  }

  function setSaveState(state, text) {
    var el = dom.id('save-indicator');
    if (!el) { return; }
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!state) {
      dom.hide(el);
      return;
    }
    if (state === 'saving') {
      el.textContent = text || 'Guardando…';
      dom.show(el);
      return;
    }
    if (state === 'saved') {
      el.textContent = text || 'Guardado';
      dom.show(el);
      saveTimer = setTimeout(function () {
        saveTimer = null;
        dom.hide(el);
      }, 1000);
      return;
    }
    if (state === 'error') {
      el.textContent = text || 'No se pudo guardar';
      dom.show(el);
      el.style.color = '#ff9a9a';
      saveTimer = setTimeout(function () {
        saveTimer = null;
        dom.hide(el);
        el.style.color = '';
      }, 3200);
    }
  }

  /* ---------------------------------------------------- paneles y popovers */

  function panelEls() {
    return dom.qsa('.panel, .popover, .overlay-panel, .quick-menu');
  }

  function closePanels(exceptId) {
    var list = dom.qsa('.panel');
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i].id !== exceptId) { dom.hide(list[i]); }
    }
  }

  function closePopovers(exceptId) {
    var list = dom.qsa('.popover');
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i].id !== exceptId) { dom.hide(list[i]); }
    }
    var overlays = dom.qsa('.overlay-panel');
    for (i = 0; i < overlays.length; i += 1) {
      if (overlays[i].id !== exceptId) { dom.hide(overlays[i]); }
    }
    if (exceptId !== 'quick-menu') { dom.hide(dom.id('quick-menu')); }
    if (exceptId !== 'panel-brushes') { dom.hide(dom.id('panel-brushes')); }
  }

  function closeAllFloating(exceptId) {
    closePanels(exceptId);
    closePopovers(exceptId);
  }

  function openPanel(id) {
    if (!dom.id(id)) { return; }
    if (id !== 'panel-adjustments' && PCW.studio && PCW.studio.cancelAdjust) {
      PCW.studio.cancelAdjust();
    }
    closeAllFloating(id);
    dom.show(dom.id(id));
  }

  function closePanel(id) {
    if (id === 'panel-adjustments' && PCW.studio && PCW.studio.cancelAdjust) {
      PCW.studio.cancelAdjust();
    }
    /* Cerrar el panel de curva sin Aplicar equivale a cancelar la edición:
       se restaura el trazo original en lugar de dejarlo interceptando el
       lienzo sin controles visibles. */
    if (id === 'panel-curve-edit' && PCW.studio && PCW.studio.hasCurveEdit &&
        PCW.studio.hasCurveEdit()) {
      PCW.studio.cancelCurveEdit();
      return;
    }
    dom.hide(dom.id(id));
  }

  function togglePanel(id) {
    var el = dom.id(id);
    if (!el) { return false; }
    if (dom.isHidden(el)) {
      openPanel(id);
      return true;
    }
    closePanel(id);
    return false;
  }

  function isPanelOpen(id) {
    return !dom.isHidden(dom.id(id));
  }

  function closeAll() {
    if (PCW.studio && PCW.studio.hasCurveEdit && PCW.studio.hasCurveEdit()) {
      PCW.studio.cancelCurveEdit();
    }
    var list = panelEls();
    var i;
    for (i = 0; i < list.length; i += 1) {
      dom.hide(list[i]);
    }
    if (PCW.studio && PCW.studio.cancelAdjust) {
      PCW.studio.cancelAdjust();
    }
  }

  /* ---------------------------------------------------------------- slider */

  function initSlider(el, opts) {
    opts = opts || {};
    el = (typeof el === 'string') ? dom.id(el) : el;
    if (!el) { return null; }
    var min = (opts.min != null) ? opts.min : parseFloat(el.getAttribute('data-min'));
    var max = (opts.max != null) ? opts.max : parseFloat(el.getAttribute('data-max'));
    var start = (opts.value != null) ? opts.value : parseFloat(el.getAttribute('data-value'));
    if (isNaN(min)) { min = 0; }
    if (isNaN(max)) { max = 100; }
    if (isNaN(start)) { start = min; }
    var scale = opts.scale || 'linear';
    var step = opts.step || 1;
    var logMin = Math.max(0.0001, min);
    var onChange = opts.onChange || function () {};

    el.innerHTML = '';
    var track = dom.create('div', 'vslider-track');
    var fill = dom.create('div', 'vslider-fill');
    var knob = dom.create('div', 'vslider-knob');
    track.appendChild(fill);
    el.appendChild(track);
    el.appendChild(knob);
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-valuemin', String(min));
    el.setAttribute('aria-valuemax', String(max));

    var value = util.clamp(start, min, max);

    function valueToT(v) {
      if (scale === 'log') {
        if (max <= logMin) { return 0; }
        return Math.log(Math.max(logMin, v) / logMin) / Math.log(max / logMin);
      }
      if (max === min) { return 0; }
      return (v - min) / (max - min);
    }

    function tToValue(t) {
      t = util.clamp(t, 0, 1);
      var v;
      if (scale === 'log') {
        v = logMin * Math.pow(max / logMin, t);
      } else {
        v = min + (max - min) * t;
      }
      if (step) {
        v = Math.round(v / step) * step;
      }
      return util.clamp(v, min, max);
    }

    function paint() {
      var t = valueToT(value);
      var pct = (t * 100) + '%';
      fill.style.height = pct;
      knob.style.bottom = pct;
      el.setAttribute('aria-valuenow', String(value));
      el.setAttribute('data-value', String(value));
      el.title = opts.label ? (opts.label + ': ' + Math.round(value)) : String(Math.round(value));
    }

    function setValue(v, silent) {
      var next = util.clamp(Math.round(v / step) * step, min, max);
      value = next;
      paint();
      if (!silent) { onChange(value); }
    }

    function applyAt(clientY) {
      var rect = el.getBoundingClientRect();
      if (!rect.height) { return; }
      var t = 1 - ((clientY - rect.top) / rect.height);
      setValue(tToValue(t), false);
    }

    var lastTouch = 0;

    function onTouchStart(ev) {
      if (!ev.touches || !ev.touches.length) { return; }
      ev.preventDefault();
      lastTouch = Date.now();
      applyAt(ev.touches[0].clientY);
    }

    function onTouchMove(ev) {
      if (!ev.touches || !ev.touches.length) { return; }
      ev.preventDefault();
      lastTouch = Date.now();
      applyAt(ev.touches[0].clientY);
    }

    function onMouseDown(ev) {
      if (Date.now() - lastTouch < 700) { return; }
      ev.preventDefault();
      applyAt(ev.clientY);

      function move(e) { applyAt(e.clientY); }
      function up() {
        document.removeEventListener('mousemove', move, false);
        document.removeEventListener('mouseup', up, false);
      }
      document.addEventListener('mousemove', move, false);
      document.addEventListener('mouseup', up, false);
    }

    dom.on(el, 'touchstart', onTouchStart, false);
    dom.on(el, 'touchmove', onTouchMove, false);
    dom.on(el, 'mousedown', onMouseDown, false);

    paint();

    var ctrl = {
      el: el,
      setValue: setValue,
      getValue: function () { return value; },
      min: min,
      max: max,
      scale: scale
    };
    el._pcwSlider = ctrl;
    return ctrl;
  }

  function setSlider(el, value, silent) {
    if (typeof el === 'string') { el = dom.id(el); }
    if (!el || !el._pcwSlider) { return; }
    el._pcwSlider.setValue(value, silent !== false);
  }

  function sliderValue(el) {
    if (typeof el === 'string') { el = dom.id(el); }
    return (el && el._pcwSlider) ? el._pcwSlider.getValue() : 0;
  }

  /* ----------------------------------------------------------- entregables */

  function viewerPage(title, inner, extraCss) {
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">' +
      '<title>' + util.escapeHtml(title) + '</title><style>' +
      'body{margin:0;padding:24px;background:#111113;color:#eee;font:14px -apple-system,Helvetica,Arial,sans-serif;text-align:center;}' +
      'h1{font-size:18px;margin:0 0 10px;}p{color:#a9a9b2;font-size:13px;line-height:1.5;}' +
      'img{max-width:100%;height:auto;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.6);margin:14px 0;}' +
      'textarea{width:100%;height:60vh;margin:14px 0;padding:10px;border-radius:8px;border:1px solid #3a3a42;background:#0b0b0d;color:#cfd8dc;font:11px Menlo,Consolas,monospace;}' +
      'button{height:40px;padding:0 16px;border:0;border-radius:9px;background:#2f6fed;color:#fff;font:600 14px -apple-system,Helvetica,Arial,sans-serif;}' +
      '.note{max-width:680px;margin:0 auto;}' + (extraCss || '') +
      '</style></head><body>' + inner + '</body></html>';
  }

  function openViewer(html) {
    var win = null;
    try {
      win = root.open('', '_blank');
    } catch (e) {
      win = null;
    }
    if (!win) { return null; }
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e2) {
      PCW.logError('viewer', e2);
      return null;
    }
    return win;
  }

  function openPending(label) {
    var win = null;
    try {
      win = root.open('', '_blank');
    } catch (e) {
      win = null;
    }
    if (!win) { return null; }
    try {
      win.document.open();
      win.document.write(viewerPage(label || 'Exportar',
        '<div class="note"><h1>' + util.escapeHtml(label || 'Exportar') + '</h1>' +
        '<p>Preparando el archivo… no cierres esta ventana.</p></div>'));
      win.document.close();
    } catch (e2) {
      PCW.logError('viewer-pending', e2);
      return null;
    }
    return win;
  }

  function dataUrlSizeWarning(dataUrl) {
    if (dataUrl.length > 12 * 1024 * 1024) {
      toast('El archivo es grande; Safari 9 puede tardar o fallar al abrirlo.', 4200);
    }
  }

  function writeViewer(win, title, inner) {
    if (!win) { return false; }
    try {
      win.document.open();
      win.document.write(viewerPage(title, inner));
      win.document.close();
      return true;
    } catch (e) {
      PCW.logError('viewer-write', e);
      return false;
    }
  }

  function deliverImage(dataUrl, filename, label, pendingWindow) {
    dataUrlSizeWarning(dataUrl);
    if (PCW.env.hasDownload) {
      try {
        var a = document.createElement('a');
        a.href = dataUrl;
        a.setAttribute('download', filename);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (pendingWindow) { try { pendingWindow.close(); } catch (e0) { /* ignorado */ } }
        toast('Descarga iniciada: ' + filename);
        return true;
      } catch (e) {
        PCW.logError('download', e);
      }
    }
    var inner = '<div class="note"><h1>' + util.escapeHtml(label || 'Exportar') + '</h1>' +
      '<p>Mantén pulsado sobre la imagen y elige <strong>Guardar imagen</strong> (o Compartir). ' +
      'Safari 9 no permite descargar archivos directamente.</p>' +
      '<img src="' + dataUrl + '" alt="Exportación">' +
      '<p>Si la imagen no aparece, el data URL supera el límite de Safari 9.</p></div>';
    if (pendingWindow) {
      if (writeViewer(pendingWindow, label || 'Exportar', inner)) { return true; }
    }
    if (!openViewer(viewerPage(label || 'Exportar', inner))) {
      modal({
        title: 'Exportar',
        body: '<p class="form-note">El navegador bloqueó la ventana de exportación. ' +
          'Vuelve a intentarlo desde el botón Compartir.</p>',
        buttons: [{ label: 'Cerrar', primary: true }]
      });
      return false;
    }
    return true;
  }

  function deliverText(text, filename, mime, label, pendingWindow) {
    if (PCW.env.hasDownload) {
      try {
        if (PCW.env.hasBlob) {
          var blob = new Blob([text], { type: mime || 'text/plain' });
          var url = root.URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.setAttribute('download', filename);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { root.URL.revokeObjectURL(url); }, 4000);
          if (pendingWindow) { try { pendingWindow.close(); } catch (e0) { /* ignorado */ } }
          toast('Descarga iniciada: ' + filename);
          return true;
        }
        var data = 'data:' + (mime || 'text/plain') + ';charset=utf-8,' +
          encodeURIComponent(text);
        var a2 = document.createElement('a');
        a2.href = data;
        a2.setAttribute('download', filename);
        document.body.appendChild(a2);
        a2.click();
        document.body.removeChild(a2);
        if (pendingWindow) { try { pendingWindow.close(); } catch (e1) { /* ignorado */ } }
        toast('Descarga iniciada: ' + filename);
        return true;
      } catch (e) {
        PCW.logError('download-text', e);
      }
    }
    var inner = '<div class="note"><h1>' + util.escapeHtml(label || 'Exportar proyecto') + '</h1>' +
      '<p>Safari 9 no puede guardar archivos directamente. Toca el texto, selecciona todo, ' +
      'copia y pégalo en Notas o en un archivo. El contenido es el respaldo del proyecto.</p>' +
      '<textarea id="export-text" readonly spellcheck="false">' + util.escapeHtml(text) + '</textarea>' +
      '<button id="copy-btn" type="button">Seleccionar todo</button>' +
      '<p>Nombre sugerido: ' + util.escapeHtml(filename) + '</p></div>' +
      '<script>document.getElementById("copy-btn").onclick=function(){' +
      'var t=document.getElementById("export-text");t.focus();t.select();' +
      'try{document.execCommand("copy");this.textContent="Copiado";}catch(e){this.textContent="Selecciona y copia";}};<\/script>';
    if (pendingWindow) {
      if (writeViewer(pendingWindow, label || 'Exportar', inner)) { return true; }
    }
    if (!openViewer(viewerPage(label || 'Exportar', inner))) {
      modal({
        title: 'Exportar',
        body: '<p class="form-note">La ventana de exportación fue bloqueada. ' +
          'Permite las ventanas emergentes y vuelve a intentarlo.</p>',
        buttons: [{ label: 'Cerrar', primary: true }]
      });
      return false;
    }
    return true;
  }

  /* -------------------------------------------------------------- globales */

  function bindGlobal() {
    var scrim = dom.qs('#modal-root .modal-scrim');
    dom.on(scrim, 'click', closeModal);
    dom.on(dom.id('modal-close'), 'click', closeModal);

    document.addEventListener('keydown', function (ev) {
      if (ev.keyCode === 27) {
        if (!dom.isHidden(dom.id('modal-root'))) {
          closeModal();
        } else {
          closeAll();
        }
      }
    }, false);

    dom.on(scrim, 'touchmove', function (ev) {
      ev.preventDefault();
    }, false);

    var gestureBlock = function (ev) {
      if (ev.target && (ev.target.id === 'view-canvas' || ev.target.id === 'color-wheel' ||
          ev.target.className === 'vslider')) {
        ev.preventDefault();
      }
    };
    document.addEventListener('gesturestart', gestureBlock, false);
    document.addEventListener('gesturechange', gestureBlock, false);
  }

  PCW.ui = {
    showScreen: showScreen,
    currentScreen: current,
    modal: modal,
    closeModal: closeModal,
    isModalOpen: function () { return !dom.isHidden(dom.id('modal-root')); },
    confirm: confirm,
    prompt: prompt,
    toast: toast,
    setSaveState: setSaveState,
    openPanel: openPanel,
    closePanel: closePanel,
    togglePanel: togglePanel,
    isPanelOpen: isPanelOpen,
    closePanels: closePanels,
    closePopovers: closePopovers,
    closeAllFloating: closeAllFloating,
    closeAll: closeAll,
    initSlider: initSlider,
    setSlider: setSlider,
    sliderValue: sliderValue,
    deliverImage: deliverImage,
    deliverText: deliverText,
    openViewer: openViewer,
    openPending: openPending,
    bindGlobal: bindGlobal
  };

})(typeof window !== 'undefined' ? window : this);
