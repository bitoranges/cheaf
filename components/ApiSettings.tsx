import React, { useState } from 'react';
import { ApiConfig } from '../types';
import { Key, Save, X, Server, CheckCircle2, Loader2, AlertTriangle, AlertCircle, Code, Copy, Check } from 'lucide-react';

interface ApiSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfig;
  onSave: (config: ApiConfig) => void;
}

// 注意: 为了让这段代码在 React 组件中被正确复制为 Python 代码，
// 我们使用了 \\n 来表示 Python 字符串中的 \n 转义，
// 并使用了 \${} 来防止 JS 尝试解析模板字符串中的 Python 变量插值。
const BACKEND_CODE = `import json
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

# 2. Volcengine Configuration (API Version 2020-08-26 - Stable)
# Documentation: Standard CVProcess Endpoint
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
    canonical_querystring = "&".join([f"\${k}=\${v}" for k, v in sorted(params.items())])
    
    # 2. Body Hash
    payload_hash = hashlib.sha256(body_bytes).hexdigest()
    
    # 3. Canonical Headers
    canonical_headers = (
        f"content-type:\${content_type}\\n"
        f"host:\${HOST}\\n"
        f"x-content-sha256:\${payload_hash}\\n"
        f"x-date:\${amz_date}\\n"
    )
    
    signed_headers = "content-type;host;x-content-sha256;x-date"
    
    # 4. Canonical Request
    canonical_request = (
        f"\${method}\\n"
        f"\${path}\\n"
        f"\${canonical_querystring}\\n"
        f"\${canonical_headers}\\n"
        f"\${signed_headers}\\n"
        f"\${payload_hash}"
    )
    
    # 5. String to Sign
    algorithm = "HMAC-SHA256"
    credential_scope = f"\${date_stamp}/\${REGION}/\${SERVICE}/request"
    string_to_sign = (
        f"\${algorithm}\\n"
        f"\${amz_date}\\n"
        f"\${credential_scope}\\n"
        f"\${hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    )
    
    # 6. Calculate Signature
    signing_key = get_signature_key(sk, date_stamp, REGION, SERVICE)
    signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()
    
    # 7. Authorization Header
    authorization_header = (
        f"\${algorithm} Credential=\${ak}/\${credential_scope}, "
        f"SignedHeaders=\${signed_headers}, Signature=\${signature}"
    )
    
    url = f"https://\${HOST}\${path}?\${canonical_querystring}"
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
    return {"status": "Cheaf Backend V1.8 Running (2020 API - CVProcess)"}

@app.post("/api/generate_video")
async def generate_video(req: VideoRequest):
    try:
        ak, sk = get_credentials(req.access_key, req.secret_key)
        
        # 2020-08-26 API uses CVProcess
        body = {
            "req_key": "video_generation", 
            "text_prompts": [req.prompt],
            "ratio": req.ratio,
        }
        
        # Action is CVProcess
        resp = make_request(ak, sk, "CVProcess", params={}, body=body, method="POST")
        
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
        
        # 2020-08-26 API uses GetImageStyleResult for status check
        # Must be POST with task_id in body
        body = {"task_id": req.task_id}
        
        resp = make_request(ak, sk, "GetImageStyleResult", params={}, body=body, method="POST")
        
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
`;

const ApiSettings: React.FC<ApiSettingsProps> = ({ isOpen, onClose, config, onSave }) => {
  const [localConfig, setLocalConfig] = useState<ApiConfig>(config);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'settings' | 'code'>('settings');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    let url = localConfig.backendUrl?.trim();
    if (!url) return;

    // 1. Smart Check: Prevent user from entering the current frontend URL
    const currentOrigin = window.location.origin;
    const cleanUrl = url.replace(/\/$/, '');
    const cleanCurrent = currentOrigin.replace(/\/$/, '');

    if (cleanUrl === cleanCurrent) {
      setTestStatus('failed');
      setErrorMessage('错误：您填入的是当前【前端网页】的地址！\n后端 API 必须是 Zeabur 上另一个独立服务的域名。\n请切换到「查看后端代码」标签页，将代码部署到 Zeabur 后获取新域名。');
      return;
    }

    setTestStatus('testing');
    setErrorMessage('');

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
      setLocalConfig(prev => ({ ...prev, backendUrl: url }));
    }

    try {
      const baseUrl = url.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/`);
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("HTML_DETECTED");
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.status && data.status.includes("Cheaf Backend")) {
        // V1.8 Check (Accepts 1.8)
        if (data.status.includes("V1.8")) {
            setTestStatus('success');
        } else {
            setTestStatus('failed');
            setErrorMessage(`检测到旧版后端 (${data.status})。\n\n请务必：\n1. 点击上方「获取后端代码」。\n2. 复制新代码 (V1.8)。\n3. 在 Zeabur 重新部署。`);
        }
      } else {
        setTestStatus('failed');
        setErrorMessage('服务器响应格式不正确，可能连接了错误的服务');
      }
    } catch (e: any) {
      console.error("Connection test failed:", e);
      setTestStatus('failed');
      
      if (e.message === 'HTML_DETECTED') {
        setErrorMessage('连接到了网页而非API。请确认您已在 Zeabur 新建了独立的 Python 服务，并使用了那个服务的域名。');
      } else if (e.message === 'Failed to fetch') {
        setErrorMessage('无法连接 (Failed to fetch)。可能原因：\n1. 后端服务尚未部署完成。\n2. 域名填写错误。');
      } else {
        setErrorMessage(e.message || '连接失败');
      }
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(BACKEND_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
      // 自动清理 URL
      const finalConfig = { ...localConfig };
      if (finalConfig.backendUrl) {
          finalConfig.backendUrl = finalConfig.backendUrl.trim().replace(/\/+$/, '');
      }
      onSave(finalConfig);
      onClose();
  };

  const hasKeys = !!localConfig.jimengAccessKey && !!localConfig.jimengSecretKey;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header with Tabs */}
        <div className="bg-slate-800 p-0 flex flex-col text-white">
          <div className="flex justify-between items-center p-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Key className="w-4 h-4 text-brand-400" />
              API 网关设置 (模块 B-1)
            </h2>
            <button onClick={onClose} className="hover:text-slate-300">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex px-4 gap-6 text-sm font-medium">
             <button 
                onClick={() => setActiveTab('settings')}
                className={`pb-3 border-b-2 transition-colors ${activeTab === 'settings' ? 'border-brand-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
             >
                连接配置
             </button>
             <button 
                onClick={() => setActiveTab('code')}
                className={`pb-3 border-b-2 transition-colors ${activeTab === 'code' ? 'border-brand-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
             >
                获取后端代码
             </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {activeTab === 'settings' ? (
            <>
              {/* Backend URL Config */}
              <div className="p-4 bg-blue-50 text-blue-900 rounded-lg border border-blue-100 shadow-sm">
                <div className="flex items-center gap-2 font-bold mb-2 text-blue-700">
                  <Server className="w-4 h-4" /> 后端服务地址
                </div>
                <p className="text-xs text-blue-600/80 mb-3">
                  请填写 Zeabur 上 <strong>Python 后端服务</strong> 的独立域名。<br/>
                  还没有后端？请切换到「获取后端代码」标签页。
                </p>
                <div className="space-y-2">
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={localConfig.backendUrl || ''}
                        onChange={(e) => {
                          setLocalConfig(prev => ({ ...prev, backendUrl: e.target.value }));
                          setTestStatus('idle');
                        }}
                        className="flex-1 px-3 py-2 border border-blue-200 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="例如: https://cheaf-api.zeabur.app"
                      />
                      <button 
                        onClick={handleTestConnection}
                        disabled={!localConfig.backendUrl || testStatus === 'testing'}
                        className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs font-medium whitespace-nowrap min-w-[70px] flex justify-center"
                      >
                        {testStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : '测试'}
                      </button>
                    </div>
                    
                    {testStatus === 'success' && (
                      <div className="text-green-600 flex items-center gap-1.5 text-xs font-medium bg-green-50 p-2 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 连接成功：Backend V1.8 (Fixed)
                      </div>
                    )}
                    {testStatus === 'failed' && (
                      <div className="text-red-600 flex flex-col gap-1.5 text-xs bg-red-50 p-2 rounded break-all border border-red-100">
                        <div className="flex items-start gap-1.5 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> 
                          <span>连接错误</span>
                        </div>
                        <span className="opacity-90 leading-relaxed whitespace-pre-wrap">{errorMessage}</span>
                      </div>
                    )}
                </div>
              </div>

              {/* Optional Keys */}
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center justify-between">
                  <span>覆盖密钥 (可选)</span>
                  {!hasKeys && (
                    <span className="flex items-center gap-1 text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-normal">
                      <AlertCircle className="w-3 h-3" /> 未设置
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  如果不填写，将使用后端环境变量中的 <code>JIMENG_ACCESS_KEY</code>。
                  <br/>
                  <span className="text-orange-600">如果后端未配置环境变量，此处为必填项。</span>
                </p>
                <div className="space-y-3">
                  <div>
                    <input 
                      type="text"
                      value={localConfig.jimengAccessKey}
                      onChange={(e) => setLocalConfig(prev => ({ ...prev, jimengAccessKey: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 outline-none ${!hasKeys && !localConfig.jimengAccessKey ? 'border-yellow-300 focus:border-yellow-400 focus:ring-yellow-200 bg-yellow-50' : 'border-slate-300 focus:ring-brand-500'}`}
                      placeholder="AccessKey ID"
                    />
                  </div>
                  <div>
                    <input 
                      type="password"
                      value={localConfig.jimengSecretKey}
                      onChange={(e) => setLocalConfig(prev => ({ ...prev, jimengSecretKey: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 outline-none ${!hasKeys && !localConfig.jimengSecretKey ? 'border-yellow-300 focus:border-yellow-400 focus:ring-yellow-200 bg-yellow-50' : 'border-slate-300 focus:ring-brand-500'}`}
                      placeholder="Secret AccessKey"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
             <div className="space-y-4 h-full flex flex-col">
               <div className="p-3 bg-slate-50 border border-slate-100 rounded text-xs text-slate-600 leading-relaxed">
                 <p className="font-bold text-slate-700 mb-1">使用说明：</p>
                 1. 复制下方代码，保存为 <code className="bg-white px-1 border rounded">main.py</code>。<br/>
                 2. 在您的项目或 Zeabur 中部署此 Python 服务（覆盖之前的代码）。<br/>
                 3. 部署成功后，重新测试连接。
               </div>
               
               <div className="relative flex-1 border border-slate-200 rounded-lg bg-slate-50 overflow-hidden group">
                  <div className="absolute top-2 right-2 z-10">
                     <button 
                       onClick={handleCopyCode}
                       className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 shadow-sm hover:border-brand-500 hover:text-brand-600 transition-all"
                     >
                       {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                       {copied ? '已复制' : '复制代码'}
                     </button>
                  </div>
                  <textarea 
                    className="w-full h-full p-4 text-xs font-mono text-slate-600 resize-none bg-slate-50 outline-none"
                    value={BACKEND_CODE}
                    readOnly
                  />
               </div>
             </div>
          )}
        </div>

        <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100 shrink-0">
           <button 
             onClick={onClose}
             className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
           >
             关闭
           </button>
           {activeTab === 'settings' && (
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 rounded-lg text-sm font-medium shadow-sm shadow-brand-500/20 flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                保存配置
              </button>
           )}
        </div>
      </div>
    </div>
  );
};

export default ApiSettings;