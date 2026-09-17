const productosPredeterminados = {
  pescado_A: {
    nombre: "Merluza / Bacalao (Muestra)",
    pesoBandeja: 1.5,
    mermaNitrogeno: 3,
    mermaFileteado: 12,
    desechoFijoKg: 2.0,
    pesoCaja: 6,
    tipoBandeja: "Modelo 4",
  },
  pescado_B: {
    nombre: "Salmón (Muestra)",
    pesoBandeja: 2.0,
    mermaNitrogeno: 2,
    mermaFileteado: 18,
    desechoFijoKg: 1.5,
    pesoCaja: 10,
    tipoBandeja: "Modelo 2",
  },
};

let listaProductosGlobal = {};
let idProductoEnEdicion = null;

window.onload = function () {
  document.getElementById("producto").addEventListener("change", function () {
    cargarDatosProducto();
    calcular();
  });

  // Escuchamos el cambio de modo para alterar las etiquetas visuales
  document
    .getElementById("modoCalculo")
    .addEventListener("change", manejarCambioModo);

  document
    .getElementById("valorProduccion")
    .addEventListener("input", calcular);
  document.getElementById("pesoCaja").addEventListener("input", calcular);

  document
    .getElementById("btnToggleAdmin")
    .addEventListener("click", function () {
      document.getElementById("formNuevoProducto").classList.toggle("hidden");
    });

  document
    .getElementById("btnGuardarProducto")
    .addEventListener("click", manejarGuardado);

  sincronizarProductos();
};

function manejarCambioModo() {
  const modo = document.getElementById("modoCalculo").value;
  const label = document.getElementById("lblInputDinamico");
  const input = document.getElementById("valorProduccion");

  if (modo === "porKilos") {
    label.innerText = "Kilos netos del pedido del cliente:";
    input.placeholder = "Introduce los kilos totales";
  } else {
    label.innerText = "Cantidad de bandejas físicas a producir:";
    input.placeholder = "Introduce el número de bandejas";
  }
  input.value = "";
  calcular();
}

async function sincronizarProductos() {
  try {
    const respuesta = await fetch("/api/productos");
    if (!respuesta.ok) throw new Error("Error del servidor");
    const documentos = await respuesta.json();

    if (documentos && documentos.length > 0) {
      listaProductosGlobal = {};
      documentos.forEach((doc) => {
        listaProductosGlobal[doc.id_producto] = {
          nombre: doc.nombre,
          pesoBandeja: doc.pesoBandeja,
          mermaNitrogeno: doc.mermaNitrogeno,
          mermaFileteado: doc.mermaFileteado,
          desechoFijoKg: doc.desechoFijoKg,
          pesoCaja: doc.pesoCaja,
          tipoBandeja: doc.tipoBandeja || "Estándar",
        };
      });
    } else {
      listaProductosGlobal = productosPredeterminados;
    }
  } catch (error) {
    console.error("Error sincronizando:", error);
    listaProductosGlobal = productosPredeterminados;
  }

  actualizarSelect();
  cargarDatosProducto();
  renderizarListaAdmin();
}

function actualizarSelect() {
  const select = document.getElementById("producto");
  select.innerHTML = "";
  for (const id in listaProductosGlobal) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = listaProductosGlobal[id].nombre;
    select.appendChild(option);
  }
}

function cargarDatosProducto() {
  const idSeleccionado = document.getElementById("producto").value;
  const p = listaProductosGlobal[idSeleccionado];
  if (p) {
    document.getElementById("lblPeso").innerText = p.pesoBandeja;
    document.getElementById("lblCongelacion").innerText = p.mermaNitrogeno;
    document.getElementById("lblFileteado").innerText = p.mermaFileteado;
    document.getElementById("lblDesecho").innerText = p.desechoFijoKg;
    document.getElementById("pesoCaja").value = p.pesoCaja || 6;
  }
}

function calcular() {
  const idSeleccionado = document.getElementById("producto").value;
  const p = listaProductosGlobal[idSeleccionado];
  if (!p) return;

  const modo = document.getElementById("modoCalculo").value;
  const valorInput =
    parseFloat(document.getElementById("valorProduccion").value) || 0;
  const pesoPorCaja =
    parseFloat(document.getElementById("pesoCaja").value) || 0;

  if (valorInput <= 0) {
    document.getElementById("resultadoTotal").innerText =
      "Materia prima necesaria: 0.00 kg iniciales";
    document.getElementById("resultadoCajas").innerText =
      "Cajas de embalaje necesarias: 0";
    document.getElementById("resultadoBandejasVacias").innerText =
      "Bandejas necesarias para el lote: 0";
    document.getElementById("detalle").innerText =
      "Introduce un valor para calcular.";
    return;
  }

  let kilosTotalesPedido = 0;
  let totalBandejas = 0;

  // SELECCIÓN INTELIGENTE DE FÓRMULA MATEMÁTICA
  if (modo === "porKilos") {
    // Modo anterior: El usuario introduce Kilos, deducimos las bandejas
    kilosTotalesPedido = valorInput;
    totalBandejas = Math.ceil(kilosTotalesPedido / (p.pesoBandeja || 1));
  } else {
    // Nuevo modo: El usuario introduce Bandejas, deducimos los Kilos netos resultantes
    totalBandejas = Math.ceil(valorInput);
    kilosTotalesPedido = totalBandejas * (p.pesoBandeja || 1);
  }

  // A partir de aquí la física de mermas corre igual para ambos porque ya tenemos los Kilos Netos
  const totalCajas =
    pesoPorCaja > 0 ? Math.ceil(kilosTotalesPedido / pesoPorCaja) : 0;

  let pesoRequerido = kilosTotalesPedido + p.desechoFijoKg;
  pesoRequerido = pesoRequerido / ((100 - p.mermaFileteado) / 100);
  const materiaPrimaInicial = pesoRequerido / ((100 - p.mermaNitrogeno) / 100);

  // Pintar resultados unificados en la pantalla
  document.getElementById("resultadoTotal").innerText =
    `Materia prima necesaria: ${materiaPrimaInicial.toFixed(2)} kg iniciales`;
  document.getElementById("resultadoCajas").innerText =
    `Cajas de embalaje necesarias: ${totalCajas}`;
  document.getElementById("resultadoBandejasVacias").innerText =
    `Bandejas necesarias para el lote: ${totalBandejas} unidades (${p.tipoBandeja})`;

  document.getElementById("detalle").innerText =
    `Pedido estimado: ${kilosTotalesPedido.toFixed(1)}kg netos terminados. | Línea de producción: ${totalBandejas} bandejas. | Mermas totales: ${(materiaPrimaInicial - kilosTotalesPedido).toFixed(2)}kg`;
}

function renderizarListaAdmin() {
  const contenedorLista = document.getElementById("listaAdminProductos");
  if (!contenedorLista) return;
  contenedorLista.innerHTML = "";

  for (const id in listaProductosGlobal) {
    if (id === "pescado_A" || id === "pescado_B") continue;

    const item = document.createElement("div");
    item.style.display = "flex";
    item.style.justify = "space-between";
    item.style.alignItems = "center";
    item.style.padding = "8px";
    item.style.borderBottom = "1px solid #e2e8f0";

    item.innerHTML = `
            <span><strong>${listaProductosGlobal[id].nombre}</strong> (Bandeja: ${listaProductosGlobal[id].pesoBandeja} kg | Molde: ${listaProductosGlobal[id].tipoBandeja})</span>
            <div class="acciones-producto">
                <button class="btn-accion btn-editar" data-id="${id}">✏️ Editar</button>
                <button class="btn-accion btn-eliminar" data-id="${id}">❌ Borrar</button>
            </div>
        `;
    contenedorLista.appendChild(item);
  }

  contenedorLista.querySelectorAll(".btn-editar").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      prepararEdicion(e.currentTarget.getAttribute("data-id"));
    });
  });

  contenedorLista.querySelectorAll(".btn-eliminar").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      eliminarProducto(e.currentTarget.getAttribute("data-id"));
    });
  });
}

function prepararEdicion(id) {
  const p = listaProductosGlobal[id];
  if (!p) return;

  idProductoEnEdicion = id;
  document.getElementById("nuevoNombre").value = p.nombre;
  document.getElementById("nuevoPesoBandeja").value = p.pesoBandeja;
  document.getElementById("nuevaMermaNitrogeno").value = p.mermaNitrogeno;
  document.getElementById("nuevaMermaFileteado").value = p.mermaFileteado;
  document.getElementById("nuevoDesechoFijo").value = p.desechoFijoKg;
  document.getElementById("nuevoPesoCajaDefecto").value = p.pesoCaja;
  document.getElementById("nuevoTipoBandeja").value = p.tipoBandeja;

  const btn = document.getElementById("btnGuardarProducto");
  btn.innerText = "Actualizar Cambios del Artículo";
  btn.style.background = "#eab308";
  document.getElementById("nuevoNombre").focus();
}

async function eliminarProducto(id) {
  if (
    !confirm(
      `¿Seguro que quieres eliminar "${listaProductosGlobal[id].nombre}" definitivamente?`,
    )
  )
    return;
  try {
    const respuesta = await fetch(`/api/productos/${id}`, { method: "DELETE" });
    if (!respuesta.ok) throw new Error("Fallo");
    await sincronizarProductos();
    calcular();
  } catch (error) {
    alert("Error al intentar eliminar.");
  }
}

async function manejarGuardado() {
  const btn = document.getElementById("btnGuardarProducto");
  const nombreInput = document.getElementById("nuevoNombre");
  const pesoBandejaInput = document.getElementById("nuevoPesoBandeja");
  const mermaNitrogenoInput = document.getElementById("nuevaMermaNitrogeno");
  const mermaFileteadoInput = document.getElementById("nuevaMermaFileteado");
  const desechoFijoInput = document.getElementById("nuevoDesechoFijo");
  const pesoCajaInput = document.getElementById("nuevoPesoCajaDefecto");
  const tipoBandejaInput = document.getElementById("nuevoTipoBandeja");

  const nombre = nombreInput.value.trim();
  const pesoBandeja = parseFloat(pesoBandejaInput.value);
  const mermaNitrogeno = parseFloat(mermaNitrogenoInput.value) || 0;
  const mermaFileteado = parseFloat(mermaFileteadoInput.value) || 0;
  const desechoFijoKg = parseFloat(desechoFijoInput.value) || 0;
  const pesoCaja = parseFloat(pesoCajaInput.value) || 6;
  const tipoBandeja = tipoBandejaInput.value.trim() || "Estándar";
  if (!nombre || isNaN(pesoBandeja)) {
    alert("Introduce elnombre y el peso dela bandeja.");
    return;
  }

  btn.disabled = true;

  try {
    if (idProductoEnEdicion) {
      btn.innerText = "Actualizando...";
      await fetch(`/api/productos/${idProductoEnEdicion}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nombre,
          pesoBandeja,
          mermaNitrogeno,
          mermaFileteado,
          desechoFijoKg,
          pesoCaja,
          tipoBandeja,
        }),
      });
      const idGuardado = idProductoEnEdicion;
      idProductoEnEdicion = null;
      await sincronizarProductos();
      document.getElementById("producto").value = idGuardado;
    } else {
      btn.innerText = "Guardando...";
      const id_producto = "prod_" + nombre.toLowerCase().replace(/\s+/g, "_");
      await fetch("api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_producto,
          nombre,
          pesoBandeja,
          mermaNitrogeno,
          mermaFileteado,
          desechoFijoKg,
          pesoCaja,
          tipoBandeja,
        }),
      });

      await sincronizarProductos();
      document.getElementById("producto").value = id_producto;
    }
    cargarDatosProducto();
    calcular();
    nombreInput.value = "";
    pesoBandejaInput.value = "";
    mermaNitrogenoInput.value = "";
    desechoFijoInput.value = "";
    pesoCajaInput.value = "";
    tipoBandejaInput.value = "";

    btn.innerText = "Guardar Producto";
    btn.style.background = "1#e38a";
    document.getElementById("formNuevoProducto").classList.add("hiden");
  } catch (error) {
    alert("Error al procesar:" + error.message);
  } finally {
    btn.disabled = false;
  }
}
