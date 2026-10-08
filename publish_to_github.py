#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将「智能云AI电商在线销售系统」发布到 GitHub —— 仅用 Python 标准库（无需本机 git）。

使用 GitHub REST API v3 + Personal Access Token（classic，scope: repo）。

重要：本脚本使用 **Contents API**（PUT /repos/{owner}/{repo}/contents/{path}）逐文件提交。
      不要用 Git Data API 的 /git/blobs —— 对空仓库会返回 409 "Git Repository is empty"。
      首个 PUT 会自动初始化空仓库并创建默认分支。

用法：
    PowerShell:  $env:GITHUB_TOKEN = "ghp_xxxx"; python publish_to_github.py
    bash:        export GITHUB_TOKEN="ghp_xxxx"; python publish_to_github.py

可选参数：
    --repo    仓库名（默认 smart-cloud-ai-ecommerce）
    --owner   账号（默认取 GET /user 的 login；也可用 GITHUB_OWNER）
    --private 建为私有仓库（默认公开）

说明：自动跳过运行时目录 data/ 与 .git / node_modules / __pycache__ / .workbuddy。令牌不会被写入文件。
"""
import os
import sys
import json
import base64
import argparse
import urllib.request
import urllib.parse
import urllib.error
import ssl

API = "https://api.github.com"

# 部分企业/代理网络需放宽证书校验；环境正常时可删除这两行
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

SKIP_DIRS = {".git", "__pycache__", "node_modules", ".workbuddy", "data"}


def api(method, path, token, body=None):
    url = API + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    # Bearer 对 classic(ghp_) 与 fine-grained(github_pat_) 都通用
    req.add_header("Authorization", "Bearer " + token)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "workbuddy-publisher")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=90) as r:
            txt = r.read().decode("utf-8")
            return r.status, (json.loads(txt) if txt else {})
    except urllib.error.HTTPError as e:
        txt = e.read().decode("utf-8", "ignore")
        try:
            err = json.loads(txt)
        except Exception:
            err = {"message": txt}
        return e.code, err


def collect_files(root):
    out = []
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            full = os.path.join(dp, fn)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            out.append((rel, full))
    return sorted(out)


def put_contents(owner, repo, path, content_bytes, token, message, branch):
    """用 Contents API 创建/更新单个文件。返回 (status, resp)。"""
    qpath = urllib.parse.quote(path)
    body = {"message": message, "content": base64.b64encode(content_bytes).decode("ascii")}
    if branch:
        body["branch"] = branch
    # 若文件已存在需带 sha
    s, info = api("GET", f"/repos/{owner}/{repo}/contents/{qpath}?ref={branch}", token)
    if s == 200 and isinstance(info, dict) and info.get("sha"):
        body["sha"] = info["sha"]
    return api("PUT", f"/repos/{owner}/{repo}/contents/{qpath}", token, body)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default="smart-cloud-ai-ecommerce")
    ap.add_argument("--owner", default=os.environ.get("GITHUB_OWNER", ""))
    ap.add_argument("--public", action="store_true", default=True)
    ap.add_argument("--private", dest="public", action="store_false")
    args = ap.parse_args()

    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("ERROR: 请先设置环境变量 GITHUB_TOKEN（GitHub Personal Access Token，scope=repo）。")
        print('PowerShell: $env:GITHUB_TOKEN = "ghp_xxxx"')
        sys.exit(1)

    root = os.path.dirname(os.path.abspath(__file__))

    # 0. 判定 owner
    owner = args.owner
    if not owner:
        s, me = api("GET", "/user", token)
        if s != 200 or "login" not in me:
            print("[x] 无法读取当前用户，请检查 token：", s, me.get("message"))
            sys.exit(1)
        owner = me["login"]
    print(f"[..] owner = {owner}, repo = {args.repo}")

    # 1. 创建仓库（已存在则忽略）
    status, resp = api("POST", "/user/repos", token, {
        "name": args.repo,
        "description": "智能云AI电商在线销售系统 — 动态全栈电商应用（Node.js 原生后端 + 原生 SPA，含 AI 智能推荐 / AI 导购助手 / 智能搜索 / 真实登录认证）",
        "private": not args.public,
        "auto_init": False,
    })
    if status == 201:
        print("[OK] 仓库已创建:", resp.get("html_url"))
    elif status == 422 and "already exists" in str(resp.get("message", "")).lower():
        print("[..] 仓库已存在，继续推送")
    else:
        print("[!!] 创建仓库返回:", status, resp.get("message", ""), "（继续尝试推送）")

    # 2. 默认分支
    s, repo_info = api("GET", f"/repos/{owner}/{args.repo}", token)
    branch = repo_info.get("default_branch", "main") if s == 200 else "main"

    # 3. 逐文件推送（Contents API）
    files = collect_files(root)
    print(f"\n准备推送 {len(files)} 个文件到分支 {branch} ...")
    for rel, full in files:
        with open(full, "rb") as f:
            content = f.read()
        s, r = put_contents(owner, args.repo, rel, content, token,
                            f"Add {rel}", branch)
        if s in (200, 201):
            print(f"  [OK] {rel} ({len(content)} bytes)")
        else:
            print(f"  [x] {rel} -> {s} {r.get('message') if isinstance(r, dict) else r}")
            sys.exit(1)

    print("\n[OK] 发布完成！")
    print(f"     仓库地址: https://github.com/{owner}/{args.repo}")


if __name__ == "__main__":
    main()
