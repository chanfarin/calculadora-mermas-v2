const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ PEGA AQUÍ TU CADENA DE CONEXIÓN REAL DE COMPASS/ATLAS
const MONGODB_URI =
  "mongodb+srv://franciscojavier:rhCSBlwHmtK1wacl@clusterecopaquetaxi.tkgbmzw.mongodb.net/fabrica?retryWrites=true&w=majority";

let dbCollection;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function conectarBaseDatos() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const database = client.db("fabrica");
    dbCollection = database.collection("productos");
    console.log("=== Conectado con éxito a MongoDB ===");
  } catch (error) {
    console.error("❌ Error crítico en la conexión a MongoDB:", error);
  }
}

// 1. GET: Obtener productos
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

// 2. POST: Guardar o añadir un nuevo producto
app.post("/api/productos", async (req, res) => {
  try {
    const nuevoProducto = req.body;
    console.log(
      "-> Servidor recibió petición POST para añadir:",
      nuevoProducto.nombre,
    );

    if (!dbCollection) {
      return res.status(500).json({ error: "Base de datos no disponible" });
    }

    // Blindamos los datos: si el navegador no envía un campo, evitamos el cuelgue asignando valores por defecto
    const docAAgregar = {
      id_producto: String(
        nuevoProducto.id_producto || "prod_desconocido",
      ).trim(),
      nombre: String(nuevoProducto.nombre || "Sin nombre").trim(),
      pesoBandeja: Number(nuevoProducto.pesoBandeja) || 0,
      mermaNitrogeno: Number(nuevoProducto.mermaNitrogeno) || 0,
      mermaFileteado: Number(nuevoProducto.mermaFileteado) || 0,
      desechoFijoKg: Number(nuevoProducto.desechoFijoKg) || 0,
      pesoCaja: Number(nuevoProducto.pesoCaja) || 6,
      tipoBandeja: String(nuevoProducto.tipoBandeja || "Estándar").trim(), // Evita el null/undefined
    };

    // Guardamos en MongoDB de forma segura
    const resultado = await dbCollection.insertOne(docAAgregar);
    console.log("✅ Guardado con éxito en MongoDB. ID:", resultado.insertedId);

    // RESPUESTA OBLIGATORIA: Avisamos al navegador para que rompa el estado "Guardando..."
    return res.status(201).json({ mensaje: "Guardado correctamente" });
  } catch (error) {
    console.error("❌ Error en POST /api/productos:", error);
    return res.status(500).json({ error: error.message });
  }
});

// 3. PUT: Editar un producto existente
app.put("/api/productos/:id", async (req, res) => {
  try {
    const idProducto = req.params.id;
    const datos = req.body;
    console.log("-> Servidor recibió petición PUT para editar ID:", idProducto);

    if (!dbCollection) {
      return res.status(500).json({ error: "Base de datos no disponible" });
    }

    const docActualizado = {
      nombre: String(datos.nombre || "Sin nombre").trim(),
      pesoBandeja: Number(datos.pesoBandeja) || 0,
      mermaNitrogeno: Number(datos.mermaNitrogeno) || 0,
      mermaFileteado: Number(datos.mermaFileteado) || 0,
      desechoFijoKg: Number(datos.desechoFijoKg) || 0,
      pesoCaja: Number(datos.pesoCaja) || 6,
      tipoBandeja: String(datos.tipoBandeja || "Estándar").trim(),
    };

    await dbCollection.updateOne(
      { id_producto: idProducto },
      { $set: docActualizado },
    );
    console.log("✅ Edición aplicada con éxito en MongoDB");

    return res.status(200).json({ mensaje: "Actualizado correctamente" });
  } catch (error) {
    console.error("❌ Error en PUT /api/productos:", error);
    return res.status(500).json({ error: error.message });
  }
});

// 4. DELETE: Eliminar un producto
app.delete("/api/productos/:id", async (req, res) => {
  try {
    if (!dbCollection)
      return res.status(500).json({ error: "Base de datos no disponible" });

    const idProducto = req.params.id;
    await dbCollection.deleteOne({ id_producto: idProducto });
    console.log(`❌ Artículo ${idProducto} eliminado`);

    return res.status(200).json({ mensaje: "Eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

conectarBaseDatos().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`=== Servidor corriendo en http://localhost:${PORT} ===`);
  });
});
