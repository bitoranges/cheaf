import os
import json
import datetime
import hashlib
import hmac
import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoRequest(BaseModel):
    prompt: str
    ratio: str = "16:9"
    access_key: Optional[str] = None
    secret_key: Optional[str] = None

class StatusRequest(BaseModel):
    task_id: str
    access_key: Optional[str] = None
    secret_key: Optional[str] = None

# Volcengine / Jimeng Configuration
HOST = "visual.volcengineapi.com"
SERVICE = "cv"
REGION = "cn-north-1"
VERSION = "2020-08-26"

def sign(key, msg):
    return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()

def get_signature_key(key, date_stamp, region_name, service_name):
    k_date = sign(key.encode('utf-8'), date_stamp)
    k_region = sign(k_date, region_name)
    k_service = sign(k_region, service_name)
    k_signing = sign(k_service, "request")
    return k_signing

def request_volcengine(action, params, body, ak, sk):
    method = "POST"
    content_type = "application/json"
    
    # CRITICAL: Create a raw JSON string.
    body_str = json.dumps(body)
    
    t = datetime.datetime.utcnow()
    amz_date = t.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = t.strftime('%Y%m%d')

    # Canonical Request
    canonical_uri = "/"
    all_params = params.copy()
    canonical_querystring = "&".join([f"{k}={all_params[k]}" for k in sorted(all_params.keys())])
    
    canonical_headers = (
        f"content-type:{content_type}\n"
        f"host:{HOST}\n"
        f"x-date:{amz_date}\n"
    )
    signed_headers = "content-type;host;x-date"
    payload_hash = hashlib.sha256(body_str.encode('utf-8')).hexdigest()
    
    canonical_request = (
        f"{method}\n"
        f"{canonical_uri}\n"
        f"{canonical_querystring}\n"
        f"{canonical_headers}\n"
        f"{signed_headers}\n"
        f"{payload_hash}"
    )

    # String to Sign
    algorithm = "HMAC-SHA256"
    credential_scope = f"{date_stamp}/{REGION}/{SERVICE}/request"
    string_to_sign = (
        f"{algorithm}\n"
        f"{amz_date}\n"
        f"{credential_scope}\n"
        f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    )

    # Calculate Signature
    signing_key = get_signature_key(sk, date_stamp, REGION, SERVICE)
    signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()

    # Build Authorization Header
    authorization_header = (
        f"{algorithm} Credential={ak}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    headers = {
        "Content-Type": content_type,
        "X-Date": amz_date,
        "Authorization": authorization_header
    }
    
    url = f"https://{HOST}/?{canonical_querystring}"
    response = requests.post(url, headers=headers, data=body_str.encode('utf-8'))
    
    return response

@app.get("/")
async def root():
    return {
        "status": "Cheaf Backend V1.1 Running", 
        "time": datetime.datetime.now().isoformat(),
        "docs": "/docs"
    }

@app.post("/api/generate_video")
async def generate_video(req: VideoRequest):
    ak = req.access_key if req.access_key else os.environ.get("JIMENG_ACCESS_KEY")
    sk = req.secret_key if req.secret_key else os.environ.get("JIMENG_SECRET_KEY")

    if not ak or not sk:
        raise HTTPException(status_code=400, detail="Missing Credentials.")

    params = {"Action": "CVGenerateVideo", "Version": VERSION}
    body = {
        "req_key": "video_animation",
        "prompt": req.prompt,
        "model_version": "vid_1.1",
        "ratio": req.ratio
    }

    try:
        resp = request_volcengine("CVGenerateVideo", params, body, ak, sk)
        if resp.status_code != 200:
             try: return resp.json()
             except: return {"code": resp.status_code, "message": "Upstream Error", "detail": resp.text}
        return resp.json()
    except Exception as e:
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/check_status")
async def check_status(req: StatusRequest):
    ak = req.access_key if req.access_key else os.environ.get("JIMENG_ACCESS_KEY")
    sk = req.secret_key if req.secret_key else os.environ.get("JIMENG_SECRET_KEY")

    if not ak or not sk:
        raise HTTPException(status_code=400, detail="Missing Credentials")

    params = {"Action": "CVProcessResult", "Version": VERSION}
    body = {"req_key": "video_animation", "task_ids": [req.task_id]}

    try:
        resp = request_volcengine("CVProcessResult", params, body, ak, sk)
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
