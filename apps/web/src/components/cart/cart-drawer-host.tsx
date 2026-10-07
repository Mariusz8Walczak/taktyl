"use client";
// F-150, A-03: punkt montowania szuflady koszyka dla calego serwisu. Sama szuflada (wraz z wycena i listami) jest
// doladowywana dopiero przy pierwszym otwarciu, zeby nie powiekszac JS stron tresciowych (budzet docs/12 §4).
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useCartDrawerOpen } from "../../lib/cart/ui";

const CartDrawer = dynamic(() => import("./cart-drawer"), { ssr: false });

export function CartDrawerHost() {
  const open = useCartDrawerOpen();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (open) setLoaded(true);
  }, [open]);
  return loaded ? <CartDrawer /> : null;
}
