// B-400..B-408 (TAKTYL-53): /ustawienia. B-014 (TAKTYL-65): sekcja resetu danych demo tylko przy DEMO_MODE=true
// (zmienna czytana w kontenerze admin w czasie dzialania, jak na /logowanie).
import { SettingsView } from "../../../components/ustawienia/settings-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ustawienia sklepu" };

export default function SettingsPage() {
  return <SettingsView demoMode={process.env.DEMO_MODE === "true"} />;
}
