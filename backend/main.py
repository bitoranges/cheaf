from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import datetime
import hashlib
import hmac
import json
import os

app = FastAPI()

# 允许跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 火山引擎 (Volcengine) 配置
SERVICE = "cv"
VERSION = "2022-08-31" # 已更新为支持视频生成的版本
REGION = "cn-north-1"
HOST = "visual.volcengineapi.com"
CONTENT_TYPE = "application/json"

class VideoRequest(BaseModel):
    prompt: str
    access_key: str
    secret_key: str
    ratio: str = "16:9"

class StatusRequest(BaseModel):
    task_id: str
    access_key: str
    secret_key: str

def get_signature(secret_key, date, region, service, signing_text):
    k_date = hmac.new(secret_key.encode('utf-8'), date.encode('utf-8'), hashlib.sha256).digest()
    k_region = hmac.new(k_date, region.encode('utf-8'), hashlib.sha256).digest()
    k_service = hmac.new(k_region, service.encode('utf-8'), hashlib.sha256).digest()
    k_signing = hmac.new(k_service, "request".encode('utf-8'), hashlib.sha256).digest()
    return hmac.new(k_signing, signing_text.encode('utf-8'), hashlib.sha256).hexdigest()

def call_volcengine(ak, sk, action, body):
    if not ak or not sk:
        raise HTTPException(status_code=400, detail="Missing Credentials")

    method = "POST"
    path = "/"
    query = f"Action={action}&Version={VERSION}"
    
    # 签名流程
    now = datetime.datetime.utcnow()
    amz_date = now.strftime('%Y%m%dT%H%M%SZ')
    datestamp = now.strftime('%Y%m%d')
    credential_scope = f"{datestamp}/{REGION}/{SERVICE}/request"

    canonical_headers = f"content-type:{CONTENT_TYPE}\nhost:{HOST}\nx-date:{amz_date}\n"
    signed_headers = "content-type;host;x-date"
    payload_hash = hashlib.sha256(json.dumps(body).encode('utf-8')).hexdigest()
    canonical_request = f"{method}\n{path}\n{query}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"

    algorithm = "HMAC-SHA256"
    string_to_sign = f"{algorithm}\n{amz_date}\n{credential_scope}\n{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"

    signature = get_signature(sk, datestamp, REGION, SERVICE, string_to_sign)
    authorization_header = f"{algorithm} Credential={ak}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"

    headers = {
        'Content-Type': CONTENT_TYPE,
        'X-Date': amz_date,
        'Authorization': authorization_header,
        'Host': HOST
    }

    url = f"https://{HOST}/?{query}"
    
    try:
        response = requests.post(url, headers=headers, json=body)
        # 尝试解析 JSON 错误
        try:
            resp_json = response.json()
        except:
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            return {"status": "error", "message": "Invalid JSON response"}

        if response.status_code != 200:
             # 透传火山引擎的详细错误
             detail = resp_json.get("ResponseMetadata", {}).get("Error", {}).get("Message", str(resp_json))
             raise HTTPException(status_code=response.status_code, detail=detail)
             
        return resp_json
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"status": "Cheaf Backend is running", "version": "1.1"}

@app.post("/api/generate_video")
def generate_video(req: VideoRequest):
    # 即梦/火山引擎 视频生成参数
    body = {
        "req_key": "video_generation", 
        "prompt": req.prompt,
        "ratio": req.ratio,
        "model_version": "v1.3"
    }
    return call_volcengine(req.access_key, req.secret_key, "CVProcess", body)

@app.post("/api/check_status")
def check_status(req: StatusRequest):
    body = {
        "task_id": req.task_id
    }
    # 异步任务查询结果
    return call_volcengine(req.access_key, req.secret_key, "CVProcessResult", body)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
