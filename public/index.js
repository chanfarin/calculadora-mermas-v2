import { productosPredeterminados } from "./config.js";
import { calcularLote, calcularPrevisionMolde } from "./logica.js";

let listaProductosGlobal = {};
let listaStocksGlobal = {};
let idProductoEnEdicion = null;
let instanciaGraficoMermas = null;
let ultimoFichajeCompletado = null;

window.onload = function () {
  document.getElementById("producto").addEventListener("change", () => {
    cargarDatosProducto();
    calcular();
  });
  document
    .getElementById("modoCalculo")
    .addEventListener("change", manejarCambioModo);
  document
    .getElementById("valorProduccion")
    .addEventListener("input", calcular);
  document.getElementById("pesoCaja").addEventListener("input", calcular);
  document
    .getElementById("btnCalcularOrdenCompra")
    .addEventListener("click", procesarCierreDeJornadaMongoDB);
  document
    .getElementById("btnToggleAdmin")
    .addEventListener("click", () =>
      document.getElementById("formNuevoProducto").classList.toggle("hidden"),
    );
  document
    .getElementById("btnGuardarProducto")
    .addEventListener("click", manejarGuardado);
  sincronizarProductos();
  // Añade esta línea dentro de tu window.onload, abajo del todo del bloque:
  document
    .getElementById("btnCargarLoteTabla")
    .addEventListener("click", cargarLoteAcumulativoATabla);

  // Añade esta línea dentro de tu window.onload para que escuche el botón rojo:
  document
    .getElementById("btnExportarPrevisionPDF")
    .addEventListener("click", generarInformePrevisionPDF);

  document
    .getElementById("filtroGrafico")
    .addEventListener("change", renderizarPanelGraficoMermas);

  document
    .getElementById("btnExportarGraficoPDF")
    .addEventListener("click", generarInformeMermasPDF);
  // Habilitamos los botones del control de tiempos e incidencias de operarios
  document
    .getElementById("btnIniciarTarea")
    .addEventListener("click", iniciarFichajeTareaPlanta);
  document
    .getElementById("btnFinalizarTarea")
    .addEventListener("click", finalizarFichajeTareaPlanta);
  document
    .getElementById("btnRegistrarIncidencia")
    .addEventListener("click", registrarIncidenciaTurnoPlanta);

  document
    .getElementById("btnExportarJornadaPDF")
    .addEventListener("click", cerrarJornadaCompletaTrabajadorPDF);

  renderizarPanelGraficoMermas();
};

function manejarCambioModo() {
  const modo = document.getElementById("modoCalculo").value;
  const label = document.getElementById("lblInputDinamico");
  const input = document.getElementById("valorProduccion");
  label.innerText =
    modo === "porKilos"
      ? "Kilos netos del pedido del cliente:"
      : "Cantidad de bandejas físicas a producir:";
  input.placeholder =
    modo === "porKilos"
      ? "Introduce los kilos totales"
      : "Introduce el número de bandejas";
  input.value = "";
  calcular();
}

async function sincronizarProductos() {
  try {
    const resProd = await fetch("/api/productos");
    if (!resProd.ok) throw new Error();
    const documentos = await resProd.json();
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
          tipoBandeja: String(doc.tipoBandeja || "Estándar").trim(),
        };
      });
    } else {
      listaProductosGlobal = productosPredeterminados;
    }
  } catch {
    listaProductosGlobal = productosPredeterminados;
  }

  // Bloque 2: Descarga segura de Stocks y Kilos desde MongoDB
  try {
    const resStock = await fetch("/api/inventario");
    listaStocksGlobal = {};
    window.listaKilosGlobal = {}; // Guardamos los kilos del día en la memoria global
    if (resStock.ok) {
      const stocksBD = await resStock.json();
      if (stocksBD && stocksBD.length > 0) {
        stocksBD.forEach((item) => {
          const llaveMolde = String(item.molde).trim();
          listaStocksGlobal[llaveMolde] = item.stockInicial || 0;
          window.listaKilosGlobal[llaveMolde] = item.kilosHoy || 0; // Descargamos los kilos acumulados
        });
      }
    }
  } catch {
    listaStocksGlobal = {};
    window.listaKilosGlobal = {};
  }

  actualizarSelect();
  cargarDatosProducto();
  renderizarListaAdmin();
  generarTablaInventario();
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
  const p = listaProductosGlobal[document.getElementById("producto").value];
  if (p) {
    document.getElementById("lblPeso").innerText = p.pesoBandeja;
    document.getElementById("lblCongelacion").innerText = p.mermaNitrogeno;
    document.getElementById("lblFileteado").innerText = p.mermaFileteado;
    document.getElementById("lblDesecho").innerText = p.desechoFijoKg;
    document.getElementById("pesoCaja").value = p.pesoCaja || 6;
  }
}
function calcular() {
  const p = listaProductosGlobal[document.getElementById("producto").value];
  if (!p) return;
  const res = calcularLote(
    p,
    document.getElementById("modoCalculo").value,
    parseFloat(document.getElementById("valorProduccion").value) || 0,
    parseFloat(document.getElementById("pesoCaja").value) || 0,
  );
  if (!res) {
    document.getElementById("resultadoTotal").innerText =
      "Materia prima necesaria: 0.00 kg iniciales";
    document.getElementById("resultadoCajas").innerText =
      "Cajas de Materia Prima  necesarias: 0";
    document.getElementById("resultadoBandejasVacias").innerText =
      "Bandejas necesarias para el lote: 0";
    document.getElementById("detalle").innerText =
      "Introduce un valor para calcular.";
    return;
  }
  document.getElementById("resultadoTotal").innerText =
    `Materia prima necesaria: ${res.materiaPrimaInicial.toFixed(2)} kg iniciales`;
  document.getElementById("resultadoCajas").innerText =
    `Cajas de Materia Prima necesarias: ${res.totalCajas}`;
  document.getElementById("resultadoBandejasVacias").innerText =
    `Bandejas necesarias para el lote: ${res.totalBandejasGastadas} unidades (${p.tipoBandeja})`;
  document.getElementById("detalle").innerText =
    `Pedido estimado: ${res.kilosTotalesPedido.toFixed(1)}kg netos terminados. | Línea de producción: ${res.totalBandejasGastadas} bandejas. | Mermas totales: ${(res.materiaPrimaInicial - res.kilosTotalesPedido).toFixed(2)}kg`;
}

function generarTablaInventario() {
  const tbody = document.getElementById("tablaCuerpoInventario");
  if (!tbody) return;
  tbody.innerHTML = "";
  const moldesUnicos = new Set();
  for (const id in listaProductosGlobal) {
    if (id !== "pescado_A" && id !== "pescado_B")
      moldesUnicos.add(listaProductosGlobal[id].tipoBandeja);
  }
  if (moldesUnicos.size === 0) return;

  moldesUnicos.forEach((molde) => {
    const tr = document.createElement("tr");
    const idSafelink = molde.replace(/\s+/g, "_");
    const stockInicial =
      listaStocksGlobal[String(molde).trim()] !== undefined
        ? listaStocksGlobal[String(molde).trim()]
        : 0;

    // Recuperamos los kilos acumulados del día desde MongoDB
    const kilosAcumulados =
      window.listaKilosGlobal &&
      window.listaKilosGlobal[String(molde).trim()] !== undefined
        ? window.listaKilosGlobal[String(molde).trim()]
        : 0;

    tr.innerHTML = `
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight:600;">${molde}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><input type="number" class="stock-manana" data-molde="${molde}" value="${stockInicial}" min="0" style="width: 75px; padding: 4px;"></td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><input type="number" class="kilos-dia" data-molde="${molde}" value="${kilosAcumulados}" min="0" style="width: 75px; padding: 4px;"></td>
            <td id="gastadas_${idSafelink}" style="padding: 8px; border-bottom: 1px solid #e2e8f0;">0</td>
            <td id="quedan_${idSafelink}" style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight:600;">0</td>
            <td id="pedido_${idSafelink}" style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight:bold;">Calculando...</td>
        `;
    tbody.appendChild(tr);
  });

  // Guardado automático de Stock Inicial en MongoDB
  tbody.querySelectorAll(".stock-manana").forEach((input) => {
    input.addEventListener("change", async function () {
      const moldeReal = this.getAttribute("data-molde").trim();
      const nuevoStock = parseInt(this.value) || 0;
      const inputKilos = document.querySelector(
        `.kilos-dia[data-molde="${moldeReal}"]`,
      );
      const kilosActuales = inputKilos ? parseFloat(inputKilos.value) || 0 : 0;

      listaStocksGlobal[moldeReal] = nuevoStock;
      calcularOrdenCompraGlobal();
      try {
        await fetch(`/api/inventario/${encodeURIComponent(moldeReal)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stockInicial: nuevoStock,
            kilosHoy: kilosActuales,
          }),
        });
      } catch {}
    });
  });

  // Guardado automático de Kilos del Día en MongoDB
  tbody.querySelectorAll(".kilos-dia").forEach((input) => {
    input.addEventListener("change", async function () {
      const moldeReal = this.getAttribute("data-molde").trim();
      const nuevosKilos = parseFloat(this.value) || 0;
      const inputStock = document.querySelector(
        `.stock-manana[data-molde="${moldeReal}"]`,
      );
      const stockActual = inputStock ? parseInt(inputStock.value) || 0 : 0;

      if (window.listaKilosGlobal)
        window.listaKilosGlobal[moldeReal] = nuevosKilos;
      calcularOrdenCompraGlobal();
      try {
        await fetch(`/api/inventario/${encodeURIComponent(moldeReal)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stockInicial: stockActual,
            kilosHoy: nuevosKilos,
          }),
        });
      } catch {}
    });
  });

  tbody
    .querySelectorAll(".kilos-dia")
    .forEach((input) =>
      input.addEventListener("input", calcularOrdenCompraGlobal),
    );
  calcularOrdenCompraGlobal();
}

function calcularOrdenCompraGlobal() {
  document.querySelectorAll(".stock-manana").forEach((input) => {
    const molde = input.getAttribute("data-molde");
    const idSafelink = molde.replace(/\s+/g, "_");
    const stockHoy = parseInt(input.value) || 0;

    const inputKilos = document.querySelector(
      `.kilos-dia[data-molde="${molde}"]`,
    );
    let kilosHoy = inputKilos ? parseFloat(inputKilos.value) || 0 : 0;

    // Sincronización de seguridad: si la celda visual está a 0 pero la nube tiene kilos, los recuperamos
    if (
      kilosHoy === 0 &&
      window.listaKilosGlobal &&
      window.listaKilosGlobal[String(molde).trim()]
    ) {
      kilosHoy = window.listaKilosGlobal[String(molde).trim()];
      if (inputKilos) inputKilos.value = kilosHoy;
    }

    // Guardamos el kilo actual en la memoria global para que no se pierda en el ecosistema del script
    if (window.listaKilosGlobal)
      window.listaKilosGlobal[String(molde).trim()] = kilosHoy;

    // Lanzamos la nueva matemática directa sin bucles de logica.js
    const prevision = calcularPrevisionMolde(
      stockHoy,
      kilosHoy,
      molde,
      listaProductosGlobal,
    );
    const dP = prevision || {
      bandejasGastadasHoy: 0,
      stockQuedaHoy: stockHoy,
      pedidoProveedor: 0,
    };

    // Pintamos los resultados reales y calculados de forma inmediata en la pantalla
    document.getElementById(`gastadas_${idSafelink}`).innerText =
      dP.bandejasGastadasHoy;

    const celdaQuedan = document.getElementById(`quedan_${idSafelink}`);
    celdaQuedan.innerText = dP.stockQuedaHoy;
    celdaQuedan.style.color = dP.stockQuedaHoy < 0 ? "#b91c1c" : "#166534";

    // Reemplaza la línea del "document.getElementById(`pedido_${idSafelink}`).innerHTML = ..." por esta:
    const textoFinalPedido =
      dP.pedidoProveedorTexto === "0"
        ? `<span style="color:#166534;">Suficiente</span>`
        : `<span style="color:#b91c1c; text-decoration: underline; font-weight:bold;">Pedir: ${dP.pedidoProveedorTexto}</span>`;

    // Revisa que la línea final de tu función calcularOrdenCompraGlobal() en index.js pinte las unidades así:
    document.getElementById(`pedido_${idSafelink}`).innerHTML =
      prevision.pedidoProveedor === 0
        ? `🛒 <span style="color:#166534;">Pedir: 0</span>`
        : `🛒 <span style="color:#b91c1c; text-decoration: underline;">Pedir: ${prevision.pedidoProveedor} uds</span>`;
  });
}

async function procesarCierreDeJornadaMongoDB() {
  if (
    !confirm(
      "¿Cerrar el turno? Esto restará las bandejas gastadas del stock real y limpiará los kilos a 0 en MongoDB.",
    )
  )
    return;

  const modo = document.getElementById("modoCalculo").value;
  const pesoPorCaja =
    parseFloat(document.getElementById("pesoCaja").value) || 0;

  // 1. PRIMERO: Procesamos y actualizamos las existencias de las bandejas/bolsas en MongoDB
  for (const input of document.querySelectorAll(".stock-manana")) {
    const molde = input.getAttribute("data-molde").trim();
    const idSafelink = molde.replace(/\s+/g, "_");
    const stockRemanenteReal =
      parseInt(document.getElementById(`quedan_${idSafelink}`).innerText) || 0;
    try {
      await fetch(`/api/inventario/${encodeURIComponent(molde)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockInicial: stockRemanenteReal, kilosHoy: 0 }),
      });
      listaStocksGlobal[molde] = stockRemanenteReal;
      if (window.listaKilosGlobal) window.listaKilosGlobal[molde] = 0;
    } catch (err) {
      console.error("Error al sincronizar el molde:", molde, err);
    }
  }

  // 2. SEGUNDO: Calculamos las mermas basándonos en el PESCADO SELECCIONADO, no en el molde general
  const idSeleccionado = document.getElementById("producto").value;
  const productoActivo = listaProductosGlobal[idSeleccionado];

  // Buscamos los kilos exactos que el botón azul inyectó hoy para la bandeja de este pescado
  let kilosProcesadosHoy = 0;
  if (productoActivo) {
    const inputKilosFila = document.querySelector(
      `.kilos-dia[data-molde="${productoActivo.tipoBandeja}"]`,
    );
    kilosProcesadosHoy = inputKilosFila
      ? parseFloat(inputKilosFila.value) || 0
      : 0;
  }

  // 3. TERCERO: Si el producto activo ha tenido kilos de trabajo, guardamos su merma independiente en MongoDB
  if (productoActivo && kilosProcesadosHoy > 0) {
    try {
      const res = calcularLote(
        productoActivo,
        modo,
        kilosProcesadosHoy,
        pesoPorCaja,
      );
      if (res) {
        const mermasTurnoKg = res.materiaPrimaInicial - res.kilosTotalesPedido;

        await fetch("/api/historico-mermas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            producto: productoActivo.nombre,
            kilosMermados: mermasTurnoKg,
          }),
        });

        await renderizarPanelGraficoMermas();
      }
    } catch (errLote) {
      console.warn(
        "No se pudo guardar el histórico del producto activo:",
        errLote,
      );
    }
  }

  // 4. CUARTO: Limpieza visual absoluta de la pantalla de cara al día siguiente
  document.getElementById("valorProduccion").value = "";
  document.querySelectorAll(".kilos-dia").forEach((input) => {
    input.value = "0";
  });

  await sincronizarProductos();
  alert(
    "🎉 Turno cerrado con éxito. Se han descontado los stocks y guardado el histórico de mermas de forma independiente en MongoDB.",
  );
}

function renderizarListaAdmin() {
  const contenedorLista = document.getElementById("listaAdminProductos");
  if (!contenedorLista) return;
  contenedorLista.innerHTML = "";
  for (const id in listaProductosGlobal) {
    if (id === "pescado_A" || id === "pescado_B") continue;
    const item = document.createElement("div");
    item.style =
      "display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #e2e8f0;";
    item.innerHTML = `<span><strong>${listaProductosGlobal[id].nombre}</strong> (Bandeja: ${listaProductosGlobal[id].pesoBandeja} kg | Molde: ${listaProductosGlobal[id].tipoBandeja})</span>
            <div class="acciones-producto"><button class="btn-accion btn-editar" data-id="${id}">✏️ Editar</button><button class="btn-accion btn-eliminar" data-id="${id}">❌ Borrar</button></div>`;
    contenedorLista.appendChild(item);
  }
  contenedorLista.querySelectorAll(".btn-editar").forEach((btn) =>
    btn.addEventListener("click", function () {
      prepararEdicion(this.getAttribute("data-id"));
    }),
  );
  contenedorLista.querySelectorAll(".btn-eliminar").forEach((btn) =>
    btn.addEventListener("click", function () {
      eliminarProducto(this.getAttribute("data-id"));
    }),
  );
}

function prepararEdicion(id) {
  const p = listaProductosGlobal[String(id).trim()];
  if (!p) return;
  idProductoEnEdicion = String(id).trim();
  document.getElementById("nuevoNombre").value = p.nombre;
  document.getElementById("nuevoPesoBandeja").value = p.pesoBandeja;
  document.getElementById("nuevaMermaNitrogeno").value = p.mermaNitrogeno;
  document.getElementById("nuevaMermaFileteado").value = p.mermaFileteado;
  document.getElementById("nuevoDesechoFijo").value = p.desechoFijoKg;
  document.getElementById("nuevoPesoCajaDefecto").value = p.pesoCaja;
  document.getElementById("nuevoTipoBandeja").value = p.tipoBandeja;
  document.getElementById("btnGuardarProducto").innerText =
    "Actualizar Cambios del Artículo";
  document.getElementById("nuevoNombre").focus();
}

async function eliminarProducto(id) {
  if (!confirm(`¿Eliminar?`)) return;
  try {
    await fetch(`/api/productos/${id}`, { method: "DELETE" });
    await sincronizarProductos();
    calcular();
  } catch {}
}

async function manejarGuardado() {
  const btn = document.getElementById("btnGuardarProducto");
  const n = document.getElementById("nuevoNombre").value.trim();
  const pB = parseFloat(document.getElementById("nuevoPesoBandeja").value);
  const mN =
    parseFloat(document.getElementById("nuevaMermaNitrogeno").value) || 0;
  const mF =
    parseFloat(document.getElementById("nuevaMermaFileteado").value) || 0;
  const dF = parseFloat(document.getElementById("nuevoDesechoFijo").value) || 0;
  const pC =
    parseFloat(document.getElementById("nuevoPesoCajaDefecto").value) || 6;
  const tB =
    document.getElementById("nuevoTipoBandeja").value.trim() || "Estándar";
  if (!n || isNaN(pB)) return;
  btn.disabled = true;
  try {
    const payload = {
      nombre: n,
      pesoBandeja: pB,
      mermaNitrogeno: mN,
      mermaFileteado: mF,
      desechoFijoKg: dF,
      pesoCaja: pC,
      tipoBandeja: tB,
    };
    if (idProductoEnEdicion) {
      await fetch(`/api/productos/${idProductoEnEdicion}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      idProductoEnEdicion = null;
    } else {
      const id = "prod_" + n.toLowerCase().replace(/\s+/g, "_");
      payload.id_producto = id;
      await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    await sincronizarProductos();
    cargarDatosProducto();
    calcular();
    document.getElementById("nuevoNombre").value = "";
    document.getElementById("nuevoPesoBandeja").value = "";
    document.getElementById("nuevaMermaNitrogeno").value = "";
    document.getElementById("nuevaMermaFileteado").value = "";
    document.getElementById("nuevoDesechoFijo").value = "";
    document.getElementById("nuevoTipoBandeja").value = "";
    document.getElementById("nuevoPesoCajaDefecto").value = "6";

    btn.innerText = "Guardar Producto";
    btn.style.background = "#1e3a8a";
    document.getElementById("formNuevoProducto").classList.add("hidden");
  } catch {
    alert("Error al procesar el artículo");
  } finally {
    btn.disabled = false;
  }
}
// Función corregida: usa la importación directa de la línea 1 de tu archivo
async function cargarLoteAcumulativoATabla() {
  const idSeleccionado = document.getElementById("producto").value;
  const p = listaProductosGlobal[idSeleccionado];
  if (!p) return;

  const modo = document.getElementById("modoCalculo").value;
  const valorInput =
    parseFloat(document.getElementById("valorProduccion").value) || 0;
  const pesoPorCaja =
    parseFloat(document.getElementById("pesoCaja").value) || 0;

  // Usamos directamente la función matemática que ya lee tu archivo index.js arriba
  const res = calcularLote(p, modo, valorInput, pesoPorCaja);
  if (!res) {
    alert("Introduce un valor de kilos válido arriba antes de cargar el lote.");
    return;
  }

  // Buscamos la celda de la tabla de abajo
  const inputKilosTabla = document.querySelector(
    `.kilos-dia[data-molde="${p.tipoBandeja}"]`,
  );
  if (inputKilosTabla) {
    const kilosPreviosEnTabla = parseFloat(inputKilosTabla.value) || 0;

    // Tu lógica exacta de suma acumulada
    const totalAcumuladoKilos = kilosPreviosEnTabla + res.kilosTotalesPedido;
    inputKilosTabla.value = totalAcumuladoKilos.toFixed(1);

    // Guardamos en la memoria global
    if (!window.listaKilosGlobal) window.listaKilosGlobal = {};
    window.listaKilosGlobal[String(p.tipoBandeja).trim()] = totalAcumuladoKilos;

    // Recalculamos la tabla visualmente
    calcularOrdenCompraGlobal();

    // Mandamos el nuevo saldo acumulado a MongoDB Compass
    const inputStock = document.querySelector(
      `.stock-manana[data-molde="${p.tipoBandeja}"]`,
    );
    const stockActual = inputStock ? parseInt(inputStock.value) || 0 : 0;
    try {
      await fetch(
        `/api/inventario/${encodeURIComponent(String(p.tipoBandeja).trim())}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stockInicial: stockActual,
            kilosHoy: totalAcumuladoKilos,
          }),
        },
      );
    } catch (err) {
      console.error(err);
    }

    // Limpiamos el formulario de arriba
    document.getElementById("valorProduccion").value = "";
    alert(
      `Lote cargado: +${res.kilosTotalesPedido.toFixed(1)} kg. Total hoy: ${totalAcumuladoKilos.toFixed(1)} kg.`,
    );
  }
}
// Función que lee la tabla logística y la maqueta en un PDF profesional para el proveedor
function generarInformePrevisionPDF() {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    alert(
      "La librería de PDFs no se ha cargado correctamente. Revisa tu conexión a internet.",
    );
    return;
  }

  const doc = new jsPDF();
  let y = 20; // Coordenada vertical inicial para escribir el texto

  // 1. Cabecera del Reporte Industrial
  doc.setFont("pacifica", "bold");
  doc.setFontSize(16);
  doc.text("INFORME PREDICTIVO DE COMPRA DE BANDEJAS", 14, y);

  y += 5;
  doc.setDrawColor(180, 0, 0);
  doc.setLineWidth(1);
  doc.line(14, y, 196, y); // Línea divisoria roja de diseño

  y += 10;
  doc.setFont("pacifica", "normal");
  doc.setFontSize(10);
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 14, y);
  doc.text(
    `Hora de Turno: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    140,
    y,
  );

  y += 12;
  doc.setFont("pacifica", "bold");
  doc.setFontSize(11);
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y - 4, 182, 6, "F");
  doc.text("RESUMEN DE ORDEN DE COMPRA SUGERIDA PARA MAÑANA", 16, y);

  y += 10;
  doc.setFontSize(9);
  // Maquetamos las columnas de la hoja del PDF
  doc.text("Modelo Bandeja", 16, y);
  doc.text("Stock Mañana", 65, y);
  doc.text("Kilos Hoy", 95, y);
  doc.text("Gastadas Hoy", 125, y);
  doc.text("Quedan Almacén", 150, y);
  doc.text("ORDEN COMPRA", 175, y);

  y += 2;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);

  // 2. Extraemos los datos dinámicos fila por fila directamente de vuestra tabla visual
  const filasTabla = document.querySelectorAll("#tablaCuerpoInventario tr");
  let hayPedidos = false;

  filasTabla.forEach((fila) => {
    const celdas = fila.querySelectorAll("td");
    if (celdas.length < 6) return;

    const molde = celdas[0].innerText.trim();
    const idSafelink = molde.replace(/\s+/g, "_");

    // Capturamos los inputs y las celdas calculadas
    const stockManana = fila.querySelector(".stock-manana")?.value || "0";
    const kilosDia = fila.querySelector(".kilos-dia")?.value || "0";
    const gastadasHoy =
      document.getElementById(`gastadas_${idSafelink}`)?.innerText || "0";
    const quedanHoy =
      document.getElementById(`quedan_${idSafelink}`)?.innerText || "0";
    const ordenCompraTexto =
      document.getElementById(`pedido_${idSafelink}`)?.innerText || "Pedir: 0";

    y += 8;
    // Si el reporte se estira mucho, evitamos que se salga del folio
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("futura", "normal");
    doc.text(molde, 16, y);
    doc.text(stockManana, 65, y);
    doc.text(kilosDia + " kg", 95, y);
    doc.text(gastadasHoy, 125, y);
    doc.text(quedanHoy, 150, y);

    // Si hay que pedir unidades, las destacamos en negrita para el proveedor
    if (
      ordenCompraTexto.includes("Pedir: 0") ||
      ordenCompraTexto.trim() === "0"
    ) {
      doc.setFont("futura", "normal");
      doc.text("0 uds", 175, y);
    } else {
      doc.setFont("futura", "bold");
      // Extraemos solo el número limpio del texto visual de la celda
      const unidadesLimpias = ordenCompraTexto.replace(/[^0-9]/g, "");
      doc.text(`${unidadesLimpias} uds ⚠️`, 175, y);
      hayPedidos = true;
    }
  });

  y += 15;
  doc.setFont("futura", "italic");
  doc.setFontSize(9);
  doc.text(
    "* Nota predictiva: La orden de compra asume un volumen de producción para mañana equivalente al procesado hoy.",
    14,
    y,
  );

  // 3. Bloque de firmas de validación para la oficina
  y += 25;
  doc.setFont("futura", "normal");
  doc.line(14, y, 64, y);
  doc.line(146, y, 196, y);
  y += 5;
  doc.text("Firma Encargado Turno", 14, y);
  doc.text("Validación Dirección", 146, y);

  // Guardamos y descargamos el archivo final de forma nativa en el móvil o PC
  const fechaArchivo = new Date().toLocaleDateString().replace(/\//g, "-");
  doc.save(`Prevision_Compras_Bandejas_${fechaArchivo}.pdf`);
}
// Función que descarga el histórico de MongoDB y dibuja el gráfico de barras con Chart.js
// Función corregida: combina fecha y producto en el eje X para evitar solapamientos
// Función que filtra por día o acumula por mes los datos de mermas de MongoDB
async function renderizarPanelGraficoMermas() {
  const canvas = document.getElementById("graficoMermasCanvas");
  if (!canvas) return;

  try {
    const respuesta = await fetch("/api/historico-mermas");
    if (!respuesta.ok) return;
    const datosHistoricos = await respuesta.json();

    const filtro = document.getElementById("filtroGrafico").value;
    const fechaHoy = new Date().toLocaleDateString("es-ES");
    const mesActual = fechaHoy.substring(3, 10);

    let etiquetasEjeX = [];
    let valoresKilos = [];
    let nombresProductos = [];

    if (filtro === "diario") {
      const datosHoy = datosHistoricos.filter(
        (item) => item.fecha === fechaHoy,
      );
      etiquetasEjeX = datosHoy.map((item) => item.producto);
      valoresKilos = datosHoy.map((item) => item.kilosMermados);
      nombresProductos = datosHoy.map((item) => item.producto);
    } else {
      const mermasAgrupadasPorProducto = {};
      datosHistoricos.forEach((item) => {
        if (item.fecha && item.fecha.includes(mesActual)) {
          const prod = item.producto;
          mermasAgrupadasPorProducto[prod] =
            (mermasAgrupadasPorProducto[prod] || 0) + (item.kilosMermados || 0);
        }
      });
      etiquetasEjeX = Object.keys(mermasAgrupadasPorProducto);
      valoresKilos = Object.values(mermasAgrupadasPorProducto);
      nombresProductos = Object.keys(mermasAgrupadasPorProducto);
    }

    // ✅ REPARADO GRÁFICAMENTE: Añadido el array [] de salvavidas para que no se rompa el script
    if (etiquetasEjeX.length === 0) {
      etiquetasEjeX = ["Sin datos registrados"];
      valoresKilos = []; // Ponemos un cero limpio entre corchetes
      nombresProductos = ["Sin actividad"];
    }

    if (instanciaGraficoMermas) {
      instanciaGraficoMermas.destroy();
    }

    instanciaGraficoMermas = new Chart(canvas, {
      type: "bar",
      data: {
        labels: etiquetasEjeX,
        datasets: [
          {
            label: "Mermas (Kg)",
            data: valoresKilos,
            backgroundColor:
              filtro === "diario"
                ? "rgba(30, 58, 138, 0.75)"
                : "rgba(22, 101, 52, 0.75)",
            borderColor:
              filtro === "diario" ? "rgb(30, 58, 138)" : "rgb(22, 101, 52)",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                return `${nombresProductos[context.dataIndex]}: ${context.parsed.y.toFixed(2)} kg mermados`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "#f1f5f9" },
            title: {
              display: true,
              text: "Kilos desperdiciados",
              font: { size: 10 },
            },
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 9 }, maxRotation: 30, minRotation: 30 },
          },
        },
      },
    });
  } catch (error) {
    console.error("Error al renderizar el gráfico estadístico:", error);
  }
}

// Función que compila el histórico de mermas de la nube y lo maqueta en un PDF formal
// Función corregida: rellenado el hueco del array para evitar que se congele el botón
async function generarInformeMermasPDF() {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    alert("La librería de PDFs no está lista. Revisa tu conexión.");
    return;
  }

  try {
    const respuesta = await fetch("/api/historico-mermas");
    if (!respuesta.ok) throw new Error();
    const datosHistoricos = await respuesta.json();

    const doc = new jsPDF();
    let y = 20;
    const fechaHoy = new Date().toLocaleDateString("es-ES");
    const mesActual = fechaHoy.substring(3, 10); // Filtro "MM/AAAA"

    // 1. Encabezado del documento
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("AUDITORÍA DE PROCESO: HISTORIAL DE MERMAS", 14, y);
    y += 5;
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(1);
    doc.line(14, y, 196, y);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Fecha de Cierre: ${fechaHoy}`, 14, y);
    doc.text(`Generado desde Terminal Móvil`, 140, y);

    // 2. Sección: Mermas de la jornada de HOY
    y += 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setFillColor(239, 246, 255);
    doc.rect(14, y - 4, 182, 6, "F");
    doc.text("1. DESGLOSE DE DESPERDICIO MANUAL Y CORTE (HOY)", 16, y);

    y += 10;
    doc.setFontSize(9);
    doc.text("Producto Procesado", 16, y);
    doc.text("Kilos Mermados Hoy (Kg)", 160, y);
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y, 196, y);

    const datosHoy = datosHistoricos.filter((item) => item.fecha === fechaHoy);

    if (datosHoy.length === 0) {
      y += 8;
      doc.setFont("helvetica", "italic");
      doc.text(
        "No se han registrado cierres de producción en la jornada de hoy.",
        16,
        y,
      );
    } else {
      datosHoy.forEach((item) => {
        y += 8;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont("helvetica", "normal");
        doc.text(String(item.producto), 16, y);
        doc.setFont("helvetica", "bold");
        doc.text(`${Number(item.kilosMermados).toFixed(2)} kg`, 160, y);
      });
    }

    // 3. Sección: Acumulado del MES
    y += 20;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setFillColor(240, 253, 244);
    doc.rect(14, y - 4, 182, 6, "F");
    doc.text(`2. ACUMULADO CONSOLIDADO DEL MES ACTUAL (${mesActual})`, 16, y);

    y += 10;
    doc.setFontSize(9);
    doc.text("Producto", 16, y);
    doc.text("Total Mermado en el Mes (Kg)", 150, y);
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y, 196, y);

    // Agrupamos el histórico por mes de forma matemática
    const mermasMensuales = {};
    datosHistoricos.forEach((item) => {
      if (item.fecha && item.fecha.includes(mesActual)) {
        mermasMensuales[item.producto] =
          (mermasMensuales[item.producto] || 0) + (item.kilosMermados || 0);
      }
    });

    const productosMes = Object.keys(mermasMensuales);
    if (productosMes.length === 0) {
      y += 8;
      doc.setFont("helvetica", "italic");
      doc.text("No hay datos acumulados para el mes en curso.", 16, y);
    } else {
      productosMes.forEach((prod) => {
        y += 8;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont("helvetica", "normal");
        doc.text(prod, 16, y);
        doc.setFont("helvetica", "bold");
        doc.text(`${mermasMensuales[prod].toFixed(2)} kg`, 150, y);
      });
    }

    // Pie de firmas formal de la empresa
    y += 30;
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.line(14, y, 64, y);
    doc.line(146, y, 196, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Firma Responsable Planta", 14, y);
    doc.text("Copia Dirección General", 146, y);

    doc.save(`Informe_Mermas_Fabrica_${fechaHoy.replace(/\//g, "-")}.pdf`);
  } catch (error) {
    alert("Error al compilar los datos para el PDF: " + error.message);
  }
}
// Variables locales en memoria del script para retener el estado del cronómetro del turno
// Variables globales en memoria del script para la jornada del trabajador
let registroTiempoActivo = null;
let incidenciasAcumuladasTurno = [];
let historialActividadesJornada = []; // 👇 NUEVA: Acumula todas las tareas del día

function iniciarFichajeTareaPlanta() {
  const operario = document.getElementById("operarioNombre").value.trim();
  const tarea = document.getElementById("operarioTarea").value;

  if (!operario) {
    alert("Introduce el nombre del operario o la línea antes de comenzar.");
    return;
  }

  registroTiempoActivo = {
    operario: operario,
    tarea: tarea,
    horaInicioTexto: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    milisegundosInicio: Date.now(),
  };

  incidenciasAcumuladasTurno = [];
  document.getElementById("listaIncidenciasTurno").innerHTML = "";

  // Bloqueamos controles táctiles para evitar errores a mitad de tarea
  document.getElementById("btnIniciarTarea").disabled = true;
  document.getElementById("btnFinalizarTarea").disabled = false;
  document.getElementById("operarioNombre").disabled = true;
  document.getElementById("operarioTarea").disabled = true;

  const cajaIncidencias =
    document.getElementById("seccionIncidencias") ||
    document.getElementById("seccaIncidencias");
  if (cajaIncidencias) cajaIncidencias.classList.remove("hidden");

  document.getElementById("estadoFichajeTexto").innerText =
    `⏱️ EN PROCESO: ${operario} en [${tarea}] desde las ${registroTiempoActivo.horaInicioTexto}`;
  document.getElementById("estadoFichajeTexto").style.background = "#bbf7d0";
}

function registrarIncidenciaTurnoPlanta() {
  const texto = document.getElementById("textoIncidencia").value.trim();
  if (!texto) return;

  const horaIncidencia = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const incidenciaFormateada = `[${horaIncidencia}] ${texto}`;
  incidenciasAcumuladasTurno.push(incidenciaFormateada);

  const li = document.createElement("li");
  li.innerText = incidenciaFormateada;
  li.style.color = "#ea580c";
  document.getElementById("listaIncidenciasTurno").appendChild(li);
  document.getElementById("textoIncidencia").value = "";
}

async function finalizarFichajeTareaPlanta() {
  if (!registroTiempoActivo) return;
  if (
    !confirm("¿Finalizar la tarea actual y guardarla en el historial del día?")
  )
    return;

  const milisegundosFin = Date.now();
  const horaFinTexto = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const diferenciaMilisegundos =
    milisegundosFin - registroTiempoActivo.milisegundosInicio;
  const minutosTrabajados = Math.ceil(diferenciaMilisegundos / 60000);

  const payloadTiempos = {
    operario: registroTiempoActivo.operario,
    tarea: registroTiempoActivo.tarea,
    horaInicio: registroTiempoActivo.horaInicioTexto,
    horaFin: horaFinTexto,
    duracionMinutos: minutosTrabajados,
    incidencias: [...incidenciasAcumuladasTurno],
  };

  // 1. ACUMULACIÓN HISTÓRICA: Guardamos esta actividad en la memoria de la jornada del móvil
  historialActividadesJornada.push(payloadTiempos);

  // 2. SINCRONIZACIÓN NUBE: Enviamos el tramo a MongoDB Compass de forma automática
  try {
    const respuesta = await fetch("/api/control-tiempos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadTiempos),
    });
    if (respuesta.status >= 200 && respuesta.status < 300) {
      alert(
        `✅ Tarea [${registroTiempoActivo.tarea}] guardada en el historial. Duración: ${minutosTrabajados} min. Continúa con el siguiente proceso.`,
      );
    } else {
      throw new Error();
    }
  } catch {
    console.error("Retraso al guardar tramo en MongoDB");
  }

  // 3. RESETEO PARCIAL: Dejamos la línea libre pero MANTENEMOS el nombre del operario congelado
  registroTiempoActivo = null;
  incidenciasAcumuladasTurno = [];

  document.getElementById("btnIniciarTarea").disabled = false;
  document.getElementById("btnFinalizarTarea").disabled = true;
  document.getElementById("operarioTarea").disabled = false; // Permitimos cambiar la tarea para el siguiente lote

  const cajaIncidencias =
    document.getElementById("seccionIncidencias") ||
    document.getElementById("seccaIncidencias");
  if (cajaIncidencias) cajaIncidencias.classList.add("hidden");

  document.getElementById("estadoFichajeTexto").innerText =
    `Línea lista. Selecciona la siguiente tarea para continuar la jornada.`;
  document.getElementById("estadoFichajeTexto").style.background = "#fef9c3";
}

// 👇 LA NUEVA FUNCIÓN CONSOLIDADA: Genera un ÚNICO PDF ordenado al acabar todo el día
function cerrarJornadaCompletaTrabajadorPDF() {
  if (historialActividadesJornada.length === 0) {
    alert(
      "⚠️ No hay ninguna tarea completada en el historial de hoy para este operario.",
    );
    return;
  }

  if (
    !confirm(
      "¿Deseas cerrar la jornada diaria completa del trabajador y descargar su informe consolidado?",
    )
  )
    return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;
  const fechaDocumento = new Date().toLocaleDateString("es-ES");

  // Obtenemos las referencias generales a partir del primer tramo registrado
  const nombreTrabajador = historialActividadesJornada[0].operario;

  // 1. Cabecera Institucional
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("PARTE DIARIO CONSOLIDADO DE TIEMPOS Y PROCESOS", 14, y);
  y += 5;
  doc.setDrawColor(161, 98, 7);
  doc.setLineWidth(1);
  doc.line(14, y, 196, y);

  // 2. Ficha del Empleado
  y += 12;
  doc.setFontSize(10);
  doc.setFillColor(254, 252, 232);
  doc.rect(14, y - 4, 182, 16, "F");
  doc.text(`TRABAJADOR / LÍNEA:  ${nombreTrabajador}`, 18, y);
  y += 7;
  doc.text(`FECHA DE LA JORNADA: ${fechaDocumento}`, 18, y);

  // 3. Cronología del Día (Fila por Fila)
  y += 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("LÍNEA CRONOLÓGICA DE ACTIVIDADES EN PLANTA", 14, y);

  y += 6;
  doc.setFontSize(9);
  doc.text("Proceso / Tarea", 16, y);
  doc.text("Inicio", 60, y);
  doc.text("Fin", 80, y);
  doc.text("Duración", 100, y);
  doc.text("Incidencias Notificadas en Planta", 125, y);

  y += 2;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);

  let minutosTotalesDelDia = 0;

  historialActividadesJornada.forEach((actividad) => {
    y += 8;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    minutosTotalesDelDia += actividad.duracionMinutos;

    doc.setFont("helvetica", "bold");
    doc.text(actividad.tarea, 16, y);
    doc.setFont("helvetica", "normal");
    doc.text(actividad.horaInicio, 60, y);
    doc.text(actividad.horaFin, 80, y);
    doc.text(`${actividad.duracionMinutos} min`, 100, y);

    // Desglosamos las incidencias de este tramo en la misma línea
    if (!actividad.incidencias || actividad.incidencias.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setTextColor(71, 85, 105);
      doc.text("Ninguna", 125, y);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(185, 28, 28);
      // Si hay varias incidencias en el mismo tramo, las unimos separadas por comas limpias
      const resumenIncidencias = actividad.incidencias
        .map((i) => i.substring(8))
        .join(", ");
      const textoCortado = doc.splitTextToSize(resumenIncidencias, 68);
      doc.text(textoCortado, 125, y);
      // Ajustamos el salto vertical si el texto de la incidencia es largo
      if (textoCortado.length > 1) y += (textoCortado.length - 1) * 4;
    }
    doc.setTextColor(0, 0, 0);
  });

  // 4. Resumen Total Horario
  y += 15;
  if (y > 260) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y - 4, 182, 7, "F");
  doc.text(
    `CÓMPUTO TOTAL DE LA JORNADA TRABAJADA: ${minutosTotalesDelDia} MINUTOS UTILES`,
    16,
    y,
  );

  // 5. Bloque de firmas oficiales
  y += 25;
  if (y > 260) {
    doc.addPage();
    y = 20;
  }
  doc.line(14, y, 64, y);
  doc.line(146, y, 196, y);
  y += 5;
  doc.setFontSize(8);
  doc.text("Firma del Trabajador", 14, y);
  doc.text("Firma Responsable Fábrica", 146, y);

  // Descargamos el PDF diario único
  const nombreArchivo = `Resumen_Jornada_${nombreTrabajador.replace(/\s+/g, "_")}_${fechaDocumento.replace(/\//g, "-")}.pdf`;
  doc.save(nombreArchivo);

  // Reseteamos el casillero general de la memoria de cara al día siguiente
  historialActividadesJornada = [];
  document.getElementById("operarioNombre").disabled = false;
  document.getElementById("operarioNombre").value = "";
  document.getElementById("estadoFichajeTexto").innerText =
    "Línea libre. Esperando inicio de tarea...";
  document.getElementById("estadoFichajeTexto").style.background = "#fef9c3";
}
