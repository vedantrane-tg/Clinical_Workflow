export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Simulated infrastructure failure rate, configurable via env for demos. */
export function shouldFail(rate: number): boolean {
  const configured = Number(import.meta.env["VITE_MOCK_FAILURE_RATE"] ?? rate);
  return Math.random() < (Number.isFinite(configured) ? configured : rate);
}