type ShopPayInstallmentProps = {
  text: string;
};

export function ShopPayInstallment({ text }: ShopPayInstallmentProps) {
  return (
    <div
      className="shop-pay-installments rounded-input border border-[#5a31f4]/20 bg-[#5a31f4]/[0.04] px-4 py-3"
      aria-label="Shop Pay installments"
    >
      <p className="text-sm text-foreground/70 leading-relaxed">{text}</p>
    </div>
  );
}
