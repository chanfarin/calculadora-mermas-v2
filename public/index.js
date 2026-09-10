// 1. PRODUCTOS DE MUESTRA (Solo si tu base de datos MongoDB está totalmente vacía)
const productosPredeterminados = {
  pescado_A: {
    nombre: "Merluza / Bacalao (Muestra)",
    pesoBandeja: 1.5,
    mermaNitrogeno: 3,
    mermaFileteado: 12,
    desechoFijoKg: 2.0,
    pesoCaja: 6,
  },
  pescado_B: {
    nombre: "Salmón (Muestra)",
    pesoBandeja: 2.0,
    mermaNitrogeno: 2,
    mermaFileteado: 18,
    desechoFijoKg: 1.5,
    pesoCaja: 10,
  },
};

let productos = {};

window.onload = async function () {
  // 2. CAPTURA DE ELEMENTOS DEL DOM
  const selectProducto = document.getElementById("producto");
  const inputBandejas = document.getElementById("bandejas");
  const inputPesoCaja = document.getElementById("pesoCaja");

  const lblPeso = document.getElementById("lblPeso");
  const lblCongelacion = document.getElementById("lblCongelacion");
  const lblFileteado = document.getElementById("lblFileteado");
  const lblDesecho = document.getElementById("lblDesecho");

  const resultadoTotal = document.getElementById("resultadoTotal");
  const resultadoCajas = document.getElementById("resultadoCajas");
  const detalleCalculo = document.getElementById("detalle");

  const btnToggleAdmin = document.getElementById("btnToggleAdmin");
  const formNuevoProducto = document.getElementById("formNuevoProducto");
  const btnGuardarProducto = document.getElementById("btnGuardarProducto");

  // 3. DESCARGAR PRODUCTOS DEL SERVIDOR NODE.JS
  async function sincronizarProductos() {
    try {
      const respuesta = await fetch("/api/productos");
      const documentos = await respuesta.json();

      if (documentos && documentos.length > 0) {
        productos = {};
        documentos.forEach((doc) => {
          productos[doc.id_producto] = {
            nombre: doc.nombre,
            pesoBandeja: doc.pesoBandeja,
            mermaNitrogeno: doc.mermaNitrogeno,
            mermaFileteado: doc.mermaFileteado,
            desechoFijoKg: doc.desechoFijoKg,
            pesoCaja: doc.pesoCaja,
          };
        });
      } else {
        productos = productosPredeterminados;
      }

      actualizarSelect();
      cargarDatosProducto();
    } catch (error) {
      console.error("Error al conectar con Node.js:", error);
      alert("No se pudieron cargar los productos desde el servidor.");
    }
  }

  function actualizarSelect() {
    selectProducto.innerHTML = "";
    for (const id in productos) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = productos[id].nombre;
      selectProducto.appendChild(option);
    }
  }

  function cargarDatosProducto() {
    const prodId = selectProducto.value;
    const p = productos[prodId];
    if (p) {
      lblPeso.innerText = p.pesoBandeja;
      lblCongelacion.innerText = p.mermaNitrogeno;
      lblFileteado.innerText = p.mermaFileteado;
      lblDesecho.innerText = p.desechoFijoKg;
      inputPesoCaja.value = p.pesoCaja || 6;
    }
  }

  // 4. LÓGICA DE CÁLCULO
  function calcular() {
    const prodId = selectProducto.value;
    const p = productos[prodId];
    if (!p) return;

    const bandejas = parseInt(inputBandejas.value) || 0;
    const pesoPorCaja = parseFloat(inputPesoCaja.value) || 0;

    if (bandejas <= 0) {
      resultadoTotal.innerText = "Necesitas: 0.00 kg iniciales";
      resultadoCajas.innerText = "Cajas necesarias: 0";
      return;
    }

    const pesoNetoTotal = bandejas * p.pesoBandeja;
    let pesoRequerido = pesoNetoTotal + p.desechoFijoKg;

    const factorFileteado = (100 - p.mermaFileteado) / 100;
    pesoRequerido = pesoRequerido / factorFileteado;

    const factorNitrogeno = (100 - p.mermaNitrogeno) / 100;
    const materiaPrimaInicial = pesoRequerido / factorNitrogeno;

    let totalCajas =
      pesoPorCaja > 0 ? Math.ceil(pesoNetoTotal / pesoPorCaja) : 0;

    resultadoTotal.innerText = `Necesitas: ${materiaPrimaInicial.toFixed(2)} kg`;
    resultadoCajas.innerText = `Cajas necesarias: ${totalCajas}`;
    detalleCalculo.innerText = `Bandejas: ${pesoNetoTotal.toFixed(1)}kg totales terminados. | Mermas: ${(materiaPrimaInicial - pesoNetoTotal).toFixed(2)}kg`;
  }

  // 5. EVENTOS
  btnToggleAdmin.addEventListener("click", function () {
    formNuevoProducto.classList.toggle("hidden");
  });

  btnGuardarProducto.addEventListener("click", async function () {
    const nombre = document.getElementById("nuevoNombre").value.trim();
    const pesoBandeja = parseFloat(
      document.getElementById("nuevoPesoBandeja").value,
    );
    const mermaNitrogeno =
      parseFloat(document.getElementById("nuevaMermaNitrogeno").value) || 0;
    const mermaFileteado =
      parseFloat(document.getElementById("nuevaMermaFileteado").value) || 0;
    const desechoFijoKg =
      parseFloat(document.getElementById("nuevoDesechoFijo").value) || 0;
    const pesoCaja =
      parseFloat(document.getElementById("nuevoPesoCajaDefecto").value) || 6;

    if (!nombre || isNaN(pesoBandeja)) {
      alert("Por favor, introduce al menos el nombre y el peso de la bandeja.");
      return;
    }

    const id_producto = "prod_" + nombre.toLowerCase().replace(/\s+/g, "_");
    const nuevoDoc = {
      id_producto,
      nombre,
      pesoBandeja,
      mermaNitrogeno,
      mermaFileteado,
      desechoFijoKg,
      pesoCaja,
    };

    btnGuardarProducto.innerText = "Guardando en MongoDB...";
    btnGuardarProducto.disabled = true;

    try {
      await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoDoc),
      });

      await sincronizarProductos();
      selectProducto.value = id_producto;
      cargarDatosProducto();
      calcular();

      // Limpiar formulario
      document.getElementById("nuevoNombre").value = "";
      document.getElementById("nuevoPesoBandeja").value = "";
      document.getElementById("nuevaMermaNitrogeno").value = "";
      document.getElementById("nuevaMermaFileteado").value = "";
      document.getElementById("nuevoDesechoFijo").value = "";
      formNuevoProducto.classList.add("hidden");
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al intentar guardar el producto.");
    } finally {
      btnGuardarProducto.innerText = "Guardar Producto";
      btnGuardarProducto.disabled = false;
    }
  });

  selectProducto.addEventListener("change", function () {
    cargarDatosProducto();
    calcular();
  });

  inputBandejas.addEventListener("input", calcular);
  inputPesoCaja.addEventListener("input", calcular);

  // Inicializar carga
  await sincronizarProductos();
};
