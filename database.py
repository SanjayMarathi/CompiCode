from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime
import uuid

import os

# Hugging Face Spaces run with a read-only /app dictionary by default. 
# We'll use /tmp/ for the database if we are running in the Space, or ./ locally.
if os.environ.get("SPACE_ID"):
    db_path = "/tmp/compicode_v2.db"
else:
    db_path = "./compicode_v2.db"

SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    is_global = Column(Boolean, default=True) # Exists in the global question bank
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    test_cases = relationship("TestCase", back_populates="question", cascade="all, delete-orphan")

class TestCase(Base):
    __tablename__ = "testcases"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    input_data = Column(Text)
    expected_output = Column(Text)
    
    question = relationship("Question", back_populates="test_cases")

class Contest(Base):
    __tablename__ = "contests"
    id = Column(Integer, primary_key=True, index=True)
    host_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    link_code = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4())[:8])
    mode = Column(String, default="standard") # standard, sudden_death, or timed
    status = Column(String, default="waiting") # waiting, active, completed
    penalty_per_wrong_answer = Column(Integer, default=5)
    overall_time_limit = Column(Integer, default=60)
    created_at = Column(DateTime, default=datetime.utcnow)
    start_time = Column(DateTime, nullable=True)
    
    host = relationship("User")
    contest_questions = relationship("ContestQuestion", back_populates="contest", cascade="all, delete-orphan")

class ContestQuestion(Base):
    __tablename__ = "contest_questions"
    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(Integer, ForeignKey("contests.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    points = Column(Integer, default=10)
    time_limit = Column(Integer, default=300) # Optional per-question timer
    
    contest = relationship("Contest", back_populates="contest_questions")
    question = relationship("Question")

class ContestParticipant(Base):
    __tablename__ = "contest_participants"
    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(Integer, ForeignKey("contests.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    joined_at = Column(DateTime, default=datetime.utcnow)

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    contest_id = Column(Integer, ForeignKey("contests.id"))
    passed = Column(Boolean, default=False)
    time_taken = Column(Integer, default=0) # time relative to question unlock
    penalty_incurred = Column(Integer, default=0)
    timestamp = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
