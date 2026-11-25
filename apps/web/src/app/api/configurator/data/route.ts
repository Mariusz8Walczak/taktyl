// F-250, audyt P0-3 (ADR-0011 pkt 7): slowniki konfiguratora dla podgladu 3D ladowanego na zadanie (galeria karty,
// sekcja "Zaprojektuj klawiature" na glownej). Te same dane co strona /konfigurator (znacznik `catalog`), bez cen.
import { NextResponse } from "next/server";
import { getConfiguratorData } from "../../../../lib/configurator/data";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const data = await getConfiguratorData();
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
