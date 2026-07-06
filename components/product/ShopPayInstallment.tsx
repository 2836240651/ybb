import { formatInstallmentPrice } from "@/lib/data/products";

type ShopPayInstallmentProps = {
  price: number;
};

export function ShopPayInstallment({ price }: ShopPayInstallmentProps) {
  const installment = formatInstallmentPrice(price);

  return (
    <div
      className="shop-pay-installments rounded-input border border-[#5a31f4]/20 bg-[#5a31f4]/[0.04] px-4 py-3"
      aria-label="Shop Pay installments"
    >
      <p className="text-sm text-foreground/70 leading-relaxed">
        Pay in 3 interest-free instalments of{" "}
        <span className="font-medium text-foreground">{installment}</span> with{" "}
        <span className="inline-flex items-center rounded bg-[#5a31f4] px-1.5 py-0.5 text-xs font-bold text-white align-middle">
          shop
        </span>{" "}
        <span className="font-semibold text-[#5a31f4]">Shop Pay</span>
      </p>
    </div>
  );
}
