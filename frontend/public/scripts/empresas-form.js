/*
 * Formularios de empresas (crear y editar): previsualización del logotipo y
 * validación del RUC ecuatoriano.
 */
(function () {
  'use strict';

  window.previewImage = function previewImage(event) {
    const archivo = event && event.target && event.target.files ? event.target.files[0] : null;
    const imageField = document.getElementById('vistaPrevia');
    if (!archivo || !imageField) return;

    if (!archivo.type || archivo.type.indexOf('image/') !== 0) return;

    const reader = new FileReader();
    reader.onload = function () {
      if (reader.readyState === 2) {
        imageField.src = reader.result;
        imageField.classList.remove('d-none');
      }
    };
    reader.readAsDataURL(archivo);
  };

  const form = document.getElementById('formEmpresa') || document.getElementById('formEditEmpresa');
  if (!form) return;

  const esEdicion = form.id === 'formEditEmpresa';

  form.addEventListener('submit', function (event) {
    const rucInput = document.getElementById('rucInput');
    const errorRuc = document.getElementById('errorRuc');
    if (!rucInput) return;

    const ruc = rucInput.value.trim();
    const valido = typeof window.validarRuc === 'function' ? window.validarRuc(ruc) : /^\d{13}$/.test(ruc);

    if (!valido) {
      if (errorRuc) {
        errorRuc.textContent = esEdicion
          ? 'El número de RUC ingresado no es válido.'
          : 'El número de RUC ingresado no es válido para Ecuador.';
        errorRuc.style.display = 'block';
      }
      event.preventDefault();
      rucInput.focus();
      return;
    }

    if (errorRuc) {
      errorRuc.textContent = '';
      errorRuc.style.display = 'none';
    }
  });
})();
