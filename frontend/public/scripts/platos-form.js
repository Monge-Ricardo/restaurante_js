/*
 * Formularios de platos (crear y editar): previsualización de imagen y
 * validación del precio antes de enviar.
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

  const form = document.getElementById('formPlato') || document.getElementById('formEditPlato');
  if (!form) return;

  const esEdicion = form.id === 'formEditPlato';

  form.addEventListener('submit', function (event) {
    const precioInput = document.getElementById('precioInput');
    const errorPrecio = document.getElementById('errorPrecio');
    if (!precioInput) return;

    const precioStr = precioInput.value.trim().replace(',', '.');
    const precioVal = parseFloat(precioStr);

    if (isNaN(precioVal) || precioVal <= 0) {
      if (errorPrecio) {
        errorPrecio.textContent = esEdicion
          ? 'El precio modificado debe ser mayor a 0.'
          : 'El precio debe ser un número mayor a 0.';
        errorPrecio.style.display = 'block';
      }
      event.preventDefault();
      precioInput.focus();
      return;
    }

    if (errorPrecio) {
      errorPrecio.textContent = '';
      errorPrecio.style.display = 'none';
    }
  });
})();
