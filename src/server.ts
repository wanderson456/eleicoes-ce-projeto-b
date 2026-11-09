import { createApp } from "./app.js";
import { pool } from "./config/database.js";
import { logger } from "./config/logger.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp(pool);

try {
  await pool.query("SELECT 1");

  logger.info("Conexão com PostgreSQL estabelecida.");

  app.listen(port, () => {
    logger.info({ port }, "API iniciada.");
  });
} catch (error) {
  logger.fatal({ err: error }, "Falha ao conectar ao PostgreSQL.");
  process.exit(1);
}