// F-250, F-255 (ADR-0011, D-I015-ikony): ikony konfiguratora z zestawu Lucide (licencja ISC, `lucide-react`, SVG w pakiecie).
// Wlasciciel zdjal regule 1 dla ikon; rysunki nadal nie sa tworzone w repo, tylko brane z zestawu. Ikony sa dekoracja
// (aria-hidden), kazdy element ma tez tekst. Kolor z `currentColor`, rozmiar z tokenu rozmiaru ikony w CSS.
import {
  Box,
  CircleDot,
  Cpu,
  Footprints,
  Gem,
  Hourglass,
  Image as ImageIcon,
  Keyboard,
  Layers,
  Lightbulb,
  Monitor,
  Mouse,
  Palette,
  Percent,
  Sparkles,
  ToggleLeft,
  Type,
  type LucideIcon,
} from "lucide-react";

const PART_ICONS: Record<string, LucideIcon> = {
  obudowa: Box,
  obudowa_spod: Layers,
  obudowa_fazowanie: Layers,
  korpus: Box,
  spod: Layers,
  plyta: Cpu,
  szklo: Gem,
  klawisze_alfa: Keyboard,
  klawisze_mod: Keyboard,
  klawisze_akcent: Keyboard,
  legendy_alfa: Type,
  legendy_mod: Type,
  legendy_akcent: Type,
  nadruk: Type,
  logo: Sparkles,
  pokretlo: CircleDot,
  rolka: CircleDot,
  przycisk_dpi: CircleDot,
  przyciski: Mouse,
  przyciski_boczne: Mouse,
  sensor: Cpu,
  slizgacze: Footprints,
  nozki: Footprints,
  przelaczniki: ToggleLeft,
  podswietlenie: Lightbulb,
  obszycie: Palette,
  wierzch: ImageIcon,
};

const ICON_SIZE = "var(--tk-ikona-konf, 1.25rem)";

export function PartIcon({ id }: { id: string }) {
  const Icon = PART_ICONS[id] ?? Palette;
  return <Icon aria-hidden="true" focusable="false" size={ICON_SIZE} strokeWidth={1.75} />;
}

export type Benefit = "kolory" | "biurko" | "rabat" | "termin" | "klawiatura" | "mysz" | "podkladka";
const BENEFIT_ICONS: Record<Benefit, LucideIcon> = {
  kolory: Palette,
  biurko: Monitor,
  rabat: Percent,
  termin: Hourglass,
  klawiatura: Keyboard,
  mysz: Mouse,
  podkladka: Layers,
};

export function BenefitIcon({ name }: { name: Benefit }) {
  const Icon = BENEFIT_ICONS[name];
  return <Icon aria-hidden="true" focusable="false" size={ICON_SIZE} strokeWidth={1.75} />;
}
