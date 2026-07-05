// Punto de entrada: separa el 'listen' de la app para que los tests
// (jest + supertest) puedan importar la app sin abrir un puerto real.
const { app, initDb } = require("./app");

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`Servidor backend escuchando en puerto ${PORT}`);
  await initDb();
});
