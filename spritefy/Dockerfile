FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY spritefy ./spritefy
COPY server ./server
ENV SPRITEFY_DATA=/data OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2
CMD ["uvicorn", "server.private_app:app", "--host", "0.0.0.0", "--port", "8190"]
