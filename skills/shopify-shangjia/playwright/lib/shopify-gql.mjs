/** Shopify Admin 新版 GraphQL（/api/shopify/{store}?operation=…） */

export async function bootstrapGql(page, store, { waitMs = 25000 } = {}) {
  let captured = null;
  const handler = (req) => {
    const url = req.url();
    if (req.method() !== "POST") return;
    if (!url.includes(`/api/shopify/${store}`)) return;
    const h = req.headers();
    if (!h["x-csrf-token"]) return;
    captured = { url, headers: h };
  };
  page.on("request", handler);

  const productsUrl = `https://admin.shopify.com/store/${store}/products`;
  await page.goto(productsUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  if (!captured) {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
  }

  let deadline = Date.now() + waitMs;
  while (!captured && Date.now() < deadline) {
    await page.waitForTimeout(500);
  }
  page.off("request", handler);

  if (!captured) {
    throw new Error("未能拦截 Admin API 请求（缺少 x-csrf-token），请确认已登录");
  }

  const baseUrl = `https://admin.shopify.com/api/shopify/${store}`;
  return {
    baseUrl,
    headers: pickHeaders(captured.headers),
  };
}

function pickHeaders(raw) {
  const keys = [
    "x-csrf-token",
    "shopify-build-version",
    "apollographql-client-name",
    "shopify-proxy-api-enable",
  ];
  const out = { "Content-Type": "application/json", Accept: "application/json" };
  for (const k of keys) {
    if (raw[k]) out[k] = raw[k];
  }
  if (!out["apollographql-client-name"]) out["apollographql-client-name"] = "core";
  return out;
}

function opName(query) {
  const m = query.match(/(?:query|mutation)\s+(\w+)/);
  return m?.[1] || "Anonymous";
}

function opType(query) {
  return query.trimStart().startsWith("mutation") ? "mutation" : "query";
}

export async function adminGql(page, gqlCtx, query, variables = {}) {
  const operationName = opName(query);
  const type = opType(query);
  const endpoint = `${gqlCtx.baseUrl}?operation=${operationName}&type=${type}`;
  const body = { operationName, variables, query };

  const result = await page.evaluate(
    async ({ endpoint, headers, body }) => {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, text };
    },
    { endpoint, headers: gqlCtx.headers, body }
  );

  if (result.status !== 200) {
    throw new Error(`GraphQL HTTP ${result.status}: ${result.text.slice(0, 500)}`);
  }
  let json;
  try {
    json = JSON.parse(result.text);
  } catch {
    throw new Error(`GraphQL 响应非 JSON: ${result.text.slice(0, 300)}`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}
