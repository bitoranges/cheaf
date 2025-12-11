from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import json
import time
import hashlib
import hmac
import datetime
import requests
from typing import Optional

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Volcengine Configuration ---
SERVICE = "cv"
VERSION = "2020-06-01"
REGION = "cn-north-1"
HOST = "opensapi.volcengineapi.com"
CONTENT_TYPE = "application/json"

class VideoRequest(BaseModel):
    prompt: str
    ratio: str = "16:9"
    access_key: Optional[str] = None
    secret_key: Optional[str] = None

class StatusRequest(BaseModel):
    task_id: str
    access_key: Optional[str] = None
    secret_key: Optional[str] = None

# --- Signature Helper Functions ---
def sign(key, msg):
    return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()

def get_signature_key(key, date_stamp, region_name, service_name):
    k_date = sign(("k" + key).encode('utf-8'), date_stamp)
    k_region = sign(k_date, region_name)
    k_service = sign(k_region, service_name)
    k_signing = sign(k_service, "request")
    return k_signing

def make_request(method, action, params, body, ak, sk):
    # 1. Credential Check
    if not ak or not sk:
        # Try environment variables
        ak = ak or os.environ.get("JIMENG_ACCESS_KEY")
        sk = sk or os.environ.get("JIMENG_SECRET_KEY")
        
    if not ak or not sk:
        raise HTTPException(status_code=400, detail="Missing Credentials. Please provide AccessKey and SecretKey in settings or environment variables.")

    # 2. Prepare Request
    url = f"https://{HOST}/"
    now = datetime.datetime.utcnow()
    amz_date = now.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = now.strftime('%Y%m%d')
    
    # Body Hash
    payload = json.dumps(body) if body else ""
    payload_hash = hashlib.sha256(payload.encode('utf-8')).hexdigest()

    # 3. Canonical Request
    # CanonicalURI
    canonical_uri = "/"
    
    # CanonicalQueryString (Sorted)
    # Add Action and Version to query params
    query_params = {
        "Action": action,
        "Version": VERSION,
        **params
    }
    canonical_querystring = "&".join([f"{k}={v}" for k, v in sorted(query_params.items())])
    
    # CanonicalHeaders (Lowercase, Sorted)
    canonical_headers = f"content-type:{CONTENT_TYPE}\nhost:{HOST}\nx-content-sha256:{payload_hash}\nx-date:{amz_date}\n"
    signed_headers = "content-type;host;x-content-sha256;x-date"
    
    canonical_request = f"{method}\n{canonical_uri}\n{canonical_querystring}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    
    # 4. String to Sign
    algorithm = "HMAC-SHA256"
    credential_scope = f"{date_stamp}/{REGION}/{SERVICE}/request"
    string_to_sign = f"{algorithm}\n{amz_date}\n{credential_scope}\n{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    
    # 5. Calculate Signature
    signing_key = get_signature_key(sk, date_stamp, REGION, SERVICE)
    signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()
    
    # 6. Authorization Header
    authorization_header = f"{algorithm} Credential={ak}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
    
    headers = {
        "Content-Type": CONTENT_TYPE,
        "X-Date": amz_date,
        "X-Content-Sha256": payload_hash,
        "Authorization": authorization_header,
        "Host": HOST
    }

    # 7. Send Request
    resp = requests.request(method, url, params=query_params, headers=headers, data=payload)
    
    try:
        return resp.json()
    except:
        return {"error": "Failed to parse JSON", "raw": resp.text, "status": resp.status_code}

@app.get("/")
def health_check():
    return {"status": "Cheaf Backend V1.2 is running", "time": time.time()}

@app.post("/api/generate_video")
def generate_video(req: VideoRequest):
    # Construct body for CV service
    body = {
        "req_key": "high_quality_video", # or "video_animation"
        "prompt": req.prompt,
        "model_version": "v1.3",
        "ratio": req.ratio,
        "scale": 1.0,
        "ddim_steps": 20,
        "seed": -1
    }
    
    try:
        # Action: CVProcess
        result = make_request("POST", "CVProcess", {}, body, req.access_key, req.secret_key)
        
        # Check for upstream API errors
        if "ResponseMetadata" in result and "Error" in result["ResponseMetadata"]:
            err = result["ResponseMetadata"]["Error"]
            raise HTTPException(status_code=400, detail=f"Volcengine Error: {err.get('Message')}")
            
        return result
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/check_status")
def check_status(req: StatusRequest):
    body = {
        "req_key": "high_quality_video",
        "task_id": req.task_id
    }
    
    try:
        result = make_request("POST", "CVProcess", {}, body, req.access_key, req.secret_key)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
