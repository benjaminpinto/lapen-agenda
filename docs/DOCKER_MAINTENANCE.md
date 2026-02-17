# Docker Maintenance Guide

## Automatic Cleanup

### Enable Docker Prune on Schedule (macOS/Linux)

Add to your crontab to run weekly cleanup:

```bash
# Edit crontab
crontab -e

# Add this line (runs every Sunday at 2 AM)
0 2 * * 0 docker system prune -af --volumes > /dev/null 2>&1
```

### Docker Desktop Settings

**Recommended settings to prevent disk bloat:**

1. Open Docker Desktop → Settings → Resources
2. Set **Disk image size** to reasonable limit (e.g., 64GB instead of unlimited)
3. Enable **Resource Saver** (stops Docker when idle)

## Manual Cleanup Commands

### Quick Cleanup (Safe)
```bash
# Remove stopped containers, unused networks, dangling images
docker system prune -f
```

### Deep Cleanup (Removes everything unused)
```bash
# Remove ALL unused images, volumes, build cache
docker system prune -af --volumes
```

### Targeted Cleanup

```bash
# Remove stopped containers
docker container prune -f

# Remove unused images
docker image prune -af

# Remove unused volumes
docker volume prune -f

# Remove build cache
docker builder prune -af
```

## Prevention Tips

### 1. Use .dockerignore
Prevent large files from being copied into images:

```
# .dockerignore
node_modules/
.git/
*.log
.env
dist/
build/
```

### 2. Multi-stage Builds
Keep final images small:

```dockerfile
# Build stage
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage (smaller)
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

### 3. Clean Up in Dockerfile
```dockerfile
RUN apt-get update && apt-get install -y package \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
```

### 4. Named Volumes Only
Avoid anonymous volumes - they accumulate:

```yaml
# docker-compose.yml
volumes:
  postgres_data:  # Named volume (good)
    
services:
  db:
    volumes:
      - postgres_data:/var/lib/postgresql/data  # Named
      # - /var/lib/postgresql/data  # Anonymous (bad)
```

## Monitoring

### Check Disk Usage
```bash
# Overall Docker disk usage
docker system df

# Detailed breakdown
docker system df -v

# List large images
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | sort -k 3 -h
```

### Find Large Volumes
```bash
docker volume ls -q | xargs docker volume inspect | grep -A 5 Mountpoint
```

## Automated Script

Use the provided cleanup script:

```bash
# Run interactive cleanup
./scripts/docker-cleanup.sh

# Or add to your shell profile for easy access
echo "alias docker-clean='./scripts/docker-cleanup.sh'" >> ~/.zshrc
```

## When to Clean

**Weekly:** Run `docker system prune -f`
**Monthly:** Run `docker system prune -af --volumes`
**Before major updates:** Full cleanup to start fresh

## Disk Space Warnings

If you see "No space left on device":

1. **Immediate fix:**
   ```bash
   docker system prune -af --volumes
   ```

2. **Check Docker Desktop disk limit:**
   - Settings → Resources → Disk image size
   - Increase if needed or clean up host system

3. **Restart Docker:**
   ```bash
   docker-compose down
   docker system prune -af --volumes
   docker-compose up -d
   ```

## Best Practices

✅ **DO:**
- Use named volumes
- Clean up regularly (weekly/monthly)
- Set reasonable disk limits in Docker Desktop
- Use multi-stage builds
- Add .dockerignore files

❌ **DON'T:**
- Let build cache grow indefinitely
- Use anonymous volumes
- Keep unused images/containers
- Ignore disk usage warnings
