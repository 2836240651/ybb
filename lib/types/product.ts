export type ProductVariant = {
  sku: string;
  spec: string;
  specEn?: string;
  specZh?: string;
  specJa?: string;
  price: number;
  compareAtPrice?: number;
  available: boolean;
  wcId?: number;
  images?: string[];
  wcAttributes?: Array<{
    attribute: string;
    value: string;
  }>;
};

export type Product = {
  handle: string;
  title: string; // legacy alias of titleEn
  titleEn: string;
  titleZh: string;
  titleJa: string;
  titleCn?: string; // backward compatibility for older data
  price: number;
  compareAtPrice?: number;
  images: string[];
  sourceImage?: string;
  video?: string;
  collection: string;
  available: boolean;
  tags: string[];
  imageCount?: number;
  sku?: string;
  wcId?: number;
  permalink?: string;
  /** Synced from Woo `review_count` (Store API). */
  reviewCount?: number;
  /** Synced from Woo `average_rating`. */
  averageRating?: number;
  spec?: string;
  productType?: "simple" | "variable";
  variants?: ProductVariant[];
  defaultVariantSku?: string;
};

export type Collection = {
  handle: string;
  title: string;
  titleCn: string;
  description: string;
  productCount: number;
  productHandles: string[];
};
