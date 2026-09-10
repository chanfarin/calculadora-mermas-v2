const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// REEMPLAZA ESTA CADENA POR TU CONEXIÓN REAL DE MONGODB COMPASS
const MONGODB_URI =
  "mongodb+srv://franciscojavier:rhCSBlwHmtK1wacl@clusterecopaquetaxi.tkgbmzw.mongodb.net/fabrica?retryWrites=true&w=majority";

let dbCollection;

// Configuración de Middlewares (¡Siempre antes de las rutas!)
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Función de conexión a la Base de Datos
async function conectarBaseDatos() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log("=== Conectado con éxito a MongoDB ===");

    // Apuntamos a la base de datos 'fabrica' y colección 'productos'
    const database = client.db("fabrica");
    dbCollection = database.collection("productos");
  } catch (error) {
    console.error("Error crítico al conectar a MongoDB:", error);
    process.exit(1);
  }
}

// === RUTAS DE LA API ===

// 1. GET: Obtener todos los productos
app.get("/api/productos", async (req, res) => {
  try {
    if (!dbCollection) {
      return res
        .status(500)
        .json({ error: "La base de datos no está inicializada" });
    }
    const listaProductos = await dbCollection.find({}).toArray();
    res.status(200).json(listaProductos);
  } catch (error) {
    console.error("Error en GET /api/productos:", error);
    res.status(500).json({ error: "Error al obtener los productos" });
  }
});

// 2. POST: Guardar un nuevo producto
app.post("/api/productos", async (req, res) => {
  try {
    console.log("-> Servidor recibió datos en el Body:", req.body);

    if (!dbCollection) {
      console.error(
        "❌ Error: dbCollection no está definida al intentar guardar.",
      );
      return res.status(500).json({ error: "Base de datos no disponible" });
    }

    const nuevoProducto = req.body;
    if (!nuevoProducto || !nuevoProducto.nombre) {
      return res.status(400).json({ error: "Datos del producto no válidos" });
    }

    // Insertamos en MongoDB
    const resultado = await dbCollection.insertOne(nuevoProducto);
    console.log(
      "✅ Producto guardado correctamente, ID asignado:",
      resultado.insertedId,
    );

    res
      .status(201)
      .json({ mensaje: "Producto guardado correctamente en MongoDB" });
  } catch (error) {
    // Muestra el fallo exacto en la terminal negra de Node
    console.error("❌ Error interno en POST /api/productos:", error);
    res
      .status(500)
      .json({ error: error.message || "Error al guardar el producto" });
  }
});

// Arrancar el servidor tras conectar
conectarBaseDatos().then(() => {
  app.listen(PORT, "0.0.0", () => {
    console.log(`=== Servidor Corriendo ===`);
  });
});
