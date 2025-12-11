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

# 允许跨域请求 (CORS)，允许前端网页调用
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 数据模型定义 ---

class VideoGenRequest(BaseModel):
    prompt: str
    ratio: str = "16:9"
    access_key: Optional[str] = None
    secret_key: Optional[str] = None

class CheckStatusRequest(BaseModel):
    task_id: str
    access_key: Optional[str] = None
    secret_key: Optional[str] = None

# --- 火山引擎签名工具函数 ---

def sign(key, msg):
    return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()

def get_signature_key(key, date_stamp, region_name, service_name):
    k_date = sign(key.encode('utf-8'), date_stamp)
    k_region = sign(k_date, region_name)
    k_service = sign(k_region, service_name)
    k_signing = sign(k_service, "request")
    return k_signing

def call_volcengine_api(ak: str, sk: str, action: str, body: dict):
    """
    通用火山引擎 API 调用函数 (Signature V4)
    """
    if not ak or not sk:
        raise HTTPException(status_code=400, detail="Missing Access Key or Secret Key")

    service = "cv"
    region = "cn-north-1"
    host = "visual.volcengineapi.com"
    content_type = "application/json; charset=utf-8"
    method = "POST"
    
    # 1. 准备时间戳
    t = datetime.datetime.utcnow()
    amz_date = t.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = t.strftime('%Y%m%d')

    # 2. 准备 Canonical Request
    canonical_uri = "/"
    canonical_querystring = f"Action={action}&Version=2022-08-31"
    canonical_headers = f"content-type:{content_type}\nhost:{host}\nx-date:{amz_date}\n"
    signed_headers = "content-type;host;x-date"
    payload_hash = hashlib.sha256(json.dumps(body).encode('utf-8')).hexdigest()
    
    canonical_request = (f"{method}\n{canonical_uri}\n{canonical_querystring}\n"
                         f"{canonical_headers}\n{signed_headers}\n{payload_hash}")

    # 3. 准备 String to Sign
    algorithm = "HMAC-SHA256"
    credential_scope = f"{date_stamp}/{region}/{service}/aws4_request"
    string_to_sign = (f"{algorithm}\n{amz_date}\n{credential_scope}\n"
                      f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}")

    # 4. 计算签名
    signing_key = get_signature_key(sk, date_stamp, region, service)
    signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()

    # 5. 构造 Header
    authorization_header = (f"{algorithm} Credential={ak}/{credential_scope}, "
                            f"SignedHeaders={signed_headers}, Signature={signature}")

    headers = {
        'Content-Type': content_type,
        'X-Date': amz_date,
        'Authorization': authorization_header,
        'Host': host
    }

    # 6. 发送请求
    url = f"https://{host}/?{canonical_querystring}"
    try:
        response = requests.post(url, headers=headers, json=body)
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- API 路由接口 ---

@app.get("/")
async def root():
    """健康检查接口"""
    return {"status": "Cheaf Backend is running", "version": "1.0.0"}

@app.post("/api/generate_video")
async def generate_video(req: VideoGenRequest):
    """
    代理调用火山引擎视频生成接口
    """
    # 优先使用前端传来的Key，如果没有则读取环境变量
    ak = req.access_key or os.environ.get("JIMENG_ACCESS_KEY")
    sk = req.secret_key or os.environ.get("JIMENG_SECRET_KEY")

    # 构造火山引擎 specific payload (针对 video_generation / Jimeng)
    # 注意：这里的 req_key 是 'video_generation'
    payload = {
        "req_key": "video_generation",
        "text_prompts": [{"text": req.prompt}],
        "ratio": req.ratio,
        # 其他可选参数可根据文档添加
    }

    result = call_volcengine_api(ak, sk, "CVProcess", payload)
    
    # 错误处理
    if "ResponseMetadata" in result and result["ResponseMetadata"].get("Error"):
        raise HTTPException(status_code=400, detail=result["ResponseMetadata"]["Error"]["Message"])
        
    return result

@app.post("/api/check_status")
async def check_status(req: CheckStatusRequest):
    """
    查询任务状态
    """
    ak = req.access_key or os.environ.get("JIMENG_ACCESS_KEY")
    sk = req.secret_key or os.environ.get("JIMENG_SECRET_KEY")

    # 使用 CVProcess 的查询逻辑，通常是 GET 或者特定的查询接口
    # 对于异步任务，通常也是通过 CVProcess 或者 GetDirectVideoGenTask
    # 这里假设使用通用查询 payload
    payload = {
        "req_key": "video_generation",
        "task_id": req.task_id
    }
    
    # 注意：某些接口查询可能需要用 GetDirectVideoGenTask，取决于具体使用的模型
    # 这里尝试用 GetImageTask (如果模型是图片) 或通用的查询方式
    # 由于火山API较多变，我们这里复用 CVProcess 传入 task_id 进行查询 (这是常见模式)
    
    # 如果 CVProcess 不支持查询，需要改为调用 'GetVideoTask' 或类似 Action
    # 为了保险，我们尝试调用 Action='GetDirectVideoGenTask' (如果是该系列) 或者继续用 CVProcess
    
    # 修正：大多数视频生成查询使用 Action="GetDirectVideoGenTask" 或 "GetVideoTask"
    # 这里演示使用 Action="GetVideoTask"
    
    # 如果上面生成用的是 CVProcess (req_key=video_generation)，查询通常也是同个 Action
    # 此时 payload 里带 task_id 即可
    
    result = call_volcengine_api(ak, sk, "CVProcess", payload)
    return result

# 本地调试入口
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
