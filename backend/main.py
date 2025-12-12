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

# 1. 允许跨域 (CORS) - 允许前端从任意域名调用
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. 火山引擎配置
HOST = "visual.volcengineapi.com"
REGION = "cn-north-1"
SERVICE = "cv"
VERSION = "2020-08-26"

class VideoRequest(BaseModel):
    prompt: str
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    ratio: str = "16:9"

class StatusRequest(BaseModel):
    task_id: str
    access_key: Optional[str] = None
    secret_key: Optional[str] = None

# 3. 鉴权与签名逻辑
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

def make_request(ak, sk, action, params=None, body=None):
    method = "POST"
    path = "/"
    content_type = "application/json"
    
    # Body 处理: 使用 strict separators 去除空格
    if body:
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
    # 必须包含 content-type, host, x-content-sha256, x-date, 且按字母顺序排序
    # 注意：这里的 \n 必须是真实的换行符
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
    
    return requests.post(url, headers=headers, data=body_bytes)

# 4. API 路由
@app.get("/")
def home():
    return {"status": "Cheaf Backend V1.1 Running"}

@app.post("/api/generate_video")
async def generate_video(req: VideoRequest):
    try:
        ak, sk = get_credentials(req.access_key, req.secret_key)
        # 注意: 根据实际使用的模型调整 req_key，如 'video_generation', 'videogen_v1.3' 等
        body = {
            "req_key": "video_generation", 
            "text_prompts": [req.prompt],
            "ratio": req.ratio,
        }
        resp = make_request(ak, sk, "CVProcess", params={}, body=body)
        
        # 尝试解析 JSON 错误
        try:
            data = resp.json()
        except:
            data = {"text": resp.text}

        if resp.status_code != 200:
             raise HTTPException(status_code=resp.status_code, detail=str(data))
        return data
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/check_status")
async def check_status(req: StatusRequest):
    try:
        ak, sk = get_credentials(req.access_key, req.secret_key)
        body = {"task_ids": [req.task_id]}
        resp = make_request(ak, sk, "CVGetResult", params={}, body=body)
        
        try:
            data = resp.json()
        except:
            data = {"text": resp.text}

        if resp.status_code != 200:
             raise HTTPException(status_code=resp.status_code, detail=str(data))
        return data
    except Exception as e:
         print(f"Error: {e}")
         raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
