import firebase_admin
from firebase_admin import credentials, firestore
import os
import json

if not firebase_admin._apps:
    env_cred = os.getenv("FIREBASE_KEY_JSON")
    if env_cred:
        cred_dict = json.loads(env_cred)
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
    else:
        cred_path = "firebase-key.json"
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            raise Exception(f"Firebase credentials not found in env FIREBASE_KEY_JSON or file {cred_path}")

db = firestore.client()
