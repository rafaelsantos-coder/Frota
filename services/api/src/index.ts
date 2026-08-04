import Fastify from "fastify";
import cors from "@fastify/cors";
import { ensureSeedData } from "./lib/seed.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";
import { registerVehicleRoutes } from "./routes/vehicles.js";
import {
  registerIngestRoutes,
  registerJimiWebhookRoutes,
  registerTelemetryRoutes,
} from "./routes/ingest.js";

const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok", service: "frota-api" }));

await registerVehicleRoutes(app);
await registerIntegrationRoutes(app);
await registerIngestRoutes(app);
await registerJimiWebhookRoutes(app);
await registerTelemetryRoutes(app);

await ensureSeedData();

try {
  await app.listen({ port, host });
  app.log.info(`API listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
