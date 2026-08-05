import { PublicTrackClient } from "./track-client";

export default async function PublicTrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicTrackClient token={token} />;
}
