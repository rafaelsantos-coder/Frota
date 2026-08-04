import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { authenticate } from "./lib/auth.js";
import { ensureSeedData } from "./lib/seed.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";
import { registerVehicleRoutes } from "./routes/vehicles.js";
import {
  registerIngestRoutes,
  registerJimiWebhookRoutes,
  registerTelemetryRoutes,
} from "./routes/ingest.js";

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
const host = process.env.API_HOST ?? "0.0.0.0";
const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

await app.register(jwt, { secret: jwtSecret });
app.decorate("authenticate", authenticate);

app.get("/health", async () => ({ status: "ok", service: "sulnet-gestao-frota-api" }));

await registerAuthRoutes(app);
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

declare module "fastify" {
  interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}
