const CRC_TABLE = (() => {
  const table = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
    table[i] = crc & 0xffff;
  }
  return table;
})();

function crc16X25(buffer: Buffer): number {
  let crc = 0xffff;
  for (let i = 0; i < buffer.length; i++) {
    const index = ((crc >> 8) ^ buffer[i]!) & 0xff;
    crc = ((crc << 8) ^ CRC_TABLE[index]!) & 0xffff;
  }
  return (~crc) & 0xffff;
}

function decodeBcdImei(bytes: Buffer): string {
  let imei = "";
  for (const byte of bytes) {
    imei += Math.floor(byte / 16).toString();
    imei += (byte % 16).toString();
  }
  return imei.replace(/^0+/, "");
}

function decodeCoordinate(raw: number): number {
  const degrees = Math.floor(raw / 30000 / 60);
  const minutes = raw / 30000 - degrees * 60;
  return degrees + minutes / 60;
}

function decodeDateTime(bytes: Buffer): Date {
  const year = 2000 + bytes[0]!;
  const month = bytes[1]! - 1;
  const day = bytes[2]!;
  const hour = bytes[3]!;
  const minute = bytes[4]!;
  const second = bytes[5]!;
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

export type Gt06Message =
  | { type: "login"; imei: string; serial: number }
  | {
      type: "location";
      latitude: number;
      longitude: number;
      speedKmh: number;
      course: number;
      recordedAt: Date;
      serial: number;
    }
  | { type: "heartbeat"; serial: number; terminalInfo?: number }
  | { type: "unknown"; protocol: number; serial: number };

export function buildAck(protocol: number, serial: number): Buffer {
  const body = Buffer.from([protocol, (serial >> 8) & 0xff, serial & 0xff]);
  const length = body.length + 2;
  const frame = Buffer.alloc(5 + body.length);
  frame[0] = 0x78;
  frame[1] = 0x78;
  frame[2] = length;
  body.copy(frame, 3);
  const crc = crc16X25(frame.subarray(2, 3 + body.length));
  frame[3 + body.length] = (crc >> 8) & 0xff;
  frame[4 + body.length] = crc & 0xff;
  return Buffer.concat([frame, Buffer.from([0x0d, 0x0a])]);
}

export function parsePackets(buffer: Buffer): { messages: Gt06Message[]; remaining: Buffer } {
  const messages: Gt06Message[] = [];
  let offset = 0;

  while (offset + 5 <= buffer.length) {
    const startTwo = buffer[offset] === 0x78 && buffer[offset + 1] === 0x78;
    const startFour = buffer[offset] === 0x79 && buffer[offset + 1] === 0x79;
    if (!startTwo && !startFour) {
      offset += 1;
      continue;
    }

    const lengthByte = buffer[offset + 2]!;
    const packetLength = startTwo ? lengthByte + 5 : lengthByte + 6;
    if (offset + packetLength > buffer.length) break;

    const packet = buffer.subarray(offset, offset + packetLength);
    const protocolOffset = startTwo ? 3 : 4;
    const protocol = packet[protocolOffset]!;
    const contentStart = protocolOffset + 1;
    const serialOffset = packet.length - 6;
    const serial = packet.readUInt16BE(serialOffset);
    const content = packet.subarray(contentStart, serialOffset);

    if (protocol === 0x01 && content.length >= 8) {
      messages.push({ type: "login", imei: decodeBcdImei(content.subarray(0, 8)), serial });
    } else if (protocol === 0x12 && content.length >= 18) {
      const recordedAt = decodeDateTime(content.subarray(0, 6));
      const latRaw = content.readUInt32BE(7);
      const lngRaw = content.readUInt32BE(11);
      const speedKmh = content[15]!;
      const course = content.readUInt16BE(16) & 0x03ff;
      messages.push({
        type: "location",
        latitude: decodeCoordinate(latRaw),
        longitude: decodeCoordinate(lngRaw),
        speedKmh,
        course,
        recordedAt,
        serial,
      });
    } else if (protocol === 0x13) {
      messages.push({
        type: "heartbeat",
        serial,
        terminalInfo: content[0],
      });
    } else {
      messages.push({ type: "unknown", protocol, serial });
    }

    offset += packetLength;
  }

  return { messages, remaining: buffer.subarray(offset) };
}
