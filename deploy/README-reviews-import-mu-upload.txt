carp-ybb 评价 Excel 批量导入 — 最小 mu-plugin 补丁

【用法】
1. SiteGround File Manager → public_html/wp-content/mu-plugins/
2. 上传 ybb-reviews-import-patch.zip
3. 右键 Extract 解压到当前目录（mu-plugins）
4. 确认存在：
   - ybb-product-reviews.php（Version 1.2.0）
   - ybb-product-reviews/includes/review-import-*.php
   - ybb-site-manager/includes/admin/page.php（含 reviews-import Tab）
5. 删除 zip
6. WP → YBB 站点管理 → 评价导入

【数据】本机 xlsx 后台上传即可，无需 rebuild 静态站
   reports/product-reviews-import/tz-hk-001-reviews-import-*.xlsx

打包文件数: 7
输出: D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site\deploy\ybb-reviews-import-patch.zip