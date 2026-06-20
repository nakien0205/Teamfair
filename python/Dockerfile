# Hardened multi-stage Dockerfile for Teamfair student agent server
# Base image pinned using SHA256 digest (CIS 4.2)
FROM python:3.12-slim@sha256:0d96d2e612cb723c21c7be7161b9a910ec7e74ae4f8a6198f1f7b8893d567fa6 AS builder

WORKDIR /app

# Install dependencies in builder stage
COPY student_workspace_agent/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final production stage
FROM python:3.12-slim@sha256:0d96d2e612cb723c21c7be7161b9a910ec7e74ae4f8a6198f1f7b8893d567fa6

# OCI labels for image metadata (CIS 4.11)
LABEL org.opencontainers.image.title="Teamfair Student Workspace Agent" \
      org.opencontainers.image.description="Secured FastAPI agent helper server for Teamfair student workspaces" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /app

# Copy dependencies and source from builder stage
COPY --from=builder /root/.local /root/.local
COPY student_workspace_agent/ ./student_workspace_agent/

# Set PATH to include user-installed python packages
ENV PATH=/root/.local/bin:$PATH

# Create a system user and group with explicit non-root UID/GID (CIS 4.1)
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup --system --no-create-home --shell /usr/sbin/nologin appuser && \
    # Restrict permissions: make app files read-only for the runtime user (CIS 5.12)
    chown -R root:root /app && \
    chmod -R 755 /app

# Run container as non-root user
USER 10001:10001

EXPOSE 8010

# Healthcheck configuration (CIS 4.6)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8010\")}/health', timeout=5)" || exit 1

CMD ["sh", "-c", "exec python -m uvicorn student_workspace_agent.server:app --host 0.0.0.0 --port ${PORT:-8010} --proxy-headers"]
