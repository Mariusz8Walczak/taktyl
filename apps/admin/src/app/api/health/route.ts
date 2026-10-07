// I-001: liveness kontenera (healthcheck Dockera).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
