import { useCallback, useState } from "react";

/** Stan otwarcia sterowany z zewnatrz (open + onOpenChange) albo wewnetrzny (defaultOpen). */
export function useControllableOpen(
  controlled: boolean | undefined,
  initial: boolean,
  onChange?: (open: boolean) => void,
): [boolean, (next: boolean) => void] {
  const [inner, setInner] = useState(initial);
  const open = controlled ?? inner;
  const set = useCallback(
    (next: boolean) => {
      if (controlled === undefined) setInner(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );
  return [open, set];
}
