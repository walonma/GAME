import { useEffect, useState } from "react";

export function Countdown({ deadline }: { deadline?: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;
  const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  return <span className="countdown">{remaining}s</span>;
}
