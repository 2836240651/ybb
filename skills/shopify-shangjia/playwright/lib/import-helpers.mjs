import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import {
  launchFreshBrowser,
  AUTH_FILE,
  CDP_PORT,
  PW_ROOT,
  getStore,
} from "./browser.mjs";
import { MAX_WAIT_MS, PRODUCT_IMPORT_WAIT_MS, INVENTORY_IMPORT_WAIT_MS, POLL_MS } from "./timeouts.mjs";

function pickReusePage(context, store) {
  const pages = context.pages().filter((p) => {
    try {
      return !p.isClosed();
    } catch {
      return false;
    }
  });
  return (
    pages.find(
      (p) => p.url().includes(`admin.shopify.com/store/${store}`) && !p.url().includes("about:blank")
    ) ??
    pages.find((p) => p.url().includes("shopify.com") && !p.url().includes("about:blank")) ??
    null
  );
}

export async function createAuthedPage({ preferCdp = true, preferFresh = false } = {}) {
  if (!fs.existsSync(AUTH_FILE)) {
    throw new Error("未找到 shopify-auth.json，请先 npm run open-chrome && npm run capture");
  }
  const store = getStore();
  let browser;
  let usingCdp = false;
  if (preferCdp && !preferFresh) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
      usingCdp = true;
    } catch {
      // fall through
    }
  }
  if (!browser) browser = await launchFreshBrowser();

  let context;
  let page;
  let ownsPage = false;
  if (usingCdp) {
    context = browser.contexts()[0];
    if (!context) throw new Error("CDP 已连接但未找到浏览器上下文");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    const existing = pickReusePage(context, store);
    if (existing) {
      page = existing;
      await page.bringToFront().catch(() => {});
    } else {
      page = await context.newPage();
      ownsPage = true;
    }
  } else {
    context = await browser.newContext({
      storageState: AUTH_FILE,
      locale: "zh-CN",
      viewport: { width: 1440, height: 900 },
    });
    page = await context.newPage();
    ownsPage = true;
  }
  return { browser, context, page, ownsPage, store, usingCdp };
}

export async function closeAuthedPage({ browser, page, ownsPage, usingCdp = false }) {
  if (ownsPage && page) await page.close().catch(() => {});
  if (browser) {
    if (usingCdp) await browser.close().catch(() => {}); // disconnect CDP only
    else await browser.close().catch(() => {});
  }
}

export async function ensureLoggedIn(page) {
  if (page.url().includes("accounts.shopify.com") || page.url().includes("login")) {
    throw new Error("登录态已过期，请重新 open-chrome → capture");
  }
}

export async function uploadCsvInDialog(page, csvPath) {
  await page.locator('[role="dialog"]').last().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached", timeout: 30000 });
  await fileInput.setInputFiles(csvPath);
  await page.waitForTimeout(1500);
}

async function assertNoUploadError(page) {
  const err = page.getByText(/导入 CSV 文件时出错|Error importing CSV|Missing image source/i);
  if (await err.isVisible({ timeout: 2000 }).catch(() => false)) {
    const detail = await page.evaluate(() => document.body?.innerText?.slice(0, 800) || "");
    await page.screenshot({ path: path.join(PW_ROOT, "csv-upload-error.png"), fullPage: true }).catch(() => {});
    throw new Error(`CSV 上传校验失败: ${detail.slice(0, 300)}`);
  }
}

/** 预览页勾选「覆盖具有匹配句柄的产品 / Overwrite products with matching handles」 */
export async function ensureOverwriteMatchingHandles(page, { required = false } = {}) {
  const dialog = page.locator('[role="dialog"], .Polaris-Modal-Dialog__Modal').last();
  const inDialog = await dialog.isVisible().catch(() => false);
  const root = inDialog ? dialog : page.locator("body");

  await root.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  // 预览弹窗内滚到底，覆盖选项常在底部
  for (const y of [0, 400, 800, 1200]) {
    await root.evaluate((el, scrollY) => el.scrollTo(0, scrollY), y).catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(500);

  const overwriteRe =
    /覆盖具有匹配句柄|覆盖.*匹配.*句柄|Overwrite products with matching handles|Overwrite any current products that have the same handle/i;

  async function dialogCheckboxes() {
    return root.evaluate((el) =>
      [...el.querySelectorAll('input[type="checkbox"], [role="checkbox"], [role="switch"]')].map((cb) => ({
        checked: cb.checked ?? cb.getAttribute("aria-checked") === "true",
        label: cb.closest("label")?.innerText?.trim()?.slice(0, 120) || cb.getAttribute("aria-label") || "",
        tag: cb.tagName,
      }))
    );
  }

  let checked = false;

  for (const re of [overwriteRe]) {
    const byRole = root.getByRole("checkbox", { name: re });
    if (await byRole.count()) {
      await byRole.first().check({ force: true, timeout: 8000 }).catch(() => byRole.first().click({ force: true }));
      checked = await byRole.first().isChecked().catch(() => false);
      if (checked) break;
    }
    const sw = root.getByRole("switch", { name: re });
    if (await sw.count()) {
      await sw.first().click({ force: true });
      checked = true;
      break;
    }
  }

  if (!checked) {
    checked = await root.evaluate(() => {
      const re =
        /覆盖具有匹配句柄|覆盖.*匹配.*句柄|Overwrite products with matching handles|Overwrite any current products that have the same handle/i;
      const scope = document.querySelector('[role="dialog"]') || document.body;
      for (const cb of scope.querySelectorAll('input[type="checkbox"]')) {
        const label = cb.closest("label")?.innerText || cb.getAttribute("aria-label") || "";
        if (re.test(label)) {
          if (!cb.checked) cb.click();
          return cb.checked;
        }
      }
      for (const el of scope.querySelectorAll("label, span, p, button")) {
        if (!re.test(el.textContent || "")) continue;
        el.click();
        const root = el.closest("label") || el.parentElement;
        const cb = root?.querySelector('input[type="checkbox"]');
        if (cb) {
          if (!cb.checked) cb.click();
          return cb.checked;
        }
      }
      return false;
    });
  }

  const willOverwrite = await page.getByText(/将覆盖|will overwrite/i).first().isVisible().catch(() => false);
  if (willOverwrite) checked = true;

  if (!checked) {
    const boxes = await dialogCheckboxes();
    const hasOverwriteControl = boxes.some((b) => overwriteRe.test(b.label));
    if (!hasOverwriteControl && required) {
      // 部分 Shopify 版本：选项文案在附近 div，checkbox 无 label
      const pageHasOverwriteHint = await page.getByText(overwriteRe).first().isVisible().catch(() => false);
      if (pageHasOverwriteHint) {
        const unchecked = root.locator('input[type="checkbox"]:not(:checked), [role="checkbox"][aria-checked="false"]');
        const n = await unchecked.count();
        for (let i = 0; i < n; i++) {
          await unchecked.nth(i).click({ force: true }).catch(() => {});
        }
        checked = await page.getByText(/将覆盖|will overwrite/i).first().isVisible().catch(() => false);
      }
    }
    if (!hasOverwriteControl) {
      if (required) {
        await page.screenshot({ path: path.join(PW_ROOT, "overwrite-checkbox-missing.png"), fullPage: true }).catch(() => {});
        throw new Error(
          "未找到「覆盖具有匹配句柄的产品」选项。更新已有产品图片必须勾选此项，请查看 playwright/overwrite-checkbox-missing.png"
        );
      }
      console.warn("⚠ 预览页无「覆盖句柄」复选框（多为新 handle），继续导入");
      return true;
    }
    console.warn("dialog checkbox:", JSON.stringify(boxes));
  }

  if (!checked) {
    await page.screenshot({ path: path.join(PW_ROOT, "overwrite-checkbox-missing.png"), fullPage: true }).catch(() => {});
    throw new Error(
      "未能勾选「覆盖具有匹配句柄的产品」。请检查预览页或截图 playwright/overwrite-checkbox-missing.png"
    );
  }

  console.log("✓ 已勾选：覆盖具有匹配句柄的产品");
  return true;
}

async function clickFinalImportButton(page, label = "products") {
  await page.waitForTimeout(2000);

  const candidates = [
    page.getByRole("button", { name: /导入产品|Import products/i }),
    page.getByRole("button", { name: /确认导入|Confirm import/i }),
    page.locator('[role="dialog"]').last().getByRole("button", { name: /导入|Import/i }),
    page.getByRole("button", { name: /^导入$|^Import$/i }),
  ];

  for (const loc of candidates) {
    const btn = loc.last();
    if (await btn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await btn.click({ timeout: 20000 });
      console.log(`✓ 已点击导入按钮 (${label})`);
      return;
    }
  }

  await page.screenshot({ path: path.join(PW_ROOT, `import-button-missing-${label}.png`), fullPage: true });
  const snippet = (await page.evaluate(() => document.body?.innerText || "")).slice(0, 600);
  throw new Error(`未找到最终导入按钮 (${label})。页面片段: ${snippet}`);
}

async function waitForImportResult(page, { label = "import", maxWaitMs = MAX_WAIT_MS } = {}) {
  const loops = Math.floor(maxWaitMs / POLL_MS);
  let lastText = "";

  for (let i = 0; i < loops; i++) {
    await page.waitForTimeout(POLL_MS);
    lastText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");

    const loginExpired =
      page.url().includes("accounts.shopify.com") || /log in|登录/i.test(lastText.slice(0, 500));
    if (loginExpired) {
      return { done: false, status: "auth_expired", message: "登录态已过期" };
    }

    const hasError =
      /invalid product categor|无效的产品类别|导入失败|import failed|something went wrong|出现错误/i.test(lastText);
    if (hasError) {
      return { done: false, status: "error", message: lastText.slice(0, 800) };
    }

    const dialogOpen = await page
      .locator('[role="dialog"], .Polaris-Modal-Dialog__Modal')
      .last()
      .isVisible()
      .catch(() => false);

    const onProductsAdmin =
      page.url().includes("/products") &&
      !page.url().includes("accounts.shopify") &&
      !dialogOpen;

    const onInventoryAdmin = page.url().includes("/inventory") && !dialogOpen;

    const success =
      /import complete|导入完成|products imported|个产品已导入|successfully imported|已完成导入|导入成功|导入完毕/i.test(lastText) ||
      /products were imported|产品已导入|inventory updated|库存已更新|updated successfully|库存导入/i.test(lastText) ||
      (i >= 1 &&
        (onProductsAdmin || onInventoryAdmin) &&
        !dialogOpen &&
        !/preview|预览|上传并预览|开始导入|Start import/i.test(lastText.slice(0, 800)));

    if (success) {
      return { done: true, status: "ok", message: lastText.slice(0, 400) };
    }

    if (i > 0 && i % 6 === 0) {
      console.log(`  [${label}] 等待中… ${((i + 1) * POLL_MS) / 1000}s / ${maxWaitMs / 1000}s`);
    }
  }

  return { done: false, status: "timeout", message: lastText.slice(0, 800) };
}

async function waitForInventoryImportDone(page, { batchTag = "", maxWaitMs = INVENTORY_IMPORT_WAIT_MS } = {}) {
  const loops = Math.floor(maxWaitMs / POLL_MS);
  for (let i = 0; i < loops; i++) {
    await page.waitForTimeout(POLL_MS);
    const importModal = await page
      .getByText(/通过 CSV 导入库存|Import inventory via CSV|您将导入.*多属性/i)
      .first()
      .isVisible()
      .catch(() => false);
    const startBtn = await page
      .getByRole("button", { name: /开始导入|Start import/i })
      .isVisible()
      .catch(() => false);
    if (page.url().includes("/inventory") && !importModal && !startBtn) {
      return { done: true, status: "ok" };
    }
    if (i > 0 && i % 6 === 0) {
      console.log(`  [inventory${batchTag}] 等待中… ${((i + 1) * POLL_MS) / 1000}s / ${maxWaitMs / 1000}s`);
    }
  }
  return { done: false, status: "timeout" };
}

export async function importProducts(page, csvPath, store, { maxWaitMs = PRODUCT_IMPORT_WAIT_MS, batchTag = "", requireOverwrite = false } = {}) {
  const url = `https://admin.shopify.com/store/${store}/products`;
  console.log("打开:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(4000);
  await ensureLoggedIn(page);

  const importBtn = page.getByRole("button", { name: /^导入$|^Import$/ }).first();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await importBtn.isVisible({ timeout: 15000 }).catch(() => false)) {
      await importBtn.click({ timeout: 45000 });
      break;
    }
    if (attempt === 2) {
      await page.screenshot({ path: path.join(PW_ROOT, `import-btn-missing-products${batchTag}.png`), fullPage: true }).catch(() => {});
      throw new Error("产品页未找到「导入」按钮");
    }
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(4000);
  }
  await page.waitForTimeout(2000);
  await uploadCsvInDialog(page, csvPath);
  await assertNoUploadError(page);

  // 覆盖选项常出现在上传后、预览前的同一弹窗
  await ensureOverwriteMatchingHandles(page, { required: requireOverwrite }).catch(() => {});

  await page.getByRole("button", { name: /上传并预览|Upload and preview/i }).click({ timeout: 30000 });
  await page.waitForTimeout(8000);
  await assertNoUploadError(page);

  await ensureOverwriteMatchingHandles(page, { required: requireOverwrite });

  const invalid = await page.getByText(/无效的产品类别|invalid product categor/i).isVisible().catch(() => false);
  if (invalid) throw new Error("CSV 含无效 Product Category");

  await clickFinalImportButton(page, `products${batchTag}`);

  const result = await waitForImportResult(page, { label: `products${batchTag}`, maxWaitMs });
  const shot = path.join(PW_ROOT, `products-import${batchTag || "-result"}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});

  if (!result.done) {
    throw new Error(`产品导入未完成 (${result.status}): ${result.message?.slice(0, 200)}`);
  }
  console.log("产品导入完成", batchTag || "");
  return result;
}

export async function importInventory(page, csvPath, store, locationId, { maxWaitMs = INVENTORY_IMPORT_WAIT_MS, batchTag = "" } = {}) {
  const url = `https://admin.shopify.com/store/${store}/products/inventory?location_id=${locationId}`;
  console.log("打开:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(6000);
  await ensureLoggedIn(page);

  await page.getByRole("button", { name: /^导入$|^Import$/i }).first().click({ timeout: 45000 });
  await page.waitForTimeout(2000);
  await uploadCsvInDialog(page, csvPath);
  await assertNoUploadError(page);

  const uploadFileBtn = page
    .getByRole("button", { name: /上传文件|Upload file/i })
    .last();
  const previewBtn = page
    .getByRole("button", { name: /上传并预览|Upload and preview/i })
    .last();

  if (await uploadFileBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await uploadFileBtn.click({ timeout: 30000, force: true });
    await page.waitForTimeout(4000);
    const startBtn = page
      .getByRole("button", { name: /开始导入|Start import|Import inventory|导入/i })
      .filter({ hasNotText: /取消|Cancel/ })
      .last();
    if (await startBtn.isVisible({ timeout: 15000 }).catch(() => false)) {
      await startBtn.click({ timeout: 30000, force: true });
      console.log("✓ 已点击开始导入（库存）");
    }
    const result = await waitForInventoryImportDone(page, { batchTag, maxWaitMs });
    const shot = path.join(PW_ROOT, `inventory-import${batchTag || "-result"}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    if (!result.done) throw new Error(`库存导入未完成 (${result.status})`);
    console.log("库存导入完成", batchTag || "");
    return result;
  } else if (await previewBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await previewBtn.click({ timeout: 30000, force: true });
    await page.waitForTimeout(5000);
    await assertNoUploadError(page);
    await ensureOverwriteMatchingHandles(page).catch(() => {
      console.log("库存导入：无覆盖句柄选项（可忽略）");
    });
    const importBtn = page
      .getByRole("button", { name: /导入库存|Import inventory|确认导入|开始导入|Import/i })
      .filter({ hasNotText: /取消|Cancel/ })
      .last();
    if (await importBtn.isVisible({ timeout: 15000 }).catch(() => false)) {
      await importBtn.click({ timeout: 30000, force: true }).catch(() => {});
    } else {
      await clickFinalImportButton(page, `inventory${batchTag}`).catch(() => {});
    }
  } else {
    throw new Error("库存导入：未找到「上传文件」或「上传并预览」按钮");
  }

  const result = await waitForImportResult(page, { label: `inventory${batchTag}`, maxWaitMs });
  const shot = path.join(PW_ROOT, `inventory-import${batchTag || "-result"}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});

  if (!result.done) {
    throw new Error(`库存导入未完成 (${result.status}): ${result.message?.slice(0, 200)}`);
  }
  console.log("库存导入完成", batchTag || "");
  return result;
}

export async function assignCollection(page, store, collectionId, searchTerm) {
  const url = `https://admin.shopify.com/store/${store}/collections/${collectionId}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(5000);
  await ensureLoggedIn(page);

  const browseCandidates = [
    page.getByRole("button", { name: /浏览|Browse/i }),
    page.getByText(/浏览产品|Browse products/i),
    page.getByText("浏览", { exact: true }),
  ];
  let opened = false;
  for (const loc of browseCandidates) {
    if (await loc.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await loc.first().click({ timeout: 15000 });
      opened = true;
      break;
    }
  }
  if (!opened) {
    await page.screenshot({ path: path.join(PW_ROOT, `collection-browse-fail-${collectionId}.png`), fullPage: true });
    throw new Error("未找到「浏览/Browse」按钮");
  }
  await page.waitForTimeout(3000);

  const modal = page.locator('[role="dialog"]').last();
  await modal.getByPlaceholder(/搜索|Search/i).first().fill(searchTerm);
  await page.waitForTimeout(4000);

  let selected = 0;
  for (let i = 0; i < 10; i++) {
    selected += await modal.evaluate((root) => {
      let n = 0;
      for (const el of root.querySelectorAll('input[type="checkbox"], [role="checkbox"]')) {
        const checked = el.checked || el.getAttribute("aria-checked") === "true";
        if (!checked) {
          el.click();
          n++;
        }
      }
      return n;
    });
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(700);
  }

  console.log(`  已选 ${selected} 项 (${searchTerm})`);
  if (selected === 0) {
    await page.keyboard.press("Escape").catch(() => {});
    console.warn(`  无匹配产品，跳过: ${searchTerm}`);
    return { added: 0 };
  }

  const addCandidates = [
    modal.getByRole("button", { name: /^添加$|^Add$/i }),
    modal.getByRole("button", { name: /添加产品|Add products|Add to collection|添加到系列/i }),
    modal.locator("button.Polaris-Button--variantPrimary").last(),
    page.locator('[role="dialog"]').last().locator("button").filter({ hasText: /^(添加|Add)$/i }).last(),
  ];
  let clicked = false;
  for (const loc of addCandidates) {
    if (await loc.isVisible({ timeout: 4000 }).catch(() => false)) {
      await loc.click({ timeout: 20000, force: true });
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    await page.screenshot({ path: path.join(PW_ROOT, `collection-add-fail-${collectionId}.png`), fullPage: true });
    throw new Error(`未找到添加按钮 (${searchTerm})`);
  }

  await page.waitForTimeout(2500);
  const saveCandidates = [
    page.getByRole("button", { name: /^保存$|^Save$/i }).last(),
    page.getByLabel(/^保存$|^Save$/i),
  ];
  for (const loc of saveCandidates) {
    if (await loc.isVisible({ timeout: 8000 }).catch(() => false)) {
      await loc.click({ timeout: 15000 });
      break;
    }
  }
  await page.waitForTimeout(4000);
  console.log("系列已更新:", searchTerm);
  return { added: selected };
}

export async function setAutomatedCollectionRules(page, store, collectionId, productTypes) {
  const url = `https://admin.shopify.com/store/${store}/collections/${collectionId}`;
  console.log("设置自动系列条件:", url, productTypes.join(" | "));
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(5000);
  await ensureLoggedIn(page);

  const editBtn = page.getByRole("link", { name: /Edit collection|编辑系列|Edit/i }).first();
  if (await editBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await editBtn.click({ timeout: 15000 });
    await page.waitForTimeout(3000);
  }

  const autoRadio = page.getByRole("radio", { name: /Automated collection|自动系列|Automated|自动/i }).first();
  if (await autoRadio.isVisible({ timeout: 8000 }).catch(() => false)) {
    await autoRadio.check({ force: true });
    await page.waitForTimeout(2000);
  }

  for (let idx = 0; idx < productTypes.length; idx++) {
    const pt = productTypes[idx];
    if (idx > 0) {
      const addCond = page.getByRole("button", { name: /Add another condition|添加其他条件|Add condition/i }).first();
      if (await addCond.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addCond.click();
        await page.waitForTimeout(1500);
      }
    }

    const condRows = page.locator('[class*="Condition"], [data-condition], .Polaris-LegacyStack').filter({ hasText: /Product type|产品类型|Type/i });
    const row = condRows.last();

    const fieldSelect = row.locator("select, [role='combobox']").first();
    if (await fieldSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fieldSelect.selectOption({ label: /Product type|产品类型/i }).catch(async () => {
        await fieldSelect.click();
        await page.getByRole("option", { name: /Product type|产品类型/i }).click({ timeout: 5000 }).catch(() => {});
      });
    }

    const valueInput = row.locator('input[type="text"], input:not([type="hidden"])').last();
    if (await valueInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await valueInput.fill(pt);
      await page.waitForTimeout(1000);
      await page.keyboard.press("Enter").catch(() => {});
    } else {
      await page.getByPlaceholder(/Value|值/i).last().fill(pt).catch(() => {});
    }
    await page.waitForTimeout(1500);
  }

  const saveBtn = page.getByRole("button", { name: /^Save$|^保存$/i }).last();
  if (await saveBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
    await saveBtn.click({ timeout: 20000 });
  }
  await page.waitForTimeout(4000);
  console.log("✓ 自动系列条件已保存:", productTypes.join(", "));
}
