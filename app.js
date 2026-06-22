const API_URL = "PEGAR_AQUI_LA_URL_DE_APPS_SCRIPT";

const STORAGE_USUARIO = "portalUsuarioAutenticado";

const elementos = {
  loginSection: document.getElementById("loginSection"),
  appSection: document.getElementById("appSection"),

  loginForm: document.getElementById("loginForm"),
  correoLogin: document.getElementById("correoLogin"),
  pinLogin: document.getElementById("pinLogin"),
  btnLogin: document.getElementById("btnLogin"),

  usuarioAutenticado: document.getElementById("usuarioAutenticado"),

  solicitudForm: document.getElementById("solicitudForm"),
  tipoSolicitud: document.getElementById("tipoSolicitud"),
  titulo: document.getElementById("titulo"),
  descripcion: document.getElementById("descripcion"),
  prioridad: document.getElementById("prioridad"),
  btnRegistrarSolicitud: document.getElementById("btnRegistrarSolicitud"),
  btnLimpiarFormulario: document.getElementById("btnLimpiarFormulario"),

  tablaSolicitudes: document.getElementById("tablaSolicitudes"),
  solicitudesTbody: document.getElementById("solicitudesTbody"),
  filaSinSolicitudes: document.getElementById("filaSinSolicitudes"),

  btnActualizar: document.getElementById("btnActualizar"),
  btnImprimirPdf: document.getElementById("btnImprimirPdf"),
  btnCerrarSesion: document.getElementById("btnCerrarSesion"),

  mensajeCarga: document.getElementById("mensajeCarga"),
  mensajeExito: document.getElementById("mensajeExito"),
  mensajeError: document.getElementById("mensajeError")
};

document.addEventListener("DOMContentLoaded", iniciarPortal);

function iniciarPortal() {
  registrarEventos();

  const usuarioGuardado = obtenerUsuarioSesion();

  if (usuarioGuardado) {
    mostrarPantallaPrincipal(usuarioGuardado);
    listarSolicitudes();
  } else {
    mostrarPantallaLogin();
  }
}

function registrarEventos() {
  elementos.loginForm.addEventListener("submit", manejarLogin);
  elementos.solicitudForm.addEventListener("submit", manejarCrearSolicitud);
  elementos.btnActualizar.addEventListener("click", listarSolicitudes);
  elementos.btnCerrarSesion.addEventListener("click", cerrarSesion);
  elementos.btnImprimirPdf.addEventListener("click", imprimirGuardarPdf);
}

async function manejarLogin(evento) {
  evento.preventDefault();

  ocultarMensajes();

  const correo = elementos.correoLogin.value.trim().toLowerCase();
  const pin = elementos.pinLogin.value.trim();

  if (!correo || !pin) {
    mostrarMensaje("error", "Ingresa correo y PIN para continuar.");
    return;
  }

  try {
    establecerEstadoCarga(true, "Validando usuario...");

    const respuesta = await enviarPeticion("login", {
      correo,
      pin
    });

    if (!respuesta || respuesta.ok !== true || !respuesta.usuario) {
      throw new Error(respuesta?.mensaje || "No se pudo validar el usuario.");
    }

    const usuario = {
      idUsuario: respuesta.usuario.idUsuario || "",
      nombre: respuesta.usuario.nombre || "",
      correo: respuesta.usuario.correo || correo,
      estado: respuesta.usuario.estado || ""
    };

    sessionStorage.setItem(STORAGE_USUARIO, JSON.stringify(usuario));

    mostrarPantallaPrincipal(usuario);
    mostrarMensaje("exito", "Inicio de sesión correcto.");
    await listarSolicitudes();
  } catch (error) {
    mostrarMensaje("error", error.message || "Error al iniciar sesión.");
  } finally {
    establecerEstadoCarga(false);
  }
}

async function manejarCrearSolicitud(evento) {
  evento.preventDefault();

  ocultarMensajes();

  const usuario = obtenerUsuarioSesion();

  if (!usuario) {
    cerrarSesion();
    mostrarMensaje("error", "La sesión no está activa. Ingresa nuevamente.");
    return;
  }

  if (!validarFormularioSolicitud()) {
    return;
  }

  const datosSolicitud = {
    idUsuario: usuario.idUsuario,
    solicitante: usuario.nombre,
    correo: usuario.correo,
    tipoSolicitud: elementos.tipoSolicitud.value.trim(),
    titulo: elementos.titulo.value.trim(),
    descripcion: elementos.descripcion.value.trim(),
    prioridad: elementos.prioridad.value.trim()
  };

  try {
    establecerEstadoCarga(true, "Registrando solicitud...");

    const respuesta = await enviarPeticion("crearSolicitud", datosSolicitud);

    if (!respuesta || respuesta.ok !== true) {
      throw new Error(respuesta?.mensaje || "No se pudo registrar la solicitud.");
    }

    elementos.solicitudForm.reset();
    mostrarMensaje("exito", "Solicitud registrada correctamente.");
    await listarSolicitudes();
  } catch (error) {
    mostrarMensaje("error", error.message || "Error al registrar la solicitud.");
  } finally {
    establecerEstadoCarga(false);
  }
}

async function listarSolicitudes() {
  ocultarMensajes();

  const usuario = obtenerUsuarioSesion();

  if (!usuario) {
    cerrarSesion();
    mostrarMensaje("error", "La sesión no está activa. Ingresa nuevamente.");
    return;
  }

  try {
    establecerEstadoCarga(true, "Consultando solicitudes...");

    const respuesta = await enviarPeticion("listarSolicitudes", {
      idUsuario: usuario.idUsuario,
      correo: usuario.correo
    });

    if (!respuesta || respuesta.ok !== true) {
      throw new Error(respuesta?.mensaje || "No se pudieron consultar las solicitudes.");
    }

    construirTablaSolicitudes(respuesta.solicitudes || []);
  } catch (error) {
    construirTablaSolicitudes([]);
    mostrarMensaje("error", error.message || "Error al consultar las solicitudes.");
  } finally {
    establecerEstadoCarga(false);
  }
}

async function enviarPeticion(accion, datos) {
  validarApiUrl();

  const parametros = new URLSearchParams();
  parametros.append("accion", accion);

  Object.keys(datos || {}).forEach((campo) => {
    parametros.append(campo, datos[campo]);
  });

  const respuesta = await fetch(API_URL, {
    method: "POST",
    body: parametros
  });

  const texto = await respuesta.text();

  let datosRespuesta;

  try {
    datosRespuesta = JSON.parse(texto);
  } catch (error) {
    throw new Error("La respuesta del servidor no tiene formato JSON válido.");
  }

  if (!respuesta.ok) {
    throw new Error(datosRespuesta?.mensaje || "Error de conexión con el servidor.");
  }

  return datosRespuesta;
}

function validarApiUrl() {
  if (!API_URL || API_URL === "PEGAR_AQUI_LA_URL_DE_APPS_SCRIPT") {
    throw new Error("Debes configurar la URL de Google Apps Script en API_URL.");
  }
}

function validarFormularioSolicitud() {
  const tipoSolicitud = elementos.tipoSolicitud.value.trim();
  const titulo = elementos.titulo.value.trim();
  const descripcion = elementos.descripcion.value.trim();
  const prioridad = elementos.prioridad.value.trim();

  if (!tipoSolicitud) {
    mostrarMensaje("error", "Selecciona el tipo de solicitud.");
    elementos.tipoSolicitud.focus();
    return false;
  }

  if (!titulo) {
    mostrarMensaje("error", "Ingresa el título de la solicitud.");
    elementos.titulo.focus();
    return false;
  }

  if (!descripcion) {
    mostrarMensaje("error", "Ingresa la descripción de la solicitud.");
    elementos.descripcion.focus();
    return false;
  }

  if (!prioridad) {
    mostrarMensaje("error", "Selecciona la prioridad.");
    elementos.prioridad.focus();
    return false;
  }

  return true;
}

function construirTablaSolicitudes(solicitudes) {
  elementos.solicitudesTbody.innerHTML = "";

  if (!Array.isArray(solicitudes) || solicitudes.length === 0) {
    const fila = document.createElement("tr");
    fila.id = "filaSinSolicitudes";

    const celda = document.createElement("td");
    celda.colSpan = 7;
    celda.textContent = "No existen solicitudes registradas para este usuario.";

    fila.appendChild(celda);
    elementos.solicitudesTbody.appendChild(fila);
    return;
  }

  solicitudes.forEach((solicitud) => {
    const fila = document.createElement("tr");

    fila.appendChild(crearCelda(solicitud.idSolicitud || ""));
    fila.appendChild(crearCelda(solicitud.fechaRegistro || ""));
    fila.appendChild(crearCelda(solicitud.tipoSolicitud || ""));
    fila.appendChild(crearCelda(solicitud.titulo || ""));
    fila.appendChild(crearCelda(solicitud.descripcion || ""));
    fila.appendChild(crearCelda(solicitud.prioridad || ""));
    fila.appendChild(crearCelda(solicitud.estado || ""));

    elementos.solicitudesTbody.appendChild(fila);
  });
}

function crearCelda(valor) {
  const celda = document.createElement("td");
  celda.textContent = valor;
  return celda;
}

function mostrarPantallaPrincipal(usuario) {
  elementos.loginSection.hidden = true;
  elementos.appSection.hidden = false;

  elementos.usuarioAutenticado.textContent = `Usuario: ${usuario.nombre} | Correo: ${usuario.correo}`;
}

function mostrarPantallaLogin() {
  elementos.appSection.hidden = true;
  elementos.loginSection.hidden = false;
  elementos.usuarioAutenticado.textContent = "";
  construirTablaSolicitudes([]);
}

function cerrarSesion() {
  sessionStorage.removeItem(STORAGE_USUARIO);
  elementos.loginForm.reset();
  elementos.solicitudForm.reset();
  ocultarMensajes();
  mostrarPantallaLogin();
}

function obtenerUsuarioSesion() {
  const usuarioTexto = sessionStorage.getItem(STORAGE_USUARIO);

  if (!usuarioTexto) {
    return null;
  }

  try {
    const usuario = JSON.parse(usuarioTexto);

    if (!usuario.idUsuario || !usuario.correo) {
      return null;
    }

    return usuario;
  } catch (error) {
    sessionStorage.removeItem(STORAGE_USUARIO);
    return null;
  }
}

function imprimirGuardarPdf() {
  ocultarMensajes();

  const usuario = obtenerUsuarioSesion();

  if (!usuario) {
    cerrarSesion();
    mostrarMensaje("error", "La sesión no está activa. Ingresa nuevamente.");
    return;
  }

  window.print();
}

function establecerEstadoCarga(estaCargando, textoMensaje) {
  elementos.mensajeCarga.hidden = !estaCargando;

  if (estaCargando) {
    elementos.mensajeCarga.textContent = textoMensaje || "Procesando solicitud, por favor espera...";
  }

  elementos.btnLogin.disabled = estaCargando;
  elementos.btnRegistrarSolicitud.disabled = estaCargando;
  elementos.btnLimpiarFormulario.disabled = estaCargando;
  elementos.btnActualizar.disabled = estaCargando;
  elementos.btnImprimirPdf.disabled = estaCargando;
  elementos.btnCerrarSesion.disabled = estaCargando;
}

function mostrarMensaje(tipo, texto) {
  ocultarMensajes();

  if (tipo === "carga") {
    elementos.mensajeCarga.textContent = texto || "Procesando solicitud, por favor espera...";
    elementos.mensajeCarga.hidden = false;
    return;
  }

  if (tipo === "exito") {
    elementos.mensajeExito.textContent = texto || "Operación realizada correctamente.";
    elementos.mensajeExito.hidden = false;
    setTimeout(() => {
      elementos.mensajeExito.hidden = true;
    }, 4500);
    return;
  }

  if (tipo === "error") {
    elementos.mensajeError.textContent = texto || "Ocurrió un error al procesar la operación.";
    elementos.mensajeError.hidden = false;
  }
}

function ocultarMensajes() {
  elementos.mensajeCarga.hidden = true;
  elementos.mensajeExito.hidden = true;
  elementos.mensajeError.hidden = true;
}