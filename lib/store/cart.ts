import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getProductByHandle, getVariant } from "@/lib/data/products";
import { buildCartLine, sanitizeCartQuantity } from "@/lib/store/cart-line";
import type { Product } from "@/lib/types/product";

export type CartLine = {
  handle: string;
  title: string;
  titleCn: string;
  price: number;
  image: string;
  variant: string;
  sku: string;
  wcId?: number;
  wcParentId?: number;
  wcVariationId?: number;
  wcAttributes?: Array<{
    attribute: string;
    value: string;
  }>;
  quantity: number;
};

type CartState = {
  lines: CartLine[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  addItem: (product: Product, variant?: string, quantity?: number) => void;
  removeItem: (handle: string, variant: string) => void;
  updateQuantity: (handle: string, variant: string, quantity: number) => void;
  clear: () => void;
  itemCount: () => number;
  subtotal: () => number;
};

type PersistedCartState = {
  lines?: Array<Partial<CartLine> & { handle?: string }>;
  isOpen?: boolean;
};

function normalizePersistedLines(
  lines: PersistedCartState["lines"]
): CartLine[] {
  if (!Array.isArray(lines)) return [];
  const normalized: CartLine[] = [];

  for (const rawLine of lines) {
    const handle = typeof rawLine?.handle === "string" ? rawLine.handle : "";
    if (!handle) continue;

    const product = getProductByHandle(handle);
    if (!product) continue;

    const variantKey =
      typeof rawLine.variant === "string" && rawLine.variant.length
        ? rawLine.variant
        : typeof rawLine.sku === "string" && rawLine.sku.length
          ? rawLine.sku
          : "Default";
    const selected = getVariant(product, variantKey);
    const rawWcId =
      typeof rawLine.wcId === "number" && rawLine.wcId > 0 ? rawLine.wcId : undefined;
    const rebuilt = buildCartLine(
      product,
      selected?.spec ?? variantKey,
      rawLine.quantity,
      rawWcId
    );

    normalized.push({
      ...rebuilt,
      title:
        typeof rawLine.title === "string" && rawLine.title.length
          ? rawLine.title
          : product.title,
      titleCn:
        typeof rawLine.titleCn === "string"
          ? rawLine.titleCn
          : product.titleCn ?? "",
      price:
        typeof rawLine.price === "number" && Number.isFinite(rawLine.price)
          ? rawLine.price
          : selected?.price ?? product.price,
      image:
        typeof rawLine.image === "string" && rawLine.image.length
          ? rawLine.image
          : selected?.images?.[0] ??
            product.images[0] ??
            "/images/placeholder-product.jpg",
      variant: selected?.spec ?? variantKey,
      sku:
        (typeof rawLine.sku === "string" && rawLine.sku.length
          ? rawLine.sku
          : selected?.sku ?? product.sku) || "",
      wcId:
        rebuilt.wcId ??
        selected?.wcId ??
        product.wcId ??
        rawWcId,
      wcParentId: rebuilt.wcParentId,
      wcVariationId: rebuilt.wcVariationId,
      wcAttributes: rebuilt.wcAttributes,
      quantity: sanitizeCartQuantity(rawLine.quantity),
    });
  }

  return normalized;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      addItem: (product, variant = "Default", quantity = 1) => {
        const line = buildCartLine(product, variant, quantity);

        set((state) => {
          const existing = state.lines.find(
            (l) => l.handle === product.handle && l.variant === line.variant
          );
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.handle === product.handle && l.variant === line.variant
                  ? { ...l, quantity: l.quantity + line.quantity }
                  : l
              ),
              isOpen: true,
            };
          }
          return {
            lines: [
              ...state.lines,
              line,
            ],
            isOpen: true,
          };
        });
      },
      removeItem: (handle, variant) =>
        set((state) => ({
          lines: state.lines.filter(
            (l) => !(l.handle === handle && l.variant === variant)
          ),
        })),
      updateQuantity: (handle, variant, quantity) => {
        if (quantity < 1) {
          get().removeItem(handle, variant);
          return;
        }
        set((state) => ({
          lines: state.lines.map((l) =>
            l.handle === handle && l.variant === variant
              ? { ...l, quantity }
              : l
          ),
        }));
      },
      clear: () => set({ lines: [] }),
      itemCount: () => get().lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: () =>
        get().lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    }),
    {
      name: "ybb-cart",
      version: 4,
      migrate: (persistedState) => {
        const state = persistedState as PersistedCartState | undefined;
        if (!state) return persistedState as CartState;
        return {
          ...state,
          lines: normalizePersistedLines(state.lines),
          isOpen: false,
        } as CartState;
      },
      partialize: (state) => ({
        lines: normalizePersistedLines(state.lines),
        isOpen: false,
      }),
    }
  )
);
