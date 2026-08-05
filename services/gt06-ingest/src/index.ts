import net from "node:net";
import { buildAck, parsePackets } from "./gt06-protocol.js";
import { forwardAlarm, forwardPosition, forwardRfid, notifySession } from "./api-client.js";

const port = Number(process.env.GT06_PORT ?? 5023);
const host = process.env.GT06_HOST ?? "0.0.0.0";

const sessions = new Map<string, { imei?: string; remoteIp?: string }>();

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
        sessions.set(`${remoteIp}:${socket.remotePort}`, { imei, remoteIp });
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
      console.log(`[gt06] disconnect imei=${imei}`);
      void notifySession(imei, false, remoteIp);
    }
    sessions.delete(`${remoteIp}:${socket.remotePort}`);
  });

  socket.on("error", (error) => {
    console.error("[gt06] socket error", error);
  });
});

server.listen(port, host, () => {
  console.log(`[gt06] TCP server listening on ${host}:${port}`);
});
