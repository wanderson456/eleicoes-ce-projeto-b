import app from "./app.js";
import { pool } from "./config/database.js";

const port = Number(process.env.PORT ?? 3000);

try {
  await pool.query("SELECT 1");

  console.log("Conexão com PostgreSQL estabelecida.");

  app.listen(port, () => {
    console.log(`API iniciada na porta ${port}`);
  });
} catch (error) {
  console.error("Falha ao conectar ao PostgreSQL:", error);
  process.exit(1);
}
