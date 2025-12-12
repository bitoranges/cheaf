<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1NFT_VNACUGRUknKAdyHfyfYFjl1Uf07K

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## 如何将本地修改推送到 GitHub（小白友好版）

下面的流程默认你已经在终端/命令行里，且当前目录是项目根目录。

### 0. 准备工作
- 注册并登录 GitHub 账号。
- 安装 Git：Windows 推荐 [Git for Windows](https://git-scm.com/downloads/win)；macOS 可用 Homebrew `brew install git`；Linux 用包管理器安装。
- **只在首次推送时需要**：
  - **HTTPS 方式**：创建一个 Personal Access Token（PAT），在 GitHub > Settings > Developer settings > Personal access tokens 里生成。
  - **SSH 方式**：运行 `ssh-keygen -t ed25519 -C "你的邮箱"` 生成密钥，并把公钥内容（`~/.ssh/id_ed25519.pub`）添加到 GitHub > Settings > SSH and GPG keys。

### 1. 检查当前仓库状态
```bash
git status
```
看到红色文件表示有修改但未暂存；绿色表示已暂存。

### 2.（首次推送）配置身份与远程仓库
仅第一次需要：
```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
git remote add origin <你的仓库地址>   # 例：git@github.com:username/repo.git 或 https://github.com/username/repo.git
```
如果已经添加过远程，可用 `git remote -v` 查看；若地址错误，用 `git remote set-url origin <新地址>` 修改。

### 3. 将修改加入暂存区
推荐精确添加需要上传的文件：
```bash
git add <文件路径1> <文件路径2>
# 或全部添加（确认无多余文件）：
git add .
```

### 4. 提交本地记录
```bash
git commit -m "描述本次修改"
```
提交信息尽量写清楚做了什么，方便以后追踪。

### 5. 推送到 GitHub
```bash
git push -u origin <分支名>
```
- 第一次推送该分支时使用 `-u` 让本地分支关联远程，之后可直接 `git push`。
- 如果使用 HTTPS，推送时会提示输入 GitHub 用户名和 PAT；SSH 则无需输入凭据。

### 6. 确认是否推送成功
- 查看提示：
  ```bash
  git status
  ```
  若看到 “Your branch is ahead of 'origin/<分支名>' by X commits” 说明还有 X 个提交未推送；没有这行且工作区干净通常表示已推送。
- 对比提交：
  ```bash
  git log --oneline -5
  ```
  打开 GitHub 仓库网页，看最新提交是否与这里一致。

### 7. 常见问题速查
- **推送被拒绝（non-fast-forward）**：先 `git pull --rebase origin <分支名>`，解决冲突后再 `git push`。
- **远程地址错/需要换**：`git remote set-url origin <新地址>`。
- **不小心推送了多余文件**：本地删除/回退后重新提交，再 `git push --force-with-lease origin <分支名>`（慎用，会覆盖远程历史）。

> 本项目的代码尚未推送到你的 GitHub 账户，需要你在本机或服务器上按上述步骤执行推送。
