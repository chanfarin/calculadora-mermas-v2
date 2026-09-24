// Función para calcular los datos de un lote individual (Mermas, cajas, bandejas)
// Función para calcular los datos de un lote individual (Mermas, cajas, envases)
export function calcularLote(p, modo, valorInput, pesoPorCaja) {
  if (valorInput <= 0) return null;

  let kilosTotalesPedido = 0;
  let totalBandejasGastadas = 0;

  // Detectamos si el envase asignado es una bolsa de 1kg o 2kg, si no, usamos el peso de la bandeja
  const nombreEnvase = String(p.tipoBandeja || "").toLowerCase();
  let divisorEnvase = parseFloat(p.pesoBandeja) || 1;

  if (nombreEnvase.includes("bolsa") && nombreEnvase.includes("2")) {
    divisorEnvase = 2; // Forzamos divisor de 2kg para bolsas de dos kilos
  } else if (nombreEnvase.includes("bolsa") && nombreEnvase.includes("1")) {
    divisorEnvase = 1; // Forzamos divisor de 1kg para bolsas de un kilo
  }

  if (modo === "porKilos") {
    kilosTotalesPedido = valorInput;
    totalBandejasGastadas = Math.ceil(kilosTotalesPedido / divisorEnvase);
  } else {
    totalBandejasGastadas = Math.ceil(valorInput);
    kilosTotalesPedido = totalBandejasGastadas * divisorEnvase;
  }

  const totalCajas =
    pesoPorCaja > 0 ? Math.ceil(kilosTotalesPedido / pesoPorCaja) : 0;

  // Aplicamos el desperdicio manual como porcentaje (%) en cascada
  let pesoRequerido = kilosTotalesPedido;
  pesoRequerido = pesoRequerido / ((100 - (p.desechoFijoKg || 0)) / 100);
  pesoRequerido = pesoRequerido / ((100 - (p.mermaFileteado || 0)) / 100);
  const materiaPrimaInicial =
    pesoRequerido / ((100 - (p.mermaNitrogeno || 0)) / 100);

  return {
    materiaPrimaInicial,
    totalCajas,
    totalBandejasGastadas,
    kilosTotalesPedido,
  };
}

// Función predictiva global sin bucles conflictivos adaptada para bolsas y bandejas
// Función predictiva global adaptada para convertir bolsas automáticas a Rollos de Film
// Función predictiva directa y limpia de errores para el inventario de la fábrica
// Función predictiva directa y limpia de errores para el inventario de la fábrica
export function calcularPrevisionMolde(
  stockInicialHoy,
  kilosProcesadosHoy,
  molde,
  listaProductosGlobal,
) {
  let bandejasGastadasHoy = 0;
  let divisorEnvaseReferencia = 1;

  // Buscamos en la base de datos el peso neto que acepta este modelo de envase
  for (const id in listaProductosGlobal) {
    if (listaProductosGlobal[id].tipoBandeja === molde) {
      const nombreEnvase = String(molde).toLowerCase();
      if (nombreEnvase.includes("bolsa") && nombreEnvase.includes("2")) {
        divisorEnvaseReferencia = 2; // Bolsa de 2kg
      } else if (nombreEnvase.includes("bolsa") && nombreEnvase.includes("1")) {
        divisorEnvaseReferencia = 1; // Bolsa de 1kg
      } else {
        divisorEnvaseReferencia =
          parseFloat(listaProductosGlobal[id].pesoBandeja) || 1; // Bandeja estándar
      }
      break;
    }
  }

  // Calculamos las unidades físicas consumidas hoy
  if (kilosProcesadosHoy > 0) {
    bandejasGastadasHoy = Math.ceil(
      kilosProcesadosHoy / divisorEnvaseReferencia,
    );
  }

  const stockQuedaHoy = stockInicialHoy - bandejasGastadasHoy;
  const balancePrevisionManana = stockQuedaHoy - bandejasGastadasHoy;
  const pedidoProveedor =
    balancePrevisionManana < 0 ? Math.abs(balancePrevisionManana) : 0;

  return {
    bandejasGastadasHoy,
    stockQuedaHoy,
    pedidoProveedor, // Retornamos el número limpio de unidades
  };
}
