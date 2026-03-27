export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ==========================================
    // ⚙️ 配置区：管理密码
    // ==========================================
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD || "123456"; 

    // 辅助函数：获取北京时间的 日、周、月 标识
    function getTimeKeys() {
      // 加上 8 小时偏移量，转换为北京时间 (UTC+8)
      const d = new Date(Date.now() + 8 * 3600 * 1000);
      const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
      const monthStr = dateStr.substring(0, 7); // YYYY-MM
      
      // 计算本周一的日期作为周标识
      const dayOfWeek = d.getUTCDay() || 7; // 1-7 (周一到周日)
      const monday = new Date(d.getTime() - (dayOfWeek - 1) * 86400000);
      const weekStr = monday.toISOString().split('T')[0];

      return { day: dateStr, week: weekStr, month: monthStr };
    }

    // 1. 处理密码验证 (POST /api/verify)
    if (request.method === "POST" && url.pathname === "/api/verify") {
      try {
        const body = await request.json();
        if (body.password === ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200, headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        }
        return new Response(JSON.stringify({ error: "密码错误" }), { status: 401 });
      } catch (e) {
        return new Response(JSON.stringify({ error: "请求无效" }), { status: 400 });
      }
    }

    // 2. 获取统计数据 (POST /api/stats)
    if (request.method === "POST" && url.pathname === "/api/stats") {
      try {
        const body = await request.json();
        if (body.password !== ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ error: "未授权" }), { status: 401 });
        }

        const list = await env.LINKS_KV.list();
        const currentKeys = getTimeKeys();

        const stats = list.keys.map(k => {
          const meta = k.metadata || {};
          const st = meta.stats || {};
          
          return {
            shortCode: k.name,
            longUrl: meta.url || "未知 (旧数据)",
            clicks: meta.clicks || 0,
            // 如果数据库里的时间标识和当前时间一致，才返回对应数量，否则说明那是过去的数据，今日/周/月应为0
            todayClicks: st.dayKey === currentKeys.day ? (st.dayCount || 0) : 0,
            weekClicks: st.weekKey === currentKeys.week ? (st.weekCount || 0) : 0,
            monthClicks: st.monthKey === currentKeys.month ? (st.monthCount || 0) : 0,
            created_at: meta.created_at || 0
          };
        }).sort((a, b) => b.created_at - a.created_at); 

        return new Response(JSON.stringify(stats), {
          status: 200, headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "获取统计失败" }), { status: 500 });
      }
    }

    // 3. 处理生成短链接 (POST /api/shorten)
    if (request.method === "POST" && url.pathname === "/api/shorten") {
      try {
        const body = await request.json();
        if (body.password !== ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ error: "登录已失效，请刷新页面！" }), { status: 401 });
        }

        let longUrl = body.url ? body.url.trim() : "";
        if (longUrl && !/^https?:\/\//i.test(longUrl)) {
          longUrl = "https://" + longUrl;
        }

        if (!longUrl || !isValidUrl(longUrl)) {
          return new Response(JSON.stringify({ error: "无效的 URL" }), { status: 400 });
        }

        const shortCode = generateShortCode();
        const currentKeys = getTimeKeys();
        
        await env.LINKS_KV.put(shortCode, longUrl, {
          metadata: { 
            url: longUrl, 
            clicks: 0, 
            created_at: Date.now(),
            stats: { dayKey: currentKeys.day, dayCount: 0, weekKey: currentKeys.week, weekCount: 0, monthKey: currentKeys.month, monthCount: 0 }
          }
        });

        const shortUrl = `${url.origin}/${shortCode}`;
        return new Response(JSON.stringify({ shortUrl, shortCode, longUrl }), {
          status: 200, headers: { "Content-Type": "application/json;charset=UTF-8" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "请求格式错误" }), { status: 400 });
      }
    }

    // 4. 处理短链接重定向 (GET /:shortCode)
    if (request.method === "GET") {
      const shortCode = url.pathname.slice(1);

      if (!shortCode) {
        return new Response(homepageHTML, {
          status: 200, headers: { "Content-Type": "text/html;charset=UTF-8" }
        });
      }

      const { value, metadata } = await env.LINKS_KV.getWithMetadata(shortCode);

      if (value) {
        // 在后台异步更新点击量统计
        ctx.waitUntil((async () => {
          const currentMeta = metadata || { url: value, clicks: 0, created_at: Date.now() };
          if (!currentMeta.stats) currentMeta.stats = {};
          
          const keys = getTimeKeys();

          // 统计今日
          if (currentMeta.stats.dayKey !== keys.day) { currentMeta.stats.dayKey = keys.day; currentMeta.stats.dayCount = 1; } 
          else { currentMeta.stats.dayCount++; }

          // 统计本周
          if (currentMeta.stats.weekKey !== keys.week) { currentMeta.stats.weekKey = keys.week; currentMeta.stats.weekCount = 1; } 
          else { currentMeta.stats.weekCount++; }

          // 统计本月
          if (currentMeta.stats.monthKey !== keys.month) { currentMeta.stats.monthKey = keys.month; currentMeta.stats.monthCount = 1; } 
          else { currentMeta.stats.monthCount++; }

          // 累计总点击
          currentMeta.clicks = (currentMeta.clicks || 0) + 1;

          await env.LINKS_KV.put(shortCode, value, { metadata: currentMeta });
        })());

        return Response.redirect(value, 302);
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
  try { new URL(string); return true; } catch (err) { return false; }
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
    body { font-family: system-ui, sans-serif; margin: 0; background-color: #f4f6f8; display: flex; justify-content: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
    
    .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); width: 100%; max-width: 800px; text-align: center; display: none; margin-top: 40px; height: fit-content; }
    
    #loginOverlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(4px); }
    .modal-content { background: white; padding: 30px; border-radius: 12px; width: 90%; max-width: 350px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
    
    h2, h3 { color: #333; margin-top: 0; }
    input { width: 100%; padding: 12px; margin-bottom: 15px; font-size: 16px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; outline: none; transition: border 0.3s; }
    input:focus { border-color: #0051c3; }
    button { padding: 12px 24px; font-size: 16px; font-weight: bold; cursor: pointer; background: #0051c3; color: white; border: none; border-radius: 6px; transition: background 0.3s; width: 100%; }
    button:hover { background: #003d99; }
    button:disabled { background: #999; cursor: not-allowed; }
    
    .nav-tabs { display: flex; margin-bottom: 20px; border-bottom: 2px solid #eee; }
    .nav-tabs div { flex: 1; padding: 10px; cursor: pointer; font-weight: bold; color: #666; transition: 0.3s; }
    .nav-tabs div.active { color: #0051c3; border-bottom: 2px solid #0051c3; margin-bottom: -2px; }
    
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    /* 表格样式优化，适应更多列 */
    table { width: 100%; border-collapse: collapse; margin-top: 15px; text-align: center; font-size: 14px; }
    th, td { padding: 12px 8px; border-bottom: 1px solid #f0f0f0; }
    th { background-color: #f8fafc; font-weight: 600; color: #334155; }
    .url-cell { max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left;}
    
    /* 不同的徽章颜色 */
    .badge { padding: 4px 8px; border-radius: 12px; font-weight: bold; font-size: 12px; display: inline-block; min-width: 20px;}
    .badge-today { background: #dcfce7; color: #166534; }
    .badge-week { background: #fef9c3; color: #854d0e; }
    .badge-month { background: #ffedd5; color: #c2410c; }
    .badge-total { background: #e0f2fe; color: #0369a1; }

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
    <h2>🔗 短链接控制台</h2>
    
    <div class="nav-tabs">
      <div id="tab-create" class="active" onclick="switchTab('create')">生成链接</div>
      <div id="tab-stats" onclick="switchTab('stats')">详细统计面板</div>
    </div>

    <div id="content-create" class="tab-content active">
      <input type="text" id="longUrl" placeholder="请输入要缩短的链接 (例如 youtube.com)" required autocomplete="off">
      <button onclick="shorten()">生成短链接</button>
      <div id="result"></div>
    </div>

    <div id="content-stats" class="tab-content">
      <button onclick="loadStats()" style="background:#f1f5f9; color:#475569; margin-bottom:15px; font-size: 14px; padding: 10px;">🔄 刷新实时数据</button>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">短码</th>
              <th style="text-align: left;">原始链接</th>
              <th>今日</th>
              <th>本周</th>
              <th>本月</th>
              <th>累计</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody id="statsBody">
            <tr><td colspan="7" style="text-align:center;">暂无数据</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    let sessionPassword = "";

    async function verifyPassword() {
      const pwdInput = document.getElementById('modalPwd').value;
      const loginResult = document.getElementById('loginResult');
      const verifyBtn = document.getElementById('verifyBtn');

      if (!pwdInput.trim()) return loginResult.innerHTML = '<span class="error">密码不能为空</span>';

      verifyBtn.disabled = true; verifyBtn.innerText = '验证中...';

      try {
        const response = await fetch('/api/verify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwdInput })
        });

        if (response.ok) {
          sessionPassword = pwdInput;
          document.getElementById('loginOverlay').style.display = 'none';
          document.getElementById('mainContainer').style.display = 'block';
          document.getElementById('longUrl').focus();
        } else {
          loginResult.innerHTML = '<span class="error">密码错误</span>';
        }
      } catch (err) {
        loginResult.innerHTML = '<span class="error">网络异常</span>';
      } finally {
        verifyBtn.disabled = false; verifyBtn.innerText = '进入系统';
      }
    }

    async function shorten() {
      const urlInput = document.getElementById('longUrl').value;
      const resultDiv = document.getElementById('result');
      if (!urlInput.trim()) return resultDiv.innerHTML = '<span class="error">请输入链接！</span>';

      resultDiv.innerHTML = '生成中...';
      try {
        const response = await fetch('/api/shorten', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlInput, password: sessionPassword })
        });
        const data = await response.json();
        if (response.ok) {
          resultDiv.innerHTML = '<span class="success">✅ 生成成功：</span><br><br><a href="' + data.shortUrl + '" target="_blank"><strong>' + data.shortUrl + '</strong></a>';
          document.getElementById('longUrl').value = '';
          loadStats(); 
        } else {
          resultDiv.innerHTML = '<span class="error">错误: ' + data.error + '</span>';
        }
      } catch (err) {
        resultDiv.innerHTML = '<span class="error">网络请求失败</span>';
      }
    }

    async function loadStats() {
      const tbody = document.getElementById('statsBody');
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">加载中...</td></tr>';
      try {
        const response = await fetch('/api/stats', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: sessionPassword })
        });
        if (response.ok) {
          const stats = await response.json();
          if (stats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">暂无数据</td></tr>';
            return;
          }
          let html = '';
          const currentOrigin = window.location.origin;
          stats.forEach(item => {
            const date = item.created_at ? new Date(item.created_at).toLocaleString('zh-CN', {month:'numeric', day:'numeric'}) : '-';
            html += \`
              <tr>
                <td style="text-align: left;"><a href="\${currentOrigin}/\${item.shortCode}" target="_blank">\${item.shortCode}</a></td>
                <td class="url-cell" title="\${item.longUrl}">\${item.longUrl}</td>
                <td><span class="badge badge-today">\${item.todayClicks}</span></td>
                <td><span class="badge badge-week">\${item.weekClicks}</span></td>
                <td><span class="badge badge-month">\${item.monthClicks}</span></td>
                <td><span class="badge badge-total">\${item.clicks}</span></td>
                <td style="color:#666; font-size:12px;">\${date}</td>
              </tr>
            \`;
          });
          tbody.innerHTML = html;
        } else {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">数据加载失败</td></tr>';
        }
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">网络错误</td></tr>';
      }
    }

    function switchTab(tab) {
      document.getElementById('tab-create').classList.remove('active');
      document.getElementById('tab-stats').classList.remove('active');
      document.getElementById('content-create').classList.remove('active');
      document.getElementById('content-stats').classList.remove('active');

      document.getElementById('tab-' + tab).classList.add('active');
      document.getElementById('content-' + tab).classList.add('active');

      if (tab === 'stats') loadStats();
    }

    document.getElementById('modalPwd').addEventListener('keypress', e => { if (e.key === 'Enter') verifyPassword(); });
    document.getElementById('longUrl').addEventListener('keypress', e => { if (e.key === 'Enter') shorten(); });
  </script>
</body>
</html>
`;
