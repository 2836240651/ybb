/** Shopify 导入等待：产品批最多 6 分钟，库存 3 分钟 */
export const PRODUCT_IMPORT_WAIT_MS = 360_000;
export const INVENTORY_IMPORT_WAIT_MS = 360_000;
export const MAX_WAIT_MS = INVENTORY_IMPORT_WAIT_MS;
export const POLL_MS = 5_000;
export const MAX_POLL_LOOPS = MAX_WAIT_MS / POLL_MS;
