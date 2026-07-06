# YBB Site Manager — REST API

Base URL（推荐，避免 SG Captcha）：

```
https://carp-ybb.com/index.php?rest_route=/ybb/v1/site-manager/{endpoint}&_={timestamp}
```

Also registered at `/wp-json/ybb/v1/site-manager/{endpoint}`.

## Phase 1

### GET `/ybb/v1/site-manager/navigation`

```json
{
  "primaryNav": [
    {
      "id": "nav-sinkers",
      "label": "Sinkers",
      "labels": { "en": "Sinkers", "zh": "铅坠", "ja": "シンカー" },
      "href": "/collections/sinkers",
      "enabled": true,
      "megaMenu": {
        "variant": "oem",
        "children": [{ "label": "Private Label", "labels": {}, "href": "/pages/private-label" }],
        "shopAll": { "label": "View overview", "labels": {}, "href": "/pages/oem-odm" }
      }
    }
  ],
  "footer": {
    "quickLinks": [],
    "information": [],
    "policies": [],
    "social": [{ "label": "Facebook", "href": "https://..." }]
  },
  "syncedAt": "2026-06-28T12:00:00Z"
}
```

### GET `/ybb/v1/site-manager/announcements`

```json
{
  "enabled": true,
  "items": [
    {
      "id": "2026-new",
      "labels": { "en": "...", "zh": "...", "ja": "..." },
      "href": "/collections/2026-new-products",
      "enabled": true
    }
  ],
  "syncedAt": "..."
}
```

### GET `/ybb/v1/site-manager/hero`

```json
{
  "enabled": true,
  "autoplayMs": 7000,
  "slides": [
    {
      "id": "factory-catalog",
      "href": "/pages/wholesale",
      "imageUrl": "/images/hero/hero-01.webp",
      "labels": { "en": "Trusted by global fishing brands", "zh": "...", "ja": "..." },
      "enabled": true
    }
  ],
  "syncedAt": "..."
}
```

## Phase 2

### GET `/ybb/v1/site-manager/factory-video`

```json
{
  "enabled": true,
  "videoUrl": "/videos/factory-showcase.mp4",
  "posterUrl": "",
  "labels": {
    "title": { "en": "...", "zh": "...", "ja": "..." },
    "body": { "en": "...", "zh": "...", "ja": "..." },
    "cta": { "en": "...", "zh": "...", "ja": "..." }
  },
  "syncedAt": "..."
}
```

### GET `/ybb/v1/site-manager/featured-product`

```json
{
  "enabled": true,
  "handle": "three-way-swivel-kit-box",
  "syncedAt": "..."
}
```

### Legacy aliases (unchanged)

- `GET /ybb/v1/hot-products`
- `GET /ybb/v1/latest-stories`
- `GET /ybb/v1/home-settings`
- `GET /ybb/v1/site-brand`

## Phase 3

### GET `/ybb/v1/deploy/status`

```json
{
  "state": "idle|pending|running|success|failed",
  "pending": false,
  "lastBuildId": "zbqS8epRctf405jMgb6dB",
  "lastError": "",
  "startedAt": null,
  "finishedAt": null,
  "trigger": "manual|product_publish"
}
```

### POST `/ybb/v1/deploy/trigger`

Headers: `X-YBB-Deploy-Key: {secret}` (matches `ybb_site_manager_settings.deploy.secret`)

Body (optional): `{ "reason": "manual" }`

Response: `{ "queued": true, "state": "pending" }`

## Phase 2.5 — Product Ops Layer（POL）

> 设计细则：`PRODUCT-OPS-DESIGN.md` · 实施包：`PRODUCT-OPS-IMPLEMENTATION-PACK.md`

### GET `/ybb/v1/site-manager/product-overrides`

```json
{
  "enabled": true,
  "overrides": {
    "tz-xp-038": {
      "titleZh": "红虫小偏转件反吹编织线",
      "titleJa": "カープ新製品 - Small Blowback Line",
      "frontHidden": false
    }
  },
  "syncedAt": "..."
}
```

### GET `/ybb/v1/site-manager/product-overrides/{handle}`

合并 Woo live 字段 + 覆盖层（价/库存/变体来自 Woo，**不可** override 写价）。

### GET `/ybb/v1/site-manager/product-catalog`

管理员索引（`manage_options`）：分页、搜索 SKU/handle、Woo 状态、wcId、上次静态 sync 时间。

### POST `/ybb/v1/site-manager/product-overrides/{handle}`

允许：`titleZh`, `titleJa`, `frontHidden`, `descriptionZh`, `descriptionJa`, `hideDescription`, `hideAdditionalInfo`。

禁止：`sku`, `wcId`, `price`, `variants`, `descriptionEn`。

### GET `product-overrides/{handle}` — `content`（POL-5 / PCT，mu-plugin ≥ 1.6.0）

> 设计：`PDP-CONTENT-TABS-DESIGN.md`

```json
{
  "content": {
    "description": {
      "visible": true,
      "html": { "en": "<p>…</p>", "zh": "", "ja": "" }
    },
    "additionalInfo": {
      "visible": true,
      "rows": [
        { "key": "weight", "label": "Weight", "value": "0.12 kg", "href": null },
        { "key": "pa_brand", "label": "Brand", "value": "YBB Tackle", "href": null, "taxonomy": "pa_brand", "termSlug": "ybb-tackle" }
      ]
    }
  }
}
```

- `description.html.en` ← Woo `get_description()`
- `description.html.zh/ja` ← override 或 fallback `en`
- `additionalInfo.rows` ← Woo weight + visible attributes
