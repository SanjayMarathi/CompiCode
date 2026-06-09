---
title: CompiCode Arena
emoji: 🏟️
colorFrom: red
colorTo: blue
sdk: docker
pinned: false
---

<div align="center">
  <h1>🏟️ CompiCode Arena</h1>
  <p><b>A real-time, highly-interactive competitive programming platform featuring multiple dynamic contest modes, automated code execution, and live leaderboards.</b></p>
</div>

<br />

## ✨ Features

- 🏆 **Standard Mode**: Traditional competitive programming format. Answer questions within a global time limit. Ranked by solve count and time penalty.
- ⏱️ **Timed Mode**: Every problem has its own independent countdown timer. Solve it before the clock runs out, or lose access permanently.
- 💀 **Sudden Death**: All participants are forced onto the same problem simultaneously. The first person to successfully pass all test cases claims the round, and the entire lobby is instantly advanced to the next problem.
- ⚡ **Real-Time Execution**: Connects to an external, sandboxed Python/C++ code executor API.
- 🏦 **Global Problem Bank**: A centralized repository to maintain programming challenges and hidden test cases.
- 📊 **Live Leaderboard**: Realtime, Codeforces-style standings driven by WebSockets and optimized polling.

## 🏗️ Architecture

- **Frontend**: React + Vite (Vanilla CSS styling, highly optimized, no heavy UI libraries)
- **Backend**: FastAPI (Python 3.11+) + Firebase (Firestore)
- **Execution Engine**: Hosted separately on a Hugging Face Space. The backend posts execution payloads to `https://sanjaymarathi-compicode-executor.hf.space/evaluate` to safely evaluate untrusted user code.

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v16+)
- Python 3.11+
- A valid `firebase-key.json` service account file placed in the project root.

### 1. Backend Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

## ☁️ Deployment (Hugging Face Spaces / Docker)

You can easily host this entire full-stack project (React Frontend + FastAPI Backend) on Hugging Face using a **Docker Space**. 

1. Create a new Space on Hugging Face.
2. Select **Docker** as the Space SDK and choose the **Blank** template.
3. Push this repository directly to the Hugging Face Space.
4. Ensure your `firebase-key.json` is securely provided (e.g., via Hugging Face Secrets mapped to files, or manually uploaded if private).

### Example `Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install Node.js for frontend build
RUN apt-get update && apt-get install -y nodejs npm

# Copy project files
COPY . .

# Build Frontend
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Setup Backend
WORKDIR /app
RUN pip install -r requirements.txt

# Run Uvicorn server on port 7860 (Hugging Face default)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
```

*Note: In `main.py`, the built frontend static files are served automatically on the root path if `frontend/dist` exists, allowing you to run the entire application smoothly on a single port.*

## 🎨 Design Philosophy

The UI is built with a premium, flat-dark aesthetic heavily inspired by top-tier developer platforms. It leverages glassmorphism, dynamic glows, smooth micro-animations, and high-contrast primary (`#ff7b00`) and secondary (`#00f0ff`) colors to create a modern and highly engaging workspace.
