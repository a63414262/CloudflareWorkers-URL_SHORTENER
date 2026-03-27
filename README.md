# 🔗 Cloudflare Workers 短链接生成器 (Pro)

基于 Cloudflare Workers 和 KV 存储构建的高性能短链接服务。轻量、极速、零成本，自带带有毛玻璃质感的密码保护控制面板，并提供多维度的数据统计。

## ✨ 核心特性

* **🚀 边缘加速，极速跳转**：依托 Cloudflare 全球边缘节点，实现毫秒级重定向。
* **📊 多维数据统计**：独创“滑动窗口”算法，精准统计**今日、本周、本月及累计**点击量，内置 UTC+8（北京时间）时区校准。
* **🔒 安全控制面板**：自带密码保护的 Web UI，支持单次登录会话保持，告别频繁输入密码。
* **✨ 智能交互体验**：自动识别并补全 `http://` 或 `https://` 协议，全面支持回车键快捷操作。
* **💾 数据永久存储**：使用 Cloudflare KV 存储，数据持久化，单节点并发毫无压力。
* **🛠 标准 API 支持**：提供 RESTful API，轻松集成到你的脚本、快捷指令或第三方系统中。

---

## 📸 界面预览

*(你可以稍后在这里插入几张你系统的截图，比如登录弹窗、生成界面和统计面板的截图，这会让 README 更吸引人)*

---

## 🚀 极简部署指南

本项目推荐直接在 Cloudflare 网页控制台完成部署，无需配置本地开发环境。只需 3 分钟即可拥有你自己的短链接服务！

### 第 1 步：创建 KV 数据库
1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 导航至左侧菜单 **Workers & Pages** -> **KV**。
3. 点击 **Create a namespace**，输入名称（例如 `URL_SHORTENER_KV`），点击创建。

### 第 2 步：创建并配置 Worker
1. 回到 **Workers & Pages** -> **Overview**，点击 **Create application** -> **Create Worker**。
2. 为你的 Worker 命名（例如 `my-shortlink`），点击 **Deploy**。
3. 进入刚刚创建的 Worker 详情页，点击 **Settings** -> **Variables**。
4. **绑定 KV 数据库**：
   * 在 **KV Namespace Bindings** 区域点击 **Add binding**。
   * **Variable name** 必须严格填写为：`LINKS_KV`。
   * **KV namespace** 选择你在第 1 步创建的数据库，点击保存。
5. **设置管理员密码**：
   * 在 **Environment Variables** 区域点击 **Add variable**。
   * **Variable name** 填写：`ADMIN_PASSWORD`。
   * **Value** 填写你的自定义复杂密码（例如 `MySuperSecretPwd`），点击保存。

### 第 3 步：部署代码
1. 在 Worker 详情页右上角点击 **Edit code**。
2. 清空原有的所有代码，将本项目 `worker.js` 中的完整代码粘贴进去。
3. 点击右上角的 **Deploy**。
4. 🎉 **部署完成！** 访问 Cloudflare 分配的 `*.workers.dev` 域名，输入密码即可开始使用。

---

## 💻 API 使用文档

支持通过脚本或第三方工具生成短链接。

**请求接口**：`POST /api/shorten`

**请求参数 (JSON)**：
```json
{
  "url": "[https://github.com](https://github.com)",
  "password": "你的管理员密码"
}
