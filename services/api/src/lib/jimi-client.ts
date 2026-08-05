import crypto from "node:crypto";
import { prisma } from "./prisma.js";

function md5(value: string) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function signParams(params: Record<string, string>, appSecret: string) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return md5(`${appSecret}${sorted}${appSecret}`).toUpperCase();
}

async function getJimiConfig(organizationId: string) {
  const integration = await prisma.jimiIntegration.findFirst({
    where: { organizationId, enabled: true },
  });
  if (!integration?.appKey || !integration.appSecret) {
    throw new Error("Integração Jimi não configurada");
  }
  return integration;
}

export async function jimiApiCall(
  organizationId: string,
  method: string,
  extraParams: Record<string, string> = {},
) {
  const integration = await getJimiConfig(organizationId);
  const params: Record<string, string> = {
    app_key: integration.appKey!,
    method,
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    v: "1.0",
    sign_method: "md5",
    format: "json",
    ...extraParams,
  };
  params.sign = signParams(params, integration.appSecret!);

  const body = new URLSearchParams(params);
  const response = await fetch(integration.apiBaseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (json.code != null && Number(json.code) !== 0) {
    throw new Error(String(json.message ?? "Erro na API Jimi"));
  }
  return json;
}

export async function startLiveStream(organizationId: string, deviceImei: string, channel = 1) {
  const result = await jimiApiCall(organizationId, "jimi.device.live.stream", {
    imei: deviceImei,
    channel: String(channel),
    streamType: "RTMP",
  });
  const data = result.result as Record<string, unknown> | undefined;
  return {
    streamUrl: (data?.url as string | undefined) ?? (data?.streamUrl as string | undefined) ?? null,
    raw: result,
  };
}

export async function requestVideoClip(
  organizationId: string,
  deviceImei: string,
  startTime: string,
  durationSec = 60,
  channel = 1,
) {
  return jimiApiCall(organizationId, "jimi.device.media.request", {
    imei: deviceImei,
    channel: String(channel),
    startTime,
    duration: String(durationSec),
  });
}

export async function stopLiveStream(organizationId: string, deviceImei: string, channel = 1) {
  return jimiApiCall(organizationId, "jimi.device.live.stop", {
    imei: deviceImei,
    channel: String(channel),
  });
}
