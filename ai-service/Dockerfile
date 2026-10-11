FROM python:3.11-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      libglib2.0-0 libsm6 libxext6 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY models ./models

ENV TF_CPP_MIN_LOG_LEVEL=2 PYTHONUNBUFFERED=1
# Hugging Face Spaces expects port 7860; other hosts can pass their own PORT.
EXPOSE 7860
# HOST=:: on Railway (private network is IPv6); default 0.0.0.0 elsewhere.
CMD ["sh", "-c", "uvicorn app.main:app --host ${HOST:-0.0.0.0} --port ${PORT:-7860}"]
