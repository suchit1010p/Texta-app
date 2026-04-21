# texta — CLI Task Manager

> Manage your tasks directly from the terminal. Create tasks, attach files, schedule auto-deletion, and more — all without leaving the command line.

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Project Structure](#project-structure)
- [Backend Setup](#backend-setup)
- [CLI Setup](#cli-setup)
- [Account](#account)
- [Task Commands](#task-commands)
- [Delete Commands](#delete-commands)
- [File Uploads](#file-uploads)
- [Row Numbers](#row-numbers)
- [Switch Between Environments](#switch-between-environments)
- [Deploy Backend to AWS Lambda](#deploy-backend-to-aws-lambda)
- [Full Command Reference](#full-command-reference)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Task management** — create, view, update, and delete tasks from the terminal
- **Row numbers** — use `#1`, `#2` instead of copying long IDs
- **File attachments** — attach images, PDFs, Word docs, spreadsheets, and any other file to a task
- **Multi-file upload** — upload multiple files at once inline or via interactive paste mode
- **Auto-delete timers** — schedule a task to delete itself after `30m`, `2h`, `1d`, etc.
- **Bulk delete** — delete multiple tasks or all tasks in one command
- **JWT authentication** — every account is personal and secure
- **Cloud storage** — tasks in MongoDB, files in AWS S3

---

## Requirements

- Node.js v14 or newer
- npm v7 or newer
- MongoDB Atlas account (free tier works)
- AWS S3 bucket (only needed for file uploads)

---

## Project Structure

```
texta-backend/        Express + MongoDB REST API
texta-cli/            Commander.js CLI that talks to the backend
```

---

## Backend Setup

### 1. Install dependencies

```bash
cd texta-backend
npm install
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/texta
JWT_SECRET=your_long_random_secret

# AWS S3 — only needed for file uploads
S3_REGION=ap-south-1
S3_ACCESS_KEY=your_iam_access_key
S3_SECRET_KEY=your_iam_secret_key
S3_BUCKET_NAME=your-bucket-name
```

> **MongoDB Atlas:** go to **Security → Network Access → Add Current IP Address**. If your internet connection changes, add the new IP too.

> **AWS S3:** your IAM user needs `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` permissions on your bucket. Add a bucket policy that grants public `s3:GetObject` so uploaded file URLs are accessible.

### 3. Start the backend

```bash
npm run dev     # development — auto-restarts on changes
npm start       # production
```

The backend runs on `http://localhost:3000` by default.

---

## CLI Setup

### Option A — Local development

```bash
cd texta-cli
npm install
npm link
```

`npm link` registers `texta` as a global command on your machine.

### Option B — Install from npm

```bash
npm install -g texta
```

### Point the CLI at your backend

```bash
texta config --api-url http://localhost:3000/api
```

This is saved to `~/.texta/config.json` and persists until you change it.

---

## Account

### Register

```bash
texta register
```

You will be prompted for a username, email, and password. Validation rules:

- Username: letters, numbers, underscores — minimum 3 characters
- Password: minimum 6 characters, confirmed twice

### Login

```bash
texta login
```

Enter your username or email and password. You stay logged in for 7 days.

### Logout

```bash
texta logout
```

Clears the session from this device. Your account and data are not affected.

---

## Task Commands

### List tasks

```bash
texta list
texta ls                        # alias
```

Displays all tasks in a table with row numbers, message, status, file count, expiry timer, and creation date. Row numbers are saved locally — you can use them in any command instead of copying the full ID.

```
╭───┬──────────────────────────────────────────────────┬──────────────┬───────┬──────────┬────────────╮
│ # │ Task                                             │ Status       │ Files │ Expires  │ Created    │
├───┼──────────────────────────────────────────────────┼──────────────┼───────┼──────────┼────────────┤
│ 1 │ Fix the login bug on the mobile app              │ ● in-progress│ 2 📎  │ 2d 3h    │ 22/02/2025 │
│ 2 │ Write unit tests for the upload module           │ ● pending    │ —     │ —        │ 22/02/2025 │
│ 3 │ Deploy v2 to production after review             │ ● done       │ 1 📎  │ —        │ 21/02/2025 │
╰───┴──────────────────────────────────────────────────┴──────────────┴───────┴──────────┴────────────╯
  Total: 3 task(s)
```

Filter and search:

```bash
texta list --status pending
texta list --status in-progress
texta list --status done
texta list --search "meeting"
```

### Add a task

```bash
texta add "Task message here"
texta add "Review PR #42" --status in-progress
texta add "Deploy to prod" --status done
```

Status options: `pending` (default), `in-progress`, `done`

### View a task (compact)

```bash
texta view 2          # by row number
texta view 2          # by full 24-char ID also works
```

Shows ID, message, status, created date, expiry, and attachment count.

### Open a task (full detail)

```bash
texta open 2
```

Shows everything — all attached files grouped by type (images, documents, other), file sizes, direct download URLs, and attachment IDs needed for removal.

```
╭──────────────────────────────────────────────────────────────────────╮
│  📋  Task                                                            │
├──────────────────────────────────────────────────────────────────────┤
│  ID        699a8540edf29201fdbe1f6b                                  │
│  Message   Fix the login bug                                         │
│  Status    ● in-progress                                             │
│  Created   22/02/2025, 10:30 AM                                      │
├──────────────────────────────────────────────────────────────────────┤
│  🖼   Images (1)                                                     │
│  1. screenshot.png  (240 KB)                                         │
│     https://your-bucket.s3.amazonaws.com/uploads/...                │
├──────────────────────────────────────────────────────────────────────┤
│  📄  Documents (1)                                                   │
│  1. report.pdf  (1.2 MB)  application/pdf                            │
│     https://your-bucket.s3.amazonaws.com/uploads/...                │
╰──────────────────────────────────────────────────────────────────────╯
```

### Update a task

**Interactive mode** — prompts you to edit message and status:

```bash
texta update 2
texta edit 2          # alias
```

**Direct mode** — update with flags:

```bash
texta update 2 --status done
texta update 2 --message "New message text"
texta update 2 --message "Updated" --status in-progress
```

---

## Delete Commands

### Delete a single task

```bash
texta delete 3            # asks for confirmation
texta delete 3 --yes      # skip confirmation
texta rm 3                # alias
```

### Delete multiple tasks

Use row numbers separated by spaces or commas:

```bash
texta delete 2 3 4        # space-separated — works in all terminals
texta delete "2,3,4"      # comma-separated — quote it in PowerShell
```

> **PowerShell note:** `2,3,4` without quotes is split by PowerShell into separate arguments automatically. texta handles both formats correctly — `texta delete 2 3 4` and `texta delete "2,3,4"` both work.

Before deleting, texta shows what will be removed and asks you to confirm:

```
  About to delete 3 task(s):
    • #2 "Fix login bug"
    • #3 "Write tests"
    • #4 "Deploy v2"

? Delete these 3 task(s)? (y/N):
```

### Delete all tasks

```bash
texta delete all
```

Permanently deletes every task and all attached files. Requires typing `DELETE` (uppercase) to confirm — this cannot be undone.

```
  ⚠  WARNING: This will permanently delete ALL 7 task(s)
     and every file attached to them.

? Type DELETE to confirm: DELETE
  ✔ All done. 7 task(s) deleted.
```

### Schedule auto-delete (timer)

Instead of deleting now, schedule the task to delete itself automatically:

```bash
texta delete 3 45s        # in 45 seconds
texta delete 3 30m        # in 30 minutes
texta delete 3 6h         # in 6 hours
texta delete 3 1d         # in 1 day
texta delete 3 7d         # in 7 days
```

> Only single-unit formats are supported. Use `90m` instead of `1h30m`.

Output:

```
  ✔ Task scheduled for auto-delete in 6 hours
  ℹ Will be deleted at: Mon, Feb 24, 10:30 AM
  Tip: texta delete 3 --cancel   to cancel the timer.
```

### Cancel a scheduled delete

```bash
texta delete 3 --cancel
```

Clears the timer. The task stays and will not be deleted.

---

## File Uploads

Attach any type of file to a task. Files are stored in your AWS S3 bucket.

**Supported types:** jpg, jpeg, png, gif, webp, svg, bmp, pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, md, json, xml, zip, rar, mp4, mp3 — and any other file as `application/octet-stream`.

### Upload inline

```bash
texta upload 2 report.pdf
texta upload 2 photo.png summary.docx data.xlsx
```

Uploads all files in one command and attaches them to the task.

### Upload with paste mode (Windows Explorer)

When you copy multiple files in Windows Explorer, each path is on its own line with quotes. PowerShell cannot pass these as CLI arguments. Use paste mode instead — run the command with no file paths:

```bash
texta upload 2
```

texta enters an interactive prompt where you paste all paths at once:

```
  Paste your file paths below.
  • Paste multiple Windows Explorer paths at once (one per line)
  • Surrounding quotes are stripped automatically
  • Press Enter on a blank line when done

  > "D:\Photos\IMG_20221126_080922.jpg"
  > "D:\Photos\IMG_20221126_081059.jpg"
  > "D:\Photos\IMG_20221126_081636.jpg"
  >

  Uploading 3 files to task 699a8540...
  ✔ IMG_20221126_080922.jpg   2.4 MB   image/jpeg
  ✔ IMG_20221126_081059.jpg   1.8 MB   image/jpeg
  ✔ IMG_20221126_081636.jpg   3.1 MB   image/jpeg
  ✔ 3 files uploaded successfully.
```

### Remove an attachment

First run `texta open` to see attachment IDs, then:

```bash
texta open 2                              # attachment IDs shown at the bottom
texta detach 2 64abc123def456789abc123    # remove one file
```

The file is deleted from S3 and removed from the task.

---

## Row Numbers

Every time you run `texta list`, tasks are numbered `#1`, `#2`, `#3` and saved to `~/.texta/cache.json`. You can use these numbers in any command:

```bash
texta list               # refresh numbers

texta view 1
texta open 3
texta update 2 --status done
texta delete 4
texta delete 2 3 5
texta upload 1 photo.png
texta delete 3 2h
```

When you use a number, texta confirms what it resolved to:

```
  ℹ #2 → 699a8541edf29201fdbe1f6c  "Write tests"
```

> Row numbers are based on your **last `texta list`**. After adding or deleting tasks, run `texta list` again to refresh before using numbers.

---

## Switch Between Environments

```bash
# use your deployed backend
texta config --api-url https://your-api.execute-api.ap-south-1.amazonaws.com/api

# switch back to local
texta config --api-url http://localhost:3000/api

# check which one is active
texta config --show
```

---

## Deploy Backend to AWS Lambda

### 1. Install dependencies

```bash
cd texta-backend
npm install serverless-http
npm install -g serverless
```

### 2. Create `src/lambda.js`

```javascript
const serverless = require('serverless-http');
const app = require('./app');

module.exports.handler = serverless(app);
```

### 3. Create `serverless.yml` in the root of `texta-backend`

```yaml
service: texta-backend

provider:
  name: aws
  runtime: nodejs18.x
  region: ap-south-1
  environment:
    MONGODB_URI: "your_mongodb_uri"
    JWT_SECRET: "your_jwt_secret"
    S3_REGION: "ap-south-1"
    S3_ACCESS_KEY: "your_iam_access_key"
    S3_SECRET_KEY: "your_iam_secret_key"
    S3_BUCKET_NAME: "your-bucket-name"

functions:
  api:
    handler: src/lambda.handler
    events:
      - httpApi:
          path: /{proxy+}
          method: ANY
      - httpApi:
          path: /
          method: ANY
```

> **Important:** Lambda reserves `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` internally. Use `S3_ACCESS_KEY` and `S3_SECRET_KEY` instead and make sure your `taskController.js` reads those names.

### 4. Install AWS CLI and configure credentials

Download AWS CLI from `https://awscli.amazonaws.com/AWSCLIV2.msi`, install it, then:

```bash
aws configure
# Enter your IAM Access Key ID, Secret, region, and press Enter for output format
```

Your IAM user needs these permissions: `cloudformation:*`, `lambda:*`, `apigateway:*`, `s3:*`, `iam:*`, `logs:*`, `ssm:*`

### 5. Deploy

```bash
serverless deploy
```

After deploy you will see:

```
endpoint: ANY - https://abc123.execute-api.ap-south-1.amazonaws.com/{proxy+}
```

Point your CLI at it:

```bash
texta config --api-url https://abc123.execute-api.ap-south-1.amazonaws.com/api
```

### 6. Future deployments

```bash
serverless deploy                       # full redeploy
serverless deploy function -f api      # faster — code only
serverless logs -f api --tail          # live logs
serverless remove                      # tear everything down
```

> **Lambda timeout:** default is 3 seconds. Go to **Lambda → Configuration → General configuration → Edit** and increase it to **30 seconds** for file upload operations.

---

## Full Command Reference

### Account

| Command | Description |
|---|---|
| `texta register` | Create a new account |
| `texta login` | Log in (username or email) |
| `texta logout` | Clear session from this device |

### Tasks

| Command | Description |
|---|---|
| `texta list` | List all tasks with row numbers |
| `texta ls` | Alias for list |
| `texta list --status <status>` | Filter by pending / in-progress / done |
| `texta list --search "text"` | Search tasks by message |
| `texta add "message"` | Create a task (default status: pending) |
| `texta add "message" --status done` | Create with a specific status |
| `texta view <ref>` | Compact task summary |
| `texta open <ref>` | Full detail — files, URLs, attachment IDs |
| `texta update <ref>` | Edit interactively |
| `texta update <ref> --status done` | Set status directly |
| `texta update <ref> --message "..."` | Set message directly |
| `texta edit <ref>` | Alias for update |

### Delete

| Command | Description |
|---|---|
| `texta delete <ref>` | Delete one task (asks to confirm) |
| `texta delete <ref> --yes` | Delete without confirmation |
| `texta delete 2 3 4` | Delete multiple tasks (space-separated) |
| `texta delete "2,3,4"` | Delete multiple tasks (comma-separated) |
| `texta delete all` | Delete every task (type DELETE to confirm) |
| `texta delete <ref> 1d` | Schedule auto-delete in 1 day |
| `texta delete <ref> 6h` | Schedule auto-delete in 6 hours |
| `texta delete <ref> 30m` | Schedule auto-delete in 30 minutes |
| `texta delete <ref> 45s` | Schedule auto-delete in 45 seconds |
| `texta delete <ref> --cancel` | Cancel a scheduled auto-delete |
| `texta rm <ref>` | Alias for delete |

### Files

| Command | Description |
|---|---|
| `texta upload <ref> <file>` | Upload one file |
| `texta upload <ref> <file1> <file2>` | Upload multiple files inline |
| `texta upload <ref>` | Paste mode — paste Windows paths one per line |
| `texta detach <ref> <attachmentId>` | Remove one attachment from a task |

### Configuration

| Command | Description |
|---|---|
| `texta config --api-url <url>` | Set backend URL |
| `texta config --show` | Show current settings |
| `texta --help` | Show all commands |
| `texta --version` | Show version |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `You are not logged in` | Run `texta login` |
| `MongoDB connection failed` | Atlas → Security → Network Access → Add your current IP |
| `#5 not found in your last list` | Run `texta list` to refresh row numbers, then retry |
| `File not found: path/to/file` | Check the path. In paste mode, quotes are stripped automatically |
| `AccessDenied` when opening an S3 URL | Add a bucket policy granting public `s3:GetObject` to `*` |
| `Upload failed: Access Denied` | Your IAM user needs `s3:PutObject` permission on the bucket |
| `Token expired` | Run `texta logout` then `texta login` |
| `Invalid time format` | Use single-unit only: `1d`, `6h`, `30m`, `45s` — not `1h30m` |
| `Lambda reserved keys error` | Use `S3_ACCESS_KEY` / `S3_SECRET_KEY` instead of the AWS reserved names |
| `serverless deploy` timeout error | Increase Lambda timeout to 30s in AWS Console → Lambda → Configuration |
| `Cast to ObjectId failed` | Run `texta list` first then use row numbers, or use the full 24-char ID |
