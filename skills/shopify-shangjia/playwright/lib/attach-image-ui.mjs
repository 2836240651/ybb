/** 在产品编辑页通过 UI 从 URL 添加主图 */
export async function attachImageViaEditor(page, store, { handle, imageUrl, title }) {
  const listUrl = `https://admin.shopify.com/store/${store}/products?query=${encodeURIComponent(handle)}`;
  await page.goto(listUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3000);

  const rowLink = page.locator(`a[href*="/products/"]`).filter({ hasText: new RegExp(handle, "i") }).first();
  const hrefLink = page.locator(`a[href*="/products/"][href*="${handle}"]`).first();
  let link = (await hrefLink.isVisible({ timeout: 2000 }).catch(() => false)) ? hrefLink : rowLink;
  if (!(await link.isVisible({ timeout: 5000 }).catch(() => false))) {
    link = page.locator('a[href*="/products/"]').first();
  }
  if (!(await link.isVisible({ timeout: 5000 }).catch(() => false))) {
    throw new Error(`列表中未找到产品 handle=${handle}`);
  }
  await link.click();
  await page.waitForTimeout(4000);

  // 已有图则跳过
  const hasThumb = await page
    .locator('[class*="Media"], [data-testid*="media"], .product-media')
    .locator('img[src*="cdn.shopify.com"]')
    .first()
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  if (hasThumb) return "skip";

  const addBtn = page
    .getByRole("button", { name: /添加媒体|Add media|添加文件|Add file|上传|Upload/i })
    .first();
  if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(1500);
  }

  const fromUrl = page
    .getByRole("menuitem", { name: /URL|链接|从 URL|From URL|嵌入/i })
    .or(page.getByRole("button", { name: /URL|从 URL|From URL/i }))
    .first();
  if (await fromUrl.isVisible({ timeout: 3000 }).catch(() => false)) {
    await fromUrl.click();
    await page.waitForTimeout(1000);
  }

  const urlInput = page
    .getByPlaceholder(/https?:\/\//i)
    .or(page.locator('input[type="url"]'))
    .or(page.locator('input[name*="url" i]'))
    .first();
  if (await urlInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await urlInput.fill(imageUrl);
    const altInput = page.getByLabel(/Alt|替代文本|替代文字/i).first();
    if (title && (await altInput.isVisible({ timeout: 1000 }).catch(() => false))) {
      await altInput.fill(title).catch(() => {});
    }
    const done = page.getByRole("button", { name: /完成|Done|添加|Add|保存|Save/i }).first();
    await done.click({ timeout: 10000 });
    await page.waitForTimeout(3000);
    return "ok";
  }

  // 备选：选择已有 Files
  const selectExisting = page
    .getByRole("menuitem", { name: /选择现有|Select existing|文件库|Content/i })
    .or(page.getByRole("button", { name: /选择现有|Select existing/i }))
    .first();
  if (await selectExisting.isVisible({ timeout: 2000 }).catch(() => false)) {
    await selectExisting.click();
    await page.waitForTimeout(2000);
    const search = page.getByPlaceholder(/搜索|Search/i).first();
    const baseName = handle.replace(/^tz-/, "TZ-").toUpperCase();
    if (await search.isVisible({ timeout: 3000 }).catch(() => false)) {
      await search.fill(baseName);
      await page.waitForTimeout(2500);
    }
    const fileRow = page.locator(`img[src*="${baseName}" i], [class*="ResourceItem"]:has-text("${baseName}")`).first();
    if (await fileRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileRow.click();
      const confirm = page.getByRole("button", { name: /完成|Done|添加|Add|选择|Select/i }).first();
      await confirm.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(2500);
      return "ok";
    }
  }

  throw new Error("未找到添加图片入口（URL / 文件库）");
}
