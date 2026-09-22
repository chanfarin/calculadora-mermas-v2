const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ REEMPLAZA ESTA CADENA POR TU CONEXIÓN REAL DE COMPASS/ATLAS
const MONGODB_URI =
  "mongodb+srv://franciscojavier:rhCSBlwHmtK1wacl@clusterecopaquetaxi.tkgbmzw.mongodb.net/bliblioteca?retryWrites=true&w=majority";

let dbCollection;
let invCollection; // Colección para los stocks de las bandejas

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function conectarBaseDatos() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const database = client.db("fabrica");
    dbCollection = database.collection("productos");
    invCollection = database.collection("inventario"); // Inicializamos la colección de stock
    console.log("=== Conectado con éxito a MongoDB ===");
  } catch (error) {
    console.error("❌ Error crítico en la conexión a MongoDB:", error);
  }
}

// ================= RUTAS DE PRODUCTOS =================

app.get("/api/productos", async (req, res) => {
  try {
    if (!dbCollection)
      return res.status(500).json({ error: "Base de datos no lista" });
    const listaProductos = await dbCollection.find({}).toArray();
    res.status(200).json(listaProductos);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los productos" });
  }
});

app.post("/api/productos", async (req, res) => {
  try {
    const nuevoProducto = req.body;
    if (!nuevoProducto || Object.keys(nuevoProducto).length === 0)
      return res.status(400).json({ error: "Datos vacíos" });
    if (!dbCollection)
      return res.status(503).json({ error: "Base de datos no disponible" });

    const idGenerado = String(
      nuevoProducto.id_producto || "prod_desconocido",
    ).trim();
    const productoDuplicado = await dbCollection.findOne({
      id_producto: idGenerado,
    });
    if (productoDuplicado)
      return res.status(400).json({ error: "Este artículo ya existe." });

    const docAAgregar = {
      id_producto: idGenerado,
      nombre: String(nuevoProducto.nombre || "Sin nombre").trim(),
      pesoBandeja: Number(nuevoProducto.pesoBandeja) || 0,
      mermaNitrogeno: Number(nuevoProducto.mermaNitrogeno) || 0,
      mermaFileteado: Number(nuevoProducto.mermaFileteado) || 0,
      desechoFijoKg: Number(nuevoProducto.desechoFijoKg) || 0,
      pesoCaja: Number(nuevoProducto.pesoCaja) || 6,
      tipoBandeja: String(nuevoProducto.tipoBandeja || "Estándar").trim(),
    };

    await dbCollection.insertOne(docAAgregar);
    return res.status(201).json({ mensaje: "Guardado correctamente" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.put("/api/productos/:id", async (req, res) => {
  try {
    const idProducto = req.params.id;
    const datos = req.body || {};
    if (!dbCollection)
      return res.status(503).json({ error: "Base de datos no disponible" });

    const nombreFinal = datos.nombre || req.body.nombre || "Sin nombre";
    const docActualizado = {
      nombre: String(nombreFinal).trim(),
      pesoBandeja: Number(datos.pesoBandeja || req.body.pesoBandeja) || 0,
      mermaNitrogeno:
        Number(datos.mermaNitrogeno || req.body.mermaNitrogeno) || 0,
      mermaFileteado:
        Number(datos.mermaFileteado || req.body.mermaFileteado) || 0,
      desechoFijoKg: Number(datos.desechoFijoKg || req.body.desechoFijoKg) || 0,
      pesoCaja: Number(datos.pesoCaja || req.body.pesoCaja) || 6,
      tipoBandeja: String(
        datos.tipoBandeja || req.body.tipoBandeja || "Estándar",
      ).trim(),
    };

    await dbCollection.updateOne(
      { id_producto: idProducto },
      { $set: docActualizado },
    );
    return res.status(200).json({ mensaje: "Actualizado correctamente" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete("/api/productos/:id", async (req, res) => {
  try {
    if (!dbCollection)
      return res.status(503).json({ error: "Base de datos no disponible" });
    await dbCollection.deleteOne({ id_producto: req.params.id });
    return res.status(200).json({ mensaje: "Eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ================= 👇 NUEVAS RUTAS DE INVENTARIO (MONGODB) =================

// Obtener los stocks iniciales de las bandejas
app.get("/api/inventario", async (req, res) => {
  try {
    if (!invCollection)
      return res.status(500).json({ error: "Base de datos no lista" });
    const listaStocks = await invCollection.find({}).toArray();
    res.status(200).json(listaStocks);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener el inventario" });
  }
});

// Guardar o actualizar el stock inicial de una bandeja específica
app.put("/api/inventario/:molde", async (req, res) => {
  try {
    if (!invCollection)
      return res.status(503).json({ error: "Base de datos no disponible" });
    const moldeId = req.params.molde;
    const { stockInicial, kilosHoy } = req.body;

    await invCollection.updateOne(
      { molde: moldeId },
      {
        $set: {
          stockInicial: Number(stockInicial) || 0,
          kilosHoy: Number(kilosHoy) || 0,
        },
      },

      { upsert: true }, // Si el molde no existe en la BD, lo crea automáticamente
    );

    return res
      .status(200)
      .json({ mensaje: "Stock de bandeja sincronizado en la nube" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

conectarBaseDatos().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`=== Servidor corriendo en http://localhost:${PORT} ===`);
  });
});
