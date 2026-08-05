const commandUrl =
  process.env.GT06_COMMAND_URL ?? "http://localhost:5024/internal/command";
const internalSecret = process.env.INTERNAL_API_SECRET ?? "change-me-in-production";

export async function sendGt06Command(imei: string, type: "BLOCK" | "UNBLOCK") {
  const response = await fetch(commandUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret,
    },
    body: JSON.stringify({ imei, type }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `GT06 command failed: ${response.status}`);
  }

  return response.json() as Promise<{ ok: boolean }>;
}
