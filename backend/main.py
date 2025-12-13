import json
import hashlib
import hmac
import datetime
import os
import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI()

# 1. CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Volcengine Configuration (API Version 2022-08-31 - Visual Service)
# Critical Fix: Service must be "visual" not "cv" for VisualGeneration action
HOST = "visual.volcengineapi.com"
REGION = "cn-north-1"
SERVICE = "visual" 
VERSION = "2022-08-31"

class VideoRequest(BaseModel):
    prompt: str
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    ratio: str = "16:9"

class StatusRequest(BaseModel):
    task_id: str
    access_key: Optional[str] = None
    secret_key: Optional[str] = None

# 3. Authentication & Signing Logic
def get_credentials(req_ak, req_sk):
    ak = req_ak if req_ak else os.environ.get("JIMENG_ACCESS_KEY")
    sk = req_sk if req_sk else os.environ.get("JIMENG_SECRET_KEY")
    if not ak or not sk:
        raise Exception("Missing Credentials")
    return ak, sk

def sign(key, msg):
    return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()

def get_signature_key(key, dateStamp, regionName, serviceName):
    kDate = sign(key.encode('utf-8'), dateStamp)
    kRegion = sign(kDate, regionName)
    kService = sign(kRegion, serviceName)
    kSigning = sign(kService, "request")
    return kSigning

def make_request(ak, sk, action, params=None, body=None, method="POST"):
    path = "/"
    content_type = "application/json"
    
    # Handle Body
    if body:
        # Use separators to avoid spaces in JSON, which can affect signature calculation
        body_str = json.dumps(body, separators=(',', ':'))
        body_bytes = body_str.encode('utf-8')
    else:
        body_bytes = b""
    
    t = datetime.datetime.utcnow()
    amz_date = t.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = t.strftime('%Y%m%d')

    if params is None: params = {}
    params["Action"] = action
    params["Version"] = VERSION
    
    # 1. Canonical Query String
    canonical_querystring = "&".join([f"{k}={v}" for k, v in sorted(params.items())])
    
    # 2. Body Hash
    payload_hash = hashlib.sha256(body_bytes).hexdigest()
    
    # 3. Canonical Headers
    canonical_headers = (
        f"content-type:{content_type}\n"
        f"host:{HOST}\n"
        f"x-content-sha256:{payload_hash}\n"
        f"x-date:{amz_date}\n"
    )
    
    signed_headers = "content-type;host;x-content-sha256;x-date"
    
    # 4. Canonical Request
    canonical_request = (
        f"{method}\n"
        f"{path}\n"
        f"{canonical_querystring}\n"
        f"{canonical_headers}\n"
        f"{signed_headers}\n"
        f"{payload_hash}"
    )
    
    # 5. String to Sign
    algorithm = "HMAC-SHA256"
    credential_scope = f"{date_stamp}/{REGION}/{SERVICE}/request"
    string_to_sign = (
        f"{algorithm}\n"
        f"{amz_date}\n"
        f"{credential_scope}\n"
        f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    )
    
    # 6. Calculate Signature
    signing_key = get_signature_key(sk, date_stamp, REGION, SERVICE)
    signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()
    
    # 7. Authorization Header
    authorization_header = (
        f"{algorithm} Credential={ak}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )
    
    url = f"https://{HOST}{path}?{canonical_querystring}"
    headers = {
        'Content-Type': content_type,
        'X-Date': amz_date,
        'X-Content-Sha256': payload_hash,
        'Authorization': authorization_header,
        'Host': HOST
    }
    
    return requests.request(method, url, headers=headers, data=body_bytes)

# 4. Routes
@app.get("/")
def home():
    return {"status": "Cheaf Backend V1.9 Running (2022 API - Visual Service)"}

@app.post("/api/generate_video")
async def generate_video(req: VideoRequest):
    try:
        ak, sk = get_credentials(req.access_key, req.secret_key)
        
        # 2022-08-31 API uses VisualGeneration
        # req_key="video_generation" is standard for T2V
        body = {
            "req_key": "video_generation", 
            "text_prompts": [req.prompt],
            "ratio": req.ratio,
        }
        
        # Action is VisualGeneration
        resp = make_request(ak, sk, "VisualGeneration", params={}, body=body, method="POST")
        
        try:
            data = resp.json()
        except:
            data = {"text": resp.text}

        if resp.status_code != 200:
             print(f"Backend Error: {resp.status_code} - {data}")
             raise HTTPException(status_code=resp.status_code, detail=str(data))
        return data
    except Exception as e:
        print(f"Exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/check_status")
async def check_status(req: StatusRequest):
    try:
        ak, sk = get_credentials(req.access_key, req.secret_key)
        
        # 2022-08-31 API uses GetVisualServiceTask
        # Important: GET request for status in this version
        params = {"task_id": req.task_id}
        
        resp = make_request(ak, sk, "GetVisualServiceTask", params=params, body={}, method="GET")
        
        try:
            data = resp.json()
        except:
            data = {"text": resp.text}

        if resp.status_code != 200:
             raise HTTPException(status_code=resp.status_code, detail=str(data))
        return data
    except Exception as e:
         print(f"Exception: {e}")
         raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Use Environment PORT for Zeabur
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
