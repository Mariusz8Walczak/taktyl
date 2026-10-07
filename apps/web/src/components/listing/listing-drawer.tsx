"use client";
// F-021, F-029 (wzorzec: `shop-filter-sidebar`, docs/08 §3): szuflada filtrow na telefonie. TAKTYL-77: osobny modul
// ladowany leniwie z listing-shell.tsx (najechanie, fokus lub dotkniecie "Filtry"), zeby Drawer (moduł nakladek
// @taktyl/ui) nie wchodzil do bazy JS listingu (docs/12 §4).
import { Drawer } from "@taktyl/ui";
import type { ReactNode } from "react";

export interface ListingDrawerProps {
  open: boolean;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}

export default function ListingDrawer({ open, onClose, footer, children }: ListingDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Filtry"
      side="left"
      className="listing__szuflada"
      footer={footer}
    >
      {children}
    </Drawer>
  );
}
