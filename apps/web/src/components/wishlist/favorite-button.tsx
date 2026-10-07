"use client";
// F-045, F-132, A-10 (wzorzec: przycisk ulubione z `product-style-0X` i `product-detail`, docs/08 §3): serce jako przycisk
// z etykieta tekstowa "Dodaj do ulubionych" / "Usun z ulubionych", `aria-pressed`, toast "Dodano do ulubionych".
// A-10: klasa `is-dodano` uruchamia scale 1 -> 1.3 -> 1 na ikonie (tylko transform; przy reduced-motion stan koncowy).
// Stan z jednego magazynu (`useSyncExternalStore` + zdarzenie storage): spojny na listingu, karcie i w /ulubione.
import { Button, Icon, useToast, VisuallyHidden } from "@taktyl/ui";
import { useState } from "react";
import { track } from "../../lib/track";
import { buildItem, grToZl } from "../../lib/track-items";
import { useIsFavorite, wishlist } from "../../lib/wishlist/store";

export interface FavoriteButtonProps {
  /** SKU wariantu pokazanego na karcie / wybranego na stronie produktu. */
  sku: string;
  /** Wszystkie SKU modelu: serce jest wcisniete, gdy na liscie jest ktorykolwiek (spojnosc karta <-> strona). */
  productSkus?: readonly string[];
  name: string;
  category: string;
  priceGr: number;
  variantLabel?: string;
  className?: string;
}

export function FavoriteButton({
  sku,
  productSkus,
  name,
  category,
  priceGr,
  variantLabel,
  className,
}: FavoriteButtonProps) {
  const skus = productSkus && productSkus.length > 0 ? productSkus : [sku];
  const pressed = useIsFavorite(skus);
  const [animate, setAnimate] = useState(false);
  const { toast } = useToast();

  const onClick = () => {
    if (pressed) {
      const before = skus.filter((s) => wishlist.skus().includes(s));
      wishlist.remove(before);
      setAnimate(false);
      toast({
        message: "Usunięto z ulubionych",
        actionLabel: "Cofnij",
        onAction: () => {
          for (const s of before) wishlist.add(s);
        },
      });
      return;
    }
    if (!wishlist.add(sku)) {
      toast({ message: "Lista ulubionych jest pełna. Usuń któryś produkt, żeby dodać kolejny." });
      return;
    }
    setAnimate(true);
    toast({ message: "Dodano do ulubionych" });
    track("add_to_wishlist", {
      items: [
        buildItem({
          sku,
          name,
          category,
          priceGr,
          ...(variantLabel ? { variant: variantLabel } : {}),
        }),
      ],
      currency: "PLN",
      value: grToZl(priceGr),
    });
  };

  return (
    <Button
      variant="secondary"
      aria-pressed={pressed}
      className={["ulubione-przycisk", pressed && "is-wcisniete", className]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      <Icon
        name="heart"
        className={
          animate && pressed ? "ulubione-przycisk__serce is-dodano" : "ulubione-przycisk__serce"
        }
      />
      {pressed ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
      <VisuallyHidden>: {name}</VisuallyHidden>
    </Button>
  );
}
