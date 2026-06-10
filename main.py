import asyncio
import httpx
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

from database import db

# Configurations
SECRET_KEY = "mysecretkey_change_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 300

pwd_context = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI(title="CompiCode")

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
            if doc.exists:
                limit_sec = doc.to_dict().get("overall_time_limit", 60) * 60
            
            self.contest_state[contest_id] = {
                "state": "WAITING_TO_START", 
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
            return

    state = manager.get_state(contest_id)
    state["current_q_idx"] += 1
    
    doc = db.collection("contests").document(contest_id).get()
    cqs = doc.to_dict().get("questions", []) if doc.exists else []
    total_q = len(cqs)
    
    if state["current_q_idx"] >= total_q:
        state["state"] = "CONTEST_OVER"
        await manager.set_state(contest_id, state)
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
        if state["state"] != "QUESTION_ACTIVE" or state["current_q_idx"] != q_idx:
            return 
        state["sync_timer"] -= 1
        await manager.broadcast(contest_id, {"type": "TIMER_TICK", "data": state["sync_timer"]})
        
    state = manager.get_state(contest_id)
    if state and state["sync_timer"] <= 0:
        state["state"] = "CONTEST_OVER"
        await manager.set_state(contest_id, state)

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
    data = contest_doc.to_dict()
    
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
            
    elapsed = 0
    if data.get("start_time"):
        try:
            st = datetime.fromisoformat(data["start_time"].replace('Z', ''))
            elapsed = (datetime.utcnow() - st).total_seconds()
        except:
            pass

    # Auto-end standard or timed contest if time is up
    if data.get("mode") in ["standard", "timed"] and data.get("status") == "active" and data.get("overall_time_limit"):
        if elapsed >= data["overall_time_limit"] * 60:
            contest_doc.reference.update({"status": "ended"})
            data["status"] = "ended"
            asyncio.create_task(manager.broadcast(contest_doc.id, {"type": "CONTEST_ENDED"}))

    return {
        "id": contest_doc.id,
        "title": data.get("title"),
        "description": data.get("description"),
        "mode": data.get("mode"),
        "status": data.get("status"),
        "start_time": data.get("start_time"),
        "scheduled_start_time": data.get("scheduled_start_time"),
        "server_elapsed_seconds": max(0, elapsed),
        "host_id": data.get("host_id"),
        "overall_time_limit": data.get("overall_time_limit"),
        "penalty_per_wrong_answer": data.get("penalty_per_wrong_answer"),
        "questions": q_data
    }

@app.post("/contests/{contest_id}/start")
async def start_sudden_death_contest(contest_id: str):
    state = manager.get_state(contest_id)
    doc = db.collection("contests").document(contest_id).get()
    
    if not state:
        limit_sec = doc.to_dict().get("overall_time_limit", 60) * 60 if doc.exists else 3600
        state = {
            "state": "WAITING_TO_START", 
            "current_q_idx": 0,
            "active_question_id": None,
            "winner": None,
            "sync_timer": limit_sec
        }
        manager.contest_state[contest_id] = state
        
    cqs = doc.to_dict().get("questions", []) if doc.exists else []
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
    doc = db.collection("contests").document(contest_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Contest not found")
        
    data = doc.to_dict()
    if data.get("host_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only host can open the contest")
        
    if data.get("status") == "active":
        return {"message": "Already active"}
        
    doc.reference.update({
        "status": "active",
        "start_time": datetime.utcnow().isoformat() + "Z"
    })
    return {"success": True, "message": "Contest opened successfully"}



@app.post("/contests/{contest_id}/end")
async def end_contest(contest_id: str):
    doc_ref = db.collection("contests").document(contest_id)
    if doc_ref.get().exists:
        doc_ref.update({"status": "ended"})
        
    state = manager.get_state(contest_id)
    if state:
        state["state"] = "FINISHED"
        await manager.set_state(contest_id, state)
        
    await manager.broadcast(contest_id, {"type": "CONTEST_ENDED"})
    return {"success": True, "message": "Contest ended"}


@app.get("/contests/{contest_id}/info")
def get_contest_info_by_id(contest_id: str):
    doc = db.collection("contests").document(contest_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Contest not found")
        
    data = doc.to_dict()
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
            
    elapsed = 0
    if data.get("start_time"):
        try:
            st = datetime.fromisoformat(data["start_time"].replace('Z', ''))
            elapsed = (datetime.utcnow() - st).total_seconds()
        except:
            pass
            
    # Auto-end standard contest if time is up
    if data.get("mode") == "standard" and data.get("status") == "active" and data.get("overall_time_limit"):
        if elapsed >= data["overall_time_limit"] * 60:
            doc.reference.update({"status": "ended"})
            data["status"] = "ended"
            asyncio.create_task(manager.broadcast(doc.id, {"type": "CONTEST_ENDED"}))

    host_name = "Unknown"
    if data.get("host_id"):
        user_doc = db.collection("users").document(data.get("host_id")).get()
        if user_doc.exists:
            host_name = user_doc.to_dict().get("username", "Unknown")

    return {
        "id": doc.id,
        "title": data.get("title"),
        "mode": data.get("mode"),
        "overall_time_limit": data.get("overall_time_limit"),
        "penalty_per_wrong_answer": data.get("penalty_per_wrong_answer"),
        "start_time": data.get("start_time"),
        "scheduled_start_time": data.get("scheduled_start_time"),
        "status": data.get("status"),
        "server_elapsed_seconds": max(0, elapsed),
        "evaluation_mode": data.get("evaluation_mode", "strict"),
        "host_name": host_name,
        "questions": q_data
    }

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

    already_passed = db.collection("submissions").where(filter=FieldFilter("contest_id", "==", submission.contest_id))\
        .where(filter=FieldFilter("user_id", "==", current_user["id"]))\
        .where(filter=FieldFilter("question_id", "==", submission.question_id))\
        .where(filter=FieldFilter("passed", "==", True)).limit(1).stream()
        
    if next(already_passed, None):
        return {"passed": True, "already_solved": True, "results": [], "message": "You already solved this question!"}

    if contest.get("status") == "waiting":
        return {"passed": False, "results": [], "error": "This contest has not started yet."}

    if contest.get("status") != "active":
        return {"passed": False, "results": [], "error": "This contest has ended. Submissions are no longer accepted."}

    elapsed = 0
    if contest.get("start_time"):
        try:
            st = datetime.fromisoformat(contest["start_time"].replace('Z', ''))
            elapsed = (datetime.utcnow() - st).total_seconds()
        except:
            pass
            
    if contest.get("mode") == "standard" and contest.get("overall_time_limit"):
        if elapsed >= contest["overall_time_limit"] * 60:
            contest_doc.reference.update({"status": "ended"})
            asyncio.create_task(manager.broadcast(submission.contest_id, {"type": "CONTEST_ENDED"}))
            return {"passed": False, "results": [], "error": "Time is up! The contest has ended."}

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
            
    db.collection("submissions").add({
        "user_id": current_user["id"],
        "question_id": submission.question_id,
        "contest_id": submission.contest_id,
        "passed": passed_all,
        "testcases_passed": sum(1 for r in eval_results if r.get("passed", False)),
        "penalty_incurred": 0 if passed_all else contest.get("penalty_per_wrong_answer", 5),
        "time_taken": time_taken,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    if passed_all and contest.get("mode") == "sudden_death" and state and state["state"] == "QUESTION_ACTIVE":
        cqs = contest.get("questions", [])
        if state["current_q_idx"] < len(cqs) and cqs[state["current_q_idx"]]["question_id"] == submission.question_id:
            state["winner"] = current_user["username"]
            await manager.set_state(submission.contest_id, state)
            asyncio.create_task(sudden_death_timer(submission.contest_id))
    
    return {"passed": passed_all, "already_solved": False, "results": eval_results}

@app.post("/contests/{contest_id}/join")
def join_contest(contest_id: str, current_user: dict = Depends(get_current_user)):
    existing = db.collection("participants").where(filter=FieldFilter("contest_id", "==", contest_id))\
        .where(filter=FieldFilter("user_id", "==", current_user["id"])).limit(1).stream()
    if not next(existing, None):
        db.collection("participants").add({
            "contest_id": contest_id,
            "user_id": current_user["id"],
            "joined_at": datetime.utcnow().isoformat()
        })
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
    participant_user_ids = [p.to_dict().get("user_id") for p in participants]
    
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
    return {"solved_question_ids": list(set(s.to_dict().get("question_id") for s in solved))}

# Dashboard specific routes
@app.get("/user/contests/hosted")
def get_hosted_contests(current_user: dict = Depends(get_current_user)):
    contests = db.collection("contests").where(filter=FieldFilter("host_id", "==", current_user["id"])).stream()
    res = []
    for c in contests:
        d = c.to_dict()
        status = d.get("status")
        if status == "active" and d.get("mode") in ["standard", "timed"] and d.get("overall_time_limit") and d.get("start_time"):
            try:
                st = datetime.fromisoformat(d["start_time"].replace('Z', ''))
                if (datetime.utcnow() - st).total_seconds() >= d["overall_time_limit"] * 60:
                    status = "ended"
                    c.reference.update({"status": "ended"})
            except:
                pass
        res.append({"id": c.id, "title": d.get("title"), "status": status, "link_code": d.get("link_code"), "mode": d.get("mode"), "start_time": d.get("start_time"), "host_name": current_user["username"]})
    return res

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
    
    hosts = {}
    for hid in host_ids:
        if hid:
            u = db.collection("users").document(hid).get()
            if u.exists:
                hosts[hid] = u.to_dict().get("username", "Unknown")
                
    for c in valid_docs:
        d = c.to_dict()
        status = d.get("status")
        if status == "active" and d.get("mode") in ["standard", "timed"] and d.get("overall_time_limit") and d.get("start_time"):
            try:
                st = datetime.fromisoformat(d["start_time"].replace('Z', ''))
                if (datetime.utcnow() - st).total_seconds() >= d["overall_time_limit"] * 60:
                    status = "ended"
                    c.reference.update({"status": "ended"})
            except:
                pass
        res.append({"id": c.id, "title": d.get("title"), "status": status, "link_code": d.get("link_code"), "mode": d.get("mode"), "start_time": d.get("start_time"), "host_name": hosts.get(d.get("host_id", ""), "Unknown")})
    return res


if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join("frontend/dist", full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse("frontend/dist/index.html")
