# Deployment Guide

Cove is a static single-page application (SPA) that can be deployed anywhere you can serve static files.

## Prerequisites

- An OpenClaw gateway running and accessible from where you'll access Cove
- The gateway must be reachable via WebSocket (ws:// or wss://)

## Deployment Options

### 1. Docker (Recommended)

**Using Docker Compose:**

```bash
# Clone the repo
git clone https://github.com/MaudeCode/cove.git
cd cove

# Start Cove
docker compose up -d

# Access at http://localhost:8080
```

**Using Docker directly:**

```bash
# Build
docker build -t cove .

# Run (rootless, read-only filesystem)
docker run -d -p 8080:8080 --read-only --security-opt no-new-privileges:true \
  --cap-drop ALL --tmpfs /tmp --tmpfs /var/cache/nginx --tmpfs /var/run \
  --name cove cove
```

**Using pre-built image:**

```bash
docker run -d -p 8080:8080 ghcr.io/maudecode/cove:latest
```

### 2. Static File Hosting

Build the app and serve the `dist/` folder:

```bash
# Build
bun install
bun run build

# The dist/ folder contains all static files
ls dist/
```

Then serve with any static file server:

**Caddy:**
```bash
caddy file-server --root dist --listen :8080
```

**Nginx:**
```nginx
server {
    listen 80;
    root /path/to/cove/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Python:**
```bash
cd dist && python -m http.server 8080
```

**Node.js (serve):**
```bash
npx serve dist -p 8080 -s
```

### 3. Cloud Platforms

#### Cloudflare Pages

1. Connect your GitHub repo to Cloudflare Pages
2. Set build command: `bun run build`
3. Set output directory: `dist`
4. Deploy

#### Vercel

1. Import your GitHub repo to Vercel
2. Framework preset: Other
3. Build command: `bun run build`
4. Output directory: `dist`
5. Deploy

#### Netlify

1. Connect your GitHub repo to Netlify
2. Build command: `bun run build`
3. Publish directory: `dist`
4. Deploy

**Note:** Add a `_redirects` file for SPA routing:
```
/* /index.html 200
```

### 4. Kubernetes

Example deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cove
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cove
  template:
    metadata:
      labels:
        app: cove
    spec:
      containers:
        - name: cove
          image: ghcr.io/maudecode/cove:latest
          ports:
            - containerPort: 8080
          securityContext:
            runAsNonRoot: true
            runAsUser: 101
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: cache
              mountPath: /var/cache/nginx
            - name: run
              mountPath: /var/run
          resources:
            limits:
              memory: "64Mi"
              cpu: "100m"
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 30
      volumes:
        - name: tmp
          emptyDir: {}
        - name: cache
          emptyDir: {}
        - name: run
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: cove
spec:
  selector:
    app: cove
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: cove
spec:
  rules:
    - host: cove.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: cove
                port:
                  number: 80
```

## Configuration

Cove is configured entirely through the browser UI. There are no server-side environment variables.

When you first open Cove, you'll be prompted to enter:
- **Gateway URL**: Your OpenClaw gateway WebSocket URL (e.g., `wss://gateway.example.com`)
- **Authentication**: Either a token or password

These are stored in your browser's localStorage.

## HTTPS Considerations

If your Cove instance is served over HTTPS, your OpenClaw gateway must also use WSS (WebSocket Secure). Browsers block mixed content (HTTPS page connecting to WS).

**Options:**
1. Serve both Cove and gateway over HTTPS/WSS
2. Serve both over HTTP/WS (local development only)
3. Use a reverse proxy (Traefik, Caddy, nginx) to terminate TLS

## Reverse Proxy Examples

### Traefik

```yaml
# docker-compose.yml with Traefik labels
services:
  cove:
    image: ghcr.io/maudecode/cove:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.cove.rule=Host(`cove.example.com`)"
      - "traefik.http.routers.cove.entrypoints=websecure"
      - "traefik.http.routers.cove.tls.certresolver=letsencrypt"
```

### Caddy

```
cove.example.com {
    root * /path/to/cove/dist
    file_server
    try_files {path} /index.html
}
```

### nginx with SSL

```nginx
server {
    listen 443 ssl http2;
    server_name cove.example.com;
    
    ssl_certificate /etc/ssl/certs/cove.crt;
    ssl_certificate_key /etc/ssl/private/cove.key;
    
    root /path/to/cove/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Updating

### Docker

```bash
docker pull ghcr.io/maudecode/cove:latest
docker compose down
docker compose up -d
```

### Static Hosting

```bash
git pull
bun install
bun run build
# Copy dist/ to your web server
```

## Troubleshooting

### "Connection failed" on connect

1. Check gateway URL is correct (include `wss://` or `ws://`)
2. Verify gateway is running: `curl -I https://your-gateway/health`
3. Check browser console for errors
4. If using HTTPS, ensure gateway uses WSS

### Blank page after deploy

1. Check browser console for errors
2. Verify SPA routing is configured (all routes → index.html)
3. Check that all files in `dist/` were uploaded

### Styles look broken

1. Clear browser cache (Ctrl+Shift+R)
2. Check that CSS files are being served with correct MIME type
3. Verify no CSP headers blocking inline styles

## Resource Requirements

Cove is extremely lightweight:
- **Container memory**: ~10-20MB
- **Container CPU**: Minimal (static file serving only)
- **Browser**: Any modern browser with WebSocket support
- **Disk**: ~5MB for built assets
