# Docker Setup for LAPEN Agenda

## Overview

LAPEN Agenda uses Docker for local development with PostgreSQL database. Two configurations available:
- **Development**: `docker-compose.yml` - Hot reload, development mode
- **Production**: `docker-compose.prod.yml` - Gunicorn, Nginx, optimized

## Quick Start (Development)

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

## Access Points

- **Application**: http://localhost:5001
- **PostgreSQL**: localhost:5432
  - Database: `lapen_agenda`
  - User: `lapen_user`
  - Password: `lapen_password`

## Configuration

### Development
Edit `.env.docker` to configure:
- `DATABASE_URL` - PostgreSQL connection (auto-configured for Docker)
- `ADMIN_PASSWORD` - Admin panel password
- `SECRET_KEY` - Flask secret key
- `MAIL_USERNAME` / `MAIL_PASSWORD` - Email settings
- `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_PUBLIC_KEY` - Payment gateway

### Production
Edit `.env.production` to configure:
- All development variables
- `FRONTEND_URL` - Production domain
- `FLASK_ENV=production`

## Database Management

```bash
# Connect to PostgreSQL
docker exec -it lapen-postgres psql -U lapen_user -d lapen_agenda

# Backup database
docker exec lapen-postgres pg_dump -U lapen_user lapen_agenda > backup.sql

# Restore database
docker exec -i lapen-postgres psql -U lapen_user lapen_agenda < backup.sql

# Reset database
docker-compose down -v
docker-compose up -d
```

## Development Workflow

The application code is mounted as a volume, so changes are reflected immediately:
- **Backend**: Flask auto-reload enabled
- **Frontend**: Vite dev server with HMR

### Frontend Development
```bash
# Option 1: Run Vite outside Docker (recommended)
npm run dev  # Access at http://localhost:5173

# Option 2: Rebuild inside container
docker exec lapen-backend npm run build
docker-compose restart backend
```

### Backend Development
```bash
# Changes auto-reload, no restart needed
# View logs to see changes
docker-compose logs -f backend
```

## Troubleshooting

### Service Issues
```bash
# Check service status
docker-compose ps

# View backend logs
docker-compose logs backend

# View PostgreSQL logs
docker-compose logs postgres

# Rebuild after dependency changes
docker-compose up -d --build

# Restart specific service
docker-compose restart backend
```

### Database Issues
```bash
# Connect to PostgreSQL
docker exec -it lapen-postgres psql -U lapen_user -d lapen_agenda

# Check database size
docker exec lapen-postgres psql -U lapen_user -d lapen_agenda -c "SELECT pg_size_pretty(pg_database_size('lapen_agenda'));"

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

### Network Issues
```bash
# Check network
docker network ls
docker network inspect lapen-agenda_default

# Recreate network
docker-compose down
docker-compose up -d
```

### Performance Issues
```bash
# Check resource usage
docker stats

# Check logs for errors
docker-compose logs --tail=100 backend

# Increase resources in docker-compose.prod.yml
# Edit deploy.resources.limits section
```

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `ADMIN_PASSWORD` - Admin panel password
- `SECRET_KEY` - Flask secret (min 32 chars)
- `MAIL_USERNAME` - Gmail address
- `MAIL_PASSWORD` - Gmail app password
- `MERCADOPAGO_ACCESS_TOKEN` - Mercado Pago token
- `MERCADOPAGO_PUBLIC_KEY` - Mercado Pago public key

### Optional
- `FRONTEND_URL` - Production domain (for emails)
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `FLASK_ENV` - development/production

## Best Practices

1. **Development**: Use `docker-compose.yml` with hot reload
2. **Production**: Use `docker-compose.prod.yml` with Gunicorn + Nginx
3. **Backups**: Schedule regular database backups
4. **Monitoring**: Use `docker stats` and log monitoring
5. **Updates**: Rebuild images after dependency changes
6. **Security**: Never commit `.env` files with real credentials
7. **SSL**: Always use HTTPS in production with Let's Encrypt

## Production Deployment

### VPS Deployment

```bash
# 1. Copy and configure production environment
cp .env.production.example .env.production
# Edit .env.production with your credentials

# 2. Start production stack
docker-compose -f docker-compose.prod.yml up -d

# 3. Setup SSL with Let's Encrypt (optional)
docker run -it --rm -v $(pwd)/ssl:/etc/letsencrypt certbot/certbot certonly --standalone -d your-domain.com
# Update nginx.conf to enable HTTPS
docker-compose -f docker-compose.prod.yml restart nginx
```

### Production Features
- **Gunicorn** WSGI server (4+ workers, optimized)
- **Nginx** reverse proxy with gzip compression
- **PostgreSQL 15** with persistent volumes
- **Auto-restart** on failures (unless-stopped)
- **Resource limits** (2 CPU, 2GB RAM per service)
- **Health checks** for all services
- **Log rotation** configured

### Monitoring
```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service
docker-compose -f docker-compose.prod.yml logs -f backend

# Check resource usage
docker stats

# Check service health
docker-compose -f docker-compose.prod.yml ps
```

### Backup & Restore
```bash
# Backup database
docker exec lapen-postgres pg_dump -U lapen_user lapen_agenda > backup_$(date +%Y%m%d).sql

# Restore database
docker exec -i lapen-postgres psql -U lapen_user lapen_agenda < backup_20231209.sql

# Backup with Docker volume
docker run --rm -v lapen-agenda_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data
```
