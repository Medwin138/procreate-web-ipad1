/* ==========================================================================
   80 — Arranque: orden de inicialización, errores globales y diagnóstico.
   ========================================================================== */
(function (root) {
  'use strict';

  var PCW = root.PCW || (root.PCW = {});
  var dom = PCW.dom;
  var ui = PCW.ui;

  var booted = false;
  var errorToasted = false;

  function wantsDiag() {
    return String(root.location.search || '').indexOf('diag=1') >= 0;
  }

  function installErrorHandlers() {
    root.onerror = function (message, source, line, column, error) {
      PCW.logError('window', error || new Error(message + ' @' + source + ':' + line));
      if (!errorToasted) {
        errorToasted = true;
        ui.toast('Error inesperado. Abre Diagnóstico para ver el detalle.', 4200);
      }
      return false;
    };

    document.addEventListener('contextmenu', function (ev) {
      var el = ev.target;
      if (el && (el.id === 'view-canvas' || el.id === 'color-wheel')) {
        ev.preventDefault();
      }
    }, false);
  }

  function revealStorage(info) {
    if (!info) { return; }
    if (info.mode === 'memory') {
      ui.toast('Sin persistencia: los proyectos se perderán al cerrar.', 4200);
    }
  }

  function boot() {
    if (booted) { return; }
    booted = true;

    installErrorHandlers();
    ui.bindGlobal();

    PCW.gallery.init();
    PCW.studio.init();
    PCW.panels.init();
    PCW.diag.init();

    ui.showScreen('screen-gallery');
    dom.setText(dom.id('gallery-count'), '');
    dom.id('gallery-empty').classList.add('is-hidden');

    PCW.storage.init(function (err, info) {
      if (err) {
        PCW.logError('boot:storage', err);
        ui.toast('Almacenamiento no disponible: ' + err.message, 4200);
      }
      revealStorage(info);
      PCW.gallery.refresh();
      if (wantsDiag()) {
        setTimeout(function () { PCW.diag.show(); }, 200);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, false);
  } else {
    setTimeout(boot, 0);
  }

  PCW.app = {
    boot: boot,
    wantsDiag: wantsDiag
  };

})(typeof window !== 'undefined' ? window : this);
