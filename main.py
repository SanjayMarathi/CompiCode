import asyncio
import httpx
from typing import List, Optional, Dict
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from database import (
    engine, SessionLocal, Base, init_db, get_db,
    User, Contest, Question, TestCase, Submission, ContestQuestion, ContestParticipant
)

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

@app.on_event("startup")
def on_startup():
    init_db()

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

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
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
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

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
    question_id: int
    points: int = 10
    time_limit: int = 300  # Only used for Timed Mode

class ContestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    mode: str = "standard" # standard, sudden_death, timed
    penalty_per_wrong_answer: int = 5
    overall_time_limit: int = 60 # minutes
    selected_questions: List[ContestQuestionInfo]

class SubmitCode(BaseModel):
    code: str
    language: str
    question_id: int
    contest_id: int

# --- WebSocket Manager for Sudden Death ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}
        self.contest_state: Dict[int, dict] = {}
        
    async def connect(self, websocket: WebSocket, contest_id: int):
        await websocket.accept()
        if contest_id not in self.active_connections:
            self.active_connections[contest_id] = []
        self.active_connections[contest_id].append(websocket)
        
        if contest_id not in self.contest_state:
            db = SessionLocal()
            c = db.query(Contest).filter(Contest.id == contest_id).first()
            limit_sec = c.overall_time_limit * 60 if c else 3600
            db.close()
            
            self.contest_state[contest_id] = {
                "state": "WAITING_TO_START", 
                "current_q_idx": 0,
                "active_question_id": None,
                "winner": None,
                "sync_timer": limit_sec, # This acts as the global timer for sudden death
            }
        
        await websocket.send_json({"type": "SYNC_STATE", "data": self.contest_state[contest_id]})

    def disconnect(self, websocket: WebSocket, contest_id: int):
        if contest_id in self.active_connections:
            if websocket in self.active_connections[contest_id]:
                self.active_connections[contest_id].remove(websocket)

    async def broadcast(self, contest_id: int, message: dict):
        if contest_id in self.active_connections:
            for connection in self.active_connections[contest_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass
                    
    def get_state(self, contest_id: int):
        return self.contest_state.get(contest_id)
        
    async def set_state(self, contest_id: int, state_updates: dict):
        if contest_id in self.contest_state:
            self.contest_state[contest_id].update(state_updates)
            await self.broadcast(contest_id, {"type": "SYNC_STATE", "data": self.contest_state[contest_id]})

manager = ConnectionManager()

# --- Async Timer Loop for Sudden Death ---
async def sudden_death_timer(contest_id: int):
    # This runs when a round is won
    state = manager.get_state(contest_id)
    if not state: return
    
    # Pause clock for 10s between rounds
    break_timer = 10 
    state["state"] = "ROUND_OVER"
    await manager.set_state(contest_id, state)
    
    while break_timer > 0:
        await asyncio.sleep(1)
        # Global timer still counts down during breaks
        state = manager.get_state(contest_id)
        if not state: return
        state["sync_timer"] -= 1
        break_timer -= 1
        await manager.broadcast(contest_id, {"type": "TIMER_TICK", "data": state["sync_timer"]})
        
        if state["sync_timer"] <= 0:
            state["state"] = "CONTEST_OVER"
            await manager.set_state(contest_id, state)
            return

    # Break over! Advance to next round
    state = manager.get_state(contest_id)
    state["current_q_idx"] += 1
    
    db = SessionLocal()
    cqs = db.query(ContestQuestion).filter(ContestQuestion.contest_id == contest_id).all()
    total_q = len(cqs)
    
    if state["current_q_idx"] >= total_q:
        state["state"] = "CONTEST_OVER"
        await manager.set_state(contest_id, state)
        db.close()
        return

    # Link the correct DB question ID to state!
    active_qid = cqs[state["current_q_idx"]].question_id
    db.close()

    state["state"] = "QUESTION_ACTIVE"
    state["winner"] = None
    state["active_question_id"] = active_qid
    await manager.set_state(contest_id, state)
    
    asyncio.create_task(global_active_timer(contest_id, state["current_q_idx"]))

async def global_active_timer(contest_id: int, q_idx: int):
    # Just ticks the global timer. Waits for winner or global time out.
    state = manager.get_state(contest_id)
    while state and state["state"] == "QUESTION_ACTIVE" and state["current_q_idx"] == q_idx and state["sync_timer"] > 0:
        await asyncio.sleep(1)
        state = manager.get_state(contest_id)
        if state["state"] != "QUESTION_ACTIVE" or state["current_q_idx"] != q_idx:
            return # Someone won, loop broken.
        state["sync_timer"] -= 1
        await manager.broadcast(contest_id, {"type": "TIMER_TICK", "data": state["sync_timer"]})
        
    state = manager.get_state(contest_id)
    if state and state["sync_timer"] <= 0:
        state["state"] = "CONTEST_OVER"
        await manager.set_state(contest_id, state)

# --- Routes ---
@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    new_user = User(username=user.username, hashed_password=get_password_hash(user.password))
    db.add(new_user)
    db.commit()
    return {"message": "User registered successfully"}

@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {"username": current_user.username, "id": current_user.id}

@app.get("/questions")
def get_questions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    questions = db.query(Question).filter((Question.is_global == True) | (Question.creator_id == current_user.id)).all()
    return [{"id": q.id, "title": q.title, "description": q.description} for q in questions]

@app.post("/questions")
def create_question(question: QuestionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_q = Question(title=question.title, description=question.description, is_global=question.is_global, creator_id=current_user.id)
    db.add(new_q)
    db.commit()
    db.refresh(new_q)
    for tc in question.test_cases:
        db.add(TestCase(question_id=new_q.id, input_data=tc.input_data, expected_output=tc.expected_output))
    db.commit()
    return {"message": "Question added to bank", "id": new_q.id}

@app.put("/questions/{q_id}")
def update_question(q_id: int, question: QuestionCreate, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == q_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    q.title = question.title
    q.description = question.description
    db.query(TestCase).filter(TestCase.question_id == q_id).delete()
    for tc in question.test_cases:
        db.add(TestCase(question_id=q.id, input_data=tc.input_data, expected_output=tc.expected_output))
    db.commit()
    return {"message": "Question updated successfully"}

@app.get("/questions/{q_id}")
def get_single_question(q_id: int, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == q_id).first()
    if not q:
        raise HTTPException(404, "Question not found")
    tcs = db.query(TestCase).filter(TestCase.question_id == q_id).all()
    return {
        "id": q.id,
        "title": q.title,
        "description": q.description,
        "test_cases": [{"input": tc.input_data, "expected": tc.expected_output} for tc in tcs]
    }

@app.post("/contests")
def create_contest(contest: ContestCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_contest = Contest(
        title=contest.title,
        description=contest.description,
        mode=contest.mode,
        host_id=current_user.id,
        penalty_per_wrong_answer=contest.penalty_per_wrong_answer,
        overall_time_limit=contest.overall_time_limit
    )
    db.add(new_contest)
    db.commit()
    db.refresh(new_contest)
    
    for sq in contest.selected_questions:
        cq = ContestQuestion(contest_id=new_contest.id, question_id=sq.question_id, points=sq.points, time_limit=sq.time_limit)
        db.add(cq)
    db.commit()
    return {"message": "Contest created!", "link_code": new_contest.link_code}

@app.get("/contests/{link_code}")
def get_contest(link_code: str, db: Session = Depends(get_db)):
    contest = db.query(Contest).filter(Contest.link_code == link_code).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")
        
    c_questions = db.query(ContestQuestion).filter(ContestQuestion.contest_id == contest.id).all()
    q_data = []
    for cq in c_questions:
        q = db.query(Question).filter(Question.id == cq.question_id).first()
        q_data.append({"id": q.id, "title": q.title, "description": q.description, "points": cq.points, "time_limit": cq.time_limit})
        
    return {
        "id": contest.id,
        "title": contest.title,
        "description": contest.description,
        "mode": contest.mode,
        "status": contest.status,
        "start_time": contest.start_time.isoformat() if contest.start_time else None,
        "host_id": contest.host_id,
        "overall_time_limit": contest.overall_time_limit,
        "penalty_per_wrong_answer": contest.penalty_per_wrong_answer,
        "questions": q_data
    }

@app.post("/contests/{contest_id}/start")
async def start_sudden_death_contest(contest_id: int):
    db = SessionLocal()
    state = manager.get_state(contest_id)
    if not state:
        c = db.query(Contest).filter(Contest.id == contest_id).first()
        limit_sec = c.overall_time_limit * 60 if c else 3600
        state = {
            "state": "WAITING_TO_START", 
            "current_q_idx": 0,
            "active_question_id": None,
            "winner": None,
            "sync_timer": limit_sec
        }
        manager.contest_state[contest_id] = state
        
    cqs = db.query(ContestQuestion).filter(ContestQuestion.contest_id == contest_id).all()
    q_id = cqs[0].question_id if cqs else 1
    db.close()
    
    state["state"] = "QUESTION_ACTIVE"
    state["current_q_idx"] = 0
    state["active_question_id"] = q_id
    await manager.set_state(contest_id, state)
    asyncio.create_task(global_active_timer(contest_id, 0))
    return {"success": True}

@app.post("/contests/{contest_id}/open")
async def open_contest_for_standard(contest_id: int):
    """Mark a standard/timed contest as open."""
    db = SessionLocal()
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if contest:
        contest.status = "active"
        contest.start_time = datetime.utcnow()
        db.commit()
    db.close()
    return {"success": True, "message": "Contest opened"}

@app.post("/contests/{contest_id}/end")
async def end_contest(contest_id: int):
    """Mark a contest as ended."""
    db = SessionLocal()
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if contest:
        contest.status = "ended"
        db.commit()
    db.close()
    state = manager.get_state(contest_id)
    if state:
        state["state"] = "FINISHED"
        await manager.set_state(contest_id, state)
    return {"success": True, "message": "Contest ended"}

@app.get("/contests/{contest_id}/info")
def get_contest_info_by_id(contest_id: int, db: Session = Depends(get_db)):
    """Get contest info by numeric ID (used by solve platform)."""
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")
    return {
        "id": contest.id,
        "title": contest.title,
        "mode": contest.mode,
        "overall_time_limit": contest.overall_time_limit,
        "penalty_per_wrong_answer": contest.penalty_per_wrong_answer,
        "start_time": contest.start_time.isoformat() if contest.start_time else None
    }

@app.websocket("/ws/contest/{contest_id}")
async def websocket_endpoint(websocket: WebSocket, contest_id: int):
    await manager.connect(websocket, contest_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, contest_id)

@app.post("/submit")
async def submit_code(submission: SubmitCode, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contest = db.query(Contest).filter(Contest.id == submission.contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    # Block re-submission of already-passed questions
    already_passed = db.query(Submission).filter(
        Submission.contest_id == submission.contest_id,
        Submission.user_id == current_user.id,
        Submission.question_id == submission.question_id,
        Submission.passed == True
    ).first()
    if already_passed:
        return {"passed": True, "already_solved": True, "results": [], "message": "You already solved this question!"}

    state = manager.get_state(submission.contest_id)
    if contest.mode == "sudden_death" and state and state["state"] != "QUESTION_ACTIVE":
        return {"passed": False, "results": [], "error": "Contest is not active"}

    test_cases = db.query(TestCase).filter(TestCase.question_id == submission.question_id).all()
    if not test_cases:
        raise HTTPException(status_code=400, detail="No test cases found for this question")
    
    payload = {
        "code": submission.code,
        "language": submission.language,
        "test_cases": [{"input": tc.input_data, "expected_output": tc.expected_output} for tc in test_cases]
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
    except httpx.TimeoutException:
        return {"passed": False, "results": [], "error": "Executor timed out. Please try again."}
    except Exception as e:
        return {"passed": False, "results": [], "error": f"Executor unavailable: {str(e)}"}
            
    passed_all = bool(eval_results) and all(r.get("passed", False) for r in eval_results)
            
    time_taken = 0
    if contest.start_time:
        time_taken = int((datetime.utcnow() - contest.start_time).total_seconds())
            
    new_sub = Submission(
        user_id=current_user.id,
        question_id=submission.question_id,
        contest_id=submission.contest_id,
        passed=passed_all,
        penalty_incurred=0 if passed_all else contest.penalty_per_wrong_answer,
        time_taken=time_taken
    )
    db.add(new_sub)
    db.commit()
    
    if passed_all and contest.mode == "sudden_death" and state and state["state"] == "QUESTION_ACTIVE":
        cqs = db.query(ContestQuestion).filter(ContestQuestion.contest_id == submission.contest_id).all()
        if state["current_q_idx"] < len(cqs) and cqs[state["current_q_idx"]].question_id == submission.question_id:
            state["winner"] = current_user.username
            await manager.set_state(submission.contest_id, state)
            asyncio.create_task(sudden_death_timer(submission.contest_id))
    
    return {"passed": passed_all, "already_solved": False, "results": eval_results}

@app.post("/contests/{contest_id}/join")
def join_contest(contest_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(ContestParticipant).filter(ContestParticipant.contest_id == contest_id, ContestParticipant.user_id == current_user.id).first()
    if not existing:
        db.add(ContestParticipant(contest_id=contest_id, user_id=current_user.id))
        db.commit()
    return {"success": True}

@app.get("/contests/{contest_id}/leaderboard")
def get_leaderboard(contest_id: int, db: Session = Depends(get_db)):
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest: return []

    cqs = db.query(ContestQuestion).filter(ContestQuestion.contest_id == contest_id).order_by(ContestQuestion.id).all()
    question_ids = [cq.question_id for cq in cqs]
    points_map = {cq.question_id: cq.points for cq in cqs}

    participants = db.query(ContestParticipant).filter(ContestParticipant.contest_id == contest_id).all()
    participant_user_ids = [p.user_id for p in participants]
    users = db.query(User).filter(User.id.in_(participant_user_ids)).all() if participant_user_ids else []

    leaderboard = []

    for u in users:
        subs = db.query(Submission).filter(
            Submission.contest_id == contest_id,
            Submission.user_id == u.id
        ).order_by(Submission.id).all()

        # Build per-question stats
        q_stats = {}
        for qid in question_ids:
            q_subs = [s for s in subs if s.question_id == qid]
            wrong = sum(1 for s in q_subs if not s.passed)
            passed_sub = next((s for s in q_subs if s.passed), None)
            solved = passed_sub is not None
            time_taken = passed_sub.time_taken if passed_sub else 0
            q_stats[str(qid)] = {"solved": solved, "wrong_count": wrong, "time_taken": time_taken}

        passed_qids = list(set(s.question_id for s in subs if s.passed))
        score = sum(points_map.get(qid, 0) for qid in passed_qids)
        total_penalty = sum(s.penalty_incurred for s in subs)

        leaderboard.append({
            "username": u.username,
            "score": score,
            "penalty": total_penalty,
            "solved_count": len(passed_qids),
            "solved_question_ids": passed_qids,
            "question_stats": q_stats
        })

    leaderboard.sort(key=lambda x: (-x["score"], x["penalty"]))
    return leaderboard

@app.get("/contests/{contest_id}/my-solved")
def get_my_solved(contest_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns list of question IDs that the current user has already solved in this contest."""
    solved = db.query(Submission).filter(
        Submission.contest_id == contest_id,
        Submission.user_id == current_user.id,
        Submission.passed == True
    ).all()
    return {"solved_question_ids": list(set(s.question_id for s in solved))}


if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join("frontend/dist", full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse("frontend/dist/index.html")
