YBB Flat Checkout mu-plugin 上传包

【用法】
1. SiteGround File Manager → public_html/wp-content/mu-plugins/
2. 上传本目录内：
   - ybb-flat-checkout.php（覆盖）
   - ybb-flat-checkout/ 整个文件夹（覆盖合并）
3. 勿把整个 siteground-upload-flat-checkout 文件夹拖进 mu-plugins
4. WooCommerce → Settings → Accounts：关闭游客结账（Allow guest checkout）
5. 验收：
   - 空车访问 /checkout/ → 跳转 /cart/
   - 未登录访问 /checkout/（有车）→ /my-account/?redirect_to=...
   - 登录后 checkout 页有 Back to cart 按钮 + place_order
   - 页面 HTML 含 class ybb-checkout-page