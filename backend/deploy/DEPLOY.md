# Deploying the KITUM backend to an Azure VM

The backend is a persistent **Express + Socket.IO** server with **in-process
dispatch timers** — it must run as a **single, always-on process** (see
`BEFORE_LIVE.md` §B3). That rules out serverless. We run it on a free-tier
**B1s Ubuntu VM**, behind **Caddy** (auto-HTTPS reverse proxy), kept alive by
**pm2**, with **GitHub Actions** deploying over SSH on every push to `main`.

```
GitHub (push to main)
   └─ .github/workflows/deploy-backend.yml
        └─ rsync backend/ ──ssh──▶ Azure VM  :  ~/kitum-backend
                                     ├─ pm2  → node src/index.js  (:5000)
                                     └─ Caddy : 443 ──▶ localhost:5000  (TLS + WS)
MongoDB Atlas (unchanged, external)  ◀── app connects out
```

Hard prerequisite: **a domain/subdomain** (e.g. `api.shillongwater.com`) you can
point at the VM. Browsers block an HTTPS site (Vercel) from calling an HTTP API,
and Let's Encrypt won't issue certs for a bare IP — so HTTPS, and thus a domain,
is mandatory.

---

## 1. Provision the VM

Azure Portal → **Create a resource → Virtual machine**:

- **Image:** Ubuntu Server 22.04 LTS · **Size:** `B1s` (the free-tier-eligible size)
- **Authentication:** SSH public key (download/keep the `.pem` — this is your admin key)
- **Username:** `azureuser` (used throughout below)
- **Inbound ports:** allow **SSH (22)**, **HTTP (80)**, **HTTPS (443)**
- After create: VM → **Networking** → confirm the NSG allows 80 and 443 inbound
- Recommended: VM → **Networking → public IP → Configuration → set assignment to
  Static** so the IP can't change and break your DNS.

> Free-tier note: 750 B1s hours/month covers one VM 24/7. Don't run two.

Point DNS at it: at your domain registrar add an **A record**
`api.YOURDOMAIN.com → <VM public IP>`.

## 2. First-time server setup (SSH in once)

```bash
ssh -i /path/to/admin-key.pem azureuser@<VM public IP>

# 2GB swap — B1s only has 1GB RAM; this prevents OOM kills during npm ci / load
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pm2 (process manager) + make it start the app on every reboot
sudo npm install -g pm2
pm2 startup systemd -u azureuser --hp /home/azureuser   # run the line it prints

# Caddy (auto-HTTPS reverse proxy)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

## 3. Put the production env on the server (once)

CI/CD never touches `.env` — you create it by hand and it stays put.

```bash
mkdir -p ~/kitum-backend
nano ~/kitum-backend/.env          # paste all prod vars, then:
chmod 600 ~/kitum-backend/.env
```

Use `backend/.env.example` as the checklist. Production-specific values:

- `NODE_ENV=production`
- `PORT=5000` (Caddy proxies to this)
- `MONGO_URI=` your Atlas **production** connection string
- `CLIENT_URL=https://your-vercel-app.vercel.app` (comma-separate extra origins,
  e.g. admin domain — used for both CORS and Socket.IO)
- `JWT_SECRET=` a fresh long random string (don't reuse the dev one)
- Razorpay **live** keys + `RAZORPAY_WEBHOOK_SECRET`
- Atlas / Mapbox / Google / Interakt / S3 keys — **rotate the ones shared in chat
  during dev** (`BEFORE_LIVE.md` §A) before going live.

## 4. Reverse proxy + HTTPS

```bash
sudo cp ~/kitum-backend/deploy/Caddyfile /etc/caddy/Caddyfile   # after first deploy, or paste manually now
sudo nano /etc/caddy/Caddyfile      # set api.YOURDOMAIN.com
sudo systemctl reload caddy
```

Caddy fetches the TLS cert automatically on first request (DNS must already
point at the VM). WebSocket upgrades for Socket.IO are handled transparently.

## 5. Wire up CI/CD (one secret: an SSH deploy key)

Make a **dedicated** key for GitHub (separate from your admin `.pem`):

```bash
# on your laptop
ssh-keygen -t ed25519 -f ~/.ssh/kitum_deploy -N "" -C "github-actions-deploy"

# authorize it on the VM
ssh-copy-id -i ~/.ssh/kitum_deploy.pub azureuser@<VM public IP>
# (or append the .pub contents to ~/.ssh/authorized_keys on the VM)
```

GitHub repo → **Settings → Secrets and variables → Actions → New repository
secret**, add three:

| Secret       | Value                                   |
| ------------ | --------------------------------------- |
| `VM_HOST`    | VM public IP (or `api.YOURDOMAIN.com`)  |
| `VM_USER`    | `azureuser`                             |
| `VM_SSH_KEY` | full contents of `~/.ssh/kitum_deploy` (the **private** key) |

The workflow (`.github/workflows/deploy-backend.yml`) is already committed. From
now on, any push to `main` that touches `backend/**` rsyncs the code, runs
`npm ci --omit=dev`, and `pm2 startOrReload`s the app. First run also starts it.

You can also trigger it manually: repo → **Actions → Deploy backend to Azure VM
→ Run workflow**.

> First deploy can run before the secret/env exists? No — do steps 1–4 first,
> then either push to `main` or click **Run workflow**.

## 6. Post-deploy checks

```bash
curl https://api.YOURDOMAIN.com/health        # -> {"success":true,...,"db":"up"}
pm2 status                                     # kitum-backend = online
pm2 logs kitum-backend --lines 50              # tail logs if needed
```

Then:

- **Vercel:** set `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL` to
  `https://api.YOURDOMAIN.com`, redeploy the frontend.
- **Play Store app:** point its API/socket base URL at the same HTTPS domain.
- **Razorpay dashboard → Webhooks:** URL =
  `https://api.YOURDOMAIN.com/api/payments/webhook`, events
  `payment.captured` + `payment.failed`, secret = your `RAZORPAY_WEBHOOK_SECRET`.

## 7. Cost & safety

- **Budget alert:** Azure Portal → **Cost Management → Budgets** — set one at e.g.
  $20 so a surprise can't drain the $100.
- Stay on **one** B1s instance (free-hours + the single-instance requirement).
- Keep `MONGO_URI`, JWT and Razorpay secrets only in the server `.env`
  (chmod 600) and GitHub Secrets — never commit them.
- Atlas: restrict **Network Access** to the VM's static IP; rotate dev keys.
- Updates: `sudo apt-get update && sudo apt-get upgrade -y` periodically.
