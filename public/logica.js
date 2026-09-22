// Función para calcular los datos de un lote individual (Mermas, cajas, bandejas)
export function calcularLote(p, modo, valorInput, pesoPorCaja) {
  if (valorInput <= 0) return null;

  let kilosTotalesPedido = 0;
  let totalBandejasGastadas = 0;

  if (modo === "porKilos") {
    kilosTotalesPedido = valorInput;
    totalBandejasGastadas = Math.ceil(
      kilosTotalesPedido / (p.pesoBandeja || 1),
    );
  } else {
    totalBandejasGastadas = Math.ceil(valorInput);
    kilosTotalesPedido = totalBandejasGastadas * (p.pesoBandeja || 1);
  }

  const totalCajas =
    pesoPorCaja > 0 ? Math.ceil(kilosTotalesPedido / pesoPorCaja) : 0;

  let pesoRequerido = kilosTotalesPedido;
  pesoRequerido = pesoRequerido / ((100 - (p.desechoFijoKg || 0)) / 100); // Desperdicio manual %
  pesoRequerido = pesoRequerido / ((100 - (p.mermaFileteado || 0)) / 100); // Merma fileteadora %
  const materiaPrimaInicial =
    pesoRequerido / ((100 - (p.mermaNitrogeno || 0)) / 100); // Merma Nitrógeno %

  return {
    materiaPrimaInicial,
    totalCajas,
    totalBandejasGastadas,
    kilosTotalesPedido,
  };
}

// Función para calcular la previsión de stock de un molde de bandeja para mañana
// Función predictiva global corregida sin bucles conflictivos para el inventario permanente
export function calcularPrevisionMolde(
  stockInicialHoy,
  kilosProcesadosHoy,
  molde,
  listaProductosGlobal,
) {
  let bandejasGastadasHoy = 0;
  let pesoBandejaReferencia = 1; // Por si acaso, un salvavidas por defecto de 1kg

  // Buscamos en la base de datos el peso neto que acepta este modelo de bandeja específico
  for (const id in listaProductosGlobal) {
    if (listaProductosGlobal[id].tipoBandeja === molde) {
      pesoBandejaReferencia =
        parseFloat(listaProductosGlobal[id].pesoBandeja) || 1;
      break; // En cuanto encontramos un producto con esa bandeja, adoptamos su peso de referencia
    }
  }

  // Si hay kilos introducidos en la tabla, calculamos las bandejas gastadas reales de forma directa
  if (kilosProcesadosHoy > 0) {
    bandejasGastadasHoy = Math.ceil(kilosProcesadosHoy / pesoBandejaReferencia);
  }

  // Realizamos las operaciones logísticas definitivas de resta y pedido predictivo
  const stockQuedaHoy = stockInicialHoy - bandejasGastadasHoy;
  const balancePrevisionManana = stockQuedaHoy - bandejasGastadasHoy;
  const pedidoProveedor =
    balancePrevisionManana < 0 ? Math.abs(balancePrevisionManana) : 0;

  return {
    bandejasGastadasHoy,
    stockQuedaHoy,
    pedidoProveedor,
  };
}
