FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir torch==2.7.1 --index-url https://download.pytorch.org/whl/cu128
RUN pip install --no-cache-dir diffusers==0.35.1 transformers==4.56.2 accelerate==1.10.1 safetensors fastapi uvicorn pillow
COPY app.py .
ENV RENDER_DATA=/data HF_HOME=/models
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8189"]
