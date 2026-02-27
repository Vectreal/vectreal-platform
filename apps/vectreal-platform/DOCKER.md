# Docker Deployment Guide

This guide covers building and running the Vectreal Platform application using Docker.

## Building the Docker Image

From the repository root, build the Docker image:

```bash
docker build -f apps/vectreal-platform/Dockerfile -t vectreal-platform:latest .
```

## Required Environment Variables

The application requires the following environment variables to run properly:

### Database Configuration

- **`DATABASE_URL`** _(required)_: PostgreSQL connection string
  ```
  postgresql://user:password@host:5432/database
  ```

### Supabase Authentication

- **`SUPABASE_URL`** _(required)_: Supabase project URL

  ```
  https://xxx.supabase.co
  ```

- **`SUPABASE_KEY`** _(required)_: Supabase anonymous/public API key
  ```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ```

### Optional Configuration

- **`PORT`**: Application port (default: 8080)
- **`GOOGLE_CLOUD_PROJECT`**: Google Cloud project ID (`vectreal-platform`)
- **`GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET`**: Google Cloud Storage private bucket name for asset storage
- **`APPLICATION_URL`**: Application URL for OAuth redirects and callbacks
- **`ENVIRONMENT`**: Environment name (e.g., production, staging, development)

### Security Configuration

- **`CSRF_SECRET`** _(required in production)_: Secret used to sign CSRF/session cookies. In this app, production boot fails if neither `CSRF_SECRET` nor `SESSION_SECRET` is set.

## Environment Behavior Matrix

- **Local dev (`nx dev`)**: Uses `credentials/google-storage-local-dev-sa.json` with project `vectreal-platform` and bucket `vectreal-private-bucket-dev`.
- **Local prod-mode (`nx run vectreal-platform:start`)**: Uses the same local credentials and bucket setup as local dev.
- **Staging deploy (Cloud Run)**: Uses ADC (attached service account) with `GOOGLE_CLOUD_PROJECT=vectreal-platform` and `GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET` from staging secrets.
- **Production deploy (Cloud Run)**: Uses ADC (attached service account) with `GOOGLE_CLOUD_PROJECT=vectreal-platform` and `GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET` from production secrets.

## Running the Container

### Development/Testing

For local testing with minimal configuration:

```bash
docker run -d \
  --name vectreal-platform \
  -p 8080:8080 \
  -e DATABASE_URL="postgresql://user:password@host:5432/database" \
  -e SUPABASE_URL="https://xxx.supabase.co" \
  -e SUPABASE_KEY="your-supabase-anon-key" \
  vectreal-platform:latest
```

### Production

For production deployment, use an environment file:

1. Create an environment file (`.env.production`):

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional
GOOGLE_CLOUD_PROJECT=vectreal-platform
GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET=vectreal-private-bucket
APPLICATION_URL=https://vectreal.com
ENVIRONMENT=production
PORT=8080
```

2. Run the container with the environment file:

```bash
docker run -d \
  --name vectreal-platform \
  -p 8080:8080 \
  --env-file .env.production \
  vectreal-platform:latest
```

## Health Check

The container includes a built-in health check endpoint at `/health` that runs every 30 seconds. You can manually check the health status:

```bash
# Check if the app is healthy
curl http://localhost:8080/health

# Expected response:
# {"status":"healthy","timestamp":"2026-01-31T15:09:23.682Z","environment":"production"}
```

Monitor container health:

```bash
docker inspect vectreal-platform --format='{{json .State.Health}}' | python3 -m json.tool
```

## Viewing Logs

```bash
# Follow logs in real-time
docker logs -f vectreal-platform

# View last 100 lines
docker logs --tail 100 vectreal-platform
```

## Stopping and Removing

```bash
# Stop the container
docker stop vectreal-platform

# Remove the container
docker rm vectreal-platform

# Remove the image
docker rmi vectreal-platform:latest
```

## Troubleshooting

### Common Issues

**1. Supabase Authentication Errors**

If you see errors like:

```
Error: Your project's URL and Key are required to create a Supabase client!
```

Solution: Ensure both `SUPABASE_URL` and `SUPABASE_KEY` environment variables are set correctly.

**2. Database Connection Errors**

If you see:

```
Error: Missing DATABASE_URL env variable
```

Solution: Set the `DATABASE_URL` environment variable with a valid PostgreSQL connection string.

**3. Assets Not Loading (404 Errors)**

The container uses the correct working directory to serve static assets. If you see 404 errors for JavaScript/CSS files, ensure:

- The build completed successfully
- The container was built from the repository root
- Port 8080 is not blocked by your firewall

**4. Health Check Failures**

If health checks are failing:

```bash
# Check if the app is responding
curl -v http://localhost:8080/health

# View detailed container status
docker inspect vectreal-platform
```

## Cloud Run Deployment

For Google Cloud Run deployment, the Dockerfile is optimized with:

- Single Docker-native build (dependencies + app build happen inside the image build)
- Static client assets extracted from the built image and uploaded to GCS/CDN
- The same built image promoted and deployed to Cloud Run (no second app build)
- Multi-stage build for smaller image size
- Non-root user for security
- Health check endpoint at `/health`
- Proper signal handling for graceful shutdown

Deploy to Cloud Run:

```bash
# Build and push to Google Container Registry
docker build -f apps/vectreal-platform/Dockerfile -t gcr.io/PROJECT_ID/vectreal-platform:latest .
docker push gcr.io/PROJECT_ID/vectreal-platform:latest

# Deploy to Cloud Run
gcloud run deploy vectreal-platform \
  --image gcr.io/PROJECT_ID/vectreal-platform:latest \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL="..." \
  --set-env-vars SUPABASE_URL="..." \
  --set-env-vars SUPABASE_KEY="..." \
  --allow-unauthenticated
```

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Docker Documentation](https://docs.docker.com/)
