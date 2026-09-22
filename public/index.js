import { productosPredeterminados } from "./config.js";
import { calcularLote, calcularPrevisionMolde } from "./logica.js";

let listaProductosGlobal = {};
let listaStocksGlobal = {};
let idProductoEnEdicion = null;

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

    document.getElementById(`pedido_${idSafelink}`).innerHTML =
      dP.pedidoProveedor === 0
        ? `🛒 <span style="color:#166534;">Pedir: 0</span>`
        : `🛒 <span style="color:#b91c1c; text-decoration: underline;">Pedir: ${dP.pedidoProveedor}</span>`;
  });
}

async function procesarCierreDeJornadaMongoDB() {
  if (
    !confirm(
      "¿Cerrar el turno? Esto restará las bandejas gastadas del stock real y limpiará los kilos a 0 en MongoDB.",
    )
  )
    return;
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
    } catch {}
  }
  document.getElementById("valorProduccion").value = "";
  sincronizarProductos();
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
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("INFORME PREDICTIVO DE COMPRA DE BANDEJAS", 14, y);

  y += 5;
  doc.setDrawColor(185, 28, 28);
  doc.setLineWidth(1);
  doc.line(14, y, 196, y); // Línea divisoria roja de diseño

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 14, y);
  doc.text(
    `Hora de Turno: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    140,
    y,
  );

  y += 12;
  doc.setFont("helvetica", "bold");
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

    doc.setFont("helvetica", "normal");
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
      doc.setFont("helvetica", "normal");
      doc.text("0 uds", 175, y);
    } else {
      doc.setFont("helvetica", "bold");
      // Extraemos solo el número limpio del texto visual de la celda
      const unidadesLimpias = ordenCompraTexto.replace(/[^0-9]/g, "");
      doc.text(`${unidadesLimpias} uds ⚠️`, 175, y);
      hayPedidos = true;
    }
  });

  y += 15;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    "* Nota predictiva: La orden de compra asume un volumen de producción para mañana equivalente al procesado hoy.",
    14,
    y,
  );

  // 3. Bloque de firmas de validación para la oficina
  y += 25;
  doc.setFont("helvetica", "normal");
  doc.line(14, y, 64, y);
  doc.line(146, y, 196, y);
  y += 5;
  doc.text("Firma Encargado Turno", 14, y);
  doc.text("Validación Dirección", 146, y);

  // Guardamos y descargamos el archivo final de forma nativa en el móvil o PC
  const fechaArchivo = new Date().toLocaleDateString().replace(/\//g, "-");
  doc.save(`Prevision_Compras_Bandejas_${fechaArchivo}.pdf`);
}
