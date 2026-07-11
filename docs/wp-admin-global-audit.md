# WP Admin 全局审查报告（carp-ybb.com）

生成时间：2026-07-08

## 架构分层

```
浏览器
  ↓
[1] SiteGround SG-Captcha（nginx 边缘，HTTP 202）
  ↓ 通过后
[2] WordPress wp-login.php
  ↓
[3] SG Security 登录算术验证码（"Prove your humanity"）
  ↓ 通过后
[4] WordPress 会话 Cookie
  ↓
[5] wp-admin/index.php 仪表盘
```

**.htaccess / 静态站 / Headless** 在未登录 curl 测试中不是主因；登录链路的真正断点在 **第 1 层或第 3 层**。

---

## 第 1 层：SG-Captcha（边缘）

**现象：** HTTP **202**，body ~180 字节，meta 跳转 `/.well-known/sgcaptcha/`，浏览器全白。

**影响路径（本机 IP 85.234.83.17 curl）：** `/`、`wp-login.php`、`wp-admin/*`、`checkout/`、`index.php`  
**例外：** `/wp-json/` 根路径有时 **200**（约 1.9MB），说明 WordPress 活着，只是按路径/IP 选择性挑战。

**部署机 IP：** 同上路径返回正常 WordPress HTML（200），无 202。

**结论：** 中国大陆/部分 IP 在到达 PHP 前被拦；**不是 htaccess 写坏**。

---

## 第 2–3 层：浏览器实测（Playwright 真浏览器）

脚本：`scripts/audit-wp-admin-browser.py`

| 步骤 | 结果 |
|------|------|
| 首页 | ✅ 正常加载（87382 字节） |
| wp-login.php | ✅ 显示登录表单 |
| 提交账号密码（未填算术题） | ❌ **WordPress › Error**：*"Please solve this math problem to prove that you are not a bot"* |
| wp-admin/index.php | ❌ 未登录，重定向回 wp-login |
| sg_auto / YBB 站点管理 | ❌ 同上，需先完成登录 |

登录页含 **「Prove your humanity 9 + 5 =」** 算术验证码 — 来自 **SiteGround Security（SG Security）** 插件，不是主题/不是 ybb 代码。

**结论：** 你能打开登录页但进不了后台，是因为 **登录 POST 被算术验证码拒绝**，会话从未建立；不是「登录成功但仪表盘白屏」。

---

## 第 4 层：已排除项

| 项 | 状态 |
|----|------|
| `.htaccess` wp-admin 规则 | ✅ 线上已核对 |
| Blocked Traffic | ✅ 无封 IP |
| Protected URLs | ✅ 空 |
| SSL | ✅ ACTIVE |
| `frontHidden` 产品消失 | ✅ 已 unhide（另案） |
| Headless 重定向 wp-admin | ⚠️ 未豁免 wp-admin，但仅在 **登录成功后** 才可能影响；当前卡在登录前 |

---

## 处理办法（按优先级）

### A. 关掉 SG Security 登录验证码（推荐）

1. 若能进 wp-admin：**SG Security → Login Security → 关闭 Math Captcha / Login Captcha**
2. 若进不去：Site Tools → **WordPress → Install & Manage → ⋮ → Disable all plugins**（临时）
3. 登录后只关 Login Captcha，再逐个启用插件

### B. 登录时填写算术题

用户名、密码、**算术题** 三项都填，再点 Log In。漏填会报 Error 或看起来像「又白屏」。

### C. SG-Captcha IP 仍被拦时

联系 SiteGround 工单，附：`HTTP 202 SG-Captcha` + 你的公网 IP，要求对 `wp-login.php` / `wp-admin/*` 放行。

### D. 不依赖 wp-admin 的运维

- 产品 `frontHidden` / REST：部署机脚本或 `ybb-unhide-products.php`
- 静态站：Ubuntu 部署机 `ybb-deploy-runner.sh`
- YBB 配置：mu-plugin REST（`/wp-json/ybb/v1/...`）在部分网络仍可达

---

## 复现命令

```powershell
cd omc-replica\ybb-site
py scripts\trace-wp-admin-http.py      # curl 链路
py scripts\audit-wp-admin-browser.py   # 真浏览器 + 登录
py scripts\audit-wp-admin-global.py    # 多 URL 总览
```

报告：`reports/wp-admin-trace.json`、`reports/wp-admin-browser-audit.json`、`reports/wp-admin-global-audit.json`
