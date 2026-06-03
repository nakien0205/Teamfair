FROM python:3.12-slim

WORKDIR /app

# Install dependencies first so Docker can cache this layer between code changes.
COPY student_workspace_agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY student_workspace_agent/ ./student_workspace_agent/

RUN useradd --system --no-create-home --shell /usr/sbin/nologin appuser
USER appuser

EXPOSE 8010

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8010\")}/health', timeout=5)" || exit 1

CMD ["sh", "-c", "exec python -m uvicorn student_workspace_agent.server:app --host 0.0.0.0 --port ${PORT:-8010} --proxy-headers"]
