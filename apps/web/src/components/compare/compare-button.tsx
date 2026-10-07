"use client";
// F-045, F-130 (wzorzec: przycisk porownaj z `product-style-0X`, docs/08 §3): "Porownaj" / "Usun z porownania" z
// `aria-pressed`. Inna kategoria niz w porownaniu: komunikat i propozycja wyczyszczenia (toast z przyciskiem, nie okno
// systemowe); zdarzenie `compare_add` po dodaniu (docs/10).
import { Button, useToast, VisuallyHidden } from "@taktyl/ui";
import { CATEGORY_PLURAL, COMPARE_MAX, compare, useIsCompared } from "../../lib/compare/store";
import { track } from "../../lib/track";

export interface CompareButtonProps {
  /** ID produktu (nie SKU): porownujemy modele. */
  id: string;
  category: string;
  name: string;
  className?: string;
}

const OTHER_CATEGORY_MS = 8000;

export function CompareButton({ id, category, name, className }: CompareButtonProps) {
  const pressed = useIsCompared(id);
  const { toast } = useToast();

  const added = (count: number) => {
    toast({ message: `Dodano do porównania (${count})` });
    track("compare_add", { item_id: id, compare_count: count });
  };

  const onClick = () => {
    if (pressed) {
      compare.remove(id);
      toast({ message: "Usunięto z porównania" });
      return;
    }
    const res = compare.add(id, category);
    if (res.status === "added") {
      added(res.count);
    } else if (res.status === "full") {
      toast({
        message: `Porównasz maksymalnie ${COMPARE_MAX} produkty. Usuń któryś, żeby dodać kolejny.`,
      });
    } else if (res.status === "other_category") {
      const current = CATEGORY_PLURAL[res.current] ?? res.current;
      toast({
        message: `W porównaniu są ${current}. Porównujemy produkty z jednej kategorii.`,
        actionLabel: "Wyczyść i dodaj",
        duration: OTHER_CATEGORY_MS,
        onAction: () => {
          compare.replaceWith(id, category);
          added(1);
        },
      });
    }
  };

  return (
    <Button
      variant="secondary"
      aria-pressed={pressed}
      className={["porownaj-przycisk", pressed && "is-wcisniete", className]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      {pressed ? "Usuń z porównania" : "Porównaj"}
      <VisuallyHidden>: {name}</VisuallyHidden>
    </Button>
  );
}
