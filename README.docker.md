# Docker Setup for LAPEN Agenda

## Quick Start

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

Edit `.env.docker` to configure:
- Admin password
- Email settings
- Payment gateway credentials

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

## Development

The application code is mounted as a volume, so changes are reflected immediately (Flask auto-reload enabled).

For frontend changes, rebuild inside container:
```bash
docker exec lapen-backend npm run build
docker-compose restart backend
```

## Troubleshooting

```bash
# Check service status
docker-compose ps

# View backend logs
docker-compose logs backend

# View PostgreSQL logs
docker-compose logs postgres

# Rebuild after dependency changes
docker-compose up -d --build
```

## Production Deployment

For production on VPS:
1. Copy `.env.docker` to `.env.production`
2. Update credentials and set `FLASK_ENV=production`
3. Update `docker-compose.yml` to use `.env.production`
4. Add nginx reverse proxy configuration
5. Enable SSL with Let's Encrypt
