const PAYMENT_ICONS = [
  { file: "american-express", label: "American Express" },
  { file: "apple-pay", label: "Apple Pay" },
  { file: "diners-club", label: "Diners Club" },
  { file: "discover", label: "Discover" },
  { file: "google-pay", label: "Google Pay" },
  { file: "klarna", label: "Klarna" },
  { file: "maestro", label: "Maestro" },
  { file: "master", label: "Mastercard" },
  { file: "paypal", label: "PayPal" },
  { file: "shopify-pay", label: "Shop Pay" },
  { file: "unionpay", label: "UnionPay" },
  { file: "visa", label: "Visa" },
  { file: "bancontact", label: "Bancontact" },
  { file: "ideal", label: "iDEAL" },
  { file: "sepa", label: "SEPA" },
  { file: "jcb", label: "JCB" },
] as const;

function PaymentBadge({
  file,
  label,
}: {
  file: string;
  label: string;
}) {
  return (
    <li className="footer-payment-item">
      <span className="footer-payment-badge" aria-label={label}>
        <img
          src={`/images/payment-icons/${file}.svg`}
          alt=""
          width={38}
          height={24}
          className="footer-payment-icon"
          loading="lazy"
          decoding="async"
        />
      </span>
    </li>
  );
}

export function FooterPaymentIcons() {
  return (
    <ul
      className="footer-payment-list payment-icons--gray"
      role="list"
      aria-label="Accepted payment methods"
    >
      {PAYMENT_ICONS.map((icon) => (
        <PaymentBadge key={icon.file} file={icon.file} label={icon.label} />
      ))}
    </ul>
  );
}
