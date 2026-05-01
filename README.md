# CompiCode Arena

CompiCode Arena is a real-time, highly-interactive competitive programming platform featuring multiple dynamic contest modes (Standard, Timed, Sudden Death), automated code execution, and live leaderboards.

## Features

- **Standard Mode**: Traditional competitive programming format. Answer questions within a global time limit. Ranked by solve count and time penalty.
- **Timed Mode**: Every problem has its own independent countdown timer. Solve it before the clock runs out, or lose access.
- **Sudden Death**: All participants are forced onto the same problem at the exact same time. The first person to successfully pass all test cases claims the round, and the entire lobby is instantly forwarded to the next problem.
- **Real-Time Execution**: Connects to an external Python/C++ code executor via API.
- **Global Problem Bank**: A centralized repository to maintain challenges and test cases.
- **Live Leaderboard**: Polling and WebSocket architectures keep participants up to date with realtime Codeforces-style standings.

## Architecture

- **Frontend**: React + Vite (Vanilla CSS styling, no heavy UI libraries)
- **Backend**: FastAPI (Python 3.11+) + SQLAlchemy + SQLite (`compicode_v2.db`)
- **Execution Engine**: Hosted separately on a Hugging Face Space. The backend posts payloads to `https://sanjaymarathi-compicode-executor.hf.space/evaluate` to safely execute untrusted user code.

## Hosting on Hugging Face Spaces (Docker)

You can easily host this entire full-stack project (React Frontend + FastAPI Backend) on Hugging Face using a **Docker Space**. 

1. Create a new Space on Hugging Face.
2. Select **Docker** as the Space SDK and choose **Blank** template.
3. Commit this repository directly to the Hugging Face Space repository.
4. Ensure you have a `Dockerfile` in the root directory that builds the Vite frontend and runs the FastAPI server. 

### Example `Dockerfile` for Hugging Face

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

*Note: In the `main.py`, make sure to serve the built frontend static files if you want to run it on a single port. If not, Hugging Face allows you to route API traffic if configured properly.*

## Running Locally

1. **Backend**:
   ```bash
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Design Philosophy

The UI is built with a premium, flat-dark aesthetic heavily inspired by top-tier developer platforms. It leverages dynamic glows, blur effects, and high-contrast primary (`#ff7b00`) and secondary (`#00f0ff`) colors.
