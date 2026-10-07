// B-001, B-007 (TAKTYL-50): /logowanie. Przycisk "Wejdz jako viewer" tylko przy DEMO_MODE=true (zmienna czytana w
// kontenerze admin w czasie dzialania, ADM-003); pasek demo z etykieta z ustawien publicznych API (shop.json -> demo.label).
import { publicShopSettingsSchema } from "@taktyl/contracts";
import type { Metadata } from "next";
import { LoginForm } from "../../components/logowanie/login-form";
import { MAIN_ID } from "../../components/skip-link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Logowanie" };

async function demoLabel(): Promise<string | null> {
  const base = (
    process.env.INTERNAL_API_URL ??
    process.env.API_URL_INTERNAL ??
    "http://localhost:4000"
  ).replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/shop-settings`, { cache: "no-store" });
    if (!res.ok) return null;
    const parsed = publicShopSettingsSchema.safeParse(await res.json());
    return parsed.success ? parsed.data.demo.label : null;
  } catch {
    return null;
  }
}

export default async function LoginPage() {
  const demoMode = process.env.DEMO_MODE === "true";
  const label = await demoLabel();
  return (
    <>
      {label ? (
        <p className="adm-pasek-demo" role="note">
          {label}
        </p>
      ) : null}
      <main id={MAIN_ID} tabIndex={-1} className="adm-logowanie tresc">
        <LoginForm demoMode={demoMode} />
      </main>
    </>
  );
}
