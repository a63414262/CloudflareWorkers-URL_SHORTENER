# 🔗 Cloudflare Workers 短链接生成器

基于 Cloudflare Workers 和 KV 存储构建的轻量级、极速、免费的短链接生成服务。自带带密码保护的简约网页端，支持单次登录会话保持。

## ✨ 功能特点

* **🚀 极致响应**：依托 Cloudflare 全球边缘节点，重定向速度极快。
* **💾 永久存储**：使用 Cloudflare KV 作为数据库，链接数据默认永久有效。
* **🔒 安全验证**：内置网页版控制面板，带有毛玻璃登录弹窗，密码验证通过后当前会话免密。
* **✨ 智能补全**：自动识别并补全长链接的 `http://` 或 `https://` 协议。
* **⌨️ 快捷操作**：全面支持回车键提交，提升使用效率。
* **🛠 API 支持**：提供标准的 JSON API 接口，方便与其他程序或快捷指令集成。

## 🚀 部署指南

本项目推荐直接在 Cloudflare 网页控制台完成部署，无需配置本地开发环境。

### 第一步：创建 KV 数据库
1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 进入左侧菜单的 **Workers & Pages** -> **KV**。
3. 点击 **Create a namespace**，输入名称（例如 `URL_SHORTENER_KV`），点击创建。

### 第二步：创建并配置 Worker
1. 回到 **Workers & Pages** -> **Overview**，点击 **Create application** -> **Create Worker**。
2. 为你的 Worker 起个名字（例如 `my-shortlink`），点击 **Deploy**。
3. 进入刚刚创建的 Worker 详情页，点击 **Settings** -> **Variables**。
4. **绑定 KV**：
   * 在 **KV Namespace Bindings** 区域点击 **Add binding**。
   * **Variable name** 必须填写为：`LINKS_KV`。
   * **KV namespace** 选择你在第一步创建的数据库，点击保存。
5. **设置密码**：
   * 在 **Environment Variables** 区域点击 **Add variable**。
   * **Variable name** 填写：`ADMIN_PASSWORD`。
   * **Value** 填写你的自定义管理密码（例如 `MySecretPwd123`），点击保存。

### 第三步：部署代码
1. 在 Worker 详情页右上角点击 **Edit code**。
2. 清空原有的代码，将本项目 `worker.js` 中的全部代码粘贴进去。
3. 点击右上角的 **Deploy**。
4. 部署完成！现在你可以通过 Cloudflare 提供的 `*.workers.dev` 域名访问你的短链接生成器了。

## 💻 API 使用说明

如果你想通过脚本或第三方工具生成短链接，可以调用以下 API。

**请求路径**：`POST /api/shorten`

**请求 Body (JSON)**：
```json
{
  "url": "[https://github.com](https://github.com)",
  "password": "你的管理密码"
}
