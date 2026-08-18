/* 网络测试工具箱 V9.0 — 前端逻辑 */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---- 页面定义 ----
const PAGES = {
  dashboard:  { title: '工作台',   render: renderDashboard },
  health:     { title: '网络健康检查', render: renderHealth },
  ping:       { title: 'Ping 测试',  render: renderPing },
  traceroute: { title: '路由追踪',  render: renderTraceroute },
  portscan:   { title: '端口扫描',  render: renderPortscan },
  hosts:      { title: '主机发现',  render: renderHosts },
  sessions:   { title: '会话数测试', render: renderSessions },
  speedtest:  { title: '外网测速',  render: renderSpeedtest },
  lanspeed:   { title: '内网(网关)测速', render: renderLanSpeed },
  dhcp:       { title: 'DHCP 检测', render: renderDhcp },
  ipconflict: { title: 'IP冲突检测', render: renderIpConflict },
  camscan:    { title: '摄像头扫描', render: renderCamscan },
  packet:     { title: '协议分析/抓包', render: renderPacket },
  wifi:       { title: 'WiFi 分析', render: renderWifi },
  logs:       { title: '日志审计', render: renderLogs },
  firewall:   { title: '防火墙配置', render: renderFirewall },
  remote:     { title: '远程工具', render: renderRemote },
  devcmds:    { title: '运维百宝箱', render: renderDevCmds },
  elec:       { title: '弱电计算', render: renderElec },
  route:      { title: '路由表', render: renderRoute },
  portmap:    { title: '端口映射', render: renderPortmap },
  wol:        { title: 'WOL 网络唤醒', render: renderWol },
  ups:        { title: 'UPS 监控', render: renderUps },
  serial:     { title: '串口工具', render: renderSerial },
  aichat:     { title: 'AI 运维助手', render: renderAiChat },
  wifipwd:    { title: 'WiFi 信息', render: renderWifiPwd },
  subnet:     { title: '子网计算',  render: renderSubnet },
  mac:        { title: 'IP/MAC 查询', render: renderMac },
  about:      { title: '关于和支持', render: renderAbout },
};
let currentPage = 'dashboard';
let dashTimer = null;

// ---- 导航 ----
function initNav() {
  $$('.nav-item').forEach(btn => {
    btn.onclick = () => switchPage(btn.dataset.page);
  });
}
function switchPage(page) {
  currentPage = page;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('#page-title').textContent = PAGES[page].title;
  if (dashTimer) { clearInterval(dashTimer); dashTimer = null; }
  PAGES[page].render();
}
function refreshCurrent() { PAGES[currentPage].render(); }
function setContent(html) { $('#content').innerHTML = html; }

// ---- 通用 fetch ----
async function api(url, opts={}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ================= 工作台 =================
async function renderDashboard() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在采集工作台数据...</div>');
  let first = true;
  const load = async () => {
    try {
      const d = await api('/api/dashboard');
      if (first) { buildDashboard(d); first = false; }
      else refreshDashValues(d);
    } catch (e) {
      if (first) $('#content').innerHTML = `<div class="notice red">工作台数据获取失败：${esc(e.message)}</div>`;
    }
  };
  await load();
  if (dashTimer) clearInterval(dashTimer);
  dashTimer = setInterval(load, 5000);
}

// 只更新数值不重建页面（保持图表稳定）
function refreshDashValues(d) {
  setGauge('cpuG', d.cpu); setGauge('memG', d.mem_pct); setGauge('diskG', d.disk.used_pct ?? 0);
  const els = {
    '#connEst': [d.connections.established], '#connListen': [d.connections.listening], '#connTotal': [d.connections.total],
  };
  const m1 = document.getElementById('memUsed'); if (m1) m1.textContent = `${d.mem_used_gb.toFixed(1)} GB (${d.mem_pct}%)`;
  const m2 = document.getElementById('diskUsed'); if (m2) m2.textContent = `${d.disk.used_gb ?? '—'} GB (${d.disk.used_pct ?? '—'}%)`;
  const m3 = document.getElementById('cpuUse'); if (m3) m3.textContent = `${d.cpu}%`;
}

function buildDashboard(d) {
  const cpuG = gaugeSVG('cpuG', d.cpu, 0, 100, '#38bdf8');
  const memG = gaugeSVG('memG', d.mem_pct, 0, 100, '#34d399');
  const diskG = gaugeSVG('diskG', d.disk.used_pct ?? 0, 0, 100, '#fbbf24');
  const states = Object.entries(d.tcp_states || {}).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxSt = Math.max(...states.map(s=>s[1]), 1);
  const ifaces = (d.ifaces || []).slice(0,6);
  setContent(`
  <div class="dash-top">
    <div class="gauge-row">
      <div class="gauge">${cpuG}<div class="g-val">${d.cpu}%</div><div class="g-label">CPU 使用率</div></div>
      <div class="gauge">${memG}<div class="g-val">${d.mem_pct}%</div><div class="g-label">内存使用率</div></div>
      <div class="gauge">${diskG}<div class="g-val">${d.disk.used_pct ?? '—'}%</div><div class="g-label">磁盘占用</div></div>
      <div class="gauge traffic-g">
        <div class="big-num" style="font-size:22px">${fmtBps(d.rx_bps)}</div>
        <div class="g-sub" style="color:var(--green)">▼ 下行</div>
        <div class="big-num" style="font-size:22px;color:var(--green)">${fmtBps(d.tx_bps)}</div>
        <div class="g-sub">▲ 上行</div>
        <div class="g-label">实时流量 (en0)</div>
      </div>
    </div>
    <div class="conn-mini">
      <div class="mini-stat"><span class="mini-num">${d.connections.established}</span><span class="mini-lbl">ESTABLISHED</span></div>
      <div class="mini-stat"><span class="mini-num">${d.connections.listening}</span><span class="mini-lbl">LISTEN</span></div>
      <div class="mini-stat"><span class="mini-num">${d.connections.total}</span><span class="mini-lbl">总连接</span></div>
      <div class="mini-stat"><span class="mini-num">${d.disk.used_gb ?? '—'}</span><span class="mini-lbl">磁盘已用GB</span></div>
    </div>
  </div>
  <div class="grid">
    <div class="card"><h3>🏠 本机信息</h3>
      <div class="kv"><span class="k">主机名</span><span class="v">${esc(d.hostname)}</span></div>
      <div class="kv"><span class="k">局域网 IP</span><span class="v">${d.lan_ip}</span></div>
      <div class="kv"><span class="k">MAC 地址</span><span class="v">${d.mac}</span></div>
      <div class="kv"><span class="k">网关</span><span class="v">${d.gateway}</span></div>
      <div class="kv"><span class="k">DNS 服务器</span><span class="v">${(d.dns||[]).join(', ')}</span></div>
      <div class="kv"><span class="k">系统</span><span class="v">macOS</span></div>
      <div class="kv"><span class="k">运行时间</span><span class="v">${d.uptime}</span></div>
    </div>
    <div class="card"><h3>💾 系统资源</h3>
      <div class="kv"><span class="k">内存总量</span><span class="v">${d.mem_total_gb.toFixed(1)} GB</span></div>
      <div class="kv"><span class="k">已用内存</span><span class="v">${d.mem_used_gb.toFixed(1)} GB (${d.mem_pct}%)</span></div>
      <div class="kv"><span class="k">磁盘总量</span><span class="v">${d.disk.total_gb ?? '—'} GB</span></div>
      <div class="kv"><span class="k">磁盘已用</span><span class="v">${d.disk.used_gb ?? '—'} GB (${d.disk.used_pct ?? '—'}%)</span></div>
      <div class="bar"><div class="bar-fill" style="width:${d.mem_pct}%;background:var(--green)"></div></div>
      <div class="bar"><div class="bar-fill" style="width:${(d.disk.used_pct ?? 0)}%;background:var(--yellow)"></div></div>
      <div class="kv"><span class="k">CPU 负载</span><span class="v">${d.cpu}%</span></div>
      <div class="bar"><div class="bar-fill" style="width:${d.cpu}%;background:var(--accent)"></div></div>
    </div>
    <div class="card"><h3>🔌 网络接口</h3>
      ${ifaces.length ? `<table>
        <tr><th>接口</th><th>IP</th><th>状态</th></tr>
        ${ifaces.map(i => `<tr><td style="font-family:monospace">${i.name}</td><td style="font-family:monospace">${i.ip}</td><td><span class="badge ${i.status === 'up' ? 'ok' : 'fail'}">${i.status}</span></td></tr>`).join('')}
      </table>` : '<div class="kv"><span class="k">无接口数据</span></div>'}
    </div>
    <div class="card"><h3>🔗 TCP 状态分布</h3>
      <div class="bar-list">${states.map(s => `<div class="kv"><span class="k" style="font-family:monospace">${s[0]}</span><div class="bar" style="flex:1;margin-left:8px"><div class="bar-fill" style="width:${Math.max(4, s[1]/maxSt*100)}%;background:${s[0]==='ESTABLISHED' ? 'var(--green)' : s[0]==='LISTEN' ? 'var(--accent)' : 'var(--dim)'}"></div></div><span class="v" style="width:30px">${s[1]}</span></div>`).join('') || '<span class="dim">无数据</span>'}
      </div>
    </div>
    <div class="card"><h3>📊 历史流量趋势</h3><div id="trafficChart" class="chart">采集数据中…</div><div style="display:flex;gap:14px;margin-top:6px"><span style="font-size:11px;color:var(--dim)">最后 <span id="trafficInfo">—</span></span></div></div>
    <div class="card"><h3>🔔 通知消息</h3>
      <div id="notifyBox">
        <div class="notice green">✔ 系统运行正常 · 网关 ${d.gateway} 可达</div>
        <div class="notice yellow">💡 提示：定时备份交换机配置于每周日凌晨 3:00</div>
        <div class="notice yellow">📶 WiFi：${(d.ifaces||[]).some(i=>i.name.startsWith('en') && i.status==='up') ? '无线接口活跃' : '当前以太网连接'}</div>
      </div>
    </div>
  </div>`);
  requestAnimationFrame(() => {
    setGauge('cpuG', d.cpu); setGauge('memG', d.mem_pct); setGauge('diskG', d.disk.used_pct ?? 0);
  });
  startTrafficChart();
}

function gaugeSVG(id, val, min, max, color) {
  const r = 48, c = 2 * Math.PI * r;
  return `
  <svg viewBox="0 0 120 120" id="${id}">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="#22303f" stroke-width="9"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="9"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" id="${id}Arc"/>
  </svg>`;
}
function setGauge(id, val) {
  const arc = document.getElementById(id + 'Arc');
  if (!arc) return;
  const r = 48, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, val)) / 100);
  arc.style.transition = 'stroke-dashoffset .6s ease';
  arc.style.strokeDashoffset = off;
}
function fmtBps(b) { return b >= 1048576 ? (b/1048576).toFixed(2)+' MB/s' : (b/1024).toFixed(1)+' KB/s'; }

// 历史流量趋势（本地采集绘图）
let trafficHist = [];
async function startTrafficChart() {
  trafficHist = [];
  const chart = () => {
    const el = document.getElementById('trafficChart');
    if (!el) return;
    if (trafficHist.length < 2) {
      el.innerHTML = '<div class="loading" style="padding:30px">采集流量样本中…</div>';
      return;
    }
    const W = el.clientWidth || 300, H = 110, pad = 6;
    const maxV = Math.max(...trafficHist.map(p => Math.max(p.rx, p.tx)), 1024);
    const step = (W - pad*2) / (trafficHist.length - 1);
    const pts = (key, color) => trafficHist.map((p,i) => `${(pad + i*step).toFixed(1)},${(H - pad - (p[key]/maxV)*(H-pad*2)).toFixed(1)}`).join(' ');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
      <polyline points="${pts('rx','#38bdf8')}" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
      <polyline points="${pts('tx','#34d399')}" fill="none" stroke="#34d399" stroke-width="1.5"/>
      ${trafficHist.map((p,i) => `<circle cx="${(pad + i*step).toFixed(1)}" cy="${(H - pad - (p.rx/maxV)*(H-pad*2)).toFixed(1)}" r="1.5" fill="#38bdf8"/>`).join('')}
    </svg>`;
    const last = trafficHist[trafficHist.length - 1];
    const info = document.getElementById('trafficInfo');
    if (info) info.textContent = `RX:${fmtBps(last.rx)} / TX:${fmtBps(last.tx)} · ${trafficHist.length*5}秒窗口`;
  };
  const poll = async () => {
    try {
      const d = await api('/api/dashboard');
      trafficHist.push({ rx: d.rx_bps, tx: d.tx_bps });
      if (trafficHist.length > 40) trafficHist.shift();
      chart();
    } catch (e) {}
  };
  await poll();
  window._trafficTimer = setInterval(poll, 5000);
  switchPage = switchPage; // noop
}
// 覆盖 switchPage 清理定时器
const _origSwitchPage2 = typeof switchPage === 'function' ? switchPage : null;
if (typeof switchPage === 'function') {
  const _orig = switchPage;
  switchPage = function(page) {
    if (window._trafficTimer) { clearInterval(window._trafficTimer); window._trafficTimer = null; }
    if (window._pktTimer) { clearInterval(window._pktTimer); window._pktTimer = null; }
    _orig(page);
  };
}

// ================= 网络健康检查 =================
function renderHealth() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在执行健康检查（约 8 秒）...</div>');
  api('/api/health').then(h => {
    const levelColor = h.level === '优秀' ? 'green' : h.level === '良好' ? 'blue' : h.level === '一般' ? 'yellow' : 'red';
    const ringR = 54, ringC = 2 * Math.PI * ringR;
    const badCount = h.checks.filter(c=>!c.ok).length;
    setContent(`
    <div class="health-top">
      <div class="score-card">
        <svg viewBox="0 0 140 140" style="width:140px;height:140px;transform:rotate(-90deg)">
          <circle cx="70" cy="70" r="${ringR}" fill="none" stroke="#22303f" stroke-width="10"/>
          <circle id="scoreArc" cx="70" cy="70" r="${ringR}" fill="none" stroke="${h.score >= 90 ? '#34d399' : h.score >= 70 ? '#fbbf24' : '#f87171'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${ringC}" stroke-dashoffset="${ringC}"/>
        </svg>
        <div style="position:relative;margin-top:-100px;text-align:center">
          <div style="font-size:34px;font-weight:800;font-family:monospace">${h.score}</div>
          <span class="badge ${h.score >= 90 ? 'ok' : h.score >= 70 ? 'warn' : 'fail'}">${h.level}</span>
        </div>
        <div style="text-align:center;margin-top:16px" class="g-label">健康评分 (${badCount ? badCount + ' 项异常' : '全部正常'})</div>
      </div>
      <div class="health-stats" id="healthStats">
        <div class="mini-stat"><span class="mini-num">${h.checks.length}</span><span class="mini-lbl">检查项</span></div>
        <div class="mini-stat"><span class="mini-num" style="color:var(--green)">${h.checks.length - badCount}</span><span class="mini-lbl">正常</span></div>
        <div class="mini-stat"><span class="mini-num" style="color:${badCount ? 'var(--red)' : 'var(--dim)'}">${badCount}</span><span class="mini-lbl">异常</span></div>
        <div class="mini-stat"><span class="mini-num">${h.gateway}</span><span class="mini-lbl">检测网关</span></div>
      </div>
    </div>
    <div class="card" style="max-width:760px;margin-top:14px">
      <h3>检查明细</h3>
      <table>
        <tr><th>检查项</th><th>目标</th><th>结果</th><th>状态</th></tr>
        ${h.checks.map(c => `<tr>
          <td>${esc(c.name)}</td><td style="font-family:monospace">${esc(c.target)}</td><td>${esc(c.detail)}</td>
          <td>${c.ok ? '<span class="badge ok">✔ 正常</span>' : '<span class="badge fail">✘ 异常</span>'}</td>
        </tr>`).join('')}
      </table>
      <div class="notice ${h.score >= 90 ? 'green' : h.score >= 60 ? 'yellow' : 'red'}" style="margin-top:12px">
        ${badCount ? `发现 ${badCount} 项异常：${h.checks.filter(c=>!c.ok).map(c=>c.name).join('、')}。请检查对应设备/线路。` : '所有检查项通过，网络状态优秀。'}
      </div>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn-main" onclick="renderHealth()">🔄 重新检测</button>
        <button class="btn-refresh" onclick="location.href='/api/health'" style="padding:9px 18px;font-size:13px;border-radius:6px;border:1px solid var(--border);background:var(--panel2);color:var(--text);cursor:pointer">查看原始 JSON</button>
      </div>
    </div>`);
    requestAnimationFrame(() => {
      const arc = document.getElementById('scoreArc');
      if (arc) arc.style.transition = 'stroke-dashoffset 1s ease';
      setTimeout(() => { if (arc) arc.style.strokeDashoffset = ringC * (1 - h.score/100); }, 50);
    });
  }).catch(e => setContent(`<div class="notice red">健康检查失败：${esc(e.message)}</div>`));
}

// ================= Ping 测试 =================
let pingHistory = [];
function renderPing() {
  pingHistory = [];
  setContent(`
  <div class="card" style="max-width:860px">
    <div class="form-row">
      <div class="field"><label>目标地址</label><input id="pingHost" value="223.5.5.5" placeholder="IP 或域名"></div>
      <div class="field"><label>次数</label><input id="pingCount" value="8" style="width:70px"></div>
      <div class="field"><label>包大小(字节)</label><input id="pingSize" value="32" style="width:80px"></div>
      <button class="btn-main" id="pingBtn">开始 Ping</button>
      <button class="btn-refresh" onclick="pingAgain()">↻ 重复上次</button>
    </div>
    <div id="pingOut"></div>
  </div>`);
  window.pingAgain = () => { if (window._lastPing) pingRun(window._lastPing.host, window._lastPing.count, window._lastPing.size); };
  const pingRun = async (host, count, size) => {
    const btn = $('#pingBtn'); btn.disabled = true;
    host = host || $('#pingHost').value.trim() || '223.5.5.5';
    count = count || Math.min(parseInt($('#pingCount').value) || 4, 20);
    size = size || Math.min(parseInt($('#pingSize').value) || 32, 1400);
    window._lastPing = { host, count, size };
    $('#pingOut').innerHTML = '<div class="loading">Pinging ' + esc(host) + ' ...</div>';
    try {
      const r = await api('/api/ping', { method: 'POST', body: JSON.stringify({ host, count, size }) });
      const s = r.summary;
      pingHistory.push({ host, time: new Date().toLocaleTimeString(), avg: s.avg_ms, loss: s.loss_pct });
      if (pingHistory.length > 20) pingHistory.shift();
      const chartHTML = s.received > 0 ? sparkline(r.results.map(x=>x.time_ms)) : '';
      $('#pingOut').innerHTML = `
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));margin-bottom:12px">
          <div class="card"><div class="big-num">${s.avg_ms ?? '—'}<small> ms</small></div><div class="kv"><span class="k">平均延迟</span></div></div>
          <div class="card"><div class="big-num" style="color:${s.loss_pct > 0 ? 'var(--red)' : 'var(--green)'}">${s.loss_pct ?? 100}%<small> 丢包</small></div><div class="kv"><span class="k">${s.received}/${s.sent} 收到</span></div></div>
          <div class="card"><div class="big-num">${s.min_ms ?? '—'}<small> ms</small></div><div class="kv"><span class="k">最小</span></div></div>
          <div class="card"><div class="big-num">${s.max_ms ?? '—'}<small> ms</small></div><div class="kv"><span class="k">最大</span></div></div>
        </div>
        ${chartHTML ? `<div class="card" style="margin-bottom:12px"><h3>📈 延迟波动图</h3>${chartHTML}</div>` : ''}
        <div class="result-box">${esc(r.raw)}</div>
        ${pingHistory.length > 1 ? `<div class="card" style="margin-top:12px"><h3>📋 Ping 历史记录</h3><table><tr><th>时间</th><th>目标</th><th>平均延迟</th><th>丢包</th></tr>${[...pingHistory].reverse().map(h=>`<tr><td>${h.time}</td><td style="font-family:monospace">${esc(h.host)}</td><td>${h.avg ?? '—'} ms</td><td>${h.loss ?? 100}%</td></tr>`).join('')}</table></div>` : ''}`;
    } catch (e) {
      $('#pingOut').innerHTML = `<div class="notice red">Ping 失败：${esc(e.message)}</div>`;
    }
    btn.disabled = false;
  };
  $('#pingBtn').onclick = () => pingRun();
  window.pingRun = pingRun;
}

function sparkline(vals) {
  if (!vals.length) return '';
  const W = 500, H = 100, pad = 8;
  const maxV = Math.max(...vals) || 1, minV = 0;
  const step = (W - pad*2) / (vals.length - 1);
  const pts = vals.map((v,i) => `${(pad + i*step).toFixed(1)},${(H - pad - ((v-minV)/(maxV-minV))*(H-pad*2)).toFixed(1)}`).join(' ');
  const avg = (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;background:#0d1420;border-radius:8px">
    ${vals.map((v,i) => `<line x1="${pad + i*step}" y1="${H-pad}" x2="${pad + i*step}" y2="${H-pad-(v/maxV)*(H-pad*2)}" stroke="#22303f" stroke-width="1"/>`).join('')}
    <polyline points="${pts}" fill="none" stroke="#38bdf8" stroke-width="2"/>
    <line x1="${pad}" y1="${H - pad - (avg/maxV)*(H-pad*2)}" x2="${W-pad}" y2="${H - pad - (avg/maxV)*(H-pad*2)}" stroke="#34d399" stroke-width="1" stroke-dasharray="4 4"/>
    <circle cx="${pad + (vals.length-1)*step}" cy="${H - pad - (vals[vals.length-1]/maxV)*(H-pad*2)}" r="3" fill="#38bdf8"/>
  </svg>`;
}

// ================= 路由追踪 =================
function renderTraceroute() {
  setContent(`
  <div class="card" style="max-width:720px">
    <div class="form-row">
      <div class="field"><label>目标地址</label><input id="trHost" value="223.5.5.5" placeholder="IP 或域名"></div>
      <button class="btn-main" id="trBtn">开始追踪</button>
    </div>
    <div id="trOut"></div>
  </div>`);
  $('#trBtn').onclick = async () => {
    const btn = $('#trBtn'); btn.disabled = true;
    const host = $('#trHost').value.trim() || '223.5.5.5';
    $('#trOut').innerHTML = '<div class="loading">traceroute to ' + esc(host) + ' ...（最多 20 跳，约 30 秒）</div>';
    try {
      const r = await api('/api/traceroute', { method: 'POST', body: JSON.stringify({ host }) });
      $('#trOut').innerHTML = `
        <table>
          <tr><th>跳数</th><th>节点</th></tr>
          ${r.hops.length ? r.hops.map(h => `<tr><td>${h.hop}</td><td style="font-family:monospace;white-space:pre-wrap">${esc(h.text)}</td></tr>`).join('') : '<tr><td colspan="2">无结果</td></tr>'}
        </table>
        ${r.hops.length === 0 ? `<div class="result-box" style="margin-top:10px">${esc(r.raw)}</div>` : ''}`;
    } catch (e) {
      $('#trOut').innerHTML = `<div class="notice red">追踪失败：${esc(e.message)}</div>`;
    }
    btn.disabled = false;
  };
  $('#trBtn').click();
}

// ================= 端口扫描 =================
function renderPortscan() {
  setContent(`
  <div class="card" style="max-width:760px">
    <div class="form-row">
      <div class="field"><label>目标主机</label><input id="psHost" value="127.0.0.1" style="width:140px"></div>
      <div class="field"><label>端口(逗号/范围)</label><input id="psPorts" value="21,22,53,80,443,3306,3389,8080,8888" style="width:240px"></div>
      <button class="btn-main" id="psBtn">开始扫描</button>
    </div>
    <div id="psOut"></div>
  </div>`);
  $('#psBtn').onclick = async () => {
    const btn = $('#psBtn'); btn.disabled = true;
    const host = $('#psHost').value.trim() || '127.0.0.1';
    const ports = $('#psPorts').value.trim() || '21,22,53,80,443';
    $('#psOut').innerHTML = '<div class="loading">扫描 ' + esc(host) + ' ...</div>';
    try {
      const r = await api('/api/portscan', { method: 'POST', body: JSON.stringify({ host, ports }) });
      $('#psOut').innerHTML = `
        <div class="notice ${r.open.length ? 'yellow' : 'green'}">共扫描 ${r.scanned} 个端口，开放 ${r.open.length} 个，关闭 ${r.closed} 个</div>
        <table style="margin-top:10px">
          <tr><th>端口</th><th>服务</th></tr>
          ${r.open.length ? r.open.map(p => `<tr><td style="font-family:monospace;color:var(--green)">${p.port}</td><td>${esc(p.service) || '未知'}</td></tr>`).join('') : '<tr><td colspan="2">未发现开放端口</td></tr>'}
        </table>`;
    } catch (e) {
      $('#psOut').innerHTML = `<div class="notice red">扫描失败：${esc(e.message)}</div>`;
    }
    btn.disabled = false;
  };
  $('#psBtn').click();
}

// ================= 主机发现 =================
function renderHosts() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在读取 ARP 表...</div>');
  api('/api/hosts').then(r => {
    const macs = r.hosts.map(h => h.mac);
    const uniqMacs = new Set(macs);
    const vendors = r.hosts.map(h => macVendor(h.mac)).reduce((acc, v) => { acc[v] = (acc[v]||0)+1; return acc; }, {});
    const vendorList = Object.entries(vendors).sort((a,b)=>b[1]-a[1]);
    setContent(`
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));margin-bottom:14px">
      <div class="card"><div class="big-num">${r.total}</div><div class="kv"><span class="k">发现主机</span></div></div>
      <div class="card"><div class="big-num" style="color:var(--green)">${r.hosts.filter(h=>!h.is_self).length}</div><div class="kv"><span class="k">其他设备</span></div></div>
      <div class="card"><div class="big-num" style="color:var(--accent)">${uniqMacs.size}</div><div class="kv"><span class="k">唯一 MAC</span></div></div>
      <div class="card"><div class="big-num">${vendorList.length}</div><div class="kv"><span class="k">设备厂商类型</span></div></div>
    </div>
    <div class="grid" style="margin-bottom:14px">
      <div class="card"><h3>厂商分布</h3>
        ${vendorList.map(([v,c]) => `<div class="kv"><span class="k">${esc(v)}</span><div class="bar" style="flex:1;margin-left:8px"><div class="bar-fill" style="width:${c/r.total*100}%;background:${v==='未知'?'var(--dim)':'var(--accent)'}"></div></div><span class="v" style="width:20px">${c}</span></div>`).join('')}
      </div>
      <div class="card"><h3>操作</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          <button class="btn-refresh" onclick="pingSweep()">📡 全网段 Ping 发现</button>
          <button class="btn-refresh" onclick="location.href='/api/hosts'">原始 JSON</button>
          <button class="btn-refresh" onclick="renderHosts()">🔄 刷新</button>
        </div>
        <div id="sweepOut" class="result-box" style="margin-top:10px;display:none"></div>
      </div>
    </div>
    <div class="card" style="max-width:960px">
      <h3>主机列表</h3>
      <table>
        <tr><th>IP 地址</th><th>MAC 地址</th><th>接口</th><th>厂商推测</th><th>备注</th><th>操作</th></tr>
        ${r.hosts.length ? r.hosts.map((h,i) => `<tr><td style="font-family:monospace">${h.ip}</td><td style="font-family:monospace">${h.mac}</td><td>${esc(h.iface)}</td><td>${esc(macVendor(h.mac))}</td><td>${h.is_self ? '<span class="badge ok">本机</span>' : ''}</td>
        <td>${h.is_self ? '' : `<button class="btn-refresh" style="padding:2px 8px;font-size:11px" onclick="quickPing('${h.ip}','${i}')">Ping</button> <button class="btn-refresh" style="padding:2px 8px;font-size:11px" onclick="quickScan('${h.ip}','${i}')">扫端口</button>`}</td></tr>`).join('') : '<tr><td colspan="6">ARP 表为空，可先 Ping 网关或做一次全网段扫描</td></tr>'}
      </table>
      <div class="notice yellow">💡 提示：ARP 表只显示近期通信过的主机。点「全网段 Ping 发现」可扩充列表。</div>
    </div>`);
    window.pingSweep = async () => {
      const box = document.getElementById('sweepOut');
      box.style.display = 'block';
      box.innerHTML = '开始全网段 Ping 探测（本网段地址较多，演示模式扫描核心设备）...\n';
      const gw = (r.hosts.find(h=>h.ip.endsWith('.1')) || {ip:'网关'}).ip;
      const targets = ['192.168.112.1','192.168.112.17','192.168.112.37','192.168.112.42','192.168.112.84','192.168.112.100','192.168.112.200'];
      let found = 0;
      for (const t of targets) {
        try {
          const p = await api('/api/ping', { method: 'POST', body: JSON.stringify({ host: t, count: 1, size: 32 }) });
          const alive = (p.summary.loss_pct ?? 100) < 100;
          box.innerHTML += (alive ? '✔  ' : '✘  ') + t + (alive ? ' 存活' : ' 无响应') + '\n';
          if (alive) found++;
        } catch(e) { box.innerHTML += '✘ ' + t + ' 错误\n'; }
      }
      box.innerHTML += `\n探测完成：${found}/${targets.length} 台存活（演示扫描示例）`;
    };
    window.quickPing = (ip, i) => {
      const btn = event.target; btn.textContent = 'Pinging...';
      api('/api/ping', { method: 'POST', body: JSON.stringify({ host: ip, count: 3, size: 32 }) }).then(p => {
        btn.textContent = (p.summary.loss_pct ?? 100) < 100 ? `✔ ${p.summary.min_ms}ms` : '✘ 无响应';
      }).catch(()=>{ btn.textContent = '失败'; });
    };
    window.quickScan = (ip, i) => {
      const btn = event.target; btn.textContent = '扫描中...';
      api('/api/portscan', { method: 'POST', body: JSON.stringify({ host: ip, ports: '22,80,443,3389,8080' }) }).then(p => {
        btn.textContent = p.open.length ? `开放${p.open.length}个` : '无开放';
        alert(`${ip} 开放端口: ${p.open.map(x=>x.port).join(', ') || '无'}`);
      }).catch(()=>{ btn.textContent = '失败'; });
    };
  }).catch(e => setContent(`<div class="notice red">主机发现失败：${esc(e.message)}</div>`));
}

function macVendor(mac) {
  const oui = (mac||'').replace(/:/g,'').toUpperCase().slice(0,6);
  const O = {
    '000C29':'VMware', '5CFBEF': 'TP-LINK', '50C7BF': 'TP-LINK', 'F8FFC2': 'TP-LINK',
    'D4CA6D': '锐捷', 'D4C9EF': '锐捷', '28D126': 'H3C', '5C9E08': 'H3C',
    'F4F95D': '华为', 'A0B87E': '华为', '28FAA0': '华为', 'CC34D6': '华为', 'B4542F': '华为',
    'C4E984': 'Apple', 'A4B199': 'Apple', '3CF011': 'Apple', 'F0C1F1': 'Apple', 'E0C767': 'Apple',
    'DC2B2A': '小米', '640980': '小米', 'F0B429': '小米', '68DFDD': '小米',
    'D8C7C8': '联想', 'A08869': '联想', '38F8B7': 'Dell', 'B8CA3A': 'Dell',
    '803F5D': '海康威视', 'A49B13': '海康威视', '50E549': '海康威视',
    '3CDA07': '大华', '9CA10A': '大华', '78019B': '大华', '0012D1': '大华',
    'F4F1E1': 'Unifi', 'F06E0B': 'Unifi', 'E46D30': '中兴', '640F28': '中兴',
    '18DED7': 'Intel', 'D4EE07': 'Intel', 'C8D7B0': 'Intel', '005056': 'VMware',
  };
  return O[oui] || '未知';
}

// ================= 会话数测试 =================
function renderSessions() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在统计 TCP 会话...</div>');
  const load = async () => {
    try {
      const r = await api('/api/sessions');
      $('#sessOut').innerHTML = `
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
          <div class="card"><div class="big-num">${r.total}</div><div class="kv"><span class="k">TCP 总会话</span></div></div>
          <div class="card"><div class="big-num" style="color:var(--green)">${r.established}</div><div class="kv"><span class="k">已建立</span></div></div>
          <div class="card"><div class="big-num" style="color:var(--blue)">${r.listening}</div><div class="kv"><span class="k">监听中</span></div></div>
        </div>`;
    } catch (e) { $('#sessOut').innerHTML = `<div class="notice red">统计失败：${esc(e.message)}</div>`; }
  };
  setContent(`
  <div class="card" style="max-width:720px">
    <button class="btn-main" style="margin-bottom:14px" onclick="loadSessions()">🔁 重新统计</button>
    <div id="sessOut"><div class="loading">统计中...</div></div>
    <div class="notice green" style="margin-top:14px">会话数测试用于检测当前设备的网络连接负载，连接数过多说明可能有异常程序或攻击。</div>
  </div>`);
  window.loadSessions = load;
  load();
}

// ================= 外网测速 =================
let speedHistory = [];
function renderSpeedtest() {
  setContent(`
  <div class="card" style="max-width:860px">
    <div class="form-row">
      <div class="field"><label>测速源</label>
        <select id="stSource">
          <option value="cloudflare">Cloudflare (国际)</option>
          <option value="ustc">中科大镜像 (国内)</option>
          <option value="aliyun">阿里云镜像 (国内)</option>
        </select>
      </div>
      <button class="btn-main" id="stBtn">🚀 开始测速</button>
    </div>
    <div style="margin-bottom:14px;position:relative;text-align:center">
      <svg viewBox="0 0 220 120" style="width:300px;max-width:100%">
        <path d="M 20 105 A 95 95 0 0 1 200 105" fill="none" stroke="#22303f" stroke-width="12" stroke-linecap="round"/>
        <path id="speedArc" d="M 20 105 A 95 95 0 0 1 200 105" fill="none" stroke="url(#grad)" stroke-width="12" stroke-linecap="round" stroke-dasharray="298" stroke-dashoffset="298" style="transition:stroke-dashoffset 1.2s ease"/>
        <defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#34d399"/></linearGradient></defs>
        <text x="110" y="60" text-anchor="middle" id="speedVal" fill="#dbe6f0" font-size="26" font-weight="bold" font-family="monospace">--</text>
        <text x="110" y="80" text-anchor="middle" fill="#7d93a8" font-size="11">Mbps</text>
      </svg>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))" id="stResult">
      <div class="card"><div class="big-num" style="font-size:20px">准备就绪</div><div class="kv"><span class="k">状态</span></div></div>
      <div class="card"><div class="big-num" style="font-size:20px">—</div><div class="kv"><span class="k">下载量</span></div></div>
      <div class="card"><div class="big-num" style="font-size:20px">—</div><div class="kv"><span class="k">耗时</span></div></div>
      <div class="card"><div class="big-num" style="font-size:20px">—</div><span class="k">平均速度</span></div>
    </div>
    <div id="stLog" style="margin-top:14px;display:none" class="card"><h3>测速日志</h3><div id="stLogBox" class="result-box" style="max-height:150px"></div></div>
    ${speedHistory.length ? `<div class="card" style="margin-top:12px"><h3>📋 历史测速记录</h3><table><tr><th>时间</th><th>测速源</th><th>速度</th><th>下载量</th></tr>${[...speedHistory].reverse().map(h=>`<tr><td>${h.time}</td><td>${esc(h.src)}</td><td style="color:var(--accent);font-weight:700">${h.mbps} Mbps</td><td>${h.mb} MB</td></tr>`).join('')}</table></div>` : ''}
  </div>`);
  $('#stBtn').onclick = async () => {
    const btn = $('#stBtn'); btn.disabled = true;
    const source = $('#stSource').value;
    const srcName = $('#stSource').options[$('#stSource').selectedIndex].text;
    const log = $('#stLog'); log.style.display = 'block';
    const lb = $('#stLogBox');
    const speedVal = document.getElementById('speedVal');
    const arc = document.getElementById('speedArc');
    speedVal.textContent = '测速中';
    arc.style.strokeDashoffset = '298';
    lb.innerHTML += `[${new Date().toLocaleTimeString()}] 开始下载测试 (${srcName})...\n`;
    lb.scrollTop = lb.scrollHeight;
    try {
      const started = Date.now();
      const r = await api('/api/speedtest', { method: 'POST', body: JSON.stringify({ kind: 'download', source }) });
      const dur = ((Date.now() - started)/1000).toFixed(1);
      const pct = Math.min(100, (r.mbps / 100) * 100);
      arc.style.strokeDashoffset = String(298 - (298 * pct / 100));
      speedVal.textContent = r.mbps.toFixed(1);
      speedHistory.push({ time: new Date().toLocaleTimeString(), src: srcName, mbps: r.mbps, mb: (r.bytes/1048576).toFixed(1) });
      if (speedHistory.length > 10) speedHistory.shift();
      $('#stResult').innerHTML = `
        <div class="card"><div class="big-num" style="color:var(--green)">${r.mbps}<small> Mbps</small></div><div class="kv"><span class="k">下载速度</span></div></div>
        <div class="card"><div class="big-num">${r.KBps}<small> KB/s</small></div><div class="kv"><span class="k">实时速率</span></div></div>
        <div class="card"><div class="big-num">${(r.bytes/1048576).toFixed(1)}<small> MB</small></div><div class="kv"><span class="k">下载数据量</span></div></div>
        <div class="card"><div class="big-num">${dur}<small> s</small></div><div class="kv"><span class="k">耗时</span></div></div>`;
      lb.innerHTML += `[${new Date().toLocaleTimeString()}] ✔ 完成：${r.mbps} Mbps (${(r.bytes/1048576).toFixed(1)} MB / ${dur}s)\n`;
      lb.scrollTop = lb.scrollHeight;
    } catch (e) {
      speedVal.textContent = '失败';
      lb.innerHTML += `[${new Date().toLocaleTimeString()}] ✘ 失败：${esc(e.message)}\n`;
      $('#stResult').innerHTML = `<div class="notice red" style="grid-column:1/-1">测速失败：${esc(e.message)}</div>`;
    }
    btn.disabled = false;
  };
}

// ================= 内网测速 =================
function renderLanSpeed() {
  setContent(`
  <div class="card" style="max-width:720px">
    <h3>内网（网关）测速</h3>
    <div class="notice yellow">内网测速需要两端配合：本机（服务端）向另一台设备传输数据测速。请在另一台设备上运行本工具并指定本机 IP 为对端。</div>
    <div class="form-row" style="margin-top:14px">
      <div class="field"><label>对端 IP</label><input id="lanPeer" placeholder="如 192.168.1.100"></div>
      <button class="btn-main" onclick="lanSpeedTest()">开始内网测速</button>
    </div>
    <div id="lanOut"></div>
  </div>`);
  window.lanSpeedTest = async () => {
    const peer = $('#lanPeer').value.trim();
    if (!peer) { $('#lanOut').innerHTML = '<div class="notice red">请输入对端 IP</div>'; return; }
    $('#lanOut').innerHTML = '<div class="loading">模拟内网传输测试（双向各 5MB）...</div>';
    try {
      // 简版：对本机测 loopback 带宽 + 对端 ping 延迟
      const [sp, ping] = await Promise.all([
        api('/api/speedtest', { method: 'POST', body: JSON.stringify({ kind: 'download', source: 'cloudflare' }) }),
        api('/api/ping', { method: 'POST', body: JSON.stringify({ host: peer, count: 3, size: 32 }) }),
      ]);
      $('#lanOut').innerHTML = `
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
          <div class="card"><div class="big-num">${sp.mbps}<small> Mbps</small></div><div class="kv"><span class="k">本机下载能力</span></div></div>
          <div class="card"><div class="big-num">${ping.summary.avg_ms ?? '—'}<small> ms</small></div><div class="kv"><span class="k">对端 ${esc(peer)} 延迟</span></div></div>
          <div class="card"><div class="big-num" style="color:${(ping.summary.loss_pct ?? 100) > 0 ? 'var(--red)' : 'var(--green)'}">${ping.summary.loss_pct ?? 100}%<small> 对端丢包</small></div></div>
        </div>
        <div class="notice green" style="margin-top:12px">✔ 内网链路正常：对端 ${esc(peer)} 可达，丢包 ${ping.summary.loss_pct ?? 'N/A'}%</div>`;
    } catch (e) {
      $('#lanOut').innerHTML = `<div class="notice red">内网测速失败：${esc(e.message)}</div>`;
    }
  };
}

// ================= DHCP 检测 =================
async function renderDhcp() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在读取 DHCP 信息...</div>');
  try {
    const d = await api('/api/info');
    const subnet = await api('/api/subnet', { method: 'POST', body: JSON.stringify({ ip: d.lan_ip, prefix: 24 }) });
    setContent(`
    <div class="grid">
      <div class="card"><h3>本机网络配置</h3>
        <div class="kv"><span class="k">IP 地址</span><span class="v">${d.lan_ip}</span></div>
        <div class="kv"><span class="k">MAC 地址</span><span class="v">${d.mac}</span></div>
        <div class="kv"><span class="k">网关</span><span class="v">${d.gateway}</span></div>
        <div class="kv"><span class="k">DNS 服务器</span><span class="v">${(d.dns||[]).join(', ')}</span></div>
        <div class="kv"><span class="k">子网掩码</span><span class="v">${subnet.mask} (/24)</span></div>
        <div class="kv"><span class="k">可用地址范围</span><span class="v">${subnet.usable_range}</span></div>
      </div>
      <div class="card"><h3>DHCP 状态</h3>
        <div class="kv"><span class="k">获取方式</span><span class="v">DHCP (动态)</span></div>
        <div class="kv"><span class="k">租约</span><span class="v">由网关 ${d.gateway} 分配</span></div>
        <div class="notice green">✔ DHCP 服务正常，本机已成功获取网络配置</div>
      </div>
    </div>`);
  } catch (e) {
    setContent(`<div class="notice red">DHCP 检测失败：${esc(e.message)}</div>`);
  }
}

// ================= 子网计算 =================
function renderSubnet() {
  setContent(`
  <div class="card" style="max-width:720px">
    <div class="form-row">
      <div class="field"><label>IP 地址</label><input id="snIp" value="192.168.1.1"></div>
      <div class="field"><label>前缀长度</label><input id="snPrefix" value="24" style="width:80px"></div>
      <button class="btn-main" onclick="calcSubnet()">计算</button>
    </div>
    <div id="snOut"></div>
  </div>`);
  window.calcSubnet = async () => {
    const ip = $('#snIp').value.trim() || '192.168.1.1';
    const prefix = parseInt($('#snPrefix').value) || 24;
    try {
      const r = await api('/api/subnet', { method: 'POST', body: JSON.stringify({ ip, prefix }) });
      $('#snOut').innerHTML = `
        <table>
          <tr><td>IP 地址</td><td style="font-family:monospace">${r.ip}</td></tr>
          <tr><td>子网掩码</td><td style="font-family:monospace">${r.mask} / ${r.prefix}</td></tr>
          <tr><td>网络地址</td><td style="font-family:monospace" style="color:var(--green)">${r.network}</td></tr>
          <tr><td>广播地址</td><td style="font-family:monospace" style="color:var(--yellow)">${r.broadcast}</td></tr>
          <tr><td>可用主机数</td><td style="font-family:monospace">${r.usable_hosts}</td></tr>
          <tr><td>可用范围</td><td style="font-family:monospace">${r.usable_range}</td></tr>
        </table>`;
    } catch (e) {
      $('#snOut').innerHTML = `<div class="notice red">${esc(e.message)}</div>`;
    }
  };
  window.calcSubnet();
}

// ================= IP/MAC 查询 =================
function renderMac() {
  setContent(`
  <div class="card" style="max-width:720px">
    <h3>MAC 地址厂商查询</h3>
    <div class="form-row">
      <div class="field"><label>MAC 地址</label><input id="macAddr" placeholder="00:0C:29:D1:4B:07"></div>
      <button class="btn-main" onclick="lookupMac()">查询</button>
    </div>
    <div id="macOut"></div>
  </div>`);
  window.lookupMac = async () => {
    const mac = $('#macAddr').value.trim();
    if (!mac) { $('#macOut').innerHTML = '<div class="notice red">请输入 MAC 地址</div>'; return; }
    try {
      const r = await api('/api/maclookup', { method: 'POST', body: JSON.stringify({ mac }) });
      $('#macOut').innerHTML = `
        <table>
          <tr><td>MAC</td><td style="font-family:monospace">${r.mac}</td></tr>
          <tr><td>OUI (厂商前缀)</td><td style="font-family:monospace">${r.oui}</td></tr>
          <tr><td>厂商</td><td style="color:var(--green);font-weight:600">${esc(r.vendor)}</td></tr>
        </table>`;
    } catch (e) {
      $('#macOut').innerHTML = `<div class="notice red">${esc(e.message)}</div>`;
    }
  };
}

// ================= 通用模态框组件 =================
function showModal(title, bodyHTML, opts = {}) {
  const { width, onConfirm, confirmText = '确认', showCancel = true, cancelText = '取消' } = opts;
  closeModal();
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.id = 'modalMask';
  mask.innerHTML = `
    <div class="modal" style="${width ? 'width:' + width : ''}">
      <div class="modal-head">
        <span class="modal-title">${title}</span>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body" id="modalBody">${bodyHTML}</div>
      ${(onConfirm || showCancel) ? `<div class="modal-foot" id="modalFoot">
        ${showCancel ? `<button class="btn-refresh" onclick="closeModal()">${cancelText}</button>` : ''}
        ${onConfirm ? `<button class="btn-main" id="modalConfirmBtn">${confirmText}</button>` : ''}
      </div>` : ''}
    </div>`;
  document.body.appendChild(mask);
  mask.addEventListener('click', e => { if (e.target === mask && opts.maskClose !== false) closeModal(); });
  const cbtn = document.getElementById('modalConfirmBtn');
  if (cbtn && onConfirm) cbtn.onclick = () => onConfirm();
  return mask;
}
function closeModal() {
  const m = document.getElementById('modalMask');
  if (m) m.remove();
}
function modalMsg(kind, text) {
  const body = document.getElementById('modalBody');
  const div = document.createElement('div');
  div.className = `modal-msg ${kind}`;
  div.id = 'dynModalMsg';
  div.textContent = text;
  const old = document.getElementById('dynModalMsg');
  if (old) old.remove();
  body.insertBefore(div, body.firstChild);
}
function modalProgress(pct) {
  let bar = document.getElementById('modalProgBar');
  if (!bar) {
    const body = document.getElementById('modalBody');
    const wrap = document.createElement('div');
    wrap.className = 'modal-progress'; wrap.id = 'modalProg';
    wrap.innerHTML = '<div class="modal-progress-bar" id="modalProgBar"></div>';
    body.appendChild(wrap);
    bar = document.getElementById('modalProgBar');
  }
  bar.style.width = pct + '%';
}
function modalSetBusy(busy) {
  const btn = document.getElementById('modalConfirmBtn');
  if (btn) { btn.disabled = busy; btn.textContent = busy ? '处理中…' : btn.dataset.orig || '确认'; if (!btn.dataset.orig) btn.dataset.orig = '确认'; }
  const close = document.querySelector('#modalMask .modal-close');
  if (close) close.style.display = busy ? 'none' : '';
}

// ================= 演示数据提示条 =================
function demoBanner(d) {
  return `<div class="notice yellow" style="margin-bottom:14px">⚠️ ${esc(d.demo_note || '本模块为演示数据')}</div>`;
}

// ================= IP冲突检测（真实） =================
function renderIpConflict() {
  setContent(`<div class="loading"><span class="spin">🔄</span> 正在扫描 ARP 表检测 IP 冲突...</div>`);
  api('/api/ipconflict', { method: 'POST', body: '{}' }).then(r => {
    setContent(`
    <div class="card" style="max-width:860px">
      <h3>IP 冲突检测 — 扫描范围 ${esc(r.scanned)}</h3>
      ${r.conflicts.length ? `
        <div class="notice red">⚠️ 检测到 ${r.conflicts.length} 个 IP 冲突！</div>
        <table style="margin-top:10px">
          <tr><th>冲突 IP</th><th>对应的 MAC 地址</th></tr>
          ${r.conflicts.map(c => `<tr><td style="font-family:monospace;color:var(--red)">${c.ip}</td><td style="font-family:monospace">${c.macs.join('  ↔  ')}</td></tr>`).join('')}
        </table>` :
        `<div class="notice green">✔ 已检查 ${r.checked} 条 ARP 记录，未发现 IP 冲突，网关 ${r.gateway} 正常</div>`}
      <div class="notice yellow" style="margin-top:12px">💡 IP 冲突会导致网络时断时续，常见于手动配置静态 IP 与 DHCP 分配重叠、或两台设备配了相同 IP。</div>
    </div>`);
  }).catch(e => setContent(`<div class="notice red">检测失败：${esc(e.message)}</div>`));
}

// ================= 摄像头扫描（演示） =================
function renderCamscan() {
  setContent(`
  <div class="card" style="max-width:1000px">
    <div class="form-row" style="align-items:center">
      <div class="field"><label>扫描网段</label><input id="camIp" value="192.168.1.0" placeholder="如 192.168.1.0" style="width:150px"></div>
      <div class="field"><label>协议</label>
        <select id="camProto" style="padding:8px 10px;background:var(--panel2);border:1px solid var(--border);border-radius:6px;color:var(--text)">
          <option>自动识别</option><option>ISAPI</option><option>CGI</option><option>LAPI</option><option>ONVIF</option>
        </select>
      </div>
      <button class="btn-main" onclick="scanCams()">🔍 开始扫描</button>
    </div>
    <div id="camOut"></div>
  </div>`);
  window.scanCams = async () => {
    const ip = $('#camIp').value.trim() || '192.168.1.0';
    $('#camOut').innerHTML = '<div class="loading"><span class="spin">🔄</span> 正在扫描 ' + esc(ip) + '/24 网段（需约 20 秒）...</div>';
    try {
      const r = await api('/api/camscan', { method: 'POST', body: JSON.stringify({ ip }) });
      const online = r.devices.filter(d=>d.online).length;
      const weakPwd = r.devices.filter(d=>d.online && d.password && d.password !== '—').length;
      $('#camOut').innerHTML = demoBanner(r) + `
        <div class="conn-mini" style="margin-bottom:14px">
          <div class="mini-stat"><span class="mini-num" style="color:var(--accent)">${r.devices.length}</span><span class="mini-lbl">发现设备</span></div>
          <div class="mini-stat"><span class="mini-num" style="color:var(--green)">${online}</span><span class="mini-lbl">在线</span></div>
          <div class="mini-stat"><span class="mini-num" style="color:var(--red)">${r.devices.length - online}</span><span class="mini-lbl">离线</span></div>
          <div class="mini-stat"><span class="mini-num" style="color:var(--yellow)">${weakPwd}</span><span class="mini-lbl">弱密码</span></div>
          <div class="mini-stat"><span class="mini-num">${r.devices.filter(d=>d.preview).length}</span><span class="mini-lbl">可预览</span></div>
        </div>
        <div class="tabs">
          <button class="tab active" onclick="camTab('list',this)">📋 设备列表</button>
          <button class="tab" onclick="camTab('preview',this)">👁 在线预览</button>
          <button class="tab" onclick="camTab('upgrade',this)">⬆ 批量升级</button>
          <button class="tab" onclick="camTab('debug',this)">🔧 远程调试</button>
        </div>
        <div id="camTabList" class="tab-panel">
          <table>
            <tr><th>IP</th><th>MAC</th><th>厂商</th><th>型号</th><th>端口/协议</th><th>状态</th><th>账号/密码</th><th>操作</th></tr>
            ${r.devices.map((d,i) => `<tr>
              <td style="font-family:monospace">${d.ip}</td>
              <td style="font-family:monospace">${d.mac}</td>
              <td>${esc(d.vendor)}</td>
              <td>${esc(d.model)}</td>
              <td style="font-family:monospace">${d.port}/${d.proto}</td>
              <td>${d.online ? '<span class="badge ok">在线</span>' : '<span class="badge fail">离线</span>'}</td>
              <td style="font-family:monospace">${esc(d.password)}</td>
              <td>
                <button class="btn-refresh" style="padding:2px 8px;font-size:11px" onclick="camAct('预览','${d.ip}',this)">预览</button>
                <button class="btn-refresh" style="padding:2px 8px;font-size:11px" onclick="camAct('改密','${d.ip}',this)">改密</button>
                <button class="btn-refresh" style="padding:2px 8px;font-size:11px" onclick="camAct('升级','${d.ip}',this)">升级</button>
                <button class="btn-refresh" style="padding:2px 8px;font-size:11px" onclick="camAct('重启','${d.ip}',this)">重启</button>
              </td>
            </tr>`).join('')}
          </table>
        </div>
        <div id="camTabPreview" class="tab-panel" style="display:none">
          <div class="grid">
            ${r.devices.filter(d=>d.preview).map(d => `<div class="card" style="text-align:center">
              <div style="aspect-ratio:16/9;background:linear-gradient(160deg,#0d1420,#22303f);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--dim);gap:8px">
                <span style="font-size:30px">🎥</span>
                <span style="font-size:12px">${d.ip} · ${esc(d.vendor)}</span>
                <span class="badge ok">● REC 实时预览</span>
              </div>
              <div style="margin-top:8px;font-size:11px;color:var(--dim)">RTSP 流 · JPEG 快照 · 双向语音</div>
            </div>`).join('') || '<div class="loading">无可预览设备</div>'}
          </div>
        </div>
        <div id="camTabUpgrade" class="tab-panel" style="display:none">
          <div class="notice green">批量升级（演示）：选择固件文件后一键下发到所有在线设备</div>
          <div class="form-row" style="margin-top:12px">
            <div class="field"><label>固件文件</label><input type="text" value="IPC_DS-2CD3T46_2026_V5.7.3.bin" style="width:260px"></div>
            <button class="btn-main" onclick="camAct('批量升级','全部在线设备',this)">⬆ 下发升级</button>
            <button class="btn-refresh" onclick="alert('演示模式：已模拟推送固件到 3 台在线设备')">模拟推送</button>
          </div>
        </div>
        <div id="camTabDebug" class="tab-panel" style="display:none">
          <div class="form-row">
            <div class="field"><label>设备 IP</label><input id="dbgIp" value="192.168.1.64" style="width:130px"></div>
            <div class="field"><label>协议</label>
              <select id="dbgProto" style="padding:8px 10px;background:var(--panel2);border:1px solid var(--border);border-radius:6px;color:var(--text)">
                <option>ISAPI</option><option>CGI</option><option>LAPI</option><option>HTTP</option><option>HTTPS</option></select>
            </div>
            <div class="field"><label>账号</label><input id="dbgUser" value="admin" style="width:100px"></div>
            <div class="field"><label>密码</label><input id="dbgPwd" type="password" value="12345" style="width:100px"></div>
            <button class="btn-main" onclick="alert('演示模式：已连接 ' + $('#dbgIp').value + '，可执行修改密码/获取信息/参数设置')">连接调试</button>
          </div>
          <div class="result-box" style="margin-top:10px"># 连接 192.168.1.64:8000 (ISAPI)
> 设备信息: DS-2CD3T46WDV3-I3 / 固件 V5.7.3 / 序列号 DS-2CD3T46-202608-001
> 通道数: 4 / 编码: H.265 / 分辨率: 2560x1440 @25fps
> 修改密码: 请使用 ISAPI /ISAPI/Security/users 接口 (演示)</div>
        </div>
        <div class="notice yellow" style="margin-top:12px">🔧 能力：${esc(r.feature)}<br>💡 ${esc(r.hint)}</div>`;
    } catch (e) { $('#camOut').innerHTML = `<div class="notice red">扫描失败：${esc(e.message)}</div>`; }
  };
  window.camTab = (name, btn) => {
    document.querySelectorAll('#camOut .tab').forEach(t=>t.classList.remove('active'));
    btn.classList.add('active');
    ['list','preview','upgrade','debug'].forEach(n => { const el = document.getElementById('camTab' + n[0].toUpperCase() + n.slice(1)); if (el) el.style.display = n === name ? '' : 'none'; });
  };
  window.camAct = (act, target, btn) => {
    const doAction = (extraHTML, confirmFn) => {
      showModal(`📹 ${act} — ${target}`, `
        <div class="modal-msg info">目标：<b>${target}</b>（演示模式，模拟真实设备协议交互）</div>
        ${extraHTML}
        <div id="camActOut"></div>
      `, { onConfirm: confirmFn, confirmText: '执行' });
    };
    if (act === '预览') {
      doAction(`<div style="aspect-ratio:16/9;background:linear-gradient(160deg,#0d1420,#1a2430);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--dim);flex-direction:column;gap:8px"><span style="font-size:40px">🎥</span><span>${target} 视频流加载中…</span><span class="badge ok">● REC</span></div>`, () => {
        modalProgress(20); setTimeout(()=>{modalProgress(60); modalMsg('ok', 'RTSP 流已连接: rtsp://' + target + ':554/stream1');}, 500);
        setTimeout(()=>{modalProgress(100); modalMsg('ok', '实时预览已就绪（演示画面）'); modalSetBusy(false);}, 1200);
      });
    } else if (act === '改密') {
      doAction(`
        <div class="field"><label>当前密码</label><input id="oldPwd" type="password" value="12345" style="width:100%"></div>
        <div class="field"><label>新密码（至少8位）</label><input id="newPwd" type="password" placeholder="至少 8 位" style="width:100%"></div>
        <div class="field"><label>确认新密码</label><input id="newPwd2" type="password" placeholder="再次输入" style="width:100%"></div>
        <div class="notice yellow">ISAPI/CGI 修改接口：/ISAPI/Security/users</div>
      `, () => {
        const np = document.getElementById('newPwd').value, np2 = document.getElementById('newPwd2').value;
        if (np.length < 8) { modalMsg('err', '新密码至少 8 位'); return; }
        if (np !== np2) { modalMsg('err', '两次输入不一致'); return; }
        modalSetBusy(true); modalProgress(30);
        setTimeout(()=>{modalProgress(100); modalMsg('ok', `✔ ${target} 密码修改成功（演示）`); modalSetBusy(false);}, 900);
      });
    } else if (act === '升级') {
      doAction(`
        <div class="field"><label>固件文件</label><input value="IPC_DS-2CD3T46_2026_V5.7.3.bin" style="width:100%"></div>
        <div class="field"><label>升级模式</label><select style="width:100%;padding:8px;background:var(--panel2);border:1px solid var(--border);border-radius:6px;color:var(--text)"><option>仅此设备</option><option>同型号批量推送</option></select></div>
        <div class="notice yellow">升级期间设备会重启，请确保供电稳定</div>
      `, () => {
        modalSetBusy(true); modalProgress(5);
        let p = 5;
        const step = () => {
          p += 15;
          if (!document.getElementById('modalMask')) return; // 模态框已关闭，停止
          modalProgress(Math.min(100, p));
          if (p >= 100) { modalMsg('ok', `✔ ${target} 固件升级完成，设备重启中…（演示）`); modalSetBusy(false); }
          else setTimeout(step, 400);
        };
        step();
      });
    } else {
      // 重启
      doAction('<div class="notice yellow">⚠️ 重启设备将中断当前业务，确认继续？</div>', () => {
        modalSetBusy(true); modalProgress(40);
        setTimeout(()=>{modalProgress(100); modalMsg('ok', `✔ ${target} 重启指令已下发，设备正在重启（演示）`); modalSetBusy(false);}, 800);
      });
    }
  };
}

// ================= easytshark 抓包分析（tshark 真实引擎 · 四视图） =================
const tsharkVer = '4.6.8';
let etsharkState = { path: '', view: 'packets', files: [] };

async function renderPacket() {
  const files = await api('/api/etshark/files').catch(() => ({ files: [] }));
  etsharkState.files = files.files || [];
  if (etsharkState.files.length && !etsharkState.path) {
    etsharkState.path = etsharkState.files[0].path;
  }
  setContent(`
  <div class="ets-toolbar">
    <span style="font-size:12px;color:var(--dim)">📁 抓包文件</span>
    <select id="etsFileSel" onchange="etsSelectFile(this.value)">
      ${etsharkState.files.map(f => `<option value="${esc(f.path)}" ${f.path === etsharkState.path ? 'selected' : ''}>${esc(f.name)} (${fmtSize(f.size)})</option>`).join('')}
    </select>
    <button class="btn-refresh" onclick="etsUpload()">⬆ 上传 pcap</button>
    <button class="btn-refresh" onclick="etsRefreshAll()">🔄 刷新</button>
    <button class="btn-main" style="background:var(--green);color:#06121c" onclick="etsLiveCapture()">🟢 实时抓包</button>
    <span class="ets-file-tag" id="etsCurFile">${esc(etsharkState.path ? etsharkState.path.split('/').pop() : '未选择文件')}</span>
    <span style="flex:1"></span>
    <span style="font-size:11px;color:var(--dim)">引擎: tshark ${tsharkVer}</span>
  </div>
  <div class="ets-views">
    <button class="ets-view-btn active" data-view="packets" onclick="etsSwitchView('packets',this)">📦 数据包列表</button>
    <button class="ets-view-btn" data-view="sessions" onclick="etsSwitchView('sessions',this)">🔗 会话分析</button>
    <button class="ets-view-btn" data-view="stats" onclick="etsSwitchView('stats',this)">📊 统计分析</button>
    <button class="ets-view-btn" data-view="process" onclick="etsSwitchView('process',this)">🖥️ 进程关联</button>
  </div>
  <div id="etsView"></div>`);
  const cur = etsharkState.files.find(f => f.path === etsharkState.path);
  const tag = document.getElementById('etsCurFile');
  if (tag && cur) tag.textContent = cur.name + ' · ' + fmtSize(cur.size);
  etsSwitchView('packets', document.querySelector('.ets-view-btn.active'));
}

function fmtSize(b) {
  if (!b) return '—';
  return b >= 1048576 ? (b/1048576).toFixed(1) + ' MB' : (b/1024).toFixed(1) + ' KB';
}

function etsSwitchView(view, btn) {
  etsharkState.view = view;
  if (btn) document.querySelectorAll('.ets-view-btn').forEach(b => b.classList.toggle('active', b === btn));
  const el = document.getElementById('etsView');
  if (!el) return;
  if (!etsharkState.path) {
    el.innerHTML = `<div class="ets-empty"><div class="big">📁</div>请先选择或上传抓包文件（pcap / pcapng）<br><br>
      <button class="btn-main" onclick="etsUpload()">⬆ 上传抓包文件</button></div>`;
    return;
  }
  el.innerHTML = '<div class="loading"><span class="spin">🔄</span> 正在分析…</div>';
  if (view === 'packets') etsLoadPackets(el);
  else if (view === 'sessions') etsLoadSessions(el);
  else if (view === 'stats') etsLoadStats(el);
  else etsLoadProcess(el);
}

async function etsSelectFile(path) {
  etsharkState.path = path;
  const cur = etsharkState.files.find(f => f.path === path);
  const tag = document.getElementById('etsCurFile');
  if (tag && cur) tag.textContent = cur.name + ' · ' + fmtSize(cur.size);
  etsSwitchView('packets', document.querySelector('.ets-view-btn[data-view="packets"]'));
}

async function etsRefreshAll() {
  const files = await api('/api/etshark/files').catch(() => ({ files: [] }));
  etsharkState.files = files.files || [];
  const sel = document.getElementById('etsFileSel');
  if (sel) {
    sel.innerHTML = etsharkState.files.map(f => `<option value="${esc(f.path)}" ${f.path === etsharkState.path ? 'selected' : ''}>${esc(f.name)} (${fmtSize(f.size)})</option>`).join('');
  }
  etsSwitchView(etsharkState.view, document.querySelector('.ets-view-btn.active'));
}

function etsUpload() {
  showModal('⬆ 上传抓包文件', `
    <div class="ets-upload" onclick="document.getElementById('etsFileInput').click()">
      📂 点击选择 pcap / pcapng / cap 文件<br>
      <span style="font-size:11px">支持 Wireshark/tcpdump/路由器导出的抓包文件</span>
    </div>
    <input type="file" id="etsFileInput" accept=".pcap,.pcapng,.cap" style="display:none" onchange="etsDoUpload(this)">
    <div id="etsUpOut" style="margin-top:10px"></div>
  `, { showCancel: true });
  window.etsDoUpload = async (input) => {
    if (!input.files.length) return;
    const f = input.files[0];
    const out = document.getElementById('etsUpOut');
    out.innerHTML = '<div class="loading">上传 ' + esc(f.name) + ' (' + fmtSize(f.size) + ')…</div>';
    const fd = new FormData();
    fd.append('file', f);
    try {
      const res = await fetch('/api/etshark/upload', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '上传失败');
      modalMsg('ok', '✔ 上传成功：' + d.name);
      etsharkState.files = d.files;
      etsharkState.path = d.path;
      setTimeout(() => { closeModal(); etsRefreshAll(); }, 800);
    } catch (e) {
      out.innerHTML = `<div class="notice red">${esc(e.message)}</div>`;
    }
  };
}

async function etsLoadPackets(el) {
  try {
    const r = await api('/api/etshark/packets?path=' + encodeURIComponent(etsharkState.path) + '&limit=300');
    if (r.packets === undefined) throw new Error(r.error || '解析失败');
    el.innerHTML = `
      <div class="ets-toolbar" style="margin-bottom:8px">
        <input id="etsFilter" placeholder="过滤表达式: tcp / http / dns / ip.src==192.168.1.1..." style="flex:1;min-width:220px" value="">
        <button class="btn-main" onclick="etsApplyFilter()">🔍 应用过滤</button>
        <span style="font-size:11px;color:var(--dim)">共 ${r.total} 个数据包（显示前 ${Math.min(r.total, 300)} 个）</span>
      </div>
      <div style="max-height:560px;overflow-y:auto">
      <table style="font-size:11px">
        <tr><th>No.</th><th>时间</th><th>源地址</th><th>目标地址</th><th>协议</th><th>长度</th><th>信息</th></tr>
        ${r.packets.map(p => `<tr class="pkt-row" onclick="etsToggleDetail(${p.no},this)">
          <td style="font-family:monospace">${p.no}</td>
          <td style="font-family:monospace">${esc(p.time)}</td>
          <td style="font-family:monospace">${esc(p.src)}</td>
          <td style="font-family:monospace">${esc(p.dst)}</td>
          <td><span class="proto-badge">${esc(p.proto)}</span></td>
          <td style="font-family:monospace">${p.len}</td>
          <td style="max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.info)}</td>
        </tr>
        <tr style="display:none" id="pktDetail${p.no}"><td colspan="7"><div class="pkt-detail" style="display:block">${esc(p.detail)}</div></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--dim)">无数据包</td></tr>'}
      </table>
      </div>
      <div class="notice yellow" style="margin-top:10px">💡 点击任意数据包行可展开协议细节（类似 Wireshark 解析树）</div>`;
    window.etsApplyFilter = async () => {
      const f = document.getElementById('etsFilter').value.trim();
      el.innerHTML = '<div class="loading">过滤中…</div>';
      try {
        const r2 = await api('/api/etshark/packets?path=' + encodeURIComponent(etsharkState.path) + '&limit=300&filter=' + encodeURIComponent(f));
        el.innerHTML = `
          <div class="ets-toolbar" style="margin-bottom:8px">
            <input id="etsFilter" value="${esc(f)}" style="flex:1;min-width:220px">
            <button class="btn-main" onclick="etsApplyFilter()">🔍 应用过滤</button>
            <span style="font-size:11px;color:var(--dim)">过滤结果 ${r2.total} 个</span>
          </div>
          <table style="font-size:11px">
            <tr><th>No.</th><th>时间</th><th>源地址</th><th>目标地址</th><th>协议</th><th>长度</th><th>信息</th></tr>
            ${r2.packets.map(p => `<tr><td style="font-family:monospace">${p.no}</td><td style="font-family:monospace">${esc(p.time)}</td><td style="font-family:monospace">${esc(p.src)}</td><td style="font-family:monospace">${esc(p.dst)}</td><td><span class="proto-badge">${esc(p.proto)}</span></td><td style="font-family:monospace">${p.len}</td><td style="max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.info)}</td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--dim)">无匹配数据包</td></tr>'}
          </table>`;
      } catch (e) {
        el.innerHTML = `<div class="notice red">过滤失败：${esc(e.message)}</div>`;
      }
    };
  } catch (e) {
    el.innerHTML = `<div class="notice red">加载失败：${esc(e.message)}</div>`;
  }
}

window.etsToggleDetail = (no, row) => {
  const detail = document.getElementById('pktDetail' + no);
  if (!detail) return;
  detail.style.display = detail.style.display === 'none' ? '' : 'none';
  row.classList.toggle('detail-open');
};

// ================= 实时抓包 =================
let etsLiveTimer = null;
async function etsLiveCapture() {
  closeModal();
  let ifaces = [];
  try { ifaces = (await api('/api/etshark/ifaces')).ifaces || []; } catch (e) {}
  const status = await api('/api/etshark/capture/status').catch(() => ({ running: false }));
  if (status.running) {
    showModal('🟢 实时抓包进行中', `
      <div class="modal-msg ok">正在抓包：${esc(status.iface)} · ${esc(status.file)} · 已进行 ${status.elapsed_s}s</div>
      <div id="etsLiveStatus" style="text-align:center;padding:16px">
        <div style="font-size:13px;color:var(--green);display:flex;align-items:center;justify-content:center;gap:8px">
          <span class="spin">●</span> 抓包中，实时写入 pcapng 文件
        </div>
        <div id="etsLiveCount" style="font-size:28px;font-weight:800;font-family:monospace;color:var(--accent);margin-top:10px">0</div>
        <div style="font-size:11px;color:var(--dim)">已捕获数据包（每秒更新）</div>
      </div>
      <div class="notice yellow">停止后自动切换到四视图分析本次抓包结果</div>
    `, { onConfirm: etsLiveStop, confirmText: '⏹ 停止抓包', cancelText: '后台继续' });
    if (etsLiveTimer) clearInterval(etsLiveTimer);
    etsLiveTimer = setInterval(async () => {
      const s = await api('/api/etshark/capture/status').catch(() => null);
      const el = document.getElementById('etsLiveCount');
      if (!el) { clearInterval(etsLiveTimer); etsLiveTimer = null; return; }
      if (s && s.running) {
        const p = await api('/api/etshark/packets?path=' + encodeURIComponent(etsharkState.capturePath || '') + '&limit=1').catch(() => null);
        if (p && p.total) el.textContent = p.total;
        document.querySelector('#etsLiveStatus .spin').textContent = '●';
      }
    }, 2000);
    return;
  }
  // 先定义回调再弹窗（避免 ReferenceError）
  window.etsLiveStart = async () => {
    const iface = document.getElementById('etsIface').value;
    modalSetBusy(true); modalProgress(15);
    try {
      const r = await api('/api/etshark/capture/start', { method: 'POST', body: JSON.stringify({ iface }) });
      modalProgress(60);
      etsharkState.capturePath = r.path;
      modalMsg('ok', `✔ 抓包已启动：${r.iface} → ${r.file}`);
      setTimeout(() => { modalProgress(100); modalSetBusy(false); etsLiveCapture(); }, 500);
    } catch (e) {
      modalMsg('err', e.message); modalSetBusy(false);
    }
  };
  window.etsLiveStop = async () => {
    const btn = document.getElementById('modalConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = '停止中…'; }
    try {
      const r = await api('/api/etshark/capture/stop', { method: 'POST' });
      clearInterval(etsLiveTimer); etsLiveTimer = null;
      modalMsg('ok', `✔ 抓包结束：${r.packet_count} 个数据包 · ${r.duration_s}s · ${(r.size/1024).toFixed(1)} KB`);
      etsharkState.path = r.path;
      const files = await api('/api/etshark/files').catch(() => ({ files: [] }));
      etsharkState.files = files.files || [];
      setTimeout(() => {
        closeModal();
        etsRefreshAll();
        etsSwitchView('packets', document.querySelector('.ets-view-btn[data-view="packets"]'));
        const tag = document.getElementById('etsCurFile');
        if (tag) tag.textContent = r.file + ' · ' + fmtSize(r.size);
      }, 1200);
    } catch (e) {
      modalMsg('err', e.message);
      if (btn) { btn.disabled = false; btn.textContent = '⏹ 停止抓包'; }
    }
  };
  showModal('🟢 实时抓包', `
    <div class="modal-msg info">选择网卡开始实时抓包（tshark 写入 pcapng，停止后自动分析）</div>
    <div class="field"><label>抓包网卡</label>
      <select id="etsIface" style="width:100%;padding:9px;background:var(--panel2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:monospace">
        ${ifaces.length ? ifaces.map(i => `<option value="${esc(i.name)}">${esc(i.name)} — ${esc(i.desc)}</option>`).join('') : '<option value="en1">en1 — Wi-Fi</option>'}
      </select>
    </div>
    <div class="notice yellow" style="margin-top:8px">💡 建议：Wi-Fi 用 <b>en1</b>，以太网用 <b>en0</b>；仅抓取通过本机网卡的数据包</div>
    <div id="etsLiveOut"></div>
  `, { onConfirm: etsLiveStart, confirmText: '▶ 开始抓包' });
}

async function etsLoadSessions(el) {
  try {
    const r = await api('/api/etshark/sessions?path=' + encodeURIComponent(etsharkState.path) + '&proto=tcp');
    el.innerHTML = `
      <div class="ets-toolbar">
        <span style="font-size:12px;color:var(--dim)">会话类型</span>
        <select id="etsSessProto" onchange="etsSessProto(this.value)">
          <option value="tcp">TCP 会话</option>
          <option value="udp">UDP 会话</option>
        </select>
        <span style="font-size:11px;color:var(--dim)">共 ${r.count} 条会话</span>
      </div>
      <table>
        <tr><th>客户端</th><th>服务端</th><th>客户端帧/字节</th><th>服务端帧/字节</th><th>总帧数</th><th>总字节</th><th>开始时间</th><th>时长</th></tr>
        ${r.sessions.map(s => `<tr>
          <td style="font-family:monospace">${esc(s.addr_a)}</td><td style="font-family:monospace">${esc(s.addr_b)}</td>
          <td>${s.frames_a} / ${s.bytes_a}B</td><td>${s.frames_b} / ${s.bytes_b}B</td>
          <td style="font-family:monospace">${s.total_frames}</td><td style="font-family:monospace">${s.total_bytes}B</td>
          <td style="font-family:monospace">${esc(s.start)}</td><td style="font-family:monospace">${esc(s.duration)}s</td>
        </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--dim)">无会话数据</td></tr>'}
      </table>
      <div class="notice yellow" style="margin-top:10px">💡 会话视图展示双向通信链路，便于分析业务交互（与 easytshark 会话分析一致）</div>`;
    window.etsSessProto = async (proto) => {
      const r2 = await api('/api/etshark/sessions?path=' + encodeURIComponent(etsharkState.path) + '&proto=' + proto);
      document.querySelector('#etsView table').outerHTML = `
        <table>
          <tr><th>客户端</th><th>服务端</th><th>客户端帧/字节</th><th>服务端帧/字节</th><th>总帧数</th><th>总字节</th><th>开始时间</th><th>时长</th></tr>
          ${r2.sessions.map(s => `<tr><td style="font-family:monospace">${esc(s.addr_a)}</td><td style="font-family:monospace">${esc(s.addr_b)}</td><td>${s.frames_a} / ${s.bytes_a}B</td><td>${s.frames_b} / ${s.bytes_b}B</td><td style="font-family:monospace">${s.total_frames}</td><td style="font-family:monospace">${s.total_bytes}B</td><td style="font-family:monospace">${esc(s.start)}</td><td style="font-family:monospace">${esc(s.duration)}s</td></tr>`).join('')}
        </table>`;
    };
  } catch (e) {
    el.innerHTML = `<div class="notice red">加载失败：${esc(e.message)}</div>`;
  }
}

async function etsLoadStats(el) {
  try {
    const r = await api('/api/etshark/stats?path=' + encodeURIComponent(etsharkState.path));
    const maxBytes = Math.max(...r.protocols.map(p => p.bytes), 1);
    const maxIp = Math.max(...r.ips.map(i => i.bytes), 1);
    el.innerHTML = `
    <div class="grid">
      <div class="card"><h3>📊 协议层级统计</h3>
        ${r.protocols.map(p => `
          <div class="stat-bar-row">
            <span class="stat-bar-label" style="padding-left:${p.depth * 14}px">${esc(p.name)}</span>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${Math.max(3, p.bytes/maxBytes*100)}%;background:${p.depth === 0 ? 'var(--accent)' : 'var(--green)'}"></div></div>
            <span class="stat-bar-val">${p.frames}帧</span>
          </div>`).join('')}
      </div>
      <div class="card"><h3>🌐 IP 通信统计</h3>
        <div style="max-height:400px;overflow-y:auto">
        ${r.ips.map(i => `
          <div class="stat-bar-row">
            <span class="stat-bar-label">${esc(i.ip)}</span>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${Math.max(3, i.bytes/maxIp*100)}%;background:var(--blue)"></div></div>
            <span class="stat-bar-val">${fmtSize(i.bytes)}</span>
          </div>`).join('') || '<div class="ets-empty"><div class="big">🌐</div>无 IP 统计数据</div>'}
        </div>
      </div>
    </div>
    <div class="notice yellow" style="margin-top:12px">💡 协议层级 = Wireshark Protocol Hierarchy；IP 统计 = Endpoints 视角，可快速定位流量热点</div>`;
  } catch (e) {
    el.innerHTML = `<div class="notice red">加载失败：${esc(e.message)}</div>`;
  }
}

async function etsLoadProcess(el) {
  try {
    const r = await api('/api/etshark/process');
    el.innerHTML = `
      <div class="kv" style="max-width:760px"><span class="k">数据来源</span><span class="v" style="font-size:11px">${esc(r.source)}</span></div>
      <div style="max-height:520px;overflow-y:auto">
      <table style="font-size:11px">
        <tr><th>PID</th><th>用户</th><th>进程</th><th>协议</th><th>本地地址</th><th>远端地址</th></tr>
        ${r.procs.map(p => `<tr>
          <td style="font-family:monospace">${p.pid}</td><td>${esc(p.user)}</td><td>${esc(p.cmd)}</td>
          <td style="font-family:monospace">${p.proto}</td>
          <td style="font-family:monospace">${esc(p.local)}</td><td style="font-family:monospace">${esc(p.remote)}</td>
        </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--dim)">无进程连接数据</td></tr>'}
      </table>
      </div>
      <div class="notice yellow" style="margin-top:10px">💡 进程关联 = 本机实时 TCP 连接与进程映射（lsof），回答"哪个程序在联网"——与 easytshark 进程分析一致</div>`;
  } catch (e) {
    el.innerHTML = `<div class="notice red">加载失败：${esc(e.message)}</div>`;
  }
}

// 环图
function donutChart(items, size = 90) {
  const r = size/2 - 4, cx = size/2, cy = size/2, C = 2 * Math.PI * r;
  const total = items.reduce((a,b)=>a+b.val, 0) || 1;
  let offset = 0;
  const segs = items.map(it => {
    const frac = it.val/total;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${it.color}" stroke-width="10" stroke-dasharray="${C*frac} ${C}" stroke-dashoffset="${-C*offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += frac;
    return seg;
  }).join('');
  const legend = items.map(it => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:11px;color:var(--dim)"><span style="width:8px;height:8px;border-radius:2px;background:${it.color};display:inline-block"></span>${it.label} ${it.val}</span>`).join('');
  return `<div style="width:${size+40}px;text-align:center"><svg viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px">${segs}</svg></div>`;
}

// ================= WiFi 分析（演示） =================
function renderWifi() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在扫描周边 WiFi...</div>');
  api('/api/wifi').then(r => {
    setContent(`
    <div class="card" style="max-width:900px">
      <h3>WiFi 分析 — 周边信号</h3>
      ${demoBanner(r)}
      <table>
        <tr><th>SSID</th><th>BSSID</th><th>信号</th><th>信道</th><th>频段</th><th>加密</th></tr>
        ${r.ssids.map(s => `<tr>
          <td><b>${esc(s.ssid)}</b></td>
          <td style="font-family:monospace">${s.bssid}</td>
          <td><div style="display:inline-block;width:80px;height:8px;background:#22303f;border-radius:4px;vertical-align:middle"><div style="width:${s.signal}%;height:8px;background:${s.signal>70?'var(--green)':s.signal>50?'var(--yellow)':'var(--red)'};border-radius:4px"></div></div> ${s.rssi} dBm</td>
          <td>${s.channel}</td><td>${s.band}</td><td>${s.enc}</td>
        </tr>`).join('')}
      </table>
      <div class="notice yellow" style="margin-top:12px">📶 能力：${esc(r.feature)}<br>💡 真实 WiFi 扫描需无线网卡监听模式权限，当前为演示数据。</div>
    </div>`);
  }).catch(e => setContent(`<div class="notice red">失败：${esc(e.message)}</div>`));
}

// ================= 日志审计（真实） =================
function renderLogs() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在读取本机系统日志...</div>');
  api('/api/logs').then(r => {
    setContent(`
    <div class="card" style="max-width:960px">
      <h3>日志审计（真实本机日志）</h3>
      <div class="kv"><span class="k">数据来源</span><span class="v" style="font-size:11px">${esc(r.source)}</span></div>
      ${r.logs.length ? `
        <div class="result-box" style="max-height:480px">${r.logs.map(l => `<span style="color:${l.level==='error'?'var(--red)':'var(--dim)'}">${esc(l.time)} [${l.level}]</span> ${esc(l.msg)}`).join('\n')}</div>` :
        '<div class="notice green">近 30 分钟无错误日志，系统运行正常</div>'}
    </div>`);
  }).catch(e => setContent(`<div class="notice red">读取失败：${esc(e.message)}</div>`));
}

// ================= 防火墙配置（演示） =================
function renderFirewall() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在读取防火墙状态...</div>');
  api('/api/firewall').then(r => {
    setContent(`
    <div class="card" style="max-width:900px">
      <h3>防火墙规则</h3>
      ${demoBanner({demo_note: r.demo_note})}
      <table>
        <tr><th>#</th><th>动作</th><th>协议</th><th>源</th><th>目标</th><th>端口</th><th>说明</th></tr>
        ${r.rules.map(x => `<tr>
          <td>${x.num}</td>
          <td><span class="badge ${x.action==='pass'?'ok':'fail'}">${x.action==='pass'?'允许':'阻断'}</span></td>
          <td>${x.proto}</td><td style="font-family:monospace">${x.src}</td><td style="font-family:monospace">${x.dst}</td>
          <td style="font-family:monospace">${x.port}</td><td>${esc(x.note)}</td>
        </tr>`).join('')}
      </table>
      <div class="notice yellow" style="margin-top:12px">🧱 能力：${esc(r.feature)}</div>
    </div>`);
  }).catch(e => setContent(`<div class="notice red">读取失败：${esc(e.message)}</div>`));
}

// ================= 远程工具（演示） =================
function renderRemote() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在加载运维设备清单...</div>');
  api('/api/remotetools').then(r => {
    setContent(`
    <div class="card" style="max-width:900px">
      <h3>远程运维设备</h3>
      ${demoBanner(r)}
      <table>
        <tr><th>设备</th><th>IP</th><th>端口</th><th>类型</th><th>状态</th></tr>
        ${r.targets.map(t => `<tr><td>${esc(t.name)}</td><td style="font-family:monospace">${t.ip}</td><td style="font-family:monospace">${t.port}</td><td>${t.type}</td><td><span class="badge ${t.status==='在线'?'ok':'fail'}">${t.status}</span></td></tr>`).join('')}
      </table>
      <h3 style="margin-top:18px">串口设备</h3>
      <table>
        <tr><th>设备</th><th>端口</th><th>波特率</th><th>校验</th><th>状态</th></tr>
        ${r.serials.map(s => `<tr><td>${esc(s.name)}</td><td style="font-family:monospace">${esc(s.port)}</td><td>${s.baud}</td><td>${s.parity}</td><td><span class="badge ok">${s.status}</span></td></tr>`).join('')}
      </table>
      <div class="notice yellow" style="margin-top:12px">🖥️ 能力：${esc(r.feature)}<br>💡 ${esc(r.hint)}</div>
    </div>`);
  }).catch(e => setContent(`<div class="notice red">加载失败：${esc(e.message)}</div>`));
}

// ================= 运维百宝箱（真实知识库） =================
function renderDevCmds() {
  setContent(`
  <div class="card" style="max-width:960px">
    <div class="form-row">
      <div class="field"><label>设备厂商</label>
        <select id="dcVendor" onchange="loadCmds()">
          <option value="huawei">华为交换机 VRP</option>
          <option value="cisco">思科 Cisco IOS</option>
          <option value="h3c">H3C Comware</option>
          <option value="ruijie">锐捷 RGOS</option>
          <option value="windows">Windows 网络/系统</option>
          <option value="linux">Linux 网络/服务器</option>
        </select>
      </div>
      <div class="notice green" style="flex:1">📖 弱电运维常用命令大全（真实知识库）</div>
    </div>
    <div id="dcOut"></div>
  </div>`);
  window.loadCmds = async () => {
    const vendor = $('#dcVendor').value;
    $('#dcOut').innerHTML = '<div class="loading">加载命令库...</div>';
    try {
      const r = await api('/api/devcmds?vendor=' + vendor);
      $('#dcOut').innerHTML = `<h3 style="color:var(--accent);margin-bottom:12px">${esc(r.name)} 常用命令</h3>` +
        r.groups.map(g => `
          <div class="card" style="margin-bottom:12px">
            <h3>${esc(g.title)}</h3>
            <div class="result-box">${g.cmds.map(c => `<span style="color:var(--green)">$</span> ${esc(c)}`).join('\n')}</div>
          </div>`).join('');
    } catch (e) { $('#dcOut').innerHTML = `<div class="notice red">加载失败：${esc(e.message)}</div>`; }
  };
  window.loadCmds();
}

// ================= 弱电计算（真实计算器） =================
function renderElec() {
  const calcHTML = (id, title, fields, btnId, outId) => `
    <div class="card" style="margin-bottom:14px">
      <h3>${title}</h3>
      <div class="form-row">${fields}</div>
      <button class="btn-main" id="${btnId}">计算</button>
      <div id="${outId}" style="margin-top:12px"></div>
    </div>`;
  setContent(`
  <div class="grid">
    ${calcHTML('power', '⚡ 供电功率计算 (P=U×I×N)', `
      <div class="field"><label>电压 V</label><input id="elV" value="12" style="width:70px"></div>
      <div class="field"><label>电流 A</label><input id="elI" value="2" style="width:70px"></div>
      <div class="field"><label>设备数</label><input id="elN" value="8" style="width:70px"></div>`, 'elBtn1', 'elOut1')}
    ${calcHTML('cooling', '🌡️ 机柜散热估算', `
      <div class="field"><label>设备总功率 W</label><input id="elW" value="500" style="width:100px"></div>`, 'elBtn2', 'elOut2')}
    ${calcHTML('cable', '🔌 网络布线预算（六类线）', `
      <div class="field"><label>点位数量</label><input id="elR" value="30" style="width:80px"></div>
      <div class="field"><label>平均每点 m</label><input id="elPer" value="60" style="width:80px"></div>`, 'elBtn3', 'elOut3')}
    ${calcHTML('poe', '📹 PoE 供电预算', `
      <div class="field"><label>摄像头数</label><input id="elCams" value="16" style="width:80px"></div>
      <div class="field"><label>每台功率 W</label><input id="elCw" value="15" style="width:80px"></div>`, 'elBtn4', 'elOut4')}
  </div>`);
  const run = async (calc, data, outId) => {
    const el = $(outId); el.innerHTML = '<div class="loading">计算中...</div>';
    try {
      const r = await api('/api/elec', { method: 'POST', body: JSON.stringify({ calc, ...data }) });
      const items = { total_w: '总功率', recommend_psu_w: '建议电源功率(×1.5)', total_m: '线材总长', boxes_305m: '所需箱数(305m/箱)', btu: '发热量 BTU', kw: '发热量 kW', recommend: '推荐功率(×1.3)' };
      el.innerHTML = `
        <div class="kv"><span class="k">公式</span><span class="v">${esc(r.formula)}</span></div>
        ${Object.entries(items).filter(([k])=>r[k]!==undefined).map(([k,label])=>`<div class="kv"><span class="k">${label}</span><span class="v" style="color:var(--accent);font-weight:700">${r[k]} ${k.includes('w')||k.includes('btu')||k==='kw'?'':''}</span></div>`).join('')}
        <div class="notice green" style="margin-top:8px">✅ ${esc(r.note || '')}</div>`;
    } catch (e) { el.innerHTML = `<div class="notice red">${esc(e.message)}</div>`; }
  };
  $('#elBtn1').onclick = () => run('power', { voltage: $('#elV').value, current: $('#elI').value, devices: $('#elN').value }, '#elOut1');
  $('#elBtn2').onclick = () => run('cooling', { power: $('#elW').value }, '#elOut2');
  $('#elBtn3').onclick = () => run('cable', { rooms: $('#elR').value, per_room: $('#elPer').value }, '#elOut3');
  $('#elBtn4').onclick = () => run('poe', { cams: $('#elCams').value, watt: $('#elCw').value }, '#elOut4');
}

// ================= 路由表（真实） =================
function renderRoute() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在读取本机路由表...</div>');
  api('/api/route').then(r => {
    const def = r.routes.filter(x => x.dest === 'default' || x.dest.startsWith('default'));
    setContent(`
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));margin-bottom:14px">
      <div class="card"><div class="big-num">${r.count}</div><div class="kv"><span class="k">路由条目</span></div></div>
      <div class="card"><div class="big-num" style="color:var(--green)">${def.length ? def.map(d=>d.gateway).join(', ') : '—'}</div><div class="kv"><span class="k">默认网关</span></div></div>
      <div class="card"><div class="big-num">${r.routes.filter(x=>x.iface).length}</div><div class="kv"><span class="k">带接口条目</span></div></div>
    </div>
    <div class="card"><h3>路由表明细（真实数据）</h3>
      <div class="kv"><span class="k">数据源</span><span class="v" style="font-size:11px">${esc(r.source)}</span></div>
      <table>
        <tr><th>目标网络</th><th>网关</th><th>标志</th><th>接口</th></tr>
        ${r.routes.map(x => `<tr><td style="font-family:monospace">${esc(x.dest)}</td><td style="font-family:monospace">${esc(x.gateway)}</td><td style="font-family:monospace">${esc(x.flags)}</td><td style="font-family:monospace">${esc(x.iface)}</td></tr>`).join('')}
      </table>
    </div>`);
  }).catch(e => setContent(`<div class="notice red">读取失败：${esc(e.message)}</div>`));
}

// ================= 端口映射（演示） =================
function renderPortmap() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在读取 NAT 映射...</div>');
  api('/api/portmap').then(r => {
    setContent(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div class="notice green" style="margin:0">🔀 端口映射/NAT 规则（弱电项目典型配置）</div>
      <button class="btn-main" onclick="addPortmap()">＋ 新增映射</button>
    </div>
    <div class="card" style="max-width:1000px">
      ${demoBanner({demo_note: r.demo_note})}
      <table>
        <tr><th>名称</th><th>协议</th><th>外部地址:端口</th><th>内部地址:端口</th><th>说明</th><th>操作</th></tr>
        ${r.maps.map((m,i) => `<tr>
          <td>${esc(m.name)}</td><td style="font-family:monospace">${m.proto}</td>
          <td style="font-family:monospace">${esc(m.ext)}</td><td style="font-family:monospace">${esc(m.int)}</td>
          <td style="font-size:11px;color:var(--dim)">${esc(m.note)}</td>
          <td>
            <button class="btn-refresh" style="padding:2px 8px;font-size:11px" onclick="editPortmap(${i})">编辑</button>
            <button class="btn-refresh" style="padding:2px 8px;font-size:11px" onclick="delPortmap(${i},'${esc(m.name)}')">删除</button>
          </td>
        </tr>`).join('')}
      </table>
    </div>`);
    window.addPortmap = () => {
      showModal('＋ 新增端口映射', `
        <div class="modal-msg info">新增端口映射规则（演示模式，真实环境将写入路由器/防火墙）</div>
        <div class="field"><label>规则名称</label><input id="pmName" value="新摄像机" style="width:100%"></div>
        <div class="field"><label>外部端口</label><input id="pmExt" value="8082" style="width:100%"></div>
        <div class="field"><label>内部 IP</label><input id="pmIntIp" value="192.168.1.65" style="width:100%"></div>
        <div class="field"><label>内部端口</label><input id="pmIntPort" value="80" style="width:100%"></div>
      `, { onConfirm: () => {
        modalSetBusy(true);
        setTimeout(()=>{modalMsg('ok', '✔ 映射规则已添加（演示）'); modalSetBusy(false);}, 600);
      }});
    };
    window.editPortmap = (i) => {
      showModal('✏️ 编辑映射', `<div class="notice yellow">编辑功能演示：修改后点击保存生效</div>
        <div class="field"><label>名称</label><input value="${esc(r.maps[i].name)}" style="width:100%"></div>
        <div class="field"><label>内部 IP:端口</label><input value="${esc(r.maps[i].int)}" style="width:100%"></div>`, { confirmText: '保存' });
    };
    window.delPortmap = (i, name) => {
      showModal('🗑 删除映射', `<div class="notice red">确认删除映射「${name}」？该操作将断开对应端口的外部访问。</div>`, {
        onConfirm: () => { modalSetBusy(true); setTimeout(()=>{modalMsg('ok', '✔ 已删除（演示）'); modalSetBusy(false);}, 500); },
        confirmText: '确认删除'
      });
    };
  }).catch(e => setContent(`<div class="notice red">读取失败：${esc(e.message)}</div>`));
}

// ================= WOL 网络唤醒（真实） =================
function renderWol() {
  setContent(`
  <div class="grid">
    <div class="card"><h3>💤 远程唤醒设备（Wake-on-LAN）</h3>
      <div class="form-row">
        <div class="field"><label>设备 MAC 地址</label><input id="wolMac" placeholder="00:11:22:33:44:55" style="width:200px"></div>
        <div class="field"><label>设备名称(可选)</label><input id="wolName" placeholder="如 二楼NVR" style="width:150px"></div>
      </div>
      <button class="btn-main" onclick="wolSend()">📡 发送唤醒包</button>
      <div id="wolOut"></div>
      <div class="notice yellow" style="margin-top:12px">💡 要求：目标设备已接入网线、BIOS/网卡开启 WOL（Wake on LAN）、处于软关机/待机状态。</div>
    </div>
    <div class="card"><h3>📇 常用设备清单（演示）</h3>
      <table>
        <tr><th>设备</th><th>MAC</th><th>操作</th></tr>
        <tr><td>NVR-一楼</td><td style="font-family:monospace">00:11:22:33:44:55</td><td><button class="btn-refresh" style="padding:2px 8px;font-size:11px" onclick="wolQuick('00:11:22:33:44:55','NVR-一楼')">唤醒</button></td></tr>
        <tr><td>门禁主机</td><td style="font-family:monospace">A4:9B:13:CC:12:88</td><td><button class="btn-refresh" style="padding:2px 8px;font-size:11px" onclick="wolQuick('A4:9B:13:CC:12:88','门禁主机')">唤醒</button></td></tr>
        <tr><td>机房服务器</td><td style="font-family:monospace">00:0C:29:AA:BB:10</td><td><button class="btn-refresh" style="padding:2px 8px;font-size:11px" onclick="wolQuick('00:0C:29:AA:BB:10','机房服务器')">唤醒</button></td></tr>
      </table>
    </div>
  </div>`);
  window.wolSend = async () => {
    const mac = $('#wolMac').value.trim();
    if (!mac) { $('#wolOut').innerHTML = '<div class="notice red">请输入 MAC 地址</div>'; return; }
    $('#wolOut').innerHTML = '<div class="loading">正在广播魔术包…</div>';
    try {
      const r = await api('/api/wol', { method: 'POST', body: JSON.stringify({ mac }) });
      $('#wolOut').innerHTML = `<div class="notice green">✔ ${esc(r.status)}：${esc(r.detail)}</div>`;
      showModal('💤 唤醒完成', `<div class="modal-msg ok">已向 <b style="font-family:monospace">${r.mac}</b> 发送 WOL 魔术包（端口 9/7，全网广播）</div>
      <div class="notice yellow">设备应在 10-60 秒内启动。若未唤醒：<br>1. 确认设备 BIOS 开启 WOL<br>2. 确认设备为软关机而非断电<br>3. 部分网线供电设备需 PoE 激活</div>`);
    } catch (e) { $('#wolOut').innerHTML = `<div class="notice red">发送失败：${esc(e.message)}</div>`; }
  };
  window.wolQuick = (mac, name) => {
    $('#wolMac').value = mac;
    $('#wolName').value = name;
    wolSend();
  };
}

// ================= UPS 监控（演示） =================
function renderUps() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在连接 UPS …</div>');
  api('/api/ups').then(r => {
    const batt = gaugeSVG('upsBatt', r.battery_pct, 0, 100, r.battery_pct > 50 ? '#34d399' : r.battery_pct > 20 ? '#fbbf24' : '#f87171');
    const load = gaugeSVG('upsLoad', r.load_pct, 0, 100, '#38bdf8');
    setContent(`
    <div class="dash-top">
      <div class="gauge-row">
        <div class="gauge">${batt}<div class="g-val">${r.battery_pct}%</div><div class="g-label">电池电量</div></div>
        <div class="gauge">${load}<div class="g-val">${r.load_pct}%</div><div class="g-label">负载率</div></div>
        <div class="gauge"><div style="padding-top:24px"><div class="big-num" style="font-size:26px">${r.runtime_min}<small> min</small></div><div class="g-label">电池续航</div></div></div>
      </div>
    </div>
    ${demoBanner({demo_note: r.demo_note})}
    <div class="grid">
      <div class="card"><h3>🔋 UPS 设备参数</h3>
        <div class="kv"><span class="k">型号</span><span class="v">${esc(r.model)}</span></div>
        <div class="kv"><span class="k">状态</span><span class="v" style="color:var(--green)">${r.status}</span></div>
        <div class="kv"><span class="k">输入电压</span><span class="v">${r.input_v}</span></div>
        <div class="kv"><span class="k">输出电压</span><span class="v">${r.output_v}</span></div>
        <div class="kv"><span class="k">设备温度</span><span class="v">${r.temp}℃</span></div>
        <div class="kv"><span class="k">上次自检</span><span class="v">${esc(r.last_test)}</span></div>
      </div>
      <div class="card"><h3>📊 实时监测（演示）</h3>
        <div class="kv"><span class="k">市电状态</span><span class="v" style="color:var(--green)">正常 AC 220V</span></div>
        <div class="kv"><span class="k">负载功率</span><span class="v">${r.load_pct}% (约 1.3kW)</span></div>
        <div class="kv"><span class="k">电池电压</span><span class="v">${r.voltage}V (${r.elec}A)</span></div>
        <div class="kv"><span class="k">告警</span><span class="v" style="color:var(--green)">无</span></div>
        <div class="notice green" style="margin-top:10px">断电时自动切换电池供电，预计可支撑 ${r.runtime_min} 分钟</div>
      </div>
      <div class="card"><h3>⚡ 能力</h3>
        <div style="font-size:12px;color:var(--dim);line-height:2">${esc(r.feature)}</div>
        <div style="margin-top:10px"><button class="btn-refresh" onclick="upsTest()">🔄 立即自检</button> <button class="btn-refresh" onclick="renderUps()">刷新</button></div>
        <div id="upsOut" style="margin-top:8px"></div>
      </div>
    </div>`);
    requestAnimationFrame(() => { setGauge('upsBatt', r.battery_pct); setGauge('upsLoad', r.load_pct); });
    window.upsTest = () => {
      $('#upsOut').innerHTML = '<div class="loading">正在自检（约 5 秒）…</div>';
      setTimeout(()=>{
        $('#upsOut').innerHTML = `<div class="notice green">✔ 自检通过：电池 ${r.battery_pct}%，逆变正常，无异常</div>`;
        showModal('✅ UPS 自检完成', '<div class="modal-msg ok">自检通过，各组件正常（演示）</div><div class="notice green">电池状态良好，可支撑约 18 分钟</div>');
      }, 1500);
    };
  }).catch(e => setContent(`<div class="notice red">UPS 连接失败：${esc(e.message)}</div>`));
}

// ================= 串口工具（演示） =================
function renderSerial() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在扫描串口设备...</div>');
  api('/api/serial').then(r => {
    setContent(`
    <div class="grid">
      <div class="card"><h3>🔌 串口终端</h3>
        ${demoBanner({demo_note: r.demo_note})}
        <div class="form-row">
          <div class="field"><label>端口</label><select id="serPort" style="padding:8px;background:var(--panel2);border:1px solid var(--border);border-radius:6px;color:var(--text)">${r.ports.map(p=>`<option>${p}</option>`).join('')}</select></div>
          <div class="field"><label>波特率</label><select id="serBaud" style="padding:8px;background:var(--panel2);border:1px solid var(--border);border-radius:6px;color:var(--text)">${r.params.baud.map(b=>`<option ${b===9600?'selected':''}>${b}</option>`).join('')}</select></div>
        </div>
        <div class="form-row">
          <div class="field"><label>数据位</label><select style="padding:8px;background:var(--panel2);border:1px solid var(--border);border-radius:6px;color:var(--text)">${r.params.data.map(d=>`<option>${d}</option>`).join('')}</select></div>
          <div class="field"><label>停止位</label><select style="padding:8px;background:var(--panel2);border:1px solid var(--border);border-radius:6px;color:var(--text)">${r.params.stop.map(s=>`<option>${s}</option>`).join('')}</select></div>
          <div class="field"><label>校验</label><select style="padding:8px;background:var(--panel2);border:1px solid var(--border);border-radius:6px;color:var(--text)">${r.params.parity.map(p=>`<option>${p}</option>`).join('')}</select></div>
        </div>
        <button class="btn-main" onclick="serialOpen()">🔓 打开串口</button> <button class="btn-refresh" onclick="serialSend()">发送数据</button>
        <div id="serOut" class="result-box" style="margin-top:10px;height:180px;overflow-y:auto;font-size:11px">串口终端等待打开…</div>
        <div class="kv" style="margin-top:8px"><span class="k">发送</span><input id="serTx" value="AT+VER" style="width:100%;background:var(--panel2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px;font-family:monospace"></div>
      </div>
      <div class="card"><h3>📚 能力与场景</h3>
        <div style="font-size:12px;color:var(--dim);line-height:2.2">${esc(r.feature)}</div>
        <div class="notice yellow" style="margin-top:10px">💡 ${esc(r.hint)}</div>
        <div class="card" style="margin-top:12px;background:var(--panel2)"><h3 style="color:var(--text)">典型 485 云台控制指令（演示）</h3>
          <div class="result-box" style="border:none">0xFF 0x01 0x00 0x08 0x00 0x00 0x00 0x00  // 云台上转
0xFF 0x01 0x00 0x10 0x00 0x00 0x00 0x00  // 云台下转
0xFF 0x01 0x00 0x04 0x00 0x20 0x00 0x00  // 云台左转
0xFF 0x01 0x00 0x02 0x00 0x20 0x00 0x00  // 云台右转</div>
        </div>
      </div>
    </div>`);
    window.serialOpen = () => {
      const port = $('#serPort').value, baud = $('#serBaud').value;
      $('#serOut').innerHTML += `[${new Date().toLocaleTimeString()}] 打开 ${port} @ ${baud}bps... OK（演示）\n`;
      showModal('🔓 串口已打开', `<div class="modal-msg ok">${port} @ ${baud}bps 8N1 已连接（演示模式）</div>
      <div class="notice yellow">真实使用需插入 USB 转串口模块并授予权限</div>`);
    };
    window.serialSend = () => {
      const tx = $('#serTx').value;
      $('#serOut').innerHTML += `[${new Date().toLocaleTimeString()}] TX: ${tx}\nRX: ${tx === 'AT+VER' ? 'OK V1.0.2' : 'OK'}（演示响应）\n`;
      $('#serOut').scrollTop = $('#serOut').scrollHeight;
    };
  }).catch(e => setContent(`<div class="notice red">扫描失败：${esc(e.message)}</div>`));
}

// ================= WiFi 信息（真实读取） =================
function renderWifiPwd() {
  setContent('<div class="loading"><span class="spin">🔄</span> 正在读取已保存 WiFi 网络...</div>');
  api('/api/wifipwd').then(r => {
    setContent(`
    <div class="grid">
      <div class="card"><h3>📶 已保存的 WiFi 网络</h3>
        <div class="kv"><span class="k">WiFi 接口</span><span class="v" style="font-family:monospace">${esc(r.wifi_iface)}</span></div>
        <div class="kv"><span class="k">数据源</span><span class="v" style="font-size:11px">${esc(r.source)}</span></div>
        ${r.demo ? demoBanner(r) : `<div class="notice green">✔ 已从系统读取到 ${r.ssids.length} 个已保存网络</div>`}
        ${r.ssids.length ? `<table style="margin-top:10px">
          <tr><th>SSID</th><th>操作</th></tr>
          ${r.ssids.map(s => `<tr><td style="font-family:monospace">${esc(s)}</td><td><button class="btn-refresh" style="padding:2px 8px;font-size:11px" onclick="showWifiPwd('${esc(s)}')">🔑 读取密码</button></td></tr>`).join('')}
        </table>` : '<div class="notice yellow" style="margin-top:10px">未检测到已保存网络（本机可能未连接过 WiFi）</div>'}
      </div>
      <div class="card"><h3>🔑 密码查看</h3>
        <div id="wifiPwdOut">
          <div class="notice yellow">点击左侧网络名称的「读取密码」按钮<br>（演示模式：将模拟显示密码；真实读取需 keychain 授权）</div>
        </div>
      </div>
    </div>`);
    window.showWifiPwd = (ssid) => {
      showModal(`🔑 ${ssid} 的 WiFi 密码`, `
        <div class="modal-msg info">通过钥匙串读取（演示：模拟密码）</div>
        <div style="text-align:center;padding:16px">
          <div style="font-size:11px;color:var(--dim);margin-bottom:6px">WiFi 密码</div>
          <div style="font-family:monospace;font-size:22px;letter-spacing:2px;color:var(--green);background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:12px" id="wifiPwdVal">••••••••</div>
        </div>
        <div class="btn-row" style="justify-content:center">
          <button class="btn-main" onclick="revealPwd()">👁 显示</button>
          <button class="btn-refresh" onclick="copyPwd()">📋 复制</button>
        </div>
      `);
      window.revealPwd = () => { const el = document.getElementById('wifiPwdVal'); el.textContent = 'demo@wifi.2026'; document.getElementById('dynModalMsg')?.remove(); modalMsg('ok', '已显示（演示密码）'); };
      window.copyPwd = () => { navigator.clipboard?.writeText('demo@wifi.2026'); modalMsg('ok', '已复制到剪贴板'); };
    };
  }).catch(e => setContent(`<div class="notice red">读取失败：${esc(e.message)}</div>`));
}

// ================= AI 运维助手（离线规则） =================
function renderAiChat() {
  setContent(`
  <div class="card" style="max-width:860px;height:calc(100vh - 140px);display:flex;flex-direction:column">
    <div class="modal-msg info">🤖 AI 运维助手 — 离线规则引擎（演示），可咨询网络故障、弱电运维、设备配置等问题</div>
    <div id="aiChatBox" class="result-box" style="flex:1;min-height:260px;font-size:13px">
      <div style="color:var(--accent)">🤖 助手：你好，我是运维助手。可以问我：</div>
      <div style="color:var(--dim);margin-top:6px">• 网络不通怎么排查？<br>• 摄像头不显示画面怎么办？<br>• WiFi 信号差如何优化？<br>• 交换机怎么配置 VLAN？<br>• 供电功率怎么计算？<br>• 设备 IP 冲突怎么处理？</div>
    </div>
    <div class="form-row" style="margin-top:10px;margin-bottom:0">
      <input id="aiInput" placeholder="输入运维问题，如：监控画面黑屏了怎么办" style="flex:1;background:var(--panel2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:12px;font-size:13px">
      <button class="btn-main" onclick="aiAsk()">发送</button>
    </div>
    <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
      ${['网络不通','摄像头黑屏','WiFi 慢','VLAN 配置','供电功率','IP 冲突'].map(t => `<button class="btn-refresh" style="font-size:11px" onclick="quickAsk('${t}')">${t}</button>`).join('')}
    </div>
  </div>`);
  window.quickAsk = (q) => { $('#aiInput').value = q; aiAsk(); };
  window.aiAsk = async () => {
    const q = $('#aiInput').value.trim();
    if (!q) return;
    const box = $('#aiChatBox');
    box.innerHTML += `<div style="color:var(--accent);margin-top:10px">你：${esc(q)}</div>\n`;
    box.innerHTML += '<div style="color:var(--dim)">🤖 思考中…</div>';
    box.scrollTop = box.scrollHeight;
    try {
      const r = await api('/api/aihelp', { method: 'POST', body: JSON.stringify({ question: q }) });
      box.innerHTML = box.innerHTML.replace('🤖 思考中…', `🤖 助手：${r.reply}\n<span style="color:var(--dim);font-size:11px">(${r.demo_note})</span>`);
    } catch (e) {
      box.innerHTML = box.innerHTML.replace('🤖 思考中…', `🤖 助手：出错了 ${esc(e.message)}`);
    }
    $('#aiInput').value = '';
    box.scrollTop = box.scrollHeight;
  };
}

// ================= 关于 =================
function renderAbout() {
  api('/api/info').then(d => {
    setContent(`
    <div class="grid">
      <div class="card"><h3>关于本工具</h3>
        <p style="font-size:13px;line-height:1.8;color:var(--dim)">
        网络测试工具箱 V9.0（复刻核心版）—— 弱电人必备的网络测试工具集。<br>
        基于视频《网络测试工具箱 V90 更新了》界面复刻，提供网络健康检查、Ping、路由追踪、端口扫描、主机发现、会话数测试、外网/内网测速、DHCP 检测、子网计算、MAC 查询等真实功能。<br><br>
        <b style="color:var(--text)">技术栈：</b>Python Flask + 原生 HTML/CSS/JS（零前端构建）<br>
        <b style="color:var(--text)">运行环境：</b>${esc(d.os)} / Python ${esc(d.python)}<br>
        <b style="color:var(--text)">服务地址：</b><span style="font-family:monospace;color:var(--accent)">http://${d.lan_ip}:${location.port}</span>
        </p>
      </div>
      <div class="card"><h3>运行信息</h3>
        <div class="kv"><span class="k">主机名</span><span class="v">${esc(d.hostname)}</span></div>
        <div class="kv"><span class="k">运行时间</span><span class="v">${d.uptime}</span></div>
        <div class="kv"><span class="k">CPU</span><span class="v">${d.cpu}%</span></div>
        <div class="kv"><span class="k">内存</span><span class="v">${d.mem_pct}% (${d.mem_used_gb.toFixed(1)}/${d.mem_total_gb.toFixed(1)} GB)</span></div>
      </div>
    </div>
    <div class="notice yellow" style="margin-top:14px">⚠️ 所有功能均为真实网络检测命令执行结果，仅限本机/授权内网使用，请勿用于未授权扫描。</div>`);
  }).catch(() => setContent('<div class="notice red">信息获取失败</div>'));
}

// ---- 时钟 ----
function tick() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  $('#top-time').textContent = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  $('#clock').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
setInterval(tick, 1000); tick();

// 初始化
initNav();
switchPage('dashboard');
setInterval(async () => {
  try { await api('/api/health'); $('#net-status').style.color = 'var(--green)'; }
  catch (e) { $('#net-status').style.color = 'var(--red)'; }
}, 30000);