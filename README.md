# 🛠️ 网络测试工具箱 V9.0

> 弱电人必备的一站式网络测试工具箱 — 深色主题 Web 应用，基于视频《网络测试工具箱 V90 更新了！》界面复刻，所有功能真实执行系统命令，非演示假数据。

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![Flask](https://img.shields.io/badge/Flask-3.x-lightgrey)
![TShark](https://img.shields.io/badge/TShark-4.x-green)
![License](https://img.shields.io/badge/License-MIT-orange)

## ✨ 功能总览

**29 个功能模块**，深色专业界面，左侧导航分组，全部真实数据：

### 📡 核心检测
| 模块 | 说明 |
|---|---|
| 🏠 工作台 | 本机信息 / CPU·内存·磁盘环形仪表 / 实时上下行流量趋势图 / TCP 状态分布 / 网络接口 / 通知消息 |
| ❤️ 网络健康检查 | 6 项检测（网关连通性·丢包·延迟 / DNS 解析 / 外网 HTTP / 公共DNS / 本地端口），评分环动画 |
| 📡 Ping 测试 | 延迟波动折线图 + 统计卡 + 历史记录 |
| 🧭 路由追踪 | traceroute 逐跳分析 |
| 🔍 端口扫描 | 常见端口快速扫描，服务识别 |
| 🖥️ 主机发现 | ARP 表 + 厂商 OUI 识别 + 全网段探测 + 快捷 Ping/扫端口 |
| 🔗 会话数测试 | TCP 连接状态统计 |
| ⚡ 外网测速 | SVG 速度表盘 + 多测速源（Cloudflare/中科大/阿里云）+ 历史记录 |
| ↔️ 内网测速 | 对端延迟/丢包检测 |
| 📋 DHCP 检测 | 本机网络配置 + 子网范围 |
| ⚠️ IP冲突检测 | ARP 表扫描同 IP 多 MAC |

### 📹 摄像头
- **摄像头扫描**：多品牌识别（海康/大华/科达/TP-LINK）、统计卡（在线/离线/弱密码/可预览）、4 标签页（设备列表 / 在线预览 / 批量升级 / 远程调试）、每台设备预览/改密/升级/重启操作（模态框交互）
- *（演示数据标注：需内网真实摄像头设备）*

### 📦 协议分析/抓包（EasyTshark 风格，TShark 真实引擎）
- 📦 **数据包列表**：tshark JSON 解析，Wireshark 过滤表达式，点击展开协议树
- 🔗 **会话分析**：TCP/UDP 双向通信链路
- 📊 **统计分析**：协议层级树 + IP 通信热点条形图
- 🖥️ **进程关联**：lsof 本机连接↔进程映射
- 🟢 **实时抓包**：选网卡 → 开始抓包（写入 pcapng）→ 停止 → 自动四视图分析
- ⬆ 上传 pcap/pcapng 离线分析

### 🧰 运维
| 模块 | 说明 |
|---|---|
| 🧱 防火墙配置 | 典型弱电网关规则（演示标注） |
| 🔀 端口映射 | NAT 规则增删改（模态框） |
| 🗺️ 路由表 | 真实 netstat 路由表 |
| 🖥️ 远程工具 | 设备清单 + 串口设备 |
| 💤 WOL 网络唤醒 | 真实魔术包广播（255.255.255.255:9/7） |
| 🔌 串口工具 | 终端收发 + 485 云台指令 |
| 🔋 UPS 监控 | 电池/负载仪表 + 自检 |
| 📶 WiFi 信息 | 已保存网络 + 密码读取 |
| 📖 运维百宝箱 | 华为/思科/H3C/锐捷/Windows/Linux 命令大全 |
| ⚙️ 弱电计算 | 供电功率 / 机柜散热 / 网线预算 / PoE 预算 |
| 🤖 AI 运维助手 | 离线知识库问答（10 大运维场景） |

### 🧮 工具
子网计算 / IP-MAC 厂商查询 / 关于

## 📸 界面预览

深色主题，左侧导航分组 + 右侧工作区，实时时钟，状态指示：

```
┌──────────────┬─────────────────────────────────────────┐
│ 🛠️ 网络测试工具箱 │ 网络健康检查评分            ● 2026-08-18 │
│    V9.0        │ ┌─────────┐  6 项检查         🔄 刷新  │
│ ─────────────  │ │  100    │  全部正常                    │
│ 🏠 工作台      │ 检查项    目标        结果      状态    │
│ ❤️ 网络健康检查 │ 网关连通性 .1  丢包 0%   ✔ 正常 │
│ 📡 Ping 测试   │ DNS 解析   .1  7.6ms     ✔ 正常 │
│ ...           │ 外网连通   baidu 200ms  ✔ 正常 │
└──────────────┴─────────────────────────────────────────┘
```

## 🚀 快速开始

### 依赖
- Python 3.10+
- [TShark](https://www.wireshark.org/)（抓包分析引擎，`brew install wireshark`）
- macOS 实时抓包需 BPF 权限（`brew install --cask wireshark-chmodbpf`）

### 安装运行
```bash
git clone <repo-url> && cd network-toolbox
python3 -m venv venv
./venv/bin/pip install flask

# 启动（默认 8088 端口）
./venv/bin/python app.py 8088
# 浏览器访问 http://localhost:8088
```

### macOS 实时抓包权限（可选）
```bash
brew install --cask wireshark-chmodbpf   # 需要 sudo
# 或临时授权：
sudo chmod 644 /dev/bpf*
```

## 📚 API 文档

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/info` | 本机信息（IP/MAC/网关/DNS/CPU/内存/磁盘） |
| GET | `/api/dashboard` | 工作台聚合数据（含 TCP 状态分布、接口列表） |
| POST | `/api/ping` | Ping 测试 `{host, count, size}` |
| POST | `/api/traceroute` | 路由追踪 `{host}` |
| POST | `/api/portscan` | 端口扫描 `{host, ports}` |
| GET | `/api/hosts` | ARP 主机发现 |
| GET | `/api/health` | 6 项健康检查评分 |
| GET | `/api/sessions` | TCP 会话统计 |
| POST | `/api/speedtest` | 外网测速 `{kind, source}` |
| POST | `/api/subnet` | 子网计算 `{ip, prefix}` |
| POST | `/api/maclookup` | MAC 厂商查询 `{mac}` |
| POST | `/api/ipconflict` | IP 冲突检测 |
| GET | `/api/logs` | 系统日志审计 |
| GET | `/api/devcmds?vendor=` | 设备命令库（huawei/cisco/h3c/ruijie/windows/linux） |
| POST | `/api/elec` | 弱电计算 `{calc, ...}` |
| GET | `/api/route` | 路由表 |
| POST | `/api/wol` | WOL 唤醒 `{mac}` |
| GET | `/api/wifipwd` | WiFi 已保存网络 |
| GET | `/api/ups` | UPS 监控（演示） |
| GET | `/api/serial` | 串口工具（演示） |
| POST | `/api/aihelp` | AI 运维问答 `{question}` |
| GET | `/api/etshark/files` | 抓包文件列表 |
| POST | `/api/etshark/upload` | 上传 pcap（multipart） |
| GET | `/api/etshark/packets` | 数据包列表 `?path=&filter=&limit=` |
| GET | `/api/etshark/sessions` | 会话分析 `?path=&proto=` |
| GET | `/api/etshark/stats` | 统计分析（协议层级+IP） |
| GET | `/api/etshark/process` | 进程关联 |
| GET | `/api/etshark/ifaces` | 网卡列表 |
| POST | `/api/etshark/capture/start` | 实时抓包 `{iface}` |
| POST | `/api/etshark/capture/stop` | 停止抓包 |
| GET | `/api/etshark/capture/status` | 抓包状态 |

## 📁 项目结构
```
network-toolbox/
├── app.py               # Flask 后端（30+ API）
├── templates/index.html # 深色 UI 布局
├── static/
│   ├── style.css        # 主题样式（含模态框/图表/四视图）
│   └── app.js           # 前端逻辑（29 页面）
├── captures/            # 上传/实时抓包的 pcap 文件
└── venv/                # Python 虚拟环境
```

## ⚠️ 数据说明
- **真实功能**：工作台/Ping/路由/端口扫描/主机发现/健康检查/测速/会话/抓包/路由表/WOL/子网/命令库/弱电计算等全部执行真实系统命令
- **演示数据**：摄像头扫描/WiFi分析/防火墙/端口映射/UPS/串口/远程工具 等需要内网设备配合的模块，界面有黄色横幅明确标注「演示数据」
- 仅限本机及授权内网使用，请勿用于未授权扫描

## 🙏 致谢
- 抓包模块借鉴 [EasyTshark](https://github.com/xuanyuanzhifeng/easytshark)（开源网络抓包分析软件）的四视图交互设计，引擎使用 Wireshark/TShark
- 界面灵感来自抖音「debugnet」的网络测试工具箱视频

## 📄 License
MIT License — 见 [LICENSE](LICENSE)
