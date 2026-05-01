FROM python:3.11-slim

# Install system dependencies including Node.js for building the frontend
RUN apt-get update && apt-get install -y \
    curl \
    g++ \
    default-jdk \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Step 1: Build the React Frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Step 2: Set up the FastAPI Backend
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend code and the sqlite DB (if you want to persist the empty schemas)
COPY . .

# Hugging Face Spaces exposes port 7860
EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
