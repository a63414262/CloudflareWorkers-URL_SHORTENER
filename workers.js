export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ==========================================
    // ⚙️ 配置区：在这里设置你的管理密码
    // ==========================================
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD || "123456"; 

    // 1. 新增：处理密码验证请求 (POST /api/verify)
    if (request.method === "POST" && url.pathname === "/api/verify") {
      try {
        const body = await request.json();
        if (body.password === ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        } else {
          return new Response(JSON.stringify({ error: "密码错误" }), {
            status: 401,
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: "请求无效" }), { status: 400 });
      }
    }

    // 2. 处理生成短链接的 API 请求 (POST /api/shorten)
    if (request.method === "POST" && url.pathname === "/api/shorten") {
      try {
        const body = await request.json();
        
        // 【安全检查】：依然需要在后端验证密码，防止别人绕过前端直接发 API 请求
        if (body.password !== ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ error: "登录已失效，请刷新页面重新输入密码！" }), {
            status: 401,
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        }

        let longUrl = body.url ? body.url.trim() : "";
        if (longUrl && !/^https?:\/\//i.test(longUrl)) {
          longUrl = "https://" + longUrl;
        }

        if (!longUrl || !isValidUrl(longUrl)) {
          return new Response(JSON.stringify({ error: "无效的 URL" }), {
            status: 400,
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        }

        const shortCode = generateShortCode();
        await env.LINKS_KV.put(shortCode, longUrl);
        const shortUrl = `${url.origin}/${shortCode}`;

        return new Response(JSON.stringify({ shortUrl, shortCode, longUrl }), {
          status: 200,
          headers: { "Content-Type": "application/json;charset=UTF-8" }
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: "请求格式错误" }), { status: 400 });
      }
    }

    // 3. 处理短链接重定向 (GET /:shortCode)
    if (request.method === "GET") {
      const shortCode = url.pathname.slice(1);

      if (!shortCode) {
        return new Response(homepageHTML, {
          status: 200,
          headers: { "Content-Type": "text/html;charset=UTF-8" }
        });
      }

      const longUrl = await env.LINKS_KV.get(shortCode);
      if (longUrl) {
        return Response.redirect(longUrl, 302);
      } else {
        return new Response("哎呀，这个短链接不存在或已失效！", { status: 404 });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  }
};

function generateShortCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (err) {
    return false;
  }
}

// 网页前端代码
const homepageHTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>短链接生成器</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background-color: #f9fafb; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    
    /* 主容器样式 */
    .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); width: 100%; max-width: 500px; text-align: center; display: none; }
    
    /* 登录弹窗遮罩层 */
    #loginOverlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(4px); }
    .modal-content { background: white; padding: 30px; border-radius: 12px; width: 90%; max-width: 350px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
    
    h2, h3 { color: #333; margin-top: 0; }
    input { width: 100%; padding: 12px; margin-bottom: 15px; font-size: 16px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; outline: none; transition: border 0.3s; }
    input:focus { border-color: #0051c3; }
    button { width: 100%; padding: 12px 24px; font-size: 16px; font-weight: bold; cursor: pointer; background: #0051c3; color: white; border: none; border-radius: 6px; transition: background 0.3s; }
    button:hover { background: #003d99; }
    button:disabled { background: #999; cursor: not-allowed; }
    
    #result, #loginResult { margin-top: 20px; font-size: 16px; word-break: break-all; }
    a { color: #0051c3; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .error { color: #d32f2f; font-weight: bold; }
    .success { color: #2e7d32; font-weight: bold; }
  </style>
</head>
<body>

  <div id="loginOverlay">
    <div class="modal-content">
      <h3>🔒 验证身份</h3>
      <input type="password" id="modalPwd" placeholder="请输入管理密码" required>
      <button id="verifyBtn" onclick="verifyPassword()">进入系统</button>
      <div id="loginResult"></div>
    </div>
  </div>

  <div class="container" id="mainContainer">
    <h2>🔗 Cloudflare 短链接生成器</h2>
    <input type="text" id="longUrl" placeholder="请输入要缩短的链接 (例如 youtube.com)" required autocomplete="off">
    <button onclick="shorten()">生成短链接</button>
    <div id="result"></div>
  </div>

  <script>
    // 在内存中保存密码，刷新页面即丢失
    let sessionPassword = "";

    // 1. 验证密码功能
    async function verifyPassword() {
      const pwdInput = document.getElementById('modalPwd').value;
      const loginResult = document.getElementById('loginResult');
      const verifyBtn = document.getElementById('verifyBtn');

      if (!pwdInput.trim()) {
        loginResult.innerHTML = '<span class="error">密码不能为空</span>';
        return;
      }

      verifyBtn.disabled = true;
      verifyBtn.innerText = '验证中...';

      try {
        const response = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwdInput })
        });

        if (response.ok) {
          // 密码正确，保存到内存，隐藏弹窗，显示主界面
          sessionPassword = pwdInput;
          document.getElementById('loginOverlay').style.display = 'none';
          document.getElementById('mainContainer').style.display = 'block';
          // 自动聚焦到链接输入框
          document.getElementById('longUrl').focus();
        } else {
          loginResult.innerHTML = '<span class="error">密码错误，请重试</span>';
        }
      } catch (err) {
        loginResult.innerHTML = '<span class="error">网络异常</span>';
      } finally {
        verifyBtn.disabled = false;
        verifyBtn.innerText = '进入系统';
      }
    }

    // 2. 生成短链接功能
    async function shorten() {
      const urlInput = document.getElementById('longUrl').value;
      const resultDiv = document.getElementById('result');
      
      if (!urlInput.trim()) {
        resultDiv.innerHTML = '<span class="error">请输入链接！</span>';
        return;
      }

      resultDiv.innerHTML = '生成中...';
      
      try {
        const response = await fetch('/api/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // 发送请求时，自动带上刚才验证通过的密码
          body: JSON.stringify({ url: urlInput, password: sessionPassword })
        });
        
        const data = await response.json();
        if (response.ok) {
          resultDiv.innerHTML = '<span class="success">✅ 生成成功：</span><br><br><a href="' + data.shortUrl + '" target="_blank"><strong>' + data.shortUrl + '</strong></a>';
          // 生成成功后清空输入框，方便下一次输入
          document.getElementById('longUrl').value = '';
        } else {
          resultDiv.innerHTML = '<span class="error">错误: ' + data.error + '</span>';
        }
      } catch (err) {
        resultDiv.innerHTML = '<span class="error">网络请求失败，请稍后再试。</span>';
      }
    }

    // 3. 绑定回车键快捷操作
    document.getElementById('modalPwd').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') verifyPassword();
    });
    document.getElementById('longUrl').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') shorten();
    });
  </script>
</body>
</html>
`;
