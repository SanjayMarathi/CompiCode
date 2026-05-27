import firebase_admin
from firebase_admin import credentials, firestore
import os

cred_path = "firebase-key.json"
if not firebase_admin._apps:
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        raise Exception(f"Firebase credentials not found at {cred_path}")

db = firestore.client()
