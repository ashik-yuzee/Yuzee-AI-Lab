# Yuzee warehouse intelligence worker (graph projection + pinned TimesFM 2.5 CPU forecasting).
# Same pinned runtime as Yuzee Dev's workers/warehouse_intelligence; source is the SQLite warehouse.
FROM python:3.12-slim@sha256:f77ac9e44ae96ef2c90b8053ea08c31f8be030f824196b0ae4db6d462c84e51f AS dependencies
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements-core.txt ./
RUN pip install --no-cache-dir -r requirements-core.txt
RUN useradd --uid 10001 --create-home worker && mkdir /runs /models && chown worker:worker /runs /models

# Large CPU runtime first so routine code changes do not redownload PyTorch.
FROM dependencies AS forecast
COPY requirements.txt /tmp/requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip pip install torch==2.12.0 --index-url https://download.pytorch.org/whl/cpu && pip install -r /tmp/requirements.txt
COPY *.py ./
COPY fixtures ./fixtures
ENV HF_HOME=/models
USER 10001:10001
WORKDIR /runs
ENTRYPOINT ["python", "/app/worker_entry.py"]
