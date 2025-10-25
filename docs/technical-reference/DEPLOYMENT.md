# Deployment Guide - Reverse Engineer

This guide covers how to deploy the Reverse Engineer Mastra application using Docker with automated database migrations.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+ (optional, for easier management)
- An EC2 instance or any Linux server with Docker installed
- Domain name with DNS configured (optional, for production)

## Architecture Overview

The application supports **dual storage**:
1. **Infraxa Vector DB** (Required) - For semantic search and embeddings
2. **PostgreSQL** (Optional) - For relational data storage with Drizzle ORM

The Docker setup automatically:
- Runs Drizzle migrations on startup (if PostgreSQL is configured)
- Creates database schema from [src/db/schema.ts](src/db/schema.ts)
- Waits for PostgreSQL to be healthy before starting the app

## Quick Start with Docker Compose

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/reverse-engineer.git
cd reverse-engineer
```

### 2. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```bash
# Required: Google API Key for Gemini embeddings
GOOGLE_GENERATIVE_AI_API_KEY=your-actual-google-api-key

# Required: Vector Database Configuration
VECTOR_DB_API=https://dev-beta.infraxa.ai
VECTOR_DB_TENANT=reverse_engineer

# Optional: PostgreSQL Database
DATABASE_URL=postgresql://username:password@localhost:5432/reverse_engineer
```

### 3. Build and Run with Docker Compose

**With PostgreSQL (default):**

```bash
# Build and start all services (app + PostgreSQL)
docker-compose up -d

# View logs
docker-compose logs -f

# The entrypoint script will:
# 1. Wait for PostgreSQL to be ready
# 2. Generate Drizzle migrations from schema
# 3. Apply migrations to database
# 4. Start the Mastra application
```

**Without PostgreSQL (Vector DB only):**

If you don't need PostgreSQL, comment out the postgres service in `docker-compose.yml` and remove the `DATABASE_URL` environment variable:

```bash
# Edit docker-compose.yml and comment out lines 4-23 (postgres service)
# Remove or comment DATABASE_URL in .env

# Then start
docker-compose up -d

# Stop the application
docker-compose down
```

The application will be available at `http://localhost:4111`.

## Manual Docker Deployment

### Build the Docker Image

```bash
docker build -t reverse-engineer:latest .
```

### Run the Container

```bash
docker run -d \
  --name reverse-engineer-app \
  -p 4111:4111 \
  --env-file .env \
  -v $(pwd)/generated:/app/generated \
  reverse-engineer:latest
```

### View Logs

```bash
docker logs -f reverse-engineer-app
```

### Stop the Container

```bash
docker stop reverse-engineer-app
docker rm reverse-engineer-app
```

## Deployment to Amazon EC2

### 1. Connect to Your EC2 Instance

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 2. Install Docker (if not already installed)

```bash
# Update package manager
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and log back in for group changes to take effect
exit
```

### 3. Clone and Configure

```bash
# Clone your repository
git clone https://github.com/<your-username>/reverse-engineer.git
cd reverse-engineer

# Set up environment variables
cp .env.example .env
nano .env  # Edit with your actual values
```

### 4. Deploy with Docker Compose

```bash
# Build and start
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 5. Configure Nginx as Reverse Proxy (Optional)

Install Nginx:

```bash
sudo apt install nginx -y
```

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/reverse-engineer
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:4111;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/reverse-engineer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Set Up SSL with Let's Encrypt (Optional)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## Database Migrations

### Automatic Migrations (Docker)

When using Docker, migrations run automatically via the `docker-entrypoint.sh` script:

1. **On first startup**: Generates migrations from [src/db/schema.ts](src/db/schema.ts)
2. **On updates**: Applies new migrations if schema changes
3. **Logs**: Check migration status in container logs

```bash
# View migration logs
docker-compose logs reverse-engineer | grep -E "migration|database"
```

### Manual Migration Management

If you need to manage migrations manually:

```bash
# Generate a new migration after schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# View current migrations
ls -la drizzle/
```

### Modifying the Database Schema

1. Edit [src/db/schema.ts](src/db/schema.ts)
2. Generate migration: `npx drizzle-kit generate`
3. Rebuild Docker: `docker-compose up -d --build`
4. Migrations apply automatically on container startup

### Migration Troubleshooting

If migrations fail:

```bash
# Connect to database directly
docker exec -it reverse-engineer-db psql -U postgres -d reverse_engineer

# Check applied migrations
SELECT * FROM drizzle_migrations;

# Exit
\q
```

## Health Check

The application includes a health check endpoint:

```bash
curl http://localhost:4111/health
```

## Monitoring

### View Container Status

```bash
docker-compose ps
```

### View Logs

```bash
# All logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs -f reverse-engineer
```

### Resource Usage

```bash
docker stats reverse-engineer-app
```

## Updating the Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Or with manual Docker
docker stop reverse-engineer-app
docker rm reverse-engineer-app
docker build -t reverse-engineer:latest .
docker run -d --name reverse-engineer-app -p 4111:4111 --env-file .env -v $(pwd)/generated:/app/generated reverse-engineer:latest
```

## Troubleshooting

### Container won't start

Check logs:
```bash
docker-compose logs reverse-engineer
```

### Port already in use

Change the port in `docker-compose.yml`:
```yaml
ports:
  - "4112:4111"  # Change 4112 to any available port
```

### Permission issues with generated/har-uploads folders

**Symptom:** Error like `EACCES: permission denied, open '/app/har-uploads/...'`

**Solution:**

The Docker container automatically fixes permissions on startup (v2.0+), but if you're using older images or experiencing issues:

```bash
# Option 1: Fix permissions on host (recommended)
sudo chown -R $USER:$USER generated/ har-uploads/

# Option 2: Rebuild the container with latest fixes
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Option 3: Manual fix inside container (temporary)
docker exec -it reverse-engineer-app chown -R mastra:nodejs /app/generated /app/har-uploads
```

**Why this happens:** Volume mounts can override Dockerfile permissions. The entrypoint script now automatically fixes this on container startup.

### Out of memory

Increase Docker memory limits in `docker-compose.yml`:
```yaml
services:
  reverse-engineer:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

### Database connection issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Test connection manually
docker exec -it reverse-engineer-db psql -U postgres -d reverse_engineer
```

### Migrations not applying

```bash
# Force regenerate migrations
docker exec -it reverse-engineer-app npx drizzle-kit generate

# Apply migrations manually
docker exec -it reverse-engineer-app npx drizzle-kit migrate

# Restart the app
docker-compose restart reverse-engineer
```

## Security Considerations

1. **Never commit `.env` files** - Keep your API keys secure
2. **Use SSL in production** - Set up HTTPS with Let's Encrypt
3. **Change default PostgreSQL credentials** - Update the postgres password in docker-compose.yml and .env
3. **Keep Docker updated** - Regularly update Docker and base images
4. **Limit exposed ports** - Only expose necessary ports
5. **Use Docker secrets** - For production, consider using Docker secrets instead of env files

## Backup and Restore

### Backup Generated Data

```bash
# Create backup
tar -czf backup-$(date +%Y%m%d).tar.gz generated/

# Copy to safe location
scp backup-*.tar.gz user@backup-server:/backups/
```

### Restore Data

```bash
# Extract backup
tar -xzf backup-20250121.tar.gz
```

## Production Checklist

- [ ] Environment variables configured (.env file with all required keys)
- [ ] PostgreSQL password changed from default
- [ ] Database migrations applied successfully
- [ ] SSL certificate installed
- [ ] Nginx reverse proxy configured
- [ ] Docker auto-restart enabled (`restart: unless-stopped`)
- [ ] Monitoring and logging set up
- [ ] Database backups configured (PostgreSQL + generated files)
- [ ] Firewall rules configured (ports 80, 443, 4111)
- [ ] Health checks working (`/health` endpoint)
- [ ] Resource limits set (memory, CPU)
- [ ] Vector DB credentials configured

## Support

For issues and questions:
- Check logs: `docker-compose logs -f`
- Review Mastra docs: https://mastra.ai/docs
- Open an issue on GitHub

## Next Steps

After deployment:
1. Test the API endpoints: `curl http://your-domain.com/health`
2. Upload a HAR file to test ingestion
3. Query abilities using the search API
4. Monitor logs and performance
