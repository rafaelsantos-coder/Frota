import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
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
import { registerExtendedTelemetryRoutes } from "./routes/telemetry.js";
import { registerGeofenceRoutes } from "./routes/geofences.js";
import { registerDriverRoutes } from "./routes/drivers.js";
import { registerOperationsRoutes } from "./routes/operations.js";
import { registerMediaRoutes } from "./routes/media.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerExportRoutes } from "./routes/export.js";

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

await app.register(swagger, {
  openapi: {
    info: {
      title: "Sulnet Gestão de Frota API",
      description: "API REST para monitoramento, telemetria, DMS/ADAS e gestão operacional",
      version: "2.0.0",
    },
    servers: [{ url: process.env.API_PUBLIC_URL ?? `http://localhost:${port}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
});

app.get("/health", async () => ({ status: "ok", service: "sulnet-gestao-frota-api" }));
app.get("/docs/json", async () => app.swagger());

await registerAuthRoutes(app);
await registerVehicleRoutes(app);
await registerDriverRoutes(app);
await registerIntegrationRoutes(app);
await registerIngestRoutes(app);
await registerJimiWebhookRoutes(app);
await registerTelemetryRoutes(app);
await registerExtendedTelemetryRoutes(app);
await registerGeofenceRoutes(app);
await registerOperationsRoutes(app);
await registerMediaRoutes(app);
await registerDashboardRoutes(app);
await registerExportRoutes(app);

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
