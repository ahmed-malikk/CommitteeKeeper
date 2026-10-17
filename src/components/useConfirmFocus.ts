import { useEffect, useRef } from "react";

/**
 * For a button that turns into a "Are you sure?" box: the button unmounts, so keyboard focus would fall back to the
 * top of the page. This moves focus into the box when it opens, and back to the button when it closes.
 */
export function useConfirmFocus(asking: boolean) {
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);

  useEffect(() => {
    if (asking) box.current?.focus();
    else if (wasAsking.current) trigger.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  return { box, trigger };
}
