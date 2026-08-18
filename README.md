# 🛠️ 网络测试工具箱 V9.0 / Network Test Toolbox V9.0

> **中文**：弱电人必备的一站式网络测试工具箱 — 深色主题 Web 应用，基于《网络测试工具箱 V90 更新了！》视频界面复刻，所有功能真实执行系统命令。
>
> **English**: An all-in-one network testing toolbox for low-voltage/ELV engineers — a dark-themed web app whose UI is inspired by the "网络测试工具箱 V90" video. Every feature executes real system commands (no fake data).

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![Flask](https://img.shields.io/badge/Flask-3.x-lightgrey)
![TShark](https://img.shields.io/badge/TShark-4.x-green)
![License](https://img.shields.io/badge/License-MIT-orange)

---

## ✨ 功能总览 / Feature Overview

**29 个功能模块 / 29 feature modules** — dark professional UI, grouped left navigation, all real data:

### 📡 核心检测 / Core Diagnostics

| 模块 / Module | 说明 / Description |
|---|---|
| 🏠 工作台 / Dashboard | 本机信息 / CPU·内存·磁盘环形仪表 / 实时上下行流量趋势图 / TCP 状态分布 / 网络接口 / 通知消息. Host info, CPU/mem/disk ring gauges, live traffic trend chart, TCP state distribution, interfaces, notifications. |
| ❤️ 网络健康检查 / Health Check | 6 项检测（网关连通性·丢包·延迟 / DNS 解析 / 外网 HTTP / 公共DNS / 本地端口），评分环动画. 6 checks (gateway reachability/ping-loss/latency, DNS resolution, internet HTTP, public DNS, local ports) with animated score ring. |
| 📡 Ping 测试 / Ping Test | 延迟波动折线图 + 统计卡 + 历史记录. Latency sparkline + stats cards + history. |
| 🧭 路由追踪 / Traceroute | traceroute 逐跳分析. Per-hop analysis. |
| 🔍 端口扫描 / Port Scan | 常见端口快速扫描，服务识别. Fast common-port scan with service detection. |
| 🖥️ 主机发现 / Host Discovery | ARP 表 + 厂商 OUI 识别 + 全网段探测 + 快捷 Ping/扫端口. ARP table, vendor OUI lookup, sweep probe, quick Ping/scan. |
| 🔗 会话数测试 / Session Test | TCP 连接状态统计. TCP connection state stats. |
| ⚡ 外网测速 / Speed Test | SVG 速度表盘 + 多测速源（Cloudflare/中科大/阿里云）+ 历史记录. SVG speed gauge, multiple sources, history. |
| ↔️ 内网测速 / LAN Test | 对端延迟/丢包检测. Peer latency/loss check. |
| 📋 DHCP 检测 / DHCP Check | 本机网络配置 + 子网范围. Local network config + subnet range. |
| ⚠️ IP冲突检测 / IP Conflict | ARP 表扫描同 IP 多 MAC. Scans ARP table for IPs with multiple MACs. |

### 📹 摄像头 / Camera
- **摄像头扫描 / Camera Scan**：多品牌识别（海康/大华/科达/TP-LINK）、统计卡（在线/离线/弱密码/可预览）、4 标签页（设备列表 / 在线预览 / 批量升级 / 远程调试）、每台设备预览/改密/升级/重启操作（模态框交互）. Multi-vendor identification (Hikvision/Dahua/Kedacom/TP-LINK), stats cards, 4 tabs (device list / live preview / batch upgrade / remote debug), per-device preview/password/upgrade/reboot via modal dialogs.
- *（演示数据标注：需内网真实摄像头设备 / *Demo data flagged — requires real cameras on the LAN)*

### 📦 协议分析/抓包 / Packet Analysis & Capture（EasyTshark 风格 / EasyTshark-style, TShark engine）
- 📦 **数据包列表 / Packet List**：tshark JSON 解析，Wireshark 过滤表达式，点击展开协议树. tshark JSON parsing, Wireshark display filters, click-to-expand protocol tree.
- 🔗 **会话分析 / Sessions**：TCP/UDP 双向通信链路. TCP/UDP conversation pairs.
- 📊 **统计分析 / Statistics**：协议层级树 + IP 通信热点条形图. Protocol hierarchy + IP endpoint bar charts.
- 🖥️ **进程关联 / Process Map**：lsof 本机连接↔进程映射. Map local connections to processes via lsof.
- 🟢 **实时抓包 / Live Capture**：选网卡 → 开始抓包（写入 pcapng）→ 停止 → 自动四视图分析. Pick interface → capture to pcapng → stop → auto-analyze in all four views.
- ⬆ 上传 pcap/pcapng 离线分析 / Upload pcap/pcapng for offline analysis.

### 🧰 运维 / Ops Tools
| 模块 / Module | 说明 / Description |
|---|---|
| 🧱 防火墙配置 / Firewall | 典型弱电网关规则（演示标注）. Typical ELV gateway rules (demo-flagged). |
| 🔀 端口映射 / Port Mapping | NAT 规则增删改（模态框）. NAT rule CRUD via modals. |
| 🗺️ 路由表 / Routing Table | 真实 netstat 路由表. Real `netstat` routing table. |
| 🖥️ 远程工具 / Remote Tools | 设备清单 + 串口设备. Device inventory + serial devices. |
| 💤 WOL 网络唤醒 / Wake-on-LAN | 真实魔术包广播（255.255.255.255:9/7）. Real magic-packet broadcast. |
| 🔌 串口工具 / Serial Tool | 终端收发 + 485 云台指令. Terminal + PTZ 485 commands. |
| 🔋 UPS 监控 / UPS Monitor | 电池/负载仪表 + 自检. Battery/load gauges + self-test. |
| 📶 WiFi 信息 / WiFi Info | 已保存网络 + 密码读取. Saved networks + password read. |
| 📖 运维百宝箱 / Command Library | 华为/思科/H3C/锐捷/Windows/Linux 命令大全. Huawei/Cisco/H3C/Ruijie/Windows/Linux command references. |
| ⚙️ 弱电计算 / ELV Calculator | 供电功率 / 机柜散热 / 网线预算 / PoE 预算. Power supply, rack cooling, cabling budget, PoE budget. |
| 🤖 AI 运维助手 / AI Assistant | 离线知识库问答（10 大运维场景）. Offline knowledge-base Q&A (10 ops scenarios). |

### 🧮 工具 / Utilities
子网计算 / Subnet Calculator · IP-MAC 厂商查询 / MAC Vendor Lookup · 关于 / About

---

## 🚀 快速开始 / Quick Start

### 依赖 / Dependencies
- Python 3.10+
- [TShark](https://www.wireshark.org/)（抓包分析引擎 / capture-analysis engine，`brew install wireshark`）
- macOS 实时抓包需 BPF 权限 / Live capture on macOS needs BPF access（`brew install --cask wireshark-chmodbpf`）

### 安装运行 / Install & Run
```bash
git clone <repo-url> && cd network-toolbox
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# 启动（默认 8088 端口 / Start (default port 8088)
./venv/bin/python app.py 8088
# 浏览器访问 / Visit http://localhost:8088
```

### macOS 实时抓包权限（可选 / Optional live-capture permission）
```bash
brew install --cask wireshark-chmodbpf   # 需要 sudo / requires sudo
# 或临时授权 / or grant temporarily:
sudo chmod 644 /dev/bpf*
```

---

## 📚 API 文档 / API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/info` | 本机信息 / Host info (IP/MAC/gateway/DNS/CPU/mem/disk) |
| GET | `/api/dashboard` | 工作台聚合数据 / Dashboard aggregate (TCP states, interfaces) |
| POST | `/api/ping` | Ping 测试 / Ping test `{host, count, size}` |
| POST | `/api/traceroute` | 路由追踪 / Traceroute `{host}` |
| POST | `/api/portscan` | 端口扫描 / Port scan `{host, ports}` |
| GET | `/api/hosts` | ARP 主机发现 / ARP host discovery |
| GET | `/api/health` | 6 项健康检查评分 / 6-item health score |
| GET | `/api/sessions` | TCP 会话统计 / TCP session stats |
| POST | `/api/speedtest` | 外网测速 / Speed test `{kind, source}` |
| POST | `/api/subnet` | 子网计算 / Subnet calc `{ip, prefix}` |
| POST | `/api/maclookup` | MAC 厂商查询 / MAC vendor lookup `{mac}` |
| POST | `/api/ipconflict` | IP 冲突检测 / IP conflict detection |
| GET | `/api/logs` | 系统日志审计 / System log audit |
| GET | `/api/devcmds?vendor=` | 设备命令库 / Command library (huawei/cisco/h3c/ruijie/windows/linux) |
| POST | `/api/elec` | 弱电计算 / ELV calculator `{calc, ...}` |
| GET | `/api/route` | 路由表 / Routing table |
| POST | `/api/wol` | WOL 唤醒 / Wake-on-LAN `{mac}` |
| GET | `/api/wifipwd` | WiFi 已保存网络 / Saved WiFi networks |
| GET | `/api/ups` | UPS 监控（演示）/ UPS monitor (demo) |
| GET | `/api/serial` | 串口工具（演示）/ Serial tool (demo) |
| POST | `/api/aihelp` | AI 运维问答 / AI ops Q&A `{question}` |
| GET | `/api/etshark/files` | 抓包文件列表 / Capture file list |
| POST | `/api/etshark/upload` | 上传 pcap / Upload pcap (multipart) |
| GET | `/api/etshark/packets` | 数据包列表 / Packet list `?path=&filter=&limit=` |
| GET | `/api/etshark/sessions` | 会话分析 / Sessions `?path=&proto=` |
| GET | `/api/etshark/stats` | 统计分析 / Stats (protocol hierarchy + IP) |
| GET | `/api/etshark/process` | 进程关联 / Process map |
| GET | `/api/etshark/ifaces` | 网卡列表 / Interface list |
| POST | `/api/etshark/capture/start` | 实时抓包 / Start capture `{iface}` |
| POST | `/api/etshark/capture/stop` | 停止抓包 / Stop capture |
| GET | `/api/etshark/capture/status` | 抓包状态 / Capture status |

---

## 📁 项目结构 / Project Structure
```
network-toolbox/
├── app.py               # Flask 后端（30+ API）/ Flask backend (30+ APIs)
├── templates/index.html # 深色 UI 布局 / Dark UI layout
├── static/
│   ├── style.css        # 主题样式（含模态框/图表/四视图）/ Styles (modals, charts, four views)
│   └── app.js           # 前端逻辑（29 页面）/ Frontend logic (29 pages)
├── captures/            # 上传/实时抓包的 pcap 文件 / Captured & uploaded pcap files
└── venv/                # Python 虚拟环境 / Virtual environment
```

---

## ⚠️ 数据说明 / Data Notes
- **真实功能 / Real features**：工作台/Ping/路由/端口扫描/主机发现/健康检查/测速/会话/抓包/路由表/WOL/子网/命令库/弱电计算等全部执行真实系统命令. Dashboard/Ping/traceroute/port scan/host discovery/health/speed/sessions/capture/routing/WOL/subnet/command library/ELV calc all run real system commands.
- **演示数据 / Demo data**：摄像头扫描/WiFi分析/防火墙/端口映射/UPS/串口/远程工具等需要内网设备配合的模块，界面有黄色横幅明确标注「演示数据」. Camera scan/WiFi analysis/firewall/port mapping/UPS/serial/remote tools need LAN devices and are clearly flagged with a yellow "demo data" banner.
- 仅限本机及授权内网使用，请勿用于未授权扫描 / For local & authorized LAN use only. Do not scan without authorization.

---

## 🙏 致谢 / Acknowledgements
- 抓包模块借鉴 [EasyTshark](https://github.com/xuanyuanzhifeng/easytshark)（开源网络抓包分析软件）的四视图交互设计，引擎使用 Wireshark/TShark. Capture module adopts the four-view interaction design of EasyTshark (open-source packet analysis software); engine: Wireshark/TShark.
- 界面灵感来自抖音「debugnet」的网络测试工具箱视频. UI inspired by the network-test-toolbox video by "debugnet" on Douyin.

## 📄 License
MIT License — see [LICENSE](LICENSE)
