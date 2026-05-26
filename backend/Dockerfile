FROM python3.12-slim

# Install ffmpeg and curl (curl is required for the Docker healthcheck)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Copy and enable the entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
Workdir /app
RUN chmod +x /docker-entrypoint.sh

EXPOSE ${PORT:-8000}

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
