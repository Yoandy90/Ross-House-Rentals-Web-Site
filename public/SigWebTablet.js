/**
 * SigWebTablet.js Placeholder
 * ============================
 * 
 * IMPORTANTE: Este es un archivo placeholder.
 * 
 * Para usar el Topaz Signature Pad real, debes:
 * 
 * 1. Descargar SigWeb desde: https://www.topazsystems.com/sdks/sigweb.html
 * 2. Instalar SigWeb en tu computadora Windows
 * 3. Reemplazar este archivo con el SigWebTablet.js real del SDK de Topaz
 *    (generalmente se encuentra en: C:\Program Files\Topaz\SigWeb\SigWebTablet.js)
 * 4. Reiniciar el navegador
 * 
 * El servicio SigWeb corre en localhost:47289 y permite comunicación
 * entre el navegador y el hardware del pad de firmas Topaz.
 * 
 * Modelos compatibles:
 * - T-S460-HSB (USB SignatureGem)
 * - T-LBK755 (LCD Signature Capture Pad)
 * - T-LBK462 (Electronic Signature Pad)
 * - Y otros modelos Topaz
 */

// Placeholder functions - estas serán sobreescritas por el SDK real
(function() {
  'use strict';
  
  // Default port for SigWeb service
  var sigWebPort = 47289;
  var sigWebUrl = 'https://localhost:' + sigWebPort + '/';
  
  // Check if SigWeb is installed
  window.IsSigWebInstalled = function() {
    // Attempt to check if SigWeb service is running
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', sigWebUrl + 'SigWeb/Version', false);
      xhr.timeout = 1000;
      xhr.send();
      return xhr.status === 200;
    } catch (e) {
      console.warn('SigWeb not detected. Please install from topazsystems.com');
      return false;
    }
  };

  window.GetSigWebVersion = function() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', sigWebUrl + 'SigWeb/Version', false);
      xhr.send();
      if (xhr.status === 200) {
        return xhr.responseText;
      }
    } catch (e) {
      console.error('Error getting SigWeb version:', e);
    }
    return 'Not Installed';
  };

  window.SetTabletState = function(state, ctx, x) {
    console.log('SetTabletState called with state:', state);
    // Real implementation would communicate with SigWeb service
  };

  window.SetDisplayXSize = function(size) {
    console.log('SetDisplayXSize:', size);
  };

  window.SetDisplayYSize = function(size) {
    console.log('SetDisplayYSize:', size);
  };

  window.SetImageXSize = function(size) {
    console.log('SetImageXSize:', size);
  };

  window.SetImageYSize = function(size) {
    console.log('SetImageYSize:', size);
  };

  window.SetImagePenWidth = function(width) {
    console.log('SetImagePenWidth:', width);
  };

  window.SetJustifyMode = function(mode) {
    console.log('SetJustifyMode:', mode);
  };

  window.SetSigCompressionMode = function(mode) {
    console.log('SetSigCompressionMode:', mode);
  };

  window.ClearTablet = function() {
    console.log('ClearTablet called');
  };

  window.NumberOfTabletPoints = function() {
    return 0;
  };

  window.GetSigImageB64 = function(callback) {
    console.warn('GetSigImageB64: Using placeholder - install real SigWeb SDK');
    if (callback) callback('');
  };

  window.GetSigString = function(callback) {
    console.warn('GetSigString: Using placeholder - install real SigWeb SDK');
    if (callback) callback('');
  };

  window.SetLCDCaptureMode = function(mode) {
    console.log('SetLCDCaptureMode:', mode);
  };

  window.LCDRefresh = function(mode, x1, y1, x2, y2) {
    console.log('LCDRefresh:', mode, x1, y1, x2, y2);
  };

  window.LCDWriteString = function(mode, font, x, y, text) {
    console.log('LCDWriteString:', text);
  };

  console.log('%c⚠️ SigWebTablet.js Placeholder Loaded', 'color: orange; font-weight: bold');
  console.log('%cPara usar Topaz real, reemplace este archivo con el SDK oficial.', 'color: gray');
  console.log('%cDescargue SigWeb: https://www.topazsystems.com/sdks/sigweb.html', 'color: blue');
  
})();
