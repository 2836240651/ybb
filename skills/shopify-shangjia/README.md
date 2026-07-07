# Shopify 独立站上货（shopify-shangjia）

**仓库**: [github.com/2836240651/ybb/tree/skill/skills/shopify-shangjia](https://github.com/2836240651/ybb/tree/skill/skills/shopify-shangjia)  
**Skill 根**: `<SKILL_ROOT>` = 本目录 `skills/shopify-shangjia/`

独立站上货表单（WPS Excel，父体/子体）→ manifest → Shopify CSV → Playwright 分批导入 → GraphQL 挂图。

## 快速开始

```powershell
cd <SKILL_ROOT>
powershell -ExecutionPolicy Bypass -File scripts\setup-local.ps1
# 编辑 config\store.json（从 store.example.json 复制）
cd playwright
npm run open-chrome
node wait-capture-session.mjs

cd <SKILL_ROOT>
node scripts/run-listing-form-pipeline.mjs --xlsx "D:\path\独立站上货表单(10).xlsx"
```

## 文档

- **完整流程**: [`SKILL.md`](SKILL.md)
- **Agent 规则**: [`AGENTS.md`](AGENTS.md)
- **Cursor 规则**: [`.cursor/rules/shopify-shangjia.mdc`](.cursor/rules/shopify-shangjia.mdc)

## 表单 10+ 三字段

| 列 | 业务 | Shopify |
|----|------|---------|
| D 产品系列（第1个） | 类型 | `Type` |
| E 产品系列（第2个） | 产品系列 | `Collection` |
| F 类别 | 中文标签 | `Tags` |

## 目录

```
shopify-shangjia/
├── SKILL.md              # 权威工作流
├── scripts/              # 解析、CSV、流水线
├── playwright/           # 导入、挂图、系列归类
├── config/store.example.json
└── output/               # 运行时产出（gitignore）
```

## 与多 Sheet 类目表

多 Sheet 泰州欧鲤钓类目表 **不走本 skill**，需完整 `独立站上架` 项目中的 `run-shopify-pipeline.mjs`。
