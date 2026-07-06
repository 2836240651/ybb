/** Run work after the browser is idle so clicks/navigation stay responsive. */
export function scheduleIdleWork(
  callback: () => void,
  options?: { timeoutMs?: number; delayMs?: number }
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const timeoutMs = options?.timeoutMs ?? 2500;
  const delayMs = options?.delayMs ?? 0;
  let cancelled = false;

  const run = () => {
    if (!cancelled) callback();
  };

  const schedule = (): (() => void) => {
    if (cancelled) return () => {};

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: timeoutMs });
      return () => window.cancelIdleCallback(id);
    }

    const timer = window.setTimeout(run, Math.max(delayMs, 120));
    return () => window.clearTimeout(timer);
  };

  let cancelScheduled: (() => void) | undefined;

  if (delayMs > 0) {
    const delayTimer = window.setTimeout(() => {
      if (!cancelled) cancelScheduled = schedule();
    }, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(delayTimer);
      cancelScheduled?.();
    };
  }

  cancelScheduled = schedule();
  return () => {
    cancelled = true;
    cancelScheduled?.();
  };
}
