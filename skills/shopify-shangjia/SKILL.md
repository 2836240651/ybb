---
name: shopify-shangjia
description: >-
  独立站上货表单（父体/子体 Excel）→ Shopify CSV → 分批导入 → GraphQL 挂图。
  触发：Shopify上架、独立站上货表单、父体子体、上货表单、产品系列、类型、类别、Shopify CSV 导入、挂图。
---

# Shopify上架

**Skill 根**: `<SKILL_ROOT>` = 本包目录（克隆后一般为 `ybb/skills/shopify-shangjia/`）  
**GitHub**: https://github.com/2836240651/ybb/tree/skill/skills/shopify-shangjia  
**表单类型**: `独立站上货表单(*).xlsx`（Sheet1 主表 + Sheet2 类别对照，父体/子体列结构）  
**解析脚本**: `scripts/extract-listing-form.mjs`（2026-07 起支持表单 10 双「产品系列」列）

首次使用：`powershell -ExecutionPolicy Bypass -File scripts/setup-local.ps1`

执行前确认 `playwright/shopify-auth.json` 有效；过期则：

```powershell
cd <SKILL_ROOT>/playwright
npm run open-chrome
node wait-capture-session.mjs
```

---

## 表单版本对照

| 版本 | 列数 | 分类列布局 | 说明 |
|------|------|------------|------|
| **表单 10+** | 41 | D/E=`产品系列`×2，F=`类别` | 当前标准；D=Type，E=Collection |
| 表单 9 | 40 | D=`系列`，E=`类别` | 仍兼容；Collection 由 `store.json` 自动映射 |
| 表单 7 | 39 | 含 `类目` 列 | `类目` 作 Type 回退 |

---

## 表单列结构（41 列，表单 10+）

| 组 | 列 | Shopify 映射 |
|----|-----|--------------|
| 关联 | 链接指向、状态 | 分组键 / 父体·子体 |
| 子体 | SKU 图片、价格、SKU（给客户看的）、产品编码 | 变体图 / 价格 / Option / SKU |
| **类型** | **产品系列（D 列，第 1 个）** | **`Type`**，英文，如 `CARP Method Feeder` |
| **产品系列** | **产品系列（E 列，第 2 个）** | **`Collection`**，英文，如 `Method Feeder`；与 Type 相同或留空时由 `store.json` 自动映射 |
| **类别** | **类别（F 列）** | **`Tags`** 中文标签，如 `鱼饵容器`；**不可当作 Type** |
| 旧版 | `系列`（表单 9）、`类目`（表单 7） | `系列`→Type；`类目`→Type 回退 |
| 父体 | 产品标题、**描述**、产品图片1–8 | Title / Body / 相册 |
| 详情 | 详情页描述1–5、详情页图片1–5 | 追加 Body / 解包图片 |
| 评论 | 评论1–6 + 评论图 | 预留 |
| 对照 | Sheet2：中文类别 → 英文 Type 参考 | 填表查表用，**解析不自动读取** |

### 三字段速记（最易混）

| 业务叫法 | 表单列 | Shopify 字段 | 语言 | 示例 |
|----------|--------|--------------|------|------|
| **类型** | D 产品系列 | `Type` | 英文 | `CARP Method Feeder` |
| **产品系列** | E 产品系列 | `Collection` | 英文 | `Method Feeder` |
| **类别** | F 类别 | `Tags`（附加） | 中文 | `鱼饵容器` |

**数据流**

```
D 类型 ──────→ manifest.productType ──→ CSV Type
E 产品系列 ──→ manifest.collection ──→ CSV Collection（空或与 D 相同时走 store.json 映射）
F 类别 ──────→ manifest.tags ────────→ CSV Tags（拼在 config.tags 后）
```

**填表规则**
- `链接指向` 相同者为同一产品（1 父体 + N 子体）
- **空链接组**（无标题/价格/SKU）自动跳过
- **类型 ≠ 产品系列 ≠ 类别**：三者不可互换、不可填同一语义
- D/E 表头都叫「产品系列」时，解析按**列位置**区分：第 1 列=Type，第 2 列=Collection
- E 列与 D 列填相同值（如都填 `CARP Method Feeder`）时，视为未指定 Collection，自动映射为 `Method Feeder`
- 父体 **描述** 列 → `Body (HTML)`；无则用详情页描述1–5
- 子体前台 SKU 名重复时，用内部编码生成唯一 Option
- 图片为 WPS `DISPIMG` 嵌入，由 `extract-listing-form.mjs` 解包到 `images/`

### Collection 自动映射（`config/store.json` → `collections`）

| Type（D 列） | 自动 Collection |
|--------------|-----------------|
| `CARP Method Feeder` | Method Feeder |
| `Feeder Fishing Rig` | Feeder Fishing Rig |
| `CARP Fishing Lines & Hooks` | Carp Fishing Rig |
| `CARP Fishing Accessories` | Carp Accessory |
| `CARP Fishing Tools & Add-ons` | Carp Tackle |
| `Carp Fishing Lead` | Carp Fishing Lead |

完整映射见 `config/store.json` → `collections[].matchProductTypes`。

---

## 解析产出（manifest.json）

`extract-listing-form.mjs` 每个产品写入：

| 字段 | 来源 | 用途 |
|------|------|------|
| `productType` | D 列 / `系列` / `类目` | CSV `Type` |
| `collection` | E 列（仅当 ≠ productType） | CSV `Collection`；否则 CSV 阶段 `resolveCollection()` |
| `subcategory` | F 列 `类别` | 写入 `tags` |
| `tags` | subcategory | CSV `Tags` |
| `series` | 同 productType | 向后兼容旧脚本 |
| `body` | `描述` + 详情页描述1–5 | CSV `Body (HTML)` |
| `variants[].imageFile` | 子体 SKU 图片 | GraphQL 变体图绑定 |

---

## 一键流水线

```powershell
Set-Location "<SKILL_ROOT>"
node scripts/run-listing-form-pipeline.mjs --xlsx "D:\path\独立站上货表单(10).xlsx"
```

| 阶段 | 脚本 | 产出 |
|------|------|------|
| 1 解析 | `extract-listing-form.mjs` | `{表名}/manifest.json` + `images/` |
| 2 CSV | `generate-shopify-csv.mjs` | `*_products_import.csv`、`*_inventory_import.csv` |
| 3 分批 | `split-shopify-csv.mjs` | `batches/batch-01-*.csv` |
| 4 导入 | `playwright/4-import-batches.mjs` | 产品 + 库存 |
| 5 挂图 | `playwright/attach-listing-images-gql.mjs` | GraphQL 相册 + 变体图 |

**分步执行**

```powershell
$X = "D:\path\独立站上货表单(10).xlsx"
$OUT = "output\shopify\独立站上货表单(10)"

node scripts/extract-listing-form.mjs --xlsx $X --out $OUT
node scripts/generate-shopify-csv.mjs --manifest "$OUT\manifest.json" --out $OUT
node scripts/split-shopify-csv.mjs --csv "$OUT\独立站上货表单(10)_products_import.csv" --out "$OUT\batches"
Copy-Item "$OUT\batches\manifest.json" "output\shopify\batches\manifest.json" -Force

cd playwright
node 4-import-batches.mjs --from 1 --continue-on-error --force
node attach-listing-images-gql.mjs --manifest "<SKILL_ROOT>/$OUT/manifest.json"
# 若变体图错绑为同一张主图，加 --force-variants 强制按 manifest.imageFile 重绑
node attach-listing-images-gql.mjs --manifest "<SKILL_ROOT>/$OUT/manifest.json" --force-variants
```

**仅生成 CSV（不导入）**

```powershell
node scripts/run-listing-form-pipeline.mjs --xlsx "表单.xlsx" --skip-import --skip-images
```

**解析后快速验收（不导入）**

```powershell
node scripts/extract-listing-form.mjs --xlsx $X --out $OUT
node scripts/generate-shopify-csv.mjs --manifest "$OUT\manifest.json" --out $OUT
# 检查 manifest：productType / collection / tags 是否正确
# 检查 CSV：Type、Collection、Tags 三列
```

---

## 与「多 Sheet 类目表」的区别

| 项 | 独立站上货表单 | 泰州欧鲤钓类目表 |
|----|---------------|-----------------|
| 入口 | `run-listing-form-pipeline.mjs` | `run-shopify-pipeline.mjs` |
| 解析 | `extract-listing-form.mjs` | `extract-shopify-catalog.mjs` |
| 结构 | 父体/子体 + 链接指向 | 多 Sheet + A 列品名 |
| 分类 | D/E/F 类型·系列·类别 | Sheet 名 → `sheetProductType` |
| 挂图 | `attach-listing-images-gql.mjs`（stagedUpload） | `run-post-import-gql.mjs` / Files 上传 |
| Cursor Skill | `shopify-shangjia` | `shopify-listing` / `shopify-automation` |

---

## Agent 禁止

- 禁止对空链接组生成 CSV 或导入
- 禁止跳过挂图阶段（表单无 Image Src 列，必须 GraphQL 上传）
- 禁止子体 Option 重复（须用内部编码去重）
- 禁止一次全量导入 400+ 产品（本表单通常 1–2 批即可）
- 禁止把 F 列「类别」填进 Type 或 Collection
- 禁止用 `headers.indexOf("产品系列")` 只读第一列（表单 10 有两列同名，须按列位置读）

---

## 验收

1. 后台搜索 handle（如 `changzui`、`g-xing-xinhejin`）
2. **Type** = D 列英文类型；**Collection** = E 列或自动映射；**Tags** 含 F 列中文类别
3. 父体相册图数量 = 表单产品图片列有值张数
4. **每个子体变体图 ≠ 主图** — 须与 Excel 子体 SKU 图一一对应（`manifest.variants[].imageFile`）
5. `Body (HTML)` 含「描述」列文案

### 变体图错绑（全部显示同一张主图）

挂图脚本会将 SKU 图单独 `productCreateMedia`（alt=`listing-file:{filename}`），再用 `productVariantsBulkUpdate(mediaId)` 绑定。  
修复已导入产品：`attach-listing-images-gql.mjs --manifest ... --force-variants`

### 解析后 Type 为空

检查表单是否为 10+ 版（D 列应为「产品系列」而非旧名「系列」）；或是否误删 D 列。旧表单 9 仍用「系列」列名，脚本已兼容。
