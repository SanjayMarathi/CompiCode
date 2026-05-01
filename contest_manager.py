from typing import Dict, List, Optional
from pydantic import BaseModel
import asyncio
from fastapi import WebSocket

class Question(BaseModel):
    id: str
    title: str
    description: str
    time_limit_mins: Optional[int] = None
    test_cases: List[dict] # {input: str, expected_output: str}

class Participant(BaseModel):
    user_id: str
    username: str
    score: int = 0
    completed_questions: List[str] = []

class Contest(BaseModel):
    id: str
    host_id: str
    timing_mode: str # 'global' or 'per-question'
    global_time_limit_mins: Optional[int] = None
    questions: List[Question] = []
    participants: Dict[str, Participant] = {}
    is_active: bool = False
    start_time: Optional[float] = None
    
class ContestManager:
    def __init__(self):
        # In-memory store
        self.contests: Dict[str, Contest] = {}
        # WebSocket connections mapping contest_id -> list of websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        
    def create_contest(self, contest_id: str, host_id: str, timing_mode: str, global_time_limit_mins: int = None) -> Contest:
        new_contest = Contest(
            id=contest_id,
            host_id=host_id,
            timing_mode=timing_mode,
            global_time_limit_mins=global_time_limit_mins
        )
        self.contests[contest_id] = new_contest
        self.active_connections[contest_id] = []
        return new_contest
        
    def get_contest(self, contest_id: str) -> Optional[Contest]:
        return self.contests.get(contest_id)

    # Websocket Management
    async def connect(self, contest_id: str, websocket: WebSocket):
        await websocket.accept()
        if contest_id not in self.active_connections:
            self.active_connections[contest_id] = []
        self.active_connections[contest_id].append(websocket)
        
    def disconnect(self, contest_id: str, websocket: WebSocket):
        if contest_id in self.active_connections:
            self.active_connections[contest_id].remove(websocket)
            
    async def broadcast_leaderboard(self, contest_id: str):
        if contest_id not in self.contests:
            return
            
        contest = self.contests[contest_id]
        leaderboard = [
            {"username": p.username, "score": p.score, "completed": len(p.completed_questions)}
            for p in contest.participants.values()
        ]
        # Sort by score descending
        leaderboard.sort(key=lambda x: x["score"], reverse=True)
        
        message = {
            "type": "leaderboard_update",
            "leaderboard": leaderboard
        }
        await self.broadcast(contest_id, message)
        
    async def broadcast_event(self, contest_id: str, event_text: str):
        message = {
            "type": "event_update",
            "event": event_text
        }
        await self.broadcast(contest_id, message)

    async def broadcast(self, contest_id: str, message: dict):
        if contest_id in self.active_connections:
            for connection in self.active_connections[contest_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ContestManager()
