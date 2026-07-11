export function clampInstallmentCount(count: number): number {
  return Math.max(2, Math.min(12, count || 3));
}

export function interpolateInstallmentTemplate(
  template: string,
  vars: { amount: string; count: number; total: string }
): string {
  return template
    .replaceAll("{amount}", vars.amount)
    .replaceAll("{count}", String(vars.count))
    .replaceAll("{total}", vars.total);
}
