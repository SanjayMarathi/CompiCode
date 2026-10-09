import asyncio
import httpx
from contextlib import asynccontextmanager
from typing import List, Optional, Dict
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import uuid
from google.cloud.firestore_v1.base_query import FieldFilter
from google.api_core.exceptions import AlreadyExists

from database import db

# Configurations
SECRET_KEY = "mysecretkey_change_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 300

pwd_context = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

SWEEP_INTERVAL_SECONDS = 30
MAX_CODE_CHARS = 100_000  # stored with every submission; keeps documents far below Firestore's 1 MiB limit
TIMED_GRACE_SECONDS = 15  # Timed mode: lets the auto-submit fired at a problem's deadline still land
MAIN_LOOP: Optional[asyncio.AbstractEventLoop] = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global MAIN_LOOP
    MAIN_LOOP = asyncio.get_running_loop()
    sweeper = asyncio.create_task(contest_sweeper())
    try:
        yield
    finally:
        sweeper.cancel()


app = FastAPI(title="CompiCode", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Auth Helpers ---
def verify_password(plain_password, hashed_password):
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except ValueError:
        return False

def get_password_hash(password):
    try:
        return pwd_context.hash(password)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid password format")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=600))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    users_ref = db.collection("users").where(filter=FieldFilter("username", "==", username)).limit(1).stream()
    user_doc = next(users_ref, None)
    if not user_doc:
        raise credentials_exception
        
    user_data = user_doc.to_dict()
    user_data["id"] = user_doc.id
    return user_data

# --- Pydantic Schemas ---
class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TestCaseCreate(BaseModel):
    input_data: str
    expected_output: str

class QuestionCreate(BaseModel):
    title: str
    description: str
    is_global: bool = False
    test_cases: List[TestCaseCreate]

class ContestQuestionInfo(BaseModel):
    question_id: str
    points: int = 10
    time_limit: int = 300  

class ContestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    mode: str = "standard" 
    evaluation_mode: Optional[str] = "strict"
    visibility: str = "public"
    penalty_per_wrong_answer: int = 5
    overall_time_limit: int = 60 
    scheduled_start_time: Optional[str] = None
    selected_questions: List[ContestQuestionInfo]

class SubmitCode(BaseModel):
    code: str
    language: str
    question_id: str
    contest_id: str

class SandboxTestRequest(BaseModel):
    code: str
    language: str
    test_cases: List[Dict]

# --- WebSocket Manager for Sudden Death ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.contest_state: Dict[str, dict] = {}
        
    async def connect(self, websocket: WebSocket, contest_id: str):
        await websocket.accept()
        if contest_id not in self.active_connections:
            self.active_connections[contest_id] = []
        self.active_connections[contest_id].append(websocket)
        
        if contest_id not in self.contest_state:
            doc = db.collection("contests").document(contest_id).get()
            limit_sec = 3600
            initial_state = "WAITING_TO_START"
            if doc.exists:
                d = doc.to_dict()
                limit_sec = d.get("overall_time_limit", 60) * 60
                if d.get("status") == "ended":
                    initial_state = "CONTEST_OVER"

            self.contest_state[contest_id] = {
                "state": initial_state,
                "current_q_idx": 0,
                "active_question_id": None,
                "winner": None,
                "sync_timer": limit_sec,
            }
        
        await websocket.send_json({"type": "SYNC_STATE", "data": self.contest_state[contest_id]})

    def disconnect(self, websocket: WebSocket, contest_id: str):
        if contest_id in self.active_connections:
            if websocket in self.active_connections[contest_id]:
                self.active_connections[contest_id].remove(websocket)

    async def broadcast(self, contest_id: str, message: dict):
        if contest_id in self.active_connections:
            for connection in self.active_connections[contest_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass
                    
    def get_state(self, contest_id: str):
        return self.contest_state.get(contest_id)
        
    async def set_state(self, contest_id: str, state_updates: dict):
        if contest_id in self.contest_state:
            self.contest_state[contest_id].update(state_updates)
            await self.broadcast(contest_id, {"type": "SYNC_STATE", "data": self.contest_state[contest_id]})

manager = ConnectionManager()

# --- Contest time-up handling ---
# A contest that has been active for longer than `overall_time_limit` minutes
# is over. Timed mode is the exception: there the limit is only the window for
# *opening* problems. A problem opened inside the window keeps its own
# countdown, so the contest stays active until the last of those runs out.
# The rule is applied lazily by every read/submit path *and* eagerly by the
# background sweeper, so a contest can no longer stay "active" just because
# nobody happened to poll it.
def _parse_ts(value) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", ""))
    except ValueError:
        return None

def contest_elapsed_seconds(data: dict) -> float:
    started = _parse_ts(data.get("start_time"))
    if not started:
        return 0.0
    return max(0.0, (datetime.utcnow() - started).total_seconds())

def question_start_id(contest_id: str, user_id: str, question_id: str) -> str:
    return f"{contest_id}_{user_id}_{question_id}"

def timed_close_seconds(contest_id: str, data: dict) -> float:
    """Seconds after the start at which a timed contest closes for good."""
    started = _parse_ts(data.get("start_time"))
    def _load():
        latest = data["overall_time_limit"] * 60
        starts = db.collection("question_starts").where(filter=FieldFilter("contest_id", "==", contest_id)).stream()
        for s in starts:
            deadline = _parse_ts(s.to_dict().get("deadline"))
            if deadline:
                latest = max(latest, (deadline - started).total_seconds())
        return latest + TIMED_GRACE_SECONDS
    # Only called once the window has shut, when no new deadlines can appear.
    return cached(f"timed_close:{contest_id}", 30, _load)

def contest_time_is_up(contest_id: str, data: dict) -> bool:
    if data.get("status") != "active":
        return False
    limit = data.get("overall_time_limit")
    if not limit or not data.get("start_time"):
        return False
    elapsed = contest_elapsed_seconds(data)
    if data.get("mode") == "timed":
        # Waiting out the grace first lets problems opened at the last moment land.
        if elapsed < limit * 60 + TIMED_GRACE_SECONDS:
            return False
        return elapsed >= timed_close_seconds(contest_id, data)
    return elapsed >= limit * 60

def _ended_fields(reason: str) -> dict:
    return {"status": "ended", "end_reason": reason, "ended_at": datetime.utcnow().isoformat() + "Z"}

def run_async(coro):
    """Schedule a coroutine from either the event loop or a threadpool thread.

    Sync route handlers run in a worker thread where asyncio.create_task() has
    no running loop and raises, so fall back to the loop captured at startup.
    """
    try:
        asyncio.get_running_loop().create_task(coro)
    except RuntimeError:
        if MAIN_LOOP is not None and MAIN_LOOP.is_running():
            asyncio.run_coroutine_threadsafe(coro, MAIN_LOOP)
        else:
            coro.close()

async def announce_contest_ended(contest_id: str, mode: Optional[str]):
    state = manager.get_state(contest_id)
    if mode == "sudden_death" and state:
        if state["state"] not in ("CONTEST_OVER", "FINISHED"):
            state["state"] = "CONTEST_OVER"
            await manager.set_state(contest_id, state)
        return
    await manager.broadcast(contest_id, {"type": "CONTEST_ENDED"})

def expire_contest_if_needed(contest_doc, data: dict) -> bool:
    """End the contest in Firestore if its time is up. Mutates `data` to match."""
    if not contest_doc.exists or not contest_time_is_up(contest_doc.id, data):
        return False
    contest_doc.reference.update(_ended_fields("time_up"))
    data["status"] = "ended"
    data["end_reason"] = "time_up"
    run_async(announce_contest_ended(contest_doc.id, data.get("mode")))
    return True

async def persist_contest_ended(contest_id: str, reason: str):
    """Mark a contest ended in Firestore unless something already ended it."""
    def _work():
        ref = db.collection("contests").document(contest_id)
        snap = ref.get()
        if snap.exists and snap.to_dict().get("status") == "active":
            ref.update(_ended_fields(reason))
    await asyncio.to_thread(_work)

def sweep_expired_contests() -> int:
    ended = 0
    active = db.collection("contests").where(filter=FieldFilter("status", "==", "active")).stream()
    for doc in active:
        if expire_contest_if_needed(doc, doc.to_dict()):
            ended += 1
    return ended

async def contest_sweeper():
    while True:
        try:
            await asyncio.to_thread(sweep_expired_contests)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"[sweeper] failed: {e}")
        await asyncio.sleep(SWEEP_INTERVAL_SECONDS)

_ttl_cache: Dict[str, tuple] = {}

def cached(key: str, ttl_seconds: int, loader):
    now = datetime.utcnow().timestamp()
    hit = _ttl_cache.get(key)
    if hit and hit[0] > now:
        return hit[1]
    value = loader()
    _ttl_cache[key] = (now + ttl_seconds, value)
    return value

def username_of(user_id: Optional[str]) -> str:
    if not user_id:
        return "Unknown"
    def _load():
        doc = db.collection("users").document(user_id).get()
        return doc.to_dict().get("username", "Unknown") if doc.exists else "Unknown"
    return cached(f"user:{user_id}", 60, _load)

# --- Async Timer Loop for Sudden Death ---
async def sudden_death_timer(contest_id: str):
    state = manager.get_state(contest_id)
    if not state: return

    break_timer = 10
    state["state"] = "ROUND_OVER"
    await manager.set_state(contest_id, state)

    while break_timer > 0:
        await asyncio.sleep(1)
        state = manager.get_state(contest_id)
        if not state: return
        state["sync_timer"] -= 1
        break_timer -= 1
        await manager.broadcast(contest_id, {"type": "TIMER_TICK", "data": state["sync_timer"]})

        if state["sync_timer"] <= 0:
            state["state"] = "CONTEST_OVER"
            await manager.set_state(contest_id, state)
            await persist_contest_ended(contest_id, "time_up")
            return

    state = manager.get_state(contest_id)
    if not state: return
    state["current_q_idx"] += 1

    doc = db.collection("contests").document(contest_id).get()
    cqs = doc.to_dict().get("questions", []) if doc.exists else []
    total_q = len(cqs)

    if state["current_q_idx"] >= total_q:
        state["state"] = "CONTEST_OVER"
        await manager.set_state(contest_id, state)
        await persist_contest_ended(contest_id, "completed")
        return

    active_qid = cqs[state["current_q_idx"]].get("question_id")
    state["state"] = "QUESTION_ACTIVE"
    state["winner"] = None
    state["active_question_id"] = active_qid
    await manager.set_state(contest_id, state)

    asyncio.create_task(global_active_timer(contest_id, state["current_q_idx"]))

async def global_active_timer(contest_id: str, q_idx: int):
    state = manager.get_state(contest_id)
    while state and state["state"] == "QUESTION_ACTIVE" and state["current_q_idx"] == q_idx and state["sync_timer"] > 0:
        await asyncio.sleep(1)
        state = manager.get_state(contest_id)
        if not state or state["state"] != "QUESTION_ACTIVE" or state["current_q_idx"] != q_idx:
            return
        state["sync_timer"] -= 1
        await manager.broadcast(contest_id, {"type": "TIMER_TICK", "data": state["sync_timer"]})

    state = manager.get_state(contest_id)
    if state and state["state"] == "QUESTION_ACTIVE" and state["current_q_idx"] == q_idx and state["sync_timer"] <= 0:
        state["state"] = "CONTEST_OVER"
        await manager.set_state(contest_id, state)
        await persist_contest_ended(contest_id, "time_up")

# --- Routes ---
@app.post("/register")
def register(user: UserCreate):
    users = db.collection("users").where(filter=FieldFilter("username", "==", user.username)).limit(1).stream()
    if next(users, None):
        raise HTTPException(status_code=400, detail="Username already registered")
    
    is_admin = (user.username.lower() == "admin")
    db.collection("users").add({
        "username": user.username,
        "hashed_password": get_password_hash(user.password),
        "is_admin": is_admin
    })
    return {"message": "User registered successfully"}

@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    users = db.collection("users").where(filter=FieldFilter("username", "==", form_data.username)).limit(1).stream()
    user_doc = next(users, None)
    if not user_doc:
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    
    user_data = user_doc.to_dict()
    if not verify_password(form_data.password, user_data["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    
    access_token = create_access_token(data={"sub": user_data["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    is_admin = current_user.get("is_admin", False) or current_user["username"].lower() == "admin"
    return {"username": current_user["username"], "id": current_user["id"], "is_admin": is_admin}

@app.get("/questions")
def get_questions(current_user: dict = Depends(get_current_user)):
    docs = db.collection("questions").stream()
    questions = []
    for doc in docs:
        data = doc.to_dict()
        if data.get("is_global") or data.get("creator_id") == current_user["id"]:
            questions.append({"id": doc.id, "title": data.get("title"), "description": data.get("description")})
    return questions

@app.post("/questions")
def create_question(question: QuestionCreate, current_user: dict = Depends(get_current_user)):
    doc_ref = db.collection("questions").document()
    doc_ref.set({
        "title": question.title,
        "description": question.description,
        "is_global": question.is_global,
        "creator_id": current_user["id"],
        "test_cases": [{"input_data": tc.input_data, "expected_output": tc.expected_output} for tc in question.test_cases]
    })
    return {"message": "Question added to bank", "id": doc_ref.id}

@app.put("/questions/{q_id}")
def update_question(q_id: str, question: QuestionCreate):
    doc_ref = db.collection("questions").document(q_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Question not found")
    
    doc_ref.update({
        "title": question.title,
        "description": question.description,
        "test_cases": [{"input_data": tc.input_data, "expected_output": tc.expected_output} for tc in question.test_cases]
    })
    return {"message": "Question updated successfully"}

@app.get("/questions/{q_id}")
def get_single_question(q_id: str):
    doc = db.collection("questions").document(q_id).get()
    if not doc.exists:
        raise HTTPException(404, "Question not found")
    
    data = doc.to_dict()
    return {
        "id": doc.id,
        "title": data.get("title"),
        "description": data.get("description"),
        "test_cases": [{"input": tc.get("input_data"), "expected": tc.get("expected_output")} for tc in data.get("test_cases", [])]
    }

@app.delete("/questions/{q_id}")
def delete_question(q_id: str, current_user: dict = Depends(get_current_user)):
    doc_ref = db.collection("questions").document(q_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Question not found")
    
    doc_ref.delete()
    return {"message": "Question deleted successfully"}

@app.post("/contests")
def create_contest(contest: ContestCreate, current_user: dict = Depends(get_current_user)):
    link_code = str(uuid.uuid4())[:8]
    doc_ref = db.collection("contests").document()
    
    questions = []
    for sq in contest.selected_questions:
        questions.append({
            "question_id": sq.question_id,
            "points": sq.points,
            "time_limit": sq.time_limit
        })
        
    doc_ref.set({
        "title": contest.title,
        "description": contest.description,
        "mode": contest.mode,
        "evaluation_mode": contest.evaluation_mode,
        "visibility": contest.visibility,
        "host_id": current_user["id"],
        "penalty_per_wrong_answer": contest.penalty_per_wrong_answer,
        "overall_time_limit": contest.overall_time_limit,
        "link_code": link_code,
        "status": "waiting",
        "start_time": None,
        "scheduled_start_time": contest.scheduled_start_time,
        "created_at": datetime.utcnow().isoformat(),
        "questions": questions
    })
    return {"message": "Contest created!", "link_code": link_code}

def build_contest_payload(contest_doc) -> dict:
    """Shared response for the link-code and by-id contest lookups."""
    data = contest_doc.to_dict()
    expire_contest_if_needed(contest_doc, data)

    q_data = []
    for cq in data.get("questions", []):
        q_doc = db.collection("questions").document(cq["question_id"]).get()
        if q_doc.exists:
            q = q_doc.to_dict()
            q_data.append({
                "id": q_doc.id,
                "title": q.get("title"),
                "description": q.get("description"),
                "points": cq.get("points"),
                "time_limit": cq.get("time_limit")
            })

    return {
        "id": contest_doc.id,
        "title": data.get("title"),
        "description": data.get("description"),
        "mode": data.get("mode"),
        "visibility": data.get("visibility", "public"),
        "status": data.get("status"),
        "end_reason": data.get("end_reason"),
        "start_time": data.get("start_time"),
        "scheduled_start_time": data.get("scheduled_start_time"),
        "server_elapsed_seconds": contest_elapsed_seconds(data),
        "host_id": data.get("host_id"),
        "host_name": username_of(data.get("host_id")),
        "overall_time_limit": data.get("overall_time_limit"),
        "penalty_per_wrong_answer": data.get("penalty_per_wrong_answer"),
        "evaluation_mode": data.get("evaluation_mode", "strict"),
        "questions": q_data
    }

def require_host_contest(contest_id: str, current_user: dict):
    doc = db.collection("contests").document(contest_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Contest not found")
    if doc.to_dict().get("host_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the host can do this")
    return doc

@app.get("/contests/{link_code}")
def get_contest(link_code: str):
    contests = db.collection("contests").where(filter=FieldFilter("link_code", "==", link_code)).limit(1).stream()
    contest_doc = next(contests, None)
    if not contest_doc:
        doc = db.collection("contests").document(link_code).get()
        if doc.exists:
            contest_doc = doc
        else:
            raise HTTPException(status_code=404, detail="Contest not found")
    return build_contest_payload(contest_doc)

@app.post("/contests/{contest_id}/start")
async def start_sudden_death_contest(contest_id: str, current_user: dict = Depends(get_current_user)):
    doc = require_host_contest(contest_id, current_user)
    data = doc.to_dict()

    if data.get("status") == "ended":
        raise HTTPException(status_code=400, detail="This contest has already ended")
    if data.get("status") == "active":
        # Idempotent: a scheduled start can fire more than once.
        return {"success": True, "already_active": True}

    if data.get("mode") != "sudden_death":
        doc.reference.update({"status": "active", "start_time": datetime.utcnow().isoformat() + "Z"})
        return {"success": True}

    state = manager.get_state(contest_id)
    if not state:
        state = {
            "state": "WAITING_TO_START",
            "current_q_idx": 0,
            "active_question_id": None,
            "winner": None,
            "sync_timer": data.get("overall_time_limit", 60) * 60
        }
        manager.contest_state[contest_id] = state

    cqs = data.get("questions", [])
    q_id = cqs[0]["question_id"] if cqs else None

    state["state"] = "QUESTION_ACTIVE"
    state["current_q_idx"] = 0
    state["active_question_id"] = q_id
    await manager.set_state(contest_id, state)
    asyncio.create_task(global_active_timer(contest_id, 0))

    doc.reference.update({
        "status": "active",
        "start_time": datetime.utcnow().isoformat() + "Z"
    })
    return {"success": True}

@app.post("/contests/{contest_id}/open")
def open_standard_contest(contest_id: str, current_user: dict = Depends(get_current_user)):
    doc = require_host_contest(contest_id, current_user)
    data = doc.to_dict()

    if data.get("status") == "active":
        return {"message": "Already active"}
    if data.get("status") == "ended":
        raise HTTPException(status_code=400, detail="This contest has already ended")

    doc.reference.update({
        "status": "active",
        "start_time": datetime.utcnow().isoformat() + "Z"
    })
    return {"success": True, "message": "Contest opened successfully"}

@app.post("/contests/{contest_id}/end")
async def end_contest(contest_id: str, current_user: dict = Depends(get_current_user)):
    doc = require_host_contest(contest_id, current_user)
    if doc.to_dict().get("status") != "ended":
        doc.reference.update(_ended_fields("host"))

    state = manager.get_state(contest_id)
    if state:
        state["state"] = "FINISHED"
        await manager.set_state(contest_id, state)

    await manager.broadcast(contest_id, {"type": "CONTEST_ENDED"})
    return {"success": True, "message": "Contest ended"}

@app.delete("/contests/{contest_id}")
async def delete_contest(contest_id: str, current_user: dict = Depends(get_current_user)):
    doc = require_host_contest(contest_id, current_user)

    def _purge():
        # Firestore batches are capped at 500 writes.
        refs = [doc.reference]
        for coll in ("participants", "submissions", "question_starts"):
            refs += [s.reference for s in db.collection(coll).where(filter=FieldFilter("contest_id", "==", contest_id)).stream()]
        for i in range(0, len(refs), 400):
            batch = db.batch()
            for r in refs[i:i + 400]:
                batch.delete(r)
            batch.commit()

    await asyncio.to_thread(_purge)

    await manager.broadcast(contest_id, {"type": "CONTEST_DELETED"})
    manager.contest_state.pop(contest_id, None)
    manager.active_connections.pop(contest_id, None)
    return {"success": True, "message": "Contest deleted"}

@app.get("/contests/{contest_id}/info")
def get_contest_info_by_id(contest_id: str):
    doc = db.collection("contests").document(contest_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Contest not found")
    return build_contest_payload(doc)

@app.websocket("/ws/contest/{contest_id}")
async def websocket_endpoint(websocket: WebSocket, contest_id: str):
    await manager.connect(websocket, contest_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, contest_id)

@app.post("/sandbox/test")
async def sandbox_test(req: SandboxTestRequest, current_user: dict = Depends(get_current_user)):
    payload = {
        "code": req.code,
        "language": req.language,
        "test_cases": [{"input": tc.get("input_data", ""), "expected_output": tc.get("expected_output", "")} for tc in req.test_cases]
    }
    eval_results = []
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://sanjaymarathi-compicode-executor.hf.space/evaluate",
                json=payload,
                timeout=20.0
            )
            data = response.json()
            eval_results = data.get("results", [])
            for i, res in enumerate(eval_results):
                if i < len(req.test_cases):
                    res["input"] = req.test_cases[i].get("input_data", "")
                    res["expected"] = req.test_cases[i].get("expected_output", "")
    except httpx.TimeoutException:
        return {"passed": False, "results": [], "error": "Execution timed out (Server unresponsive)"}
    except Exception as e:
        return {"passed": False, "results": [], "error": f"Execution engine error: {str(e)}"}
        
    passed = all(res.get("passed", False) for res in eval_results) if eval_results else False
    return {"passed": passed, "results": eval_results}

def participant_block_reason(contest_id: str, contest: dict, user_id: str) -> Optional[str]:
    """Why this user may not compete, or None. Public contests enrol them on first use."""
    if user_id == contest.get("host_id"):
        return None
    p_docs = db.collection("participants").where(filter=FieldFilter("contest_id", "==", contest_id))\
        .where(filter=FieldFilter("user_id", "==", user_id)).limit(1).stream()
    p_doc = next(p_docs, None)
    if p_doc is None:
        if contest.get("visibility", "public") == "private":
            return "This is a private contest. Request access from the host first."
        db.collection("participants").add({
            "contest_id": contest_id,
            "user_id": user_id,
            "status": "accepted",
            "joined_at": datetime.utcnow().isoformat()
        })
    elif p_doc.to_dict().get("status", "accepted") != "accepted":
        return "You are not an approved participant of this contest."
    return None

@app.post("/contests/{contest_id}/questions/{question_id}/start")
def start_timed_question(contest_id: str, question_id: str, current_user: dict = Depends(get_current_user)):
    """Timed mode: start this user's countdown on a problem, or report the one already running.

    Problems can only be started while the contest's start window is open.
    """
    contest_doc = db.collection("contests").document(contest_id).get()
    if not contest_doc.exists:
        raise HTTPException(status_code=404, detail="Contest not found")
    contest = contest_doc.to_dict()
    if contest.get("mode") != "timed":
        raise HTTPException(status_code=400, detail="Only timed contests have per-problem timers")
    cq = next((q for q in contest.get("questions", []) if q.get("question_id") == question_id), None)
    if cq is None:
        raise HTTPException(status_code=404, detail="This problem is not part of the contest")
    time_limit = cq.get("time_limit") or 0

    ref = db.collection("question_starts").document(question_start_id(contest_id, current_user["id"], question_id))
    snap = ref.get()
    if not snap.exists:
        expire_contest_if_needed(contest_doc, contest)
        if contest.get("status") != "active":
            raise HTTPException(status_code=400, detail="This contest is not running.")
        blocked = participant_block_reason(contest_id, contest, current_user["id"])
        if blocked:
            raise HTTPException(status_code=403, detail=blocked)
        window = contest.get("overall_time_limit")
        if window and contest_elapsed_seconds(contest) >= window * 60:
            return {"locked": True, "time_limit": time_limit, "elapsed_seconds": 0}
        now = datetime.utcnow()
        try:
            ref.create({
                "contest_id": contest_id,
                "user_id": current_user["id"],
                "question_id": question_id,
                "started_at": now.isoformat() + "Z",
                "deadline": (now + timedelta(seconds=time_limit)).isoformat() + "Z",
            })
        except AlreadyExists:
            pass  # another tab started it first
        snap = ref.get()

    started = _parse_ts(snap.to_dict().get("started_at"))
    return {"locked": False, "time_limit": time_limit, "elapsed_seconds": max(0.0, (datetime.utcnow() - started).total_seconds())}

class CodeSubmission(BaseModel):
    code: str
    language: str
    question_id: str
    contest_id: str
    time_taken_seconds: Optional[int] = None

@app.post("/submit")
async def submit_code(submission: CodeSubmission, current_user: dict = Depends(get_current_user)):
    contest_doc = db.collection("contests").document(submission.contest_id).get()
    if not contest_doc.exists:
        raise HTTPException(status_code=404, detail="Contest not found")
    contest = contest_doc.to_dict()

    if len(submission.code) > MAX_CODE_CHARS:
        return {"passed": False, "results": [], "error": f"Code is too long (limit {MAX_CODE_CHARS:,} characters)."}

    already_passed = db.collection("submissions").where(filter=FieldFilter("contest_id", "==", submission.contest_id))\
        .where(filter=FieldFilter("user_id", "==", current_user["id"]))\
        .where(filter=FieldFilter("question_id", "==", submission.question_id))\
        .where(filter=FieldFilter("passed", "==", True)).limit(1).stream()
        
    if next(already_passed, None):
        return {"passed": True, "already_solved": True, "results": [], "message": "You already solved this question!"}

    if contest.get("status") == "waiting":
        return {"passed": False, "results": [], "error": "This contest has not started yet."}

    if expire_contest_if_needed(contest_doc, contest):
        return {"passed": False, "results": [], "error": "Time is up! The contest has ended."}

    if contest.get("status") != "active":
        return {"passed": False, "results": [], "error": "This contest has ended. Submissions are no longer accepted."}

    blocked = participant_block_reason(submission.contest_id, contest, current_user["id"])
    if blocked:
        return {"passed": False, "results": [], "error": blocked}

    if contest.get("mode") == "timed":
        start = db.collection("question_starts").document(
            question_start_id(submission.contest_id, current_user["id"], submission.question_id)).get()
        if not start.exists:
            return {"passed": False, "results": [], "error": "This problem is locked: it was not opened before the start window closed."}
        deadline = _parse_ts(start.to_dict().get("deadline"))
        if deadline and datetime.utcnow() > deadline + timedelta(seconds=TIMED_GRACE_SECONDS):
            return {"passed": False, "results": [], "error": "Your time on this problem is up."}

    state = manager.get_state(submission.contest_id)
    if contest.get("mode") == "sudden_death" and state and state["state"] != "QUESTION_ACTIVE":
        return {"passed": False, "results": [], "error": "Contest is not active"}

    q_doc = db.collection("questions").document(submission.question_id).get()
    test_cases = q_doc.to_dict().get("test_cases", []) if q_doc.exists else []
    if not test_cases:
        raise HTTPException(status_code=400, detail="No test cases found for this question")
    
    payload = {
        "code": submission.code,
        "language": submission.language,
        "test_cases": [{"input": tc.get("input_data", ""), "expected_output": tc.get("expected_output", "")} for tc in test_cases]
    }
    
    eval_results = []
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://sanjaymarathi-compicode-executor.hf.space/evaluate",
                json=payload,
                timeout=20.0
            )
            data = response.json()
            eval_results = data.get("results", [])
            for i, res in enumerate(eval_results):
                if i < len(test_cases):
                    if i < 2:
                        res["input"] = test_cases[i].get("input_data", "")
                        res["expected"] = test_cases[i].get("expected_output", "")
                    else:
                        res["input"] = "Hidden Testcase"
                        res["expected"] = "Hidden Testcase"
    except httpx.TimeoutException:
        return {"passed": False, "results": [], "error": "Executor timed out. Please try again."}
    except Exception as e:
        return {"passed": False, "results": [], "error": f"Executor unavailable: {str(e)}"}
            
    passed_all = bool(eval_results) and all(r.get("passed", False) for r in eval_results)
            
    time_taken = 0
    if submission.time_taken_seconds is not None:
        time_taken = submission.time_taken_seconds
    elif contest.get("start_time"):
        try:
            start_dt = datetime.fromisoformat(contest.get("start_time").replace('Z', ''))
            time_taken = int((datetime.utcnow() - start_dt).total_seconds())
        except:
            pass
            
    verdict = "accepted" if passed_all else ("error" if any(r.get("error") for r in eval_results) else "wrong_answer")
    db.collection("submissions").add({
        "user_id": current_user["id"],
        "question_id": submission.question_id,
        "contest_id": submission.contest_id,
        "passed": passed_all,
        "verdict": verdict,
        "testcases_passed": sum(1 for r in eval_results if r.get("passed", False)),
        "total_testcases": len(eval_results),
        "penalty_incurred": 0 if passed_all else contest.get("penalty_per_wrong_answer", 5),
        "time_taken": time_taken,
        "language": submission.language,
        "code": submission.code,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    if passed_all and contest.get("mode") == "sudden_death" and state and state["state"] == "QUESTION_ACTIVE":
        cqs = contest.get("questions", [])
        if state["current_q_idx"] < len(cqs) and cqs[state["current_q_idx"]]["question_id"] == submission.question_id:
            state["winner"] = current_user["username"]
            # Flip synchronously so a concurrent winning submission can't also start a round timer.
            state["state"] = "ROUND_OVER"
            await manager.set_state(submission.contest_id, state)
            asyncio.create_task(sudden_death_timer(submission.contest_id))
    
    return {"passed": passed_all, "already_solved": False, "results": eval_results}

@app.post("/contests/{contest_id}/join")
def join_contest(contest_id: str, current_user: dict = Depends(get_current_user)):
    contest_doc = db.collection("contests").document(contest_id).get()
    if not contest_doc.exists:
        raise HTTPException(status_code=404, detail="Contest not found")
    contest = contest_doc.to_dict()
    if contest.get("status") == "ended":
        raise HTTPException(status_code=400, detail="Cannot join an ended contest")
        
    visibility = contest.get("visibility", "public")
    is_host = contest.get("host_id") == current_user["id"]
    participant_status = "pending" if (visibility == "private" and not is_host) else "accepted"

    existing = db.collection("participants").where(filter=FieldFilter("contest_id", "==", contest_id))\
        .where(filter=FieldFilter("user_id", "==", current_user["id"])).limit(1).stream()
    existing_doc = next(existing, None)
    if existing_doc:
        doc_data = existing_doc.to_dict()
        if doc_data.get("status") == "rejected":
            return {"success": False, "status": "rejected"}
        return {"success": True, "status": doc_data.get("status", "accepted")}
    else:
        db.collection("participants").add({
            "contest_id": contest_id,
            "user_id": current_user["id"],
            "status": participant_status,
            "joined_at": datetime.utcnow().isoformat()
        })
    return {"success": True, "status": participant_status}

@app.get("/contests/{contest_id}/my-status")
def my_status(contest_id: str, current_user: dict = Depends(get_current_user)):
    p_docs = db.collection("participants").where(filter=FieldFilter("contest_id", "==", contest_id))\
        .where(filter=FieldFilter("user_id", "==", current_user["id"])).limit(1).stream()
    p_doc = next(p_docs, None)
    if not p_doc:
        return {"status": "none"}
    return {"status": p_doc.to_dict().get("status", "accepted")}

@app.get("/contests/{contest_id}/pending")
def get_pending_participants(contest_id: str, current_user: dict = Depends(get_current_user)):
    contest_doc = db.collection("contests").document(contest_id).get()
    if not contest_doc.exists or contest_doc.to_dict().get("host_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    pending = db.collection("participants").where(filter=FieldFilter("contest_id", "==", contest_id))\
        .where(filter=FieldFilter("status", "==", "pending")).stream()

    users = []
    for p in pending:
        p_data = p.to_dict()
        u_id = p_data.get("user_id")
        if u_id == current_user["id"]:
            continue  # legacy rows: the host was once queued for their own contest
        u_doc = db.collection("users").document(u_id).get()
        if u_doc.exists:
            users.append({"id": u_id, "username": u_doc.to_dict().get("username"), "doc_id": p.id, "requested_at": p_data.get("joined_at")})
    users.sort(key=lambda u: u.get("requested_at") or "")
    return users

@app.post("/contests/{contest_id}/accept/{user_id}")
def accept_participant(contest_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    contest_doc = db.collection("contests").document(contest_id).get()
    if not contest_doc.exists or contest_doc.to_dict().get("host_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    p_docs = db.collection("participants").where(filter=FieldFilter("contest_id", "==", contest_id))\
        .where(filter=FieldFilter("user_id", "==", user_id)).limit(1).stream()
    p_doc = next(p_docs, None)
    if p_doc:
        p_doc.reference.update({"status": "accepted"})
    return {"success": True}

@app.post("/contests/{contest_id}/reject/{user_id}")
def reject_participant(contest_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    contest_doc = db.collection("contests").document(contest_id).get()
    if not contest_doc.exists or contest_doc.to_dict().get("host_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    p_docs = db.collection("participants").where(filter=FieldFilter("contest_id", "==", contest_id))\
        .where(filter=FieldFilter("user_id", "==", user_id)).limit(1).stream()
    p_doc = next(p_docs, None)
    if p_doc:
        p_doc.reference.update({"status": "rejected"})
    return {"success": True}

@app.delete("/contests/{contest_id}/kick/{user_id}")
async def kick_participant(contest_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    contest_doc = db.collection("contests").document(contest_id).get()
    if not contest_doc.exists or contest_doc.to_dict().get("host_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    # Delete participant
    p_docs = db.collection("participants").where(filter=FieldFilter("contest_id", "==", contest_id))\
        .where(filter=FieldFilter("user_id", "==", user_id)).limit(1).stream()
    p_doc = next(p_docs, None)
    if p_doc:
        p_doc.reference.delete()
        
    # Delete submissions
    subs = db.collection("submissions").where(filter=FieldFilter("contest_id", "==", contest_id))\
        .where(filter=FieldFilter("user_id", "==", user_id)).stream()
    for s in subs:
        s.reference.delete()
        
    # Broadcast kick event
    await manager.broadcast(contest_id, {"type": "KICK_USER", "user_id": user_id})
        
    return {"success": True}

@app.get("/contests/{contest_id}/leaderboard")
def get_leaderboard(contest_id: str):
    contest_doc = db.collection("contests").document(contest_id).get()
    if not contest_doc.exists: return []
    contest = contest_doc.to_dict()

    cqs = contest.get("questions", [])
    question_ids = [cq["question_id"] for cq in cqs]
    points_map = {cq["question_id"]: cq.get("points", 10) for cq in cqs}
    
    eval_mode = contest.get("evaluation_mode", "strict")

    tcs_map = {}
    for qid in question_ids:
        q_doc = db.collection("questions").document(qid).get()
        if q_doc.exists:
            tcs_map[qid] = len(q_doc.to_dict().get("test_cases", []))
        else:
            tcs_map[qid] = 1

    total_contest_points = sum(points_map.values())
    total_contest_tcs = sum(tcs_map.values())

    participants = db.collection("participants").where(filter=FieldFilter("contest_id", "==", contest_id)).stream()
    participant_user_ids = []
    for p in participants:
        p_data = p.to_dict()
        if p_data.get("status", "accepted") == "accepted":
            participant_user_ids.append(p_data.get("user_id"))
    
    if not participant_user_ids:
        return []
        
    users = []
    for uid in participant_user_ids:
        u_doc = db.collection("users").document(uid).get()
        if u_doc.exists:
            u_data = u_doc.to_dict()
            u_data["id"] = u_doc.id
            users.append(u_data)

    leaderboard = []

    all_subs = db.collection("submissions").where(filter=FieldFilter("contest_id", "==", contest_id)).stream()
    subs_list = [s.to_dict() for s in all_subs]

    for u in users:
        u_subs = [s for s in subs_list if s.get("user_id") == u["id"]]
        
        total_obtained_tcs = 0
        total_time_taken = 0
        total_obtained_points = 0
        q_stats = {}
        
        for qid in question_ids:
            q_subs = [s for s in u_subs if s.get("question_id") == qid]
            wrong = sum(1 for s in q_subs if not s.get("passed", False))
            passed_sub = next((s for s in q_subs if s.get("passed", False)), None)
            solved = passed_sub is not None
            
            max_tc = 0
            if q_subs:
                max_tc = max((s.get("testcases_passed", 0) for s in q_subs), default=0)
            total_obtained_tcs += max_tc
            
            time_taken = passed_sub.get("time_taken", 0) if passed_sub else 0
            total_time_taken += time_taken
            
            q_total_tcs = tcs_map.get(qid, 1)
            q_points = points_map.get(qid, 10)
            
            if eval_mode == "partial":
                obtained_q_points = (max_tc / q_total_tcs) * q_points if q_total_tcs > 0 else 0
            else:
                obtained_q_points = q_points if solved else 0
                
            total_obtained_points += obtained_q_points
            
            q_stats[str(qid)] = {
                "solved": solved, 
                "wrong_count": wrong, 
                "time_taken": time_taken, 
                "testcases_passed": max_tc,
                "total_testcases": q_total_tcs,
                "obtained_points": obtained_q_points,
                "total_points": q_points
            }

        passed_qids = list(set(s.get("question_id") for s in u_subs if s.get("passed", False)))
        total_penalty = sum(s.get("penalty_incurred", 0) for s in u_subs)

        leaderboard.append({
            "user_id": u.get("id"),
            "username": u.get("username"),
            "score": round(total_obtained_points, 2),
            "total_points": total_contest_points,
            "penalty": total_penalty,
            "solved_count": len(passed_qids),
            "total_questions": len(question_ids),
            "total_testcases": total_obtained_tcs,
            "max_testcases": total_contest_tcs,
            "total_time": total_time_taken,
            "solved_question_ids": passed_qids,
            "question_stats": q_stats
        })

    if eval_mode == "partial":
        leaderboard.sort(key=lambda x: (-x["score"], x["total_time"], x["penalty"]))
    else:
        leaderboard.sort(key=lambda x: (-x["score"], x["total_time"], -x["total_testcases"], x["penalty"]))
        
    return leaderboard

@app.get("/contests/{contest_id}/my-solved")
def get_my_solved(contest_id: str, current_user: dict = Depends(get_current_user)):
    solved = db.collection("submissions").where(filter=FieldFilter("contest_id", "==", contest_id))\
        .where(filter=FieldFilter("user_id", "==", current_user["id"]))\
        .where(filter=FieldFilter("passed", "==", True)).stream()
    # Timed mode: how long ago each problem's countdown started (absent = not opened yet).
    starts = db.collection("question_starts").where(filter=FieldFilter("contest_id", "==", contest_id))\
        .where(filter=FieldFilter("user_id", "==", current_user["id"])).stream()
    now = datetime.utcnow()
    question_elapsed = {}
    for s in starts:
        d = s.to_dict()
        started = _parse_ts(d.get("started_at"))
        if started:
            question_elapsed[d.get("question_id")] = max(0.0, (now - started).total_seconds())
    return {
        "solved_question_ids": list(set(s.to_dict().get("question_id") for s in solved)),
        "question_elapsed_seconds": question_elapsed,
    }

def _question_title(question_id: str) -> str:
    def _load():
        q = db.collection("questions").document(question_id).get()
        return q.to_dict().get("title", "Untitled") if q.exists else "Deleted problem"
    return cached(f"qtitle:{question_id}", 120, _load)

def _submission_row(snap) -> dict:
    d = snap.to_dict()
    passed = bool(d.get("passed", False))
    return {
        "id": snap.id,
        "user_id": d.get("user_id"),
        "username": username_of(d.get("user_id")),
        "question_id": d.get("question_id"),
        "question_title": _question_title(d.get("question_id")),
        "passed": passed,
        "verdict": d.get("verdict") or ("accepted" if passed else "wrong_answer"),
        "testcases_passed": d.get("testcases_passed", 0),
        "total_testcases": d.get("total_testcases"),
        "language": d.get("language"),
        "time_taken": d.get("time_taken", 0),
        "timestamp": d.get("timestamp"),
        "has_code": bool(d.get("code")),
    }

@app.get("/contests/{contest_id}/submissions")
def list_contest_submissions(
    contest_id: str,
    user_id: Optional[str] = None,
    question_id: Optional[str] = None,
    limit: int = 300,
    current_user: dict = Depends(get_current_user),
):
    """Host only: every submission in the contest, newest first (without the code)."""
    require_host_contest(contest_id, current_user)
    query = db.collection("submissions").where(filter=FieldFilter("contest_id", "==", contest_id))
    if user_id:
        query = query.where(filter=FieldFilter("user_id", "==", user_id))
    if question_id:
        query = query.where(filter=FieldFilter("question_id", "==", question_id))
    snaps = sorted(query.stream(), key=lambda x: x.to_dict().get("timestamp") or "", reverse=True)
    limit = max(1, min(limit, 500))
    return {"total": len(snaps), "submissions": [_submission_row(x) for x in snaps[:limit]]}

@app.get("/contests/{contest_id}/submissions/{submission_id}")
def get_contest_submission(contest_id: str, submission_id: str, current_user: dict = Depends(get_current_user)):
    """Host only: one submission including the code the participant wrote."""
    require_host_contest(contest_id, current_user)
    snap = db.collection("submissions").document(submission_id).get()
    if not snap.exists or snap.to_dict().get("contest_id") != contest_id:
        raise HTTPException(status_code=404, detail="Submission not found")
    row = _submission_row(snap)
    row["code"] = snap.to_dict().get("code")
    return row

# Dashboard specific routes
def contest_summary(doc, host_name: str) -> dict:
    d = doc.to_dict()
    expire_contest_if_needed(doc, d)
    return {
        "id": doc.id,
        "title": d.get("title"),
        "status": d.get("status"),
        "end_reason": d.get("end_reason"),
        "link_code": d.get("link_code"),
        "mode": d.get("mode"),
        "visibility": d.get("visibility", "public"),
        "start_time": d.get("start_time"),
        "created_at": d.get("created_at"),
        "host_name": host_name,
    }

@app.get("/user/contests/hosted")
def get_hosted_contests(current_user: dict = Depends(get_current_user)):
    contests = db.collection("contests").where(filter=FieldFilter("host_id", "==", current_user["id"])).stream()
    return [contest_summary(c, current_user["username"]) for c in contests]

@app.get("/user/contests/participated")
def get_participated_contests(current_user: dict = Depends(get_current_user)):
    parts = db.collection("participants").where(filter=FieldFilter("user_id", "==", current_user["id"])).stream()
    c_ids = [p.to_dict().get("contest_id") for p in parts]
    res = []
    host_ids = set()
    valid_docs = []
    for cid in set(c_ids):
        c = db.collection("contests").document(cid).get()
        if c.exists:
            valid_docs.append(c)
            host_ids.add(c.to_dict().get("host_id", ""))
    
    hosts = {hid: username_of(hid) for hid in host_ids if hid}

    for c in valid_docs:
        res.append(contest_summary(c, hosts.get(c.to_dict().get("host_id", ""), "Unknown")))
    return res


if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join("frontend/dist", full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse("frontend/dist/index.html")
