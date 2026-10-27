/*
 * Punto de venta: búsqueda automática de cliente por cédula y validaciones
 * del formulario antes de generar la factura.
 */
(function () {
  'use strict';

  const cedulaInput = document.getElementById('cedula_cliente');
  const correoInput = document.getElementById('correo_cliente');
  const telefonoInput = document.getElementById('tel_cliente');
  const nombreInput = document.getElementById('nombre_cliente');
  const apellidoInput = document.getElementById('apellido_cliente');
  const form = document.getElementById('formFacturacion');
  const spinner = document.getElementById('spinner-busqueda');
  const cedulaHelp = document.getElementById('cedulaHelp');

  if (!form || !cedulaInput) return;

  const CEDULA_CONSUMIDOR_FINAL = '9999999999';
  const CORREO_CONSUMIDOR_FINAL = 'consumidorfinal@restaurante.com';
  let busquedaTimer = null;

  function mostrarSpinner(visible) {
    if (spinner) spinner.style.display = visible ? 'block' : 'none';
  }

  function estadoAyuda(texto, clase) {
    if (!cedulaHelp) return;
    cedulaHelp.textContent = texto;
    cedulaHelp.className = clase;
  }

  window.cargarConsumidorFinal = function cargarConsumidorFinal() {
    cedulaInput.value = CEDULA_CONSUMIDOR_FINAL;
    if (nombreInput) nombreInput.value = 'Consumidor';
    if (apellidoInput) apellidoInput.value = 'Final';
    if (telefonoInput) telefonoInput.value = CEDULA_CONSUMIDOR_FINAL;
    if (correoInput) correoInput.value = CORREO_CONSUMIDOR_FINAL;

    cedulaInput.setCustomValidity('');
    if (correoInput) correoInput.setCustomValidity('');
    estadoAyuda('Al digitar 10 dígitos se buscará al cliente automáticamente.', 'form-text text-muted');
  };

  function ejecutarBusquedaCliente(cedula) {
    mostrarSpinner(true);
    estadoAyuda('Buscando cliente...', 'form-text text-primary fw-bold');

    const url = '/Facturacion/BuscarCliente?cedula=' + encodeURIComponent(cedula);

    fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        mostrarSpinner(false);

        if (data.encontrado) {
          if (nombreInput) nombreInput.value = data.nombre || '';
          if (apellidoInput) apellidoInput.value = data.apellido || '';
          if (telefonoInput) telefonoInput.value = data.telefono || '';
          if (correoInput) correoInput.value = data.correo || '';

          cedulaInput.setCustomValidity('');
          estadoAyuda(
            'Cliente encontrado: ' + (data.nombre || '') + ' ' + (data.apellido || ''),
            'form-text text-success fw-bold'
          );
        } else {
          if (nombreInput) nombreInput.value = '';
          if (apellidoInput) apellidoInput.value = '';
          if (telefonoInput) telefonoInput.value = '';
          if (correoInput) correoInput.value = '';

          estadoAyuda(
            'Cliente no encontrado. Complete los datos manualmente.',
            'form-text text-warning fw-bold'
          );
        }
      })
      .catch(function (error) {
        mostrarSpinner(false);
        estadoAyuda('Error al buscar el cliente: ' + error.message, 'form-text text-danger fw-bold');
      });
  }

  function validarCedulaEcuatoriana(cedula) {
    if (cedula === CEDULA_CONSUMIDOR_FINAL) return true;
    if (typeof window.validarCedula === 'function') return window.validarCedula(cedula);

    if (!/^\d{10}$/.test(cedula)) return false;

    const provincia = parseInt(cedula.substring(0, 2), 10);
    if (provincia < 1 || provincia > 24) return false;

    const tercerDigito = parseInt(cedula.substring(2, 3), 10);
    if (tercerDigito < 0 || tercerDigito > 5) return false;

    const digitoVerificador = parseInt(cedula.substring(9, 10), 10);
    let suma = 0;

    for (let i = 0; i < 9; i += 1) {
      let valor = parseInt(cedula.charAt(i), 10) * (i % 2 === 0 ? 2 : 1);
      if (valor > 9) valor -= 9;
      suma += valor;
    }

    const total = (Math.ceil(suma / 10) * 10) - suma;
    return (total === 10 ? 0 : total) === digitoVerificador;
  }

  function validarCorreoSimple(correo) {
    if (typeof window.validarCorreo === 'function') return window.validarCorreo(correo);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  }

  cedulaInput.addEventListener('input', function () {
    this.value = this.value.replace(/[^0-9]/g, '');
    this.setCustomValidity('');

    if (busquedaTimer) clearTimeout(busquedaTimer);

    if (this.value.length === 10 && this.value !== CEDULA_CONSUMIDOR_FINAL) {
      const valor = this.value;
      busquedaTimer = setTimeout(function () {
        ejecutarBusquedaCliente(valor);
      }, 400);
    } else if (this.value.length < 10) {
      estadoAyuda('Al digitar 10 dígitos se buscará al cliente automáticamente.', 'form-text text-muted');
    }
  });

  if (telefonoInput) {
    telefonoInput.addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9]/g, '');
    });
  }

  form.addEventListener('submit', function (event) {
    const cedula = cedulaInput.value.trim();
    const correo = correoInput ? correoInput.value.trim() : '';
    let valido = true;

    if (cedula !== '' && !validarCedulaEcuatoriana(cedula)) {
      cedulaInput.setCustomValidity('La cédula ingresada no es válida en Ecuador.');
      cedulaInput.reportValidity();
      valido = false;
    } else {
      cedulaInput.setCustomValidity('');
    }

    if (valido && correo !== '' && correo !== CORREO_CONSUMIDOR_FINAL && !validarCorreoSimple(correo)) {
      correoInput.setCustomValidity('El formato del correo electrónico no es válido.');
      correoInput.reportValidity();
      valido = false;
    } else if (correoInput) {
      correoInput.setCustomValidity('');
    }

    if (!valido) event.preventDefault();
  });
})();
