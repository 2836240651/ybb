# YBB Skills

Cursor / Agent 可复用技能包，与 `ybb-site` 同仓 `skill` 分支维护。

| Skill | 路径 | 说明 |
|-------|------|------|
| **shopify-shangjia** | [`shopify-shangjia/`](shopify-shangjia/) | 独立站上货表单（父体/子体 Excel）→ Shopify CSV → 导入 → GraphQL 挂图 |

## 使用

```powershell
git clone -b skill https://github.com/2836240651/ybb.git
cd ybb\skills\shopify-shangjia
powershell -ExecutionPolicy Bypass -File scripts\setup-local.ps1
```

Agent 任务前读取：`skills/shopify-shangjia/SKILL.md`
