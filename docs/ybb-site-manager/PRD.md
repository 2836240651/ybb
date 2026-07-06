# YBB Site Manager — PRD

## 背景

carp-ybb.com 采用 Next.js 静态导出 + WooCommerce 混站。运营无法独立维护导航、公告、Hero 等前台内容，且新产品上架依赖开发执行 sync/build/全量 zip 部署。

## 目标

统一 Woo 后台 **YBB 站点管理**，使运营可配置前台模块（REST + client fetch），Phase 3 实现产品发布后自动部署。

## 用户故事

- **运营**：改导航/公告/Hero/视频/热点，保存后 5 分钟内前台生效，无需找开发。
- **运营（PCT）**：在 Woo / 站点管理维护商品描述与附加信息，PDP Tab 即时更新，无需静态 redeploy。
- **运营（Phase 3）**：Woo 发布新产品后 1 小时内 PDP 可访问，无需手动部署。
- **开发**：单一 mu-plugin、REST 契约稳定、禁止 hydrate 注入。

## 范围

| Phase | 模块 |
|-------|------|
| 1 | 导航、公告、Hero |
| 2 | 视频、Featured、合并 Home Settings / Site Brand |
| 2.5 | **产品运营分层（POL）** — Woo 真源 + overrides REST + Admin 产品 Tab + PDP live 价 |
| 2.6 | **PDP 内容 Tab（PCT / POL-5）** — Description + Additional information；Woo 真源 + 站点管理覆盖 |
| 3 | Woo publish → 自动 sync/build/deploy |

详见：`docs/ybb-site-manager/PRODUCT-OPS-DESIGN.md`、`PRODUCT-OPS-IMPLEMENTATION-PACK.md`、`PDP-CONTENT-TABS-DESIGN.md`、`PDP-CONTENT-TABS-IMPLEMENTATION-PACK.md`。

## 非目标

- 不替换 WP 主题；不做全站 runtime PDP（Phase 3 前）。
- Phase 1 不改 CategoryGrid、政策页正文。
- 不合并 Quorlyx / Checkout / My Account。

## 成功指标

| 指标 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| 配置改后需静态 deploy | 0 | 0 | — |
| 新产品 PDP 可用 | — | — | ≤60min |
| 部署导致白屏 | 0 | 0 | 0（audit 门禁） |

## 参考

- 插件：`deploy/wp-content/mu-plugins/ybb-site-manager/`
- REST 细则：`REST-SPEC.md`
- 运营手册：`OPS-RUNBOOK-zh.md`
