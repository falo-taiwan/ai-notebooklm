# v2.01版 Falo x Force Cheng 2026/6/14
import sys
import os
import socket
import urllib.request
import json
import time
import signal
import subprocess

DEFAULT_PORT = 8765
BACKUP_PORT_RANGE = range(8766, 8801)

def log(msg):
    # Print logs to stderr so they show on terminal but don't pollute stdout capture
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()

def check_port_in_use(port, host="127.0.0.1"):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex((host, port)) == 0

def get_service_pid(port):
    url = f"http://127.0.0.1:{port}/api/status"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'FaloLauncher'})
        with urllib.request.urlopen(req, timeout=2.0) as response:
            if response.status == 200:
                body = response.read().decode('utf-8')
                data = json.loads(body)
                if data.get("app") == "AI NotebookLM Runtime Lab":
                    identity = data.get("runtime_identity", {})
                    return identity.get("pid")
    except Exception:
        pass
    return None

def kill_process(pid):
    try:
        log(f"[INFO] Killing process with PID {pid}...")
        if os.name == 'nt': # Windows
            subprocess.run(["taskkill", "/F", "/PID", str(pid)], capture_output=True, check=False)
        else: # macOS / Linux
            try:
                os.kill(pid, signal.SIGTERM)
                # Wait up to 2 seconds for process to exit
                for _ in range(20):
                    time.sleep(0.1)
                    # check if still alive
                    try:
                        os.kill(pid, 0)
                    except OSError:
                        break
                else:
                    # force kill
                    os.kill(pid, signal.SIGKILL)
            except OSError:
                pass
        return True
    except Exception as e:
        log(f"[ERROR] Failed to kill process {pid}: {e}")
        return False

def main():
    log("==============================================")
    log(" Port Resolver & Conflict Manager")
    log("==============================================")
    
    target_port = None
    
    if check_port_in_use(DEFAULT_PORT):
        log(f"[INFO] Port {DEFAULT_PORT} is in use.")
        pid = get_service_pid(DEFAULT_PORT)
        if pid:
            log(f"[OK] Detected same service running on port {DEFAULT_PORT} (PID: {pid}).")
            if kill_process(pid):
                # Wait for port release
                log("[INFO] Waiting for port to be released...")
                for _ in range(30):
                    time.sleep(0.2)
                    if not check_port_in_use(DEFAULT_PORT):
                        log(f"[OK] Port {DEFAULT_PORT} has been successfully released.")
                        target_port = DEFAULT_PORT
                        break
                else:
                    log(f"[WARN] Port {DEFAULT_PORT} remained occupied after killing PID {pid}.")
            else:
                log(f"[WARN] Failed to terminate running service on port {DEFAULT_PORT}.")
        else:
            log(f"[WARN] Port {DEFAULT_PORT} is occupied by a DIFFERENT service.")
    else:
        log(f"[OK] Port {DEFAULT_PORT} is free.")
        target_port = DEFAULT_PORT
        
    if target_port is None:
        log("[INFO] Scanning backup port range for an available port...")
        for p in BACKUP_PORT_RANGE:
            if not check_port_in_use(p):
                log(f"[OK] Found available backup port: {p}")
                target_port = p
                break
        else:
            log("[FATAL] All ports in backup range are occupied!")
            sys.exit(1)
            
    log(f"[INFO] Selected port: {target_port}")
    # Print only the port number to stdout so the launcher shell script can capture it
    print(target_port)

if __name__ == "__main__":
    main()
