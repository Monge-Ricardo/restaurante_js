function validarCedula(cedula) {

    if (!/^\d{10}$/.test(cedula)) {
        return false;
    }

    const provincia = parseInt(cedula.substring(0, 2));

    if (provincia < 1 || provincia > 24) {
        return false;
    }

    const tercerDigito = parseInt(cedula.charAt(2));

    if (tercerDigito < 0 || tercerDigito > 5) {
        return false;
    }

    let suma = 0;

    for (let i = 0; i < 9; i++) {

        let numero = parseInt(cedula.charAt(i));

        if (i % 2 === 0) {
            numero *= 2;

            if (numero > 9) {
                numero -= 9;
            }
        }

        suma += numero;
    }

    const digitoCalculado =
        (10 - (suma % 10)) % 10;

    const digitoVerificador =
        parseInt(cedula.charAt(9));

    return digitoCalculado === digitoVerificador;
}

function validarCorreo(correo) {

    if (!correo) {
        return false;
    }

    const regex =
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    return regex.test(correo.trim());
}

function validarRuc(ruc) {

    if (!/^\d{13}$/.test(ruc)) {
        return false;
    }

    const provincia = parseInt(ruc.substring(0, 2));

    if (provincia < 1 || provincia > 24) {
        return false;
    }

    const tercerDigito = parseInt(ruc.charAt(2));

    const establecimiento = ruc.substring(10, 13);

    if (establecimiento === "000") {
        return false;
    }

    // Persona natural
    if (tercerDigito >= 0 && tercerDigito <= 5) {

        return validarCedula(ruc.substring(0, 10));
    }

    // Entidad pública
    if (tercerDigito === 6) {

        const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];

        let suma = 0;

        for (let i = 0; i < 8; i++) {
            suma += parseInt(ruc.charAt(i)) * coeficientes[i];
        }

        let verificador = 11 - (suma % 11);

        if (verificador === 11) {
            verificador = 0;
        }

        if (verificador === 10) {
            return false;
        }

        return verificador === parseInt(ruc.charAt(8));
    }

    // Sociedad privada
    if (tercerDigito === 9) {

        const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];

        let suma = 0;

        for (let i = 0; i < 9; i++) {
            suma += parseInt(ruc.charAt(i)) * coeficientes[i];
        }

        let verificador = 11 - (suma % 11);

        if (verificador === 11) {
            verificador = 0;
        }

        if (verificador === 10) {
            return false;
        }

        return verificador === parseInt(ruc.charAt(9));
    }

    return false;
}

function validarTextoLimpio(texto, minLength, maxLength) {

    if (!texto) {
        return false;
    }

    const limpio = texto.trim();

    if (limpio.length < minLength ||
        limpio.length > maxLength) {
        return false;
    }

    const regex =
        /^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s'-]+$/;

    return regex.test(limpio);
}

function validarNumeroPositivo(numero) {

    if (
        numero === null ||
        numero === undefined ||
        isNaN(numero)
    ) {
        return false;
    }

    return parseFloat(numero) > 0;
}