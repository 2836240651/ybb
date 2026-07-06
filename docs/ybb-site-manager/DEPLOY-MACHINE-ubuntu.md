# 固定部署机（Ubuntu）— carp-ybb 静态站 Runner

运营在 **任意电脑** 的 WP 后台改产品图 → 只入队。  
**本 Ubuntu 服务器** 常驻 Runner，自动 sync → build → FTPS 上传。

> 你提供的机器：`170.106.110.63`（Ubuntu / 硅谷）。  
> **不要** 在聊天里粘贴私钥；用 Lighthouse 控制台下载的 `.pem` 登录。

---

## 1. 架构

```
运营改 Woo 产品图 (任意浏览器)
        ↓
WordPress 部署队列 (pending)
        ↓
Ubuntu 部署机 ybb-deploy-runner.sh --poll  (每 5 分钟)
        ↓
sync → build → audit → FTPS zip 上传 → verify
        ↓
https://carp-ybb.com 静态 PDP 图片更新
```

运营电脑 **不需要** 装脚本。

---

## 2. 登录部署机

```bash
# 本机（Windows PowerShell 示例）
ssh -i C:\path\to\your-lighthouse.pem ubuntu@170.106.110.63
```

---

## 3. 同步代码到服务器

在 **开发机**（有完整 `omc-replica/ybb-site` 的电脑）执行：

```bash
rsync -avz --delete \
  --exclude node_modules --exclude out --exclude .next --exclude reports \
  "D:/开发/fishAgent/总包/skill/reverse-skill/omc-replica/ybb-site/" \
  ubuntu@170.106.110.63:/opt/ybb-site/
```

（Windows 可用 WSL、WinSCP，或先 zip 再 scp。）

---

## 4. 一键安装依赖 + systemd 服务

在 **服务器** 上：

```bash
cd /opt/ybb-site
sudo bash scripts/setup-deploy-runner-ubuntu.sh
```

---

## 5. 配置 secrets.local.json（仅服务器本地）

编辑 `/opt/ybb-site/secrets.local.json`：

| 字段 | 来源 |
|------|------|
| `deploy.runnerKey` | WP → YBB 站点管理 → **部署状态** → Deploy Secret |
| `ftp.*` | 与开发机 `secrets.local.json` 相同（SiteGround FTPS） |
| `wordpress.*` | 用于 Playwright 同步（与开发机相同） |

```bash
sudo chmod 600 /opt/ybb-site/secrets.local.json
sudo chown ubuntu:ubuntu /opt/ybb-site/secrets.local.json
sudo systemctl restart ybb-deploy-runner
```

---

## 6. 验证

```bash
# 服务是否在跑
sudo systemctl status ybb-deploy-runner

# 手动跑一次（不轮询）
cd /opt/ybb-site && bash scripts/ybb-deploy-runner.sh

# 强制全量（跳过 claim）
bash scripts/ybb-deploy-runner.sh --force
```

WP 后台 **部署状态** 页（已支持每 8 秒自动刷新）应出现：

- `running` → 各步骤文案  
- `success` + `lastBuildId`  
- 或 `failed` + `lastError`

---

## 7. 运营侧说明

| 问题 | 答案 |
|------|------|
| 运营要装 Runner 吗？ | **不要** |
| 改图后多久上线？ | 入队后 ≤5 分钟（轮询间隔）+ 构建约 3–10 分钟 |
| 操作记录有、状态 idle？ | 部署机 Runner 未跑或 secrets 错误 |
| 价格/库存 | Woo API **即时**，不依赖 Runner |
| **产品主图**（静态 PDP） | **必须** Runner 成功部署 |

---

## 8. 与 Windows 脚本关系

| 环境 | 命令 |
|------|------|
| Windows 开发机 | `scripts\ybb-deploy-runner.ps1 -Poll` |
| **Ubuntu 部署机** | `scripts/ybb-deploy-runner.sh --poll` |

Linux 版上传走 `siteground_deploy_cli.py deploy-static --auto-upload`（FTPS），**不需要** Chrome 浏览器。

---

## 9. 故障排查

```bash
journalctl -u ybb-deploy-runner -f
```

常见失败：

- `audit BLOCKED` — 构建包不完整（已改为按当前目录产品校验，非写死 tz-eldz-012）
- `secrets.local.json missing deploy.runnerKey` — Secret 与 WP 后台不一致
- FTPS 超时 — 检查服务器出站 21 端口 / 换时段重试

部署成功后请在 SiteGround **Purge Cache**。
