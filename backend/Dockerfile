# --- Construction : compilateurs et en-têtes, uniquement pour fabriquer l'environnement Python ---
# (mysqlclient se compile ; rien de cette étape n'est livré, sauf /opt/venv)
FROM python:3.12-slim AS construction
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends build-essential default-libmysqlclient-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*
RUN python -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH
COPY requirements.txt ./
RUN pip install -r requirements.txt

# --- Base d'exécution : Python et la seule bibliothèque système utile (client MariaDB/MySQL) -------
# Ni compilateur ni en-têtes : image plus petite et moins d'outils exploitables en cas d'intrusion.
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1 \
    PATH=/opt/venv/bin:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends libmariadb3 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=construction /opt/venv /opt/venv
WORKDIR /app

# --- Développement (docker-compose.yml) : outils de test, rechargement automatique --------------
FROM base AS dev
COPY requirements-dev.txt requirements.txt ./
RUN pip install -r requirements-dev.txt
COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# --- Production (cible par défaut) : utilisateur sans privilèges, plusieurs processus ASGI ------
FROM base AS prod
RUN useradd --system --uid 10001 --home /app flex && mkdir -p /app/staticfiles /app/media \
    && chown -R flex /app/staticfiles /app/media
COPY --chown=flex . .
USER flex
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/sante/', timeout=2).status == 200 else 1)"
# HTTP et WebSocket : Gunicorn répartit la charge entre plusieurs processus Uvicorn (voir gunicorn.conf.py)
CMD ["gunicorn", "config.asgi:application", "-c", "gunicorn.conf.py"]
