"use client";
// F-150, A-03: punkt montowania szuflady koszyka dla calego serwisu. Sama szuflada (wraz z wycena i listami) jest
// doladowywana (React.lazy) dopiero przy pierwszym otwarciu, zeby nie powiekszac JS stron tresciowych (budzet docs/12 §4);
// host zna tylko maly modul `lib/cart/ui.ts`, bez logiki koszyka.
import { Suspense, lazy, useEffect, useState } from "react";
import { useCartDrawerOpen } from "../../lib/cart/ui";

const CartDrawer = lazy(() => import("./cart-drawer"));

export function CartDrawerHost() {
  const open = useCartDrawerOpen();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (open) setLoaded(true);
  }, [open]);
  return loaded ? (
    <Suspense fallback={null}>
      <CartDrawer />
    </Suspense>
  ) : null;
}
