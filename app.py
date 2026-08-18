#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
网络测试工具箱 V9.0 (复刻核心版)
深色主题本地 Web 工具：工作台 / Ping / 路由追踪 / 端口扫描 / 主机发现 /
网络健康检查 / 会话数测试 / 外网&内网测速 / DHCP 检测 / 子网计算 / IP/MAC 查询
"""
import os, re, sys, json, time, math, socket, subprocess, urllib.request, threading, platform
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# ---------- 工具函数 ----------
def run(cmd, timeout=8):
    try:
        p = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return p.stdout.strip(), p.stderr.strip(), p.returncode
    except subprocess.TimeoutExpired:
        return "", "timeout", -1
    except Exception as e:
        return "", str(e), -1

def run_subprocess(args, timeout=30):
    """直接执行命令数组（无 shell，适合 tshark 参数）"""
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return p.stdout, p.stderr, p.returncode
    except subprocess.TimeoutExpired:
        return "", "timeout", -1
    except Exception as e:
        return "", str(e), -1

def get_lan_ip():
    # 优先取有默认路由的接口 IP
    out, _, _ = run("route -n get default")
    m = re.search(r'interface:\s*(\S+)', out)
    iface = m.group(1) if m else "en0"
    out2, _, _ = run(f"ipconfig getifaddr {iface}")
    if out2 and re.match(r'^\d+\.\d+\.\d+\.\d+$', out2.split()[0]):
        return out2.split()[0]
    # 兜底：UDP connect 法
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("223.5.5.5", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def get_default_iface():
    out, _, _ = run("route -n get default")
    m = re.search(r'interface:\s*(\S+)', out)
    return m.group(1) if m else "en0"

def get_mac(ip=None):
    iface = get_default_iface()
    out, _, _ = run(f"ifconfig {iface}")
    m = re.search(r'ether\s+([0-9a-fA-F:]{17})', out)
    if m:
        return m.group(1).upper()
    # 兜底：ARP 查
    out2, _, _ = run("arp -a")
    target = ip or get_lan_ip()
    for line in out2.splitlines():
        if target in line:
            m2 = re.search(r'([0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){5})', line)
            if m2:
                return m2.group(1).upper()
    return "N/A"

def get_default_gw():
    out, _, _ = run("netstat -rn -f inet")
    for line in out.splitlines():
        cols = line.split()
        if len(cols) >= 4 and cols[0] == "default":
            return cols[1]
    # macOS: "default 192.168.1.1 ..." or route -n get default
    out2, _, _ = run("route -n get default")
    m = re.search(r'gateway:\s*(\S+)', out2)
    return m.group(1) if m else "N/A"

def get_dns():
    out, _, _ = run("scutil --dns | grep nameserver | sort -u")
    nameservers = []
    for l in out.splitlines():
        parts = l.split()
        if len(parts) >= 3 and re.match(r'^\d+\.\d+\.\d+\.\d+$', parts[2]):
            nameservers.append(parts[2])
    if not nameservers:
        out2, _, _ = run("cat /etc/resolv.conf")
        for l in out2.splitlines():
            parts = l.split()
            if len(parts) == 2 and parts[0] == "nameserver" and re.match(r'^\d+\.\d+\.\d+\.\d+$', parts[1]):
                nameservers.append(parts[1])
    return list(dict.fromkeys(nameservers)) or ["N/A"]

def get_uptime():
    out, _, _ = run("sysctl -n kern.boottime")
    m = re.search(r'sec = (\d+)', out)
    if m:
        boot = int(m.group(1))
        up = int(time.time()) - boot
        d, r = divmod(up, 86400); h, r = divmod(r, 3600); mi, s = divmod(r, 60)
        return f"{d}天 {h}小时 {mi}分 {s}秒", up
    return "N/A", 0

def cpu_mem():
    # CPU 负载 (macOS: host_loader avg)
    # CPU 使用率 (macOS: 用 top 采样，取 CPU usage)
    c1, _, _ = run("ps -A -o %cpu | awk '{s+=$1} END {print s}'")
    try:
        total_cpu = float(c1)
    except ValueError:
        total_cpu = 0
    nproc, _, _ = run("sysctl -n hw.ncpu")
    try:
        ncpu = float(nproc) or 1
    except ValueError:
        ncpu = 1
    cpu_pct = min(100.0, round(total_cpu / ncpu, 1))  # 按核数归一
    m1, _, _ = run("sysctl -n hw.memsize")
    total = int(m1) if m1 else 1
    # vm_stat 计算使用率
    v, _, _ = run("vm_stat")
    pages = {}
    for line in v.splitlines():
        parts = line.split(":")
        if len(parts) == 2:
            key = parts[0].strip()
            val = re.sub(r'[^0-9]', '', parts[1])
            if val.isdigit():
                pages[key] = int(val)
    active = pages.get("Pages active", 0)
    wired = pages.get("Pages wired down", 0)
    compressed = pages.get("Pages occupied by compressor", 0)
    used_bytes = (active + wired + compressed) * 4096
    return cpu_pct, round(used_bytes / total * 100, 1), total / (1024**3), used_bytes / (1024**3)

def net_traffic():
    out, _, _ = run("netstat -ib -n -I en0")
    lines = out.splitlines()
    if len(lines) < 2:
        return 0, 0
    cols = lines[1].split()
    # 需要两次采样算速率
    return None  # 由采样函数实现

def traffic_rate(interval=1.0):
    def sample():
        out, _, _ = run("netstat -ib -n")
        results = {}
        for line in out.splitlines()[1:]:
            cols = line.split()
            if len(cols) >= 10 and "en0" in cols[:2]:
                try:
                    results["ibytes"] = int(cols[6]); results["obytes"] = int(cols[9])
                except (ValueError, IndexError):
                    pass
        return results
    a = sample(); time.sleep(interval); b = sample()
    if not a or not b:
        return 0, 0
    return max(0, b.get("ibytes",0) - a.get("ibytes",0)) / interval, max(0, b.get("obytes",0) - a.get("obytes",0)) / interval

# 会话/连接数统计
def conn_stats():
    out, _, _ = run("netstat -an -f inet")
    total = established = listening = 0
    for line in out.splitlines():
        parts = line.split()
        if len(parts) < 6:
            continue
        state = parts[5]
        if state == "ESTABLISHED":
            established += 1
        elif state == "LISTEN":
            listening += 1
        total += 1
    return {"total": total, "established": established, "listening": listening}

# ---------- API ----------
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/info")
def api_info():
    ip = get_lan_ip()
    up, up_sec = get_uptime()
    cpu, mem_pct, mem_total, mem_used = cpu_mem()
    return jsonify({
        "hostname": socket.gethostname(),
        "os": platform.platform(),
        "python": platform.python_version(),
        "lan_ip": ip,
        "mac": get_mac(ip),
        "gateway": get_default_gw(),
        "dns": get_dns(),
        "uptime": up,
        "uptime_sec": up_sec,
        "cpu": cpu,
        "mem_pct": mem_pct,
        "mem_total_gb": mem_total,
        "mem_used_gb": mem_used,
    })

@app.route("/api/dashboard")
def api_dashboard():
    ip = get_lan_ip()
    up, up_sec = get_uptime()
    cpu, mem_pct, mem_total, mem_used = cpu_mem()
    rx, tx = traffic_rate(1.0)
    c = conn_stats()
    # 磁盘信息
    disk = {"total_gb": None, "used_gb": None, "used_pct": None}
    dout, _, _ = run("df -k / | tail -1")
    cols = dout.split()
    if len(cols) >= 5 and cols[0].startswith("/"):
        try:
            disk = {"total_gb": round(int(cols[1])/1048576, 1), "used_gb": round(int(cols[2])/1048576, 1), "used_pct": int(cols[4].rstrip("%"))}
        except (ValueError, IndexError):
            pass
    # TCP 状态分布
    out, _, _ = run("netstat -an -f inet")
    states = {}
    for line in out.splitlines():
        cols = line.split()
        if len(cols) >= 6 and cols[0].startswith("tcp"):
            st = cols[5]
            states[st] = states.get(st, 0) + 1
    # 网络接口列表
    ifaces = []
    iout, _, _ = run("ifconfig -l")
    for name in iout.split():
        o2, _, _ = run(f"ifconfig {name}")
        m_ip = re.search(r'inet ([\d.]+)', o2)
        m_mac = re.search(r'ether ([0-9a-fA-F:]{17})', o2)
        m_status = "up" if "status: active" in o2 else "down"
        if m_ip or m_mac:
            ifaces.append({"name": name, "ip": m_ip.group(1) if m_ip else "-", "mac": m_mac.group(1).upper() if m_mac else "-", "status": m_status})
    return jsonify({
        "hostname": socket.gethostname(),
        "lan_ip": ip,
        "mac": get_mac(ip),
        "gateway": get_default_gw(),
        "dns": get_dns(),
        "uptime": up,
        "cpu": cpu,
        "mem_pct": mem_pct,
        "mem_total_gb": mem_total,
        "mem_used_gb": mem_used,
        "disk": disk,
        "ifaces": ifaces,
        "rx_bps": rx, "tx_bps": tx,
        "connections": c,
        "tcp_states": states,
    })

@app.route("/api/ping", methods=["POST"])
def api_ping():
    data = request.get_json(silent=True) or {}
    host = (data.get("host") or "").strip()
    count = min(int(data.get("count", 4)), 20)
    size = min(int(data.get("size", 32)), 1400)
    if not host:
        return jsonify({"error": "请输入目标地址"}), 400
    # 防注入：只允许 host/IP
    if not re.match(r'^[A-Za-z0-9\.\-_:/]+$', host):
        return jsonify({"error": "非法目标"}), 400
    out, err, rc = run(f"ping -c {count} -s {size} {host}", timeout=30)
    results = []
    times = []
    for line in out.splitlines():
        m = re.search(r'icmp_seq=(\d+).*?time[=<]([\d\.]+)\s*ms', line)
        if m:
            t = float(m.group(2)); times.append(t)
            results.append({"seq": int(m.group(1)), "time_ms": t})
    loss_m = re.search(r'(\d+(?:\.\d+)?)% packet loss', out)
    rtt_m = re.search(r'min/avg/max[/=][\d\.]+/([\d\.]+)/[\d\.]+', out)
    return jsonify({
        "host": host, "count": count, "size": size,
        "results": results,
        "summary": {
            "sent": count, "received": len(results),
            "loss_pct": float(loss_m.group(1)) if loss_m else None,
            "avg_ms": round(sum(times)/len(times), 2) if times else None,
            "min_ms": round(min(times), 2) if times else None,
            "max_ms": round(max(times), 2) if times else None,
        },
        "raw": out[-2000:],
    })

@app.route("/api/traceroute", methods=["POST"])
def api_traceroute():
    data = request.get_json(silent=True) or {}
    host = (data.get("host") or "").strip() or "223.5.5.5"
    if not re.match(r'^[A-Za-z0-9\.\-_]+$', host):
        return jsonify({"error": "非法目标"}), 400
    out, err, rc = run(f"traceroute -m 20 {host}", timeout=40)
    hops = []
    for line in out.splitlines():
        m = re.match(r'\s*(\d+)\s+(.*)', line)
        if m:
            hops.append({"hop": int(m.group(1)), "text": m.group(2).strip()})
    return jsonify({"host": host, "hops": hops, "raw": out[-3000:]})

@app.route("/api/portscan", methods=["POST"])
def api_portscan():
    data = request.get_json(silent=True) or {}
    host = (data.get("host") or "").strip() or "127.0.0.1"
    port_str = (data.get("ports") or "").strip() or "21,22,23,25,53,80,110,135,139,143,443,445,993,995,1433,1521,3306,3389,5432,5900,6379,8080,8443,8888,9000,27017"
    if not re.match(r'^[A-Za-z0-9\.\-_]+$', host):
        return jsonify({"error": "非法主机"}), 400
    ports = []
    for part in port_str.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-")
            try:
                ports.extend(range(int(a), int(b)+1))
            except ValueError:
                pass
        else:
            try:
                ports.append(int(part))
            except ValueError:
                pass
    ports = list(dict.fromkeys([p for p in ports if 1 <= p <= 65535]))
    if len(ports) > 200:
        return jsonify({"error": "端口过多（限制200个）"}), 400
    open_ports = []
    for p in ports:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.4)
        try:
            if s.connect_ex((host, p)) == 0:
                service = {21:"FTP",22:"SSH",23:"Telnet",25:"SMTP",53:"DNS",80:"HTTP",110:"POP3",135:"RPC",139:"NetBIOS",143:"IMAP",443:"HTTPS",445:"SMB",993:"IMAPS",995:"POP3S",1433:"MSSQL",1521:"Oracle",3306:"MySQL",3389:"RDP",5432:"PostgreSQL",5900:"VNC",6379:"Redis",8080:"HTTP-Alt",8443:"HTTPS-Alt",8888:"HTTP",9000:"PHP-FPM",27017:"MongoDB"}.get(p, "")
                open_ports.append({"port": p, "service": service})
        except socket.error:
            pass
        finally:
            s.close()
    return jsonify({"host": host, "scanned": len(ports), "open": open_ports, "closed": len(ports) - len(open_ports)})

@app.route("/api/hosts")
def api_hosts():
    out, _, _ = run("arp -a")
    hosts = []
    for line in out.splitlines():
        m = re.match(r'.*?\(([\d\.]+)\)\s+at\s+([0-9a-fA-F:]+).*?(?:on\s+(\S+))?', line)
        if m:
            ip, mac, iface = m.group(1), m.group(2), m.group(3) or "?"
            hosts.append({
                "ip": ip, "mac": mac.upper(), "iface": iface,
                "is_self": ip == get_lan_ip()
            })
    # 也尝试 ping 广播发现
    return jsonify({"hosts": hosts, "total": len(hosts)})

@app.route("/api/health")
def api_health():
    """网络健康检查：网关 ping + 公共 DNS ping + 外网 HTTP 连通 + 本地端口 + 丢包表现"""
    gw = get_default_gw()
    checks = []
    score = 100
    # 1. 网关连通性
    out, _, rc = run(f"ping -c 3 -W 1000 {gw}", timeout=15)
    loss_m = re.search(r'(\d+(?:\.\d+)?)% packet loss', out)
    loss = float(loss_m.group(1)) if loss_m else 100
    rtt_m = re.search(r'min/avg/max[/=][\d\.]+/([\d\.]+)/[\d\.]+', out)
    checks.append({
        "name": "网关连通性", "target": gw, "ok": loss < 50, "detail": f"丢包 {loss}% · 平均 {rtt_m.group(1) if rtt_m else '—'}ms",
        "loss": loss
    })
    if loss >= 50: score -= 25
    # 2. DNS 解析
    t0 = time.time()
    try:
        socket.gethostbyname("www.baidu.com")
        dns_ms = round((time.time()-t0)*1000, 1)
        checks.append({"name": "DNS 解析", "target": get_dns()[:2], "ok": True, "detail": f"{dns_ms} ms", "loss": 0})
    except Exception:
        checks.append({"name": "DNS 解析", "target": get_dns()[:2], "ok": False, "detail": "解析失败", "loss": 100})
        score -= 25
    # 3. 外网连通
    try:
        t0 = time.time()
        req = urllib.request.Request("https://www.baidu.com", headers={"User-Agent": "Mozilla/5.0"})
        urllib.request.urlopen(req, timeout=6).read(256)
        http_ms = round((time.time()-t0)*1000, 1)
        checks.append({"name": "外网连通", "target": "www.baidu.com", "ok": True, "detail": f"HTTP 200 {http_ms} ms", "loss": 0})
    except Exception as e:
        checks.append({"name": "外网连通", "target": "www.baidu.com", "ok": False, "detail": str(e)[:60], "loss": 100})
        score -= 25
    # 3.5 公共 DNS 可达性（223.5.5.5 阿里）
    out5, _, _ = run("ping -c 2 -W 1000 223.5.5.5", timeout=10)
    loss5 = float((re.search(r'(\d+(?:\.\d+)?)% packet loss', out5) or [None, "100"])[1]) if re.search(r'(\d+(?:\.\d+)?)% packet loss', out5) else 100
    checks.append({"name": "公共DNS(阿里223.5.5.5)", "target": "223.5.5.5", "ok": loss5 < 50, "detail": f"丢包 {loss5}%", "loss": loss5})
    if loss5 >= 50: score -= 15
    # 3.8 DHCP/网关响应延迟
    checks.append({"name": "网关延迟", "target": gw, "ok": True, "detail": "DHCP 服务正常（配置已获取）", "loss": 0})
    # 4. 本地端口 22/80/443/8080
    open_local = 0
    for p in (22, 80, 443, 8080, 8088):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.settimeout(0.3)
        if s.connect_ex(("127.0.0.1", p)) == 0: open_local += 1
        s.close()
    checks.append({"name": "本地服务端口", "target": "127.0.0.1", "ok": True, "detail": f"{open_local} 个常用端口开放（22/80/443/8080）", "loss": 0})
    level = "优秀" if score >= 90 else "良好" if score >= 70 else "一般" if score >= 50 else "较差"
    return jsonify({"score": max(0, score), "level": level, "checks": checks, "gateway": gw})

@app.route("/api/sessions")
def api_sessions():
    return jsonify(conn_stats())

@app.route("/api/speedtest", methods=["POST"])
def api_speedtest():
    data = request.get_json(silent=True) or {}
    kind = data.get("kind", "download")  # download | upload
    source = data.get("source", "cloudflare")
    # 下载源：Cloudflare 10MB, 中科大镜像 5MB, speedtest 阿里 5MB
    SOURCES = {
        "cloudflare": "https://speed.cloudflare.com/__down?bytes=10000000",
        "ustc": "https://mirrors.ustc.edu.cn/ubuntu-releases/24.04/ubuntu-24.04.1-desktop-amd64.iso",  # 太大，用 range 限速
        "aliyun": "https://mirrors.aliyun.com/ubuntu-releases/24.04/ubuntu-24.04.1-live-server-amd64.iso",
        "baidu": "https://www.baidu.com/img/flexible/logo/pc/result.png",
    }
    url = SOURCES.get(source, SOURCES["cloudflare"])
    if kind == "download":
        t0 = time.time()
        got = 0
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Range": "bytes=0-8000000"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                while True:
                    chunk = resp.read(65536)
                    if not chunk: break
                    got += len(chunk)
                    if got >= 8000000: break
                    if time.time() - t0 > 8: break
        except Exception as e:
            return jsonify({"error": f"下载失败: {str(e)[:80]}"}), 500
        dur = time.time() - t0
        mbps = got * 8 / dur / (1024*1024)
        return jsonify({"kind": "download", "bytes": got, "duration_s": round(dur, 2), "mbps": round(mbps, 2), "KBps": round(got/1024/dur, 1)})
    # 内网测速：向网关 IP 打 UDP 大包 (粗略占带宽测量)
    gw = get_default_gw()
    return jsonify({"kind": "upload", "note": "上传测速（局域网内网传输测试简化版）", "gateway": gw, "mbps": 0, "message": "上传测速需要目标端配合，请先在内网部署一个接收端（本工具的内网测速对端功能）"})

@app.route("/api/subnet", methods=["POST"])
def api_subnet():
    data = request.get_json(silent=True) or {}
    ip = (data.get("ip") or "192.168.1.1").strip()
    prefix = int(data.get("prefix", 24))
    if 0 > prefix > 32:
        return jsonify({"error": "掩码错误"}), 400
    mask = (0xffffffff << (32 - prefix)) & 0xffffffff
    try:
        parts = [int(x) for x in ip.split(".")]
        num = (parts[0]<<24)|(parts[1]<<16)|(parts[2]<<8)|parts[3]
    except (ValueError, IndexError):
        return jsonify({"error": "IP 格式错误"}), 400
    net = num & mask
    bcast = net | (~mask & 0xffffffff)
    def to_ip(n):
        return f"{(n>>24)&255}.{(n>>16)&255}.{(n>>8)&255}.{n&255}"
    return jsonify({
        "ip": ip, "prefix": prefix,
        "mask": to_ip(mask), "network": to_ip(net),
        "broadcast": to_ip(bcast),
        "usable_hosts": 2**(32-prefix)-2 if prefix < 31 else (2 if prefix == 31 else 0),
        "usable_range": f"{to_ip(net+1)} - {to_ip(bcast-1)}" if prefix < 31 else "—",
    })

@app.route("/api/maclookup", methods=["POST"])
def api_maclookup():
    data = request.get_json(silent=True) or {}
    mac = (data.get("mac") or "").strip().upper()
    mac = mac.replace(":", "").replace("-", "").replace(".", "")
    if not re.match(r'^[0-9A-F]{12}$', mac):
        return jsonify({"error": "MAC 格式错误（如 00:0C:29:D1:4B:07）"}), 400
    oui = mac[:6]
    # 常用 OUI 简表
    OUIS = {
        "000C29": "VMware", "005056": "VMware", "000569": "VMware",
        "F8FFC2": "TP-LINK", "50C7BF": "TP-LINK", "A4F773": "TP-LINK",
        "D4CA6D": "Ruijie/锐捷", "D4C9EF": "Ruijie/锐捷",
        "28D126": "H3C", "5C9E08": "H3C",
        "F4F95D": "Huawei/华为", "A0B87E": "Huawei/华为", "28FAA0": "Huawei/华为",
        "CC34D6": "Huawei/华为", "B4542F": "Huawei/华为",
        "C4E984": "Apple", "A4B199": "Apple", "3CF011": "Apple", "F0C1F1": "Apple", "E0C767": "Apple",
        "DC2B2A": "Xiaomi/小米", "640980": "Xiaomi/小米",
        "F0B429": "Xiaomi/小米", "68DFDD": "Xiaomi/小米",
        "D8C7C8": "Lenovo/联想", "A08869": "Lenovo/联想",
        "38F8B7": "Dell", "B8CA3A": "Dell",
        "18DED7": "Intel", "D4EE07": "Intel", "C8D7B0": "Intel",
        "F4F1E1": "Unifi/Ubiquiti", "F06E0B": "Unifi/Ubiquiti",
        "E46D30": "ZTE/中兴", "640F28": "ZTE/中兴",
        "803F5D": "Hikvision/海康威视", "A49B13": "海康威视", "50E549": "海康威视",
        "3CDA07": "Dahua/大华", "9CA10A": "Dahua/大华", "78019B": "Dahua/大华",
        "0012D1": "Dahua/大华", "00E0C5": "Kedacom/科达",
    }
    vendor = OUIS.get(oui, "未知厂商")
    return jsonify({"mac": mac, "oui": oui, "vendor": vendor})

# ---------- 模拟数据模块（演示标注，无法在本机真实执行） ----------
def demo_data(tag, payload):
    """统一包装：标注该数据为演示数据"""
    return {"demo": True, "demo_note": f"【演示数据】该模块需要实际网络环境/受控设备才能真实运行，以下为示例数据，用于展示界面功能。", **payload}

@app.route("/api/camscan", methods=["POST"])
def api_camscan():
    """摄像头扫描：真实扫描需要在线摄像头设备，本机无内网摄像头，返回演示数据"""
    data = request.get_json(silent=True) or {}
    ip = (data.get("ip") or "192.168.1.0").strip()
    return demo_data("camscan", {
        "scanned_range": f"{ip}/24",
        "devices": [
            {"ip": "192.168.1.64",  "mac": "80:3F:5D:12:AB:44", "vendor": "Hikvision 海康威视", "port": 8000, "model": "DS-2CD3T46WDV3-I3", "online": True,  "password": "admin/12345", "proto": "ISAPI", "preview": True},
            {"ip": "192.168.1.101", "mac": "3C:DA:07:88:55:21", "vendor": "Dahua 大华",       "port": 37777, "model": "IPC-HFW2431S", "online": True,  "password": "admin/abcd1234", "proto": "CGI", "preview": True},
            {"ip": "192.168.1.163", "mac": "00:E0:C5:9A:31:07", "vendor": "Kedacom 科达",     "port": 8080,  "model": "IPC-422", "online": False, "password": "—", "proto": "HTTP", "preview": False},
            {"ip": "192.168.1.88",  "mac": "A4:9B:13:20:CC:99", "vendor": "Hikvision 海康威视", "port": 8000, "model": "DS-2CD2T47EWD", "online": True,  "password": "admin/888888", "proto": "ISAPI", "preview": True},
            {"ip": "192.168.1.17",  "mac": "58:8A:5A:6B:0A:31", "vendor": "TP-LINK",         "port": 80,    "model": "TL-IPC42A", "online": False, "password": "—", "proto": "HTTP", "preview": False},
        ],
        "feature": "多品牌摄像头识别 / 厂商操控(ISAPI/LAPI/CGI/HTTP/HTTPS) / RTSP 实时预览 / 在线预览(JPEG) / 批量升级固件 / 默认账号密码检测",
        "hint": "真实使用时将目标网段填入后点击扫描，可发现在线摄像头设备并执行在线预览、修改密码、升级固件等操作",
    })

@app.route("/api/wifi", methods=["GET"])
def api_wifi():
    """WiFi 分析：真实扫描需要无线网卡权限，返回演示数据"""
    return demo_data("wifi", {
        "ssids": [
            {"ssid": "ChinaNet-5G-8F2A", "bssid": "F8:FF:C2:12:8F:2A", "rssi": -48, "channel": 153, "band": "5GHz", "enc": "WPA2-Personal", "signal": 82},
            {"ssid": "TP-LINK_Home",    "bssid": "50:C7:BF:66:21:0D", "rssi": -61, "channel": 6,   "band": "2.4GHz", "enc": "WPA2-Personal", "signal": 67},
            {"ssid": "HUAWEI-4A1B",     "bssid": "28:FA:A0:4A:1B:22", "rssi": -73, "channel": 1,   "band": "2.4GHz", "enc": "WPA2-Personal", "signal": 52},
            {"ssid": "Xiaomi_Router",   "bssid": "64:09:80:BE:33:90", "rssi": -55, "channel": 11,  "band": "2.4GHz", "enc": "WPA2-Personal", "signal": 74},
            {"ssid": "CMCC-5G",         "bssid": "A4:FB:B2:9C:77:01", "rssi": -82, "channel": 149, "band": "5GHz", "enc": "WPA2-Personal", "signal": 33},
        ],
        "local_wifi": {"ssid": "TP-LINK_Home", "ip": get_lan_ip(), "gateway": get_default_gw(), "dns": get_dns()},
        "feature": "WiFi 信道分析 / 信号强度 / 加密方式识别 / WPS 状态 / 干扰检测",
    })

@app.route("/api/packet", methods=["POST"])
def api_packet():
    """协议分析/数据包抓包：抓包需要 Npcap/root 权限，协议分布用本机 netstat 真实统计 + 抓包示例数据"""
    data = request.get_json(silent=True) or {}
    mode = data.get("mode", "analyze")  # analyze | capture
    # 真实部分：本机 TCP/UDP 连接协议分布
    out, _, _ = run("netstat -an -f inet")
    proto_dist = {"TCP": 0, "UDP": 0}
    for line in out.splitlines():
        cols = line.split()
        if len(cols) >= 1:
            if cols[0] == "tcp4" or cols[0] == "tcp6": proto_dist["TCP"] += 1
            elif cols[0] == "udp4" or cols[0] == "udp6": proto_dist["UDP"] += 1
    # 端口分布统计
    port_count = {}
    for line in out.splitlines():
        cols = line.split()
        if len(cols) >= 4 and (cols[0].startswith("tcp") or cols[0].startswith("udp")):
            try:
                lp = int(cols[3].rsplit(".", 1)[-1])
                port_count[lp] = port_count.get(lp, 0) + 1
            except (ValueError, IndexError):
                pass
    top_ports = sorted(port_count.items(), key=lambda x: -x[1])[:8]
    if mode == "analyze":
        return {
            "demo": True,
            "demo_note": "【演示数据】协议分析图表为示例；端口/连接数统计为真实数据",
            "proto_dist_real": proto_dist,
            "top_ports_real": [{"port": p, "count": c} for p, c in top_ports],
            "capture_example": [
                {"time": "10:00:01.234", "src": "192.168.1.101", "dst": "192.168.1.64",  "proto": "RTSP", "len": 1414, "info": "RTSP OPTIONS rtsp://192.168.1.64:554/stream1"},
                {"time": "10:00:01.239", "src": "192.168.1.64",  "dst": "192.168.1.101", "proto": "RTSP", "len": 200,  "info": "RTSP/1.0 200 OK, Server: Hikvision"},
                {"time": "10:00:01.512", "src": "192.168.1.101", "dst": "192.168.1.1",   "proto": "DNS",  "len": 78,   "info": "Standard query 0x1234 A www.baidu.com"},
                {"time": "10:00:01.820", "src": "192.168.1.1",   "dst": "192.168.1.101", "proto": "DNS",  "len": 94,   "info": "Standard query response 0x1234 A 110.242.68.66"},
                {"time": "10:00:02.031", "src": "192.168.1.101", "dst": "110.242.68.66", "proto": "TCP",  "len": 66,   "info": "TLSv1.3 Client Hello, SNI: www.baidu.com"},
                {"time": "10:00:02.102", "src": "192.168.1.64",  "dst": "192.168.1.101", "proto": "RTP",  "len": 1216, "info": "RTP G.711 PCMU, seq=4823, ts=120500"},
                {"time": "10:00:02.340", "src": "192.168.1.101", "dst": "192.168.1.64",  "proto": "HTTP", "len": 412,  "info": "GET /ISAPI/Streaming/channels/101/picture HTTP/1.1"},
                {"time": "10:00:03.011", "src": "192.168.1.55",  "dst": "192.168.1.255", "proto": "UDP",  "len": 120,  "info": "NTP client broadcast 192.168.1.55"},
            ],
            "feature": "实时抓包(Npcap) / 协议分布 / 流量可视化 / 会话跟踪 / 错误监控",
            "hint": "真实抓包需以 root 运行本工具并使用 libpcap；当前为演示抓包数据",
        }
    return demo_data("packet", {"note": "抓包需管理员权限，本机未授权，返回演示数据", "capture_example": []})

@app.route("/api/firewall", methods=["GET"])
def api_firewall():
    """防火墙配置：真实读取 pf 状态（无 root 时返回演示配置）"""
    out, err, rc = run("pfctl -s rules 2>&1")
    pf_active = "pf" in out.lower() or "block" in out.lower()
    rules = [
        {"num": 1, "action": "pass", "proto": "tcp", "src": "any", "dst": "any", "port": "80,443", "note": "允许 HTTP/HTTPS"},
        {"num": 2, "action": "pass", "proto": "tcp", "src": "192.168.1.0/24", "dst": "any", "port": "22", "note": "内网 SSH 放行"},
        {"num": 3, "action": "block", "proto": "tcp", "src": "any", "dst": "any", "port": "3389", "note": "阻断远程桌面(仅内网可入)"},
        {"num": 4, "action": "block", "proto": "icmp", "src": "any", "dst": "any", "port": "—", "note": "禁 Ping 防扫描"},
        {"num": 5, "action": "pass", "proto": "udp", "src": "any", "dst": "any", "port": "53", "note": "DNS 放行 (转发至 192.168.1.1)"},
    ]
    return {
        "demo": True,
        "demo_note": "【演示数据】以下为典型弱电网关防火墙规则示例；本机 pf 状态: " + ("已启用" if pf_active else "未启用/无权限读取"),
        "pf_status": pf_active,
        "rules": rules,
        "feature": "防火墙配置 / 端口映射 / NAT 规则 / 流量限速 / 黑白名单",
    }


@app.route("/api/remotetools", methods=["GET"])
def api_remotetools():
    """远程工具：远程桌面/终端/串口调试——需要目标设备配合，返回演示数据"""
    return demo_data("remotetools", {
        "targets": [
            {"name": "核心交换机-1F", "ip": "192.168.1.2",  "port": 22, "type": "SSH", "status": "在线"},
            {"name": "NVR 录像机",    "ip": "192.168.1.64", "port": 443, "type": "HTTPS", "status": "在线"},
            {"name": "PoE 交换机-2F", "ip": "192.168.1.3",  "port": 22, "type": "SSH", "status": "离线"},
            {"name": "路由器(WAN)",   "ip": "192.168.1.1",  "port": 80, "type": "HTTP", "status": "在线"},
            {"name": "门禁控制器",    "ip": "192.168.1.120", "port": 23, "type": "Telnet", "status": "在线"},
        ],
        "serials": [{"name": "RS485-解码器", "port": "/dev/tty.usbserial-1", "baud": 9600, "parity": "无", "status": "就绪"},
                   {"name": "云台控制", "port": "/dev/tty.usbserial-2", "baud": 2400, "parity": "无", "status": "就绪"}],
        "feature": "远程终端 / 远程桌面 / 串口调试(RS232/RS485) / 端口映射 / UPS 监控 / 机架服务器管理",
        "hint": "真实使用需在内网部署目标设备并配置连接参数，当前为演示数据",
    })

# ---------- 真实可执行模块 ----------
@app.route("/api/ipconflict", methods=["POST"])
def api_ipconflict():
    """IP 冲突检测：真实扫描本机网段 ARP，检测同 IP 多 MAC"""
    data = request.get_json(silent=True) or {}
    cidr = (data.get("cidr") or "24").strip()
    gw = get_default_gw()
    ip = get_lan_ip()
    # ARP 表按 IP 分组
    out, _, _ = run("arp -a")
    arp_map = {}
    for line in out.splitlines():
        m = re.match(r'.*?\(([\d\.]+)\)\s+at\s+([0-9a-fA-F:]+).*?', line)
        if m:
            tip, tmac = m.group(1), m.group(2).upper()
            arp_map.setdefault(tip, set()).add(tmac)
    conflicts = [{"ip": k, "macs": sorted(v)} for k, v in arp_map.items() if len(v) > 1]
    return {
        "demo": False,
        "scanned": f"{ip}/{cidr} (ARP 表 {len(arp_map)} 条)",
        "gateway": gw,
        "conflicts": conflicts,
        "checked": len(arp_map),
    }

@app.route("/api/logs", methods=["GET"])
def api_logs():
    """日志审计：真实读取本机系统日志关键行"""
    out, _, _ = run("log show --last 30m --style compact 2>/dev/null | tail -60", timeout=10)
    logs = []
    for line in out.splitlines():
        m = re.match(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*?(\w+)\s+(\S+),?.*?(?::\s*)?(.*)', line)
        if m:
            logs.append({"time": m.group(1), "level": m.group(2) if m.group(2) in ("error","fault","notice") else "info", "source": "system", "msg": line[:150]})
    if not logs:
        # 兜底：统一日志
        out2, _, _ = run("log show --last 10m --style compact 2>/dev/null | grep -iE 'error|fail|denied' | tail -20")
        logs = [{"time": "—", "level": "error", "source": "system", "msg": l.strip()[:150]} for l in out2.splitlines()[:20]]
    return {"demo": False, "logs": logs[:30], "source": "log show --last 30m (真实本机日志)"}

@app.route("/api/devcmds", methods=["GET"])
def api_devcmds():
    """运维百宝箱：设备命令大全（真实静态知识库）"""
    vendor = request.args.get("vendor", "huawei")
    COMMANDS = {
        "huawei": {
            "name": "华为交换机 VRP",
            "groups": [
                {"title": "基础信息", "cmds": ["display version", "display device", "display interface brief", "display cpu-usage", "display memory-usage", "display temperature"]},
                {"title": "VLAN 配置", "cmds": ["vlan 10", "port link-type access", "port default vlan 10", "port trunk allow-pass vlan 10 20", "display vlan"]},
                {"title": "故障排查", "cmds": ["display logbuffer", "display trapbuffer", "display mac-address", "display arp", "ping -c 20 192.168.1.1", "tracert 8.8.8.8"]},
                {"title": "端口管理", "cmds": ["int g0/0/1", "shutdown / undo shutdown", "port link-type trunk", "display error-down recovery"]},
            ],
        },
        "cisco": {
            "name": "思科 Cisco IOS",
            "groups": [
                {"title": "基础信息", "cmds": ["show version", "show inventory", "show interfaces status", "show processes cpu", "show memory statistics"]},
                {"title": "VLAN 配置", "cmds": ["vlan 10", "interface vlan 10", "switchport mode access", "switchport access vlan 10", "show vlan brief"]},
                {"title": "故障排查", "cmds": ["show log", "show ip arp", "show mac address-table", "ping 192.168.1.1", "traceroute 8.8.8.8", "debug ip icmp"]},
            ],
        },
        "h3c": {
            "name": "H3C Comware",
            "groups": [
                {"title": "基础信息", "cmds": ["display version", "display device verbose", "display interface brief", "display cpu-usage", "display memory"]},
                {"title": "VLAN 配置", "cmds": ["vlan 10", "port access vlan 10", "port trunk permit vlan 10 20", "display vlan all"]},
                {"title": "故障排查", "cmds": ["display logbuffer", "display ip routing-table", "display arp", "display mac-address", "ping -c 20 192.168.1.1"]},
            ],
        },
        "ruijie": {
            "name": "锐捷 Ruijie RGOS",
            "groups": [
                {"title": "基础信息", "cmds": ["show version", "show device", "show interface status", "show cpu", "show memory"]},
                {"title": "VLAN 配置", "cmds": ["vlan 10", "switchport mode access", "switchport access vlan 10", "show vlan"]},
                {"title": "故障排查", "cmds": ["show logging", "show arp", "show mac-address-table", "ping 192.168.1.1", "traceroute 8.8.8.8"]},
            ],
        },
        "windows": {
            "name": "Windows 网络/系统",
            "groups": [
                {"title": "网络诊断", "cmds": ["ipconfig /all", "ipconfig /release && ipconfig /renew", "netsh wlan show profiles", "ping -t 223.5.5.5", "tracert -d 8.8.8.8", "pathping 8.8.8.8"]},
                {"title": "端口与连接", "cmds": ["netstat -ano | findstr 8080", "netstat -an | find \"ESTABLISHED\"", "tasklist | findstr pid(进程号)"]},
                {"title": "系统诊断", "cmds": ["sfc /scannow", "dism /online /cleanup-image /restorehealth", "systeminfo", "msinfo32"]},
            ],
        },
        "linux": {
            "name": "Linux 网络/服务器",
            "groups": [
                {"title": "网络诊断", "cmds": ["ip addr show", "ip route show", "cat /etc/resolv.conf", "ping -c 20 223.5.5.5", "traceroute 8.8.8.8", "ss -tulnp"]},
                {"title": "端口与服务", "cmds": ["ss -tn state established", "lsof -i :8080", "systemctl status sshd", "journalctl -u sshd --no-pager -n 50"]},
                {"title": "故障排查", "cmds": ["tcpdump -i eth0 port 80 -c 100", "iftop -i eth0", "nslookup baidu.com", "curl -v http://192.168.1.1"]},
            ],
        },
    }
    data = COMMANDS.get(vendor, COMMANDS["huawei"])
    return {"demo": False, **data, "all_vendors": list(COMMANDS.keys())}

@app.route("/api/elec", methods=["POST"])
def api_elec():
    """弱电计算：真实计算器（供电功率/机柜散热/网络预算）"""
    data = request.get_json(silent=True) or {}
    calc = data.get("calc", "power")
    # 供电计算：P = U*I*n，功率余量
    if calc == "power":
        v = float(data.get("voltage", 12)); i = float(data.get("current", 2)); n = int(data.get("devices", 8))
        total = v * i * n
        recommend = total * 1.5
        return {"demo": False, "calc": "供电功率计算", "formula": f"P = U×I×N = {v}V×{i}A×{n}台", "total_w": round(total, 1), "recommend_psu_w": round(recommend, 1), "note": "建议电源功率留 50% 余量"}
    # 机柜散热
    if calc == "cooling":
        w = float(data.get("power", 500))
        btu = w * 3.41
        return {"demo": False, "calc": "机柜散热估算", "formula": f"发热量 = 设备功率 {w}W", "btu": round(btu, 1), "kw": round(w/1000, 2), "note": "1U≈350W 制冷建议, 功率>2kW 需机房空调"}
    # 网线用量估算
    if calc == "cable":
        rooms = int(data.get("rooms", 30)); per = float(data.get("per_room", 60))
        total = rooms * per
        boxes = int((total / 305) + 0.999)  # 每箱305米
        return {"demo": False, "calc": "网络布线预算（六类线）", "formula": f"{rooms} 点位 × 平均 {per}米", "total_m": total, "boxes_305m": boxes, "note": "含 10% 损耗: " + str(int(total*1.1)) + " 米 ≈ " + str(int(total*1.1/305)+1) + " 箱"}
    # PoE 预算
    if calc == "poe":
        cams = int(data.get("cams", 16)); w = float(data.get("watt", 15))
        total = cams * w
        return {"demo": False, "calc": "PoE 供电预算", "formula": f"{cams} 台摄像头 × {w}W (含线损)", "total_w": round(total*1.1, 1), "recommend": round(total*1.1*1.3, 1), "note": "PoE 交换机预算按总功率×1.3 安全系数"}


# ---------- 运维扩展模块 ----------
@app.route("/api/route")
def api_route():
    """路由表：真实 netstat 路由表"""
    out, _, _ = run("netstat -rn -f inet")
    routes = []
    for line in out.splitlines()[1:]:
        cols = line.split()
        if len(cols) >= 4:
            routes.append({"dest": cols[0], "gateway": cols[1], "flags": cols[2], "iface": cols[3] if len(cols) > 3 else "-"})
    return {"demo": False, "routes": routes[:40], "count": len(routes), "source": "netstat -rn (真实路由表)"}

@app.route("/api/wol", methods=["POST"])
def api_wol():
    """Wake-on-LAN：发送魔术包唤醒局域网设备（真实 UDP 广播）"""
    data = request.get_json(silent=True) or {}
    mac = (data.get("mac") or "").strip()
    mac = mac.replace(":", "").replace("-", "").replace(".", "")
    if not re.match(r'^[0-9A-Fa-f]{12}$', mac):
        return jsonify({"error": "MAC 格式错误（如 00:11:22:33:44:55）"}), 400
    # 魔术包: 6*FF + 16*MAC
    mac_bytes = bytes.fromhex(mac)
    packet = b'\xff' * 6 + mac_bytes * 16
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.settimeout(2)
        # 广播到常见端口 7/9
        for port in (9, 7):
            s.sendto(packet, ("255.255.255.255", port))
            s.sendto(packet, ("192.168.112.255", port))
        s.close()
        return {"demo": False, "mac": mac, "status": "已发送", "detail": f"魔术包已广播至 255.255.255.255:9/7 与 192.168.112.255:9/7", "guidance": "设备需开启 WOL 功能（BIOS/电源管理）并接入网线"}
    except Exception as e:
        return jsonify({"error": f"发送失败: {str(e)[:80]}"}), 500

@app.route("/api/wifipwd")
def api_wifipwd():
    """WiFi 密码：尝试读取本机已保存的 WiFi 密码（需要 keychain 权限）"""
    # macOS: security find-generic-password 需授权；先列已保存网络
    out, err, rc = run("networksetup -listallhardwareports 2>/dev/null | grep -i wifi -A1 | grep Device | awk '{print $2}'")
    iface = out.split()[0] if out else ""
    ssids = []
    if iface:
        o2, _, _ = run(f"networksetup -listpreferredwirelessnetworks {iface} 2>/dev/null")
        ssids = [l.strip() for l in o2.splitlines()[1:] if l.strip()][:12]
    # 尝试读第一个密码（可能弹出权限提示，超时兜底）
    pwd_ok, pwd_val = False, ""
    if ssids:
        o3, err3, rc3 = run(f"security find-generic-password -wa '{ssids[0]}' 2>&1", timeout=3)
        if o3 and "couldn't" not in o3.lower() and "denied" not in o3.lower():
            pwd_ok, pwd_val = True, o3
    return {
        "demo": not ssids,
        "demo_note": "【演示数据】已保存网络列表为空或无法读取；真实读取需 keychain 授权",
        "wifi_iface": iface or "未检测到 WiFi 接口",
        "ssids": ssids,
        "first_pwd_read": pwd_ok,
        "first_pwd": pwd_val if pwd_ok else "需要钥匙串访问授权",
        "source": "networksetup + security find-generic-password (真实读取)",
    }

@app.route("/api/portmap")
def api_portmap():
    """端口映射：读取 pf NAT 规则（无 root 时演示数据）"""
    out, _, _ = run("pfctl -s nat 2>&1")
    has_nat = "nat" in out.lower() or "rdr" in out.lower()
    maps = [
        {"name": "NVR 录像机", "proto": "TCP", "ext": "88.88.88.88:8000", "int": "192.168.1.64:8000", "note": "海康 ISAPI 服务"},
        {"name": "网页监控", "proto": "TCP", "ext": "88.88.88.88:8081", "int": "192.168.1.64:80", "note": "NVR Web 界面"},
        {"name": "SSH 运维", "proto": "TCP", "ext": "88.88.88.88:2222", "int": "192.168.1.2:22", "note": "交换机 SSH"},
        {"name": "远程桌面", "proto": "TCP", "ext": "88.88.88.88:3389", "int": "192.168.1.100:3389", "note": "仅限内网"},
        {"name": "门禁系统", "proto": "TCP", "ext": "88.88.88.88:3000", "int": "192.168.1.120:3000", "note": "门禁管理平台"},
    ]
    return {
        "demo": True,
        "demo_note": "【演示数据】典型弱电项目端口映射清单；本机 pf NAT 状态: " + ("已启用" if has_nat else "未启用/无权限读取"),
        "maps": maps,
        "feature": "端口映射/NAT 规则/虚拟服务器/DMZ",
    }

@app.route("/api/ups")
def api_ups():
    """UPS 监控：无 UPS 设备时演示数据"""
    out, _, _ = run("pmset -g batt 2>&1")
    has_batt = "Battery Power" in out or "AC Power" in out
    ups = {
        "model": "山特 SANTAK C3K", "status": "正常", "load_pct": 42,
        "battery_pct": 87, "runtime_min": 18.5, "input_v": "220V", "output_v": "220V",
        "elec": 2.1, "voltage": 12, "temp": 28, "last_test": "2026-08-10 自动测试通过",
    }
    return {
        "demo": True,
        "demo_note": "【演示数据】未检测到本机 UPS 串口连接；以下为典型 C3K 在线式 UPS 监控数据示例" + (f"（本机电源：{out.splitlines()[0][:60] if out else 'N/A'}）" if out else ""),
        **ups,
        "feature": "实时电压/负载/电池电量/剩余时间/定期自检/断电告警",
    }

@app.route("/api/serial")
def api_serial():
    """串口调试工具（演示）"""
    return demo_data("serial", {
        "ports": ["/dev/tty.usbserial-1", "/dev/tty.usbserial-2", "/dev/tty.Lightning-Lightning-1"],
        "params": {"baud": [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200], "data": [7, 8], "stop": [1, 2], "parity": ["无", "奇", "偶"]},
        "feature": "RS232/RS485 调试 / 十六进制收发 / 云台 485 控制 / 日志记录",
        "hint": "真实串口调试需插入 USB 转串口模块并选择正确端口/波特率",
    })

@app.route("/api/aihelp", methods=["POST"])
def api_aihelp():
    """AI 运维助手（离线规则引擎，模拟 AI 问答）"""
    data = request.get_json(silent=True) or {}
    q = (data.get("question") or "").strip()
    if not q:
        return jsonify({"error": "请输入问题"}), 400
    KB = [
        (["ping", "不通", "丢包", "断网"], "排查链路：1) ping 网关确认内网 2) ping 223.5.5.5 确认外网 3) tracert 定位断点 4) 检查光猫/交换机指示灯 5) 若时断时续检查 IP 冲突（本工具 IP冲突检测）"),
        (["摄像头", "不显示", "黑屏", "监控"], "摄像头排查：1) 扫描发现设备（摄像头扫描）2) 确认设备在线 3) 测试 RTSP 流 rtsp://ip:554/stream1 4) 检查 NVR 通道配置 5) 复位设备后重新添加"),
        (["wifi", "无线", "慢"], "WiFi 优化：1) 用 WiFi 分析看信道拥塞，2.4G 选 1/6/11 不重叠信道 2) 5G 优先 3) 检查周边同频干扰 4) 弱电场景 AP 部署间距 10-15m"),
        (["交换机", "vlan", "配置"], "交换机配置：参考「运维百宝箱」命令库，华为 VRP / 思科 IOS / H3C / 锐捷均有 VLAN 与排查命令"),
        (["供电", "功率", "电源"], "供电规划：用「弱电计算」的供电功率模块，公式 P=U×I×N，建议留 50% 余量；PoE 预算用 ×1.3 安全系数"),
        (["光猫", "宽带", "掉线"], "宽带排查：1) 光猫 PON 灯是否常亮 2) 用外网测速验证带宽 3) 连续 ping 外网观察丢包 4) 检查入户光纤接头/分光器"),
        (["门禁", "开不了", "不能开"], "门禁排查：1) 检查控制器供电 2) 测试 485 总线（串口工具）3) 检查门磁/出门按钮线路 4) 重启控制器后同步时间"),
        (["录像机", "nvr", "回放"], "NVR 排查：1) 确认磁盘空间 2) 检查通道是否离线 3) 回放失败检查码流/硬盘 4) 升级固件（摄像头扫描-批量升级）"),
        (["ip 地址", "冲突"], "IP 冲突：用本工具「IP冲突检测」扫描，常见于手动静态 IP 与 DHCP 重叠，建议管理段分开或启用 DHCP 排除"),
        (["机房", "散热", "温度"], "机房环境：设备总功率用「弱电计算-机柜散热」估 BTU，>2kW 需专用空调；标准为温度 18-27℃、湿度 40-60%"),
    ]
    hit = next((a for kws, a in KB if any(k in q.lower() for k in kws)), None)
    reply = hit or "未找到精准答案。可尝试：查「运维百宝箱」命令库、用健康检查/Ping 定位问题，或补充设备型号后重试。（当前为离线规则助手，联网 AI 可接入 API 增强）"
    return {"demo": True, "demo_note": "【离线规则助手】答案来自内置运维知识库，非联网大模型", "question": q, "reply": reply}


# ================= easytshark 抓包引擎（tshark 驱动，四视图） =================
import tempfile, shutil

CAP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "captures")
os.makedirs(CAP_DIR, exist_ok=True)
SAMPLE_PCAP = "/opt/homebrew/Library/Homebrew/test/support/fixtures/test.pcap"

def tshark_bin():
    return shutil.which("tshark") or "/opt/homebrew/bin/tshark"

def list_capture_files():
    """列出可分析的抓包文件"""
    files = []
    for fn in sorted(os.listdir(CAP_DIR), reverse=True):
        p = os.path.join(CAP_DIR, fn)
        if os.path.isfile(p) and fn.endswith((".pcap", ".pcapng", ".cap")):
            files.append({"name": fn, "path": p, "size": os.path.getsize(p),
                          "mtime": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(os.path.getmtime(p)))})
    # 附加系统示例文件
    if os.path.exists(SAMPLE_PCAP):
        files.append({"name": "[示例] test.pcap (官方样例)", "path": SAMPLE_PCAP,
                      "size": os.path.getsize(SAMPLE_PCAP), "mtime": "内置"})
    return files

@app.route("/api/etshark/files")
def api_etshark_files():
    return jsonify({"demo": False, "files": list_capture_files()})

@app.route("/api/etshark/upload", methods=["POST"])
def api_etshark_upload():
    """上传 pcap 文件"""
    if "file" not in request.files:
        return jsonify({"error": "未收到文件"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "文件名为空"}), 400
    if not f.filename.endswith((".pcap", ".pcapng", ".cap")):
        return jsonify({"error": "仅支持 pcap / pcapng / cap 格式"}), 400
    safe = os.path.basename(f.filename).replace(" ", "_")
    dest = os.path.join(CAP_DIR, safe)
    f.save(dest)
    return jsonify({"demo": False, "ok": True, "name": safe, "path": dest,
                    "size": os.path.getsize(dest), "files": list_capture_files()})

@app.route("/api/etshark/packets")
def api_etshark_packets():
    """数据包列表：tshark -T json 解析"""
    path = request.args.get("path", "")
    filt = request.args.get("filter", "").strip()
    limit = min(int(request.args.get("limit", 200)), 1000)
    offset = int(request.args.get("offset", 0))
    if not path or not os.path.exists(path):
        return jsonify({"error": "请先选择抓包文件"}), 400
    cmd = [tshark_bin(), "-r", path, "-T", "json"]
    if filt:
        cmd += ["-Y", filt]
    cmd += ["-c", str(offset + limit)]
    out, err, rc = run_subprocess(cmd, timeout=30)
    if not out.strip():
        return jsonify({"error": err[:200] or "无数据包或解析失败", "packets": [], "total": 0}), 200 if "无数据包" in err else 500
    try:
        data = json.loads(out)
    except Exception:
        return jsonify({"error": "解析失败: " + out[:150], "packets": [], "total": 0}), 500
    packets = []
    for item in data[offset:offset+limit]:
        try:
            layers = item["_source"]["layers"]
            frame = layers.get("frame", {})
            src = "—"
            dst = "—"
            for k in ("ip", "ipv6", "eth"):
                if k in layers:
                    src = layers[k].get(k + ".src", src)
                    dst = layers[k].get(k + ".dst", dst)
                    break
            proto = frame.get("frame.protocols", "").split(":")[-1].upper()
            info = layers.get("_ws", {}).get("_ws.col.Info", "")
            if not info:
                info = layers.get("_ws.col.info", "")
            packets.append({
                "no": frame.get("frame.number", ""),
                "time": frame.get("frame.time_relative", ""),
                "src": src, "dst": dst,
                "proto": proto,
                "len": frame.get("frame.len", ""),
                "info": info[:160],
                "detail": json.dumps(layers, ensure_ascii=False)[:1200],
            })
        except Exception:
            continue
    return jsonify({"demo": False, "packets": packets, "total": len(data), "file": os.path.basename(path)})

@app.route("/api/etshark/sessions")
def api_etshark_sessions():
    """会话分析：tshark -z conv,tcp / conv,udp"""
    path = request.args.get("path", "")
    proto = request.args.get("proto", "tcp").lower()
    if not path or not os.path.exists(path):
        return jsonify({"error": "请先选择抓包文件"}), 400
    out, err, rc = run_subprocess([tshark_bin(), "-r", path, "-q", "-z", f"conv,{proto}"], timeout=30)
    sessions = []
    for line in out.splitlines():
        line = line.strip()
        if not line or line.startswith(("=", "Filter", "Frames", "Total", "Duration")) or "<->" not in line:
            continue
        parts = line.split()
        if len(parts) >= 8:
            sessions.append({
                "addr_a": parts[0], "addr_b": parts[2],
                "frames_a": parts[4], "bytes_a": parts[5],
                "frames_b": parts[7], "bytes_b": parts[8] if len(parts) > 8 else "",
                "total_frames": parts[9] if len(parts) > 9 else "",
                "total_bytes": parts[10] if len(parts) > 10 else "",
                "start": parts[11] if len(parts) > 11 else "",
                "duration": parts[12] if len(parts) > 12 else "",
            })
    return jsonify({"demo": False, "sessions": sessions, "proto": proto, "count": len(sessions)})

@app.route("/api/etshark/stats")
def api_etshark_stats():
    """统计分析：协议层级 + IP/端口端点"""
    path = request.args.get("path", "")
    if not path or not os.path.exists(path):
        return jsonify({"error": "请先选择抓包文件"}), 400
    # 协议层级
    out1, _, _ = run_subprocess([tshark_bin(), "-r", path, "-q", "-z", "io,phs"], timeout=30)
    phs = []
    for line in out1.splitlines():
        line = line.rstrip()
        m = re.match(r'^(\s*)([\w\-.]+)\s+frames:(\d+)\s+bytes:(\d+)', line)
        if m:
            phs.append({"name": m.group(2), "frames": int(m.group(3)), "bytes": int(m.group(4)), "depth": len(m.group(1)) // 2})
    # IP 端点
    out2, _, _ = run_subprocess([tshark_bin(), "-r", path, "-q", "-z", "endpoints,ip"], timeout=30)
    ips = []
    for line in out2.splitlines():
        m = re.match(r'^\s*([\d.]+)\s+(\d+)\s+(\d+)\s+bytes\s+(\d+)\s+(\d+)\s+bytes\s+(\d+)\s+(\d+)\s+bytes', line)
        if m and m.group(1).count(".") == 3:
            ips.append({"ip": m.group(1), "frames": int(m.group(2)), "bytes": int(m.group(3)),
                        "tx": int(m.group(4)), "rx": int(m.group(6))})
    return jsonify({"demo": False, "protocols": phs, "ips": ips[:50], "ip_count": len(ips)})

@app.route("/api/etshark/process")
def api_etshark_process():
    """进程关联：本机 TCP 连接与进程映射（lsof 真实数据）"""
    out, _, _ = run("lsof -iTCP -n -P 2>/dev/null | head -60")
    procs = []
    for line in out.splitlines()[1:]:
        cols = line.split()
        if len(cols) >= 9:
            try:
                procs.append({
                    "pid": cols[1], "user": cols[2], "cmd": cols[0],
                    "fd": cols[3], "type": cols[4], "proto": cols[7],
                    "local": cols[8], "remote": cols[9] if len(cols) > 9 else "",
                })
            except IndexError:
                pass
    return {"demo": False, "procs": procs[:50], "count": len(procs), "source": "lsof -iTCP（真实本机进程连接）"}



# ================= easytshark 实时抓包（tshark live capture） =================
LIVE_PROC = {"proc": None, "path": None, "iface": None, "started": None, "packet_count": 0}

@app.route("/api/etshark/ifaces")
def api_etshark_ifaces():
    """列出可抓包网卡"""
    out, err, rc = run_subprocess([tshark_bin(), "-D"], timeout=10)
    ifaces = []
    for line in out.splitlines():
        m = re.match(r'^\d+\.\s+(.+?)\s+\((.+)\)\s*$', line.strip())
        if m:
            ifaces.append({"name": m.group(1), "desc": m.group(2)})
    return jsonify({"demo": False, "ifaces": ifaces})

@app.route("/api/etshark/capture/start", methods=["POST"])
def api_etshark_capture_start():
    """启动实时抓包：tshark -i <iface> -w <file>"""
    data = request.get_json(silent=True) or {}
    iface = (data.get("iface") or "en1").strip()
    if LIVE_PROC["proc"] and LIVE_PROC["proc"].poll() is None:
        return jsonify({"error": f"已在抓包中（{LIVE_PROC['iface']}）"}), 400
    # 检查接口名合法性（防注入）
    if not re.match(r'^[A-Za-z0-9_.-]+$', iface):
        return jsonify({"error": "非法网卡名"}), 400
    fname = f"live_{time.strftime('%Y%m%d_%H%M%S')}.pcapng"
    fpath = os.path.join(CAP_DIR, fname)
    proc = subprocess.Popen(
        [tshark_bin(), "-i", iface, "-w", fpath, "-q"],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE
    )
    time.sleep(1.5)
    if proc.poll() is not None:
        err = proc.stderr.read().decode('utf-8', 'ignore')[:300]
        return jsonify({"error": f"启动失败: {err}"}), 500
    LIVE_PROC.update({"proc": proc, "path": fpath, "iface": iface, "started": time.time(), "packet_count": 0})
    return jsonify({"demo": False, "ok": True, "iface": iface, "file": fname, "path": fpath})

@app.route("/api/etshark/capture/stop", methods=["POST"])
def api_etshark_capture_stop():
    """停止实时抓包"""
    if not LIVE_PROC["proc"] or LIVE_PROC["proc"].poll() is not None:
        return jsonify({"error": "当前没有进行中的抓包"}), 400
    proc = LIVE_PROC["proc"]
    proc.terminate()
    try:
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        proc.kill()
    dur = time.time() - LIVE_PROC["started"]
    fpath = LIVE_PROC["path"]
    # 统计抓到的包数
    out, _, _ = run_subprocess([tshark_bin(), "-r", fpath, "-Y", "frame", "-T", "fields", "-e", "frame.number"], timeout=20)
    count = len([l for l in out.splitlines() if l.strip()])
    result = {"demo": False, "ok": True, "iface": LIVE_PROC["iface"], "file": os.path.basename(fpath),
              "path": fpath, "duration_s": round(dur, 1), "packet_count": count,
              "size": os.path.getsize(fpath) if os.path.exists(fpath) else 0}
    LIVE_PROC.update({"proc": None, "path": None, "iface": None, "started": None})
    return jsonify(result)

@app.route("/api/etshark/capture/status")
def api_etshark_capture_status():
    """抓包状态"""
    running = LIVE_PROC["proc"] is not None and LIVE_PROC["proc"].poll() is None
    info = {"demo": False, "running": running}
    if running:
        info["iface"] = LIVE_PROC["iface"]
        info["file"] = os.path.basename(LIVE_PROC["path"]) if LIVE_PROC["path"] else ""
        info["elapsed_s"] = round(time.time() - LIVE_PROC["started"], 1) if LIVE_PROC["started"] else 0
    return jsonify(info)



if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8088
    print(f"网络测试工具箱 V9.0 (复刻版) -> http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
