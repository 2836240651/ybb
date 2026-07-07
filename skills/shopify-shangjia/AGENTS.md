# shopify-shangjia Agent 规则

**Skill 根**: `<SKILL_ROOT>` = 本包目录（`skills/shopify-shangjia/`）  
**权威文档**: `<SKILL_ROOT>/SKILL.md`

## 必做

1. 任务开始前 **Read `SKILL.md`**
2. 确认 `playwright/shopify-auth.json` 有效
3. 区分 **类型(D) / 产品系列(E) / 类别(F)**，不可互换
4. 表单 10+ 两列「产品系列」按**列位置**解析
5. 空链接组不导入；不可跳过 GraphQL 挂图

## 一键

```powershell
Set-Location "<SKILL_ROOT>"
node scripts/run-listing-form-pipeline.mjs --xlsx "<独立站上货表单.xlsx>"
```

## 禁止

- 禁止 `headers.indexOf("产品系列")` 只读第一列
- 禁止把 F 列「类别」写入 Type/Collection
- 禁止一次全量导入 400+ 产品（本表单通常 1–2 批）
