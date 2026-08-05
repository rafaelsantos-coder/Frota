import net from "node:net";
import http from "node:http";
import { buildAck, buildServerCommand, GT06_COMMAND_STRINGS, parsePackets } from "./gt06-protocol.js";
import { forwardAlarm, forwardPosition, forwardRfid, notifySession } from "./api-client.js";

const port = Number(process.env.GT06_PORT ?? 5023);
const host = process.env.GT06_HOST ?? "0.0.0.0";
const cmdPort = Number(process.env.GT06_CMD_PORT ?? 5024);
const internalSecret = process.env.INTERNAL_API_SECRET ?? "change-me-in-production";

const imeiSockets = new Map<string, net.Socket>();

function verifySecret(header?: string) {
  if (!internalSecret) return true;
  return header === internalSecret;
}

const server = net.createServer((socket) => {
  const remoteIp = socket.remoteAddress ?? undefined;
  let buffer = Buffer.alloc(0);
  let imei: string | undefined;

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    const parsed = parsePackets(buffer);
    buffer = Buffer.from(parsed.remaining);

    for (const message of parsed.messages) {
      if (message.type === "login") {
        imei = message.imei;
        imeiSockets.set(imei, socket);
        console.log(`[gt06] login imei=${imei} from ${remoteIp}`);
        void notifySession(imei, true, remoteIp);
        socket.write(buildAck(0x01, message.serial));
      }

      if (message.type === "heartbeat") {
        if (imei) void notifySession(imei, true, remoteIp, message.ignitionOn);
        socket.write(buildAck(0x13, message.serial));
      }

      if (message.type === "location" && imei) {
        socket.write(buildAck(0x12, message.serial));
        void forwardPosition({
          imei,
          latitude: message.latitude,
          longitude: message.longitude,
          speedKmh: message.speedKmh,
          course: message.course,
          recordedAt: message.recordedAt,
          remoteIp,
          ignitionOn: message.ignitionOn,
        });
      }

      if (message.type === "alarm" && imei) {
        socket.write(buildAck(0x16, message.serial));
        void forwardAlarm({
          imei,
          alarmType: message.alarmType,
          latitude: message.latitude,
          longitude: message.longitude,
          recordedAt: message.recordedAt,
        });
      }

      if (message.type === "rfid" && imei) {
        socket.write(buildAck(0x17, message.serial));
        void forwardRfid({ imei, rfidTag: message.rfidTag });
      }

      if (message.type === "unknown") {
        socket.write(buildAck(message.protocol, message.serial));
      }
    }
  });

  socket.on("close", () => {
    if (imei) {
      if (imeiSockets.get(imei) === socket) {
        imeiSockets.delete(imei);
      }
      console.log(`[gt06] disconnect imei=${imei}`);
      void notifySession(imei, false, remoteIp);
    }
  });

  socket.on("error", (error) => {
    console.error("[gt06] socket error", error);
  });
});

http
  .createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/internal/command") {
      res.writeHead(404);
      res.end();
      return;
    }

    if (!verifySecret(req.headers["x-internal-secret"] as string | undefined)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    let body = "";
    for await (const chunk of req) body += chunk;

    try {
      const parsed = JSON.parse(body) as { imei?: string; type?: "BLOCK" | "UNBLOCK" };
      if (!parsed.imei || !parsed.type) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "imei and type required" }));
        return;
      }

      const socket = imeiSockets.get(parsed.imei);
      if (!socket || socket.destroyed) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Rastreador offline ou não conectado" }));
        return;
      }

      const commandText = GT06_COMMAND_STRINGS[parsed.type];
      socket.write(buildServerCommand(commandText));
      console.log(`[gt06] command ${parsed.type} sent to imei=${parsed.imei}: ${commandText}`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Command failed" }));
    }
  })
  .listen(cmdPort, host, () => {
    console.log(`[gt06] command HTTP on ${host}:${cmdPort}`);
  });

server.listen(port, host, () => {
  console.log(`[gt06] TCP server listening on ${host}:${port}`);
});
