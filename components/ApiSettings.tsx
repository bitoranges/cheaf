import React, { useState } from 'react';
import { ApiConfig } from '../types';
import { Key, Save, X, Activity, Server, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';

interface ApiSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfig;
  onSave: (config: ApiConfig) => void;
}

const ApiSettings: React.FC<ApiSettingsProps> = ({ isOpen, onClose, config, onSave }) => {
  const [localConfig, setLocalConfig] = useState<ApiConfig>(config);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    let url = localConfig.backendUrl?.trim();
    if (!url) return;

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
        throw new Error("检测到网页而非API。请确认后端代码已部署且 URL 正确。");
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.status && data.status.includes("Cheaf Backend")) {
        setTestStatus('success');
      } else {
        setTestStatus('failed');
        setErrorMessage('服务器返回数据不匹配，请检查代码版本');
      }
    } catch (e: any) {
      console.error("Connection test failed:", e);
      setTestStatus('failed');
      if (e.message === 'Failed to fetch') {
        setErrorMessage('无法连接到服务器。可能服务器正在休眠或重启。请尝试点击下方链接直接访问，激活服务器后再试。');
      } else {
        setErrorMessage(e.message || '连接失败');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
          <h2 className="font-semibold flex items-center gap-2">
            <Key className="w-4 h-4 text-brand-400" />
            API 网关设置 (模块 B-1)
          </h2>
          <button onClick={onClose} className="hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Backend URL Config */}
          <div className="p-4 bg-blue-50 text-blue-900 rounded-lg border border-blue-100 shadow-sm">
             <div className="flex items-center gap-2 font-bold mb-2 text-blue-700">
               <Server className="w-4 h-4" /> 后端服务地址
             </div>
             <p className="text-xs text-blue-600/80 mb-3">
               为了解决跨域问题并保护密钥，请连接到部署好的 Python 后端。
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
                    placeholder="例如: https://mmf.zeabur.app"
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
                    <CheckCircle2 className="w-3.5 h-3.5" /> 连接成功：Backend V1.3 Ready
                  </div>
                )}
                {testStatus === 'failed' && (
                  <div className="text-red-600 flex flex-col gap-1.5 text-xs bg-red-50 p-2 rounded break-all">
                    <div className="flex items-start gap-1.5">
                      <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> 
                      <span>{errorMessage}</span>
                    </div>
                    {localConfig.backendUrl && (
                      <a 
                        href={localConfig.backendUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="ml-5 flex items-center gap-1 text-blue-600 underline hover:text-blue-800"
                      >
                        <ExternalLink className="w-3 h-3" /> 在浏览器中尝试打开
                      </a>
                    )}
                  </div>
                )}
             </div>
          </div>

          {/* Optional Keys */}
          <div className="border-t border-slate-100 pt-4 opacity-70 hover:opacity-100 transition-opacity">
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              覆盖密钥 (可选)
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              如果不填写，系统将使用服务器端预设的密钥。仅在您需要使用特定账号时填写。
            </p>
            <div className="space-y-3">
              <div>
                <input 
                  type="text"
                  value={localConfig.jimengAccessKey}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, jimengAccessKey: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="AccessKey ID (留空使用默认)"
                />
              </div>
              <div>
                <input 
                  type="password"
                  value={localConfig.jimengSecretKey}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, jimengSecretKey: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="Secret AccessKey (留空使用默认)"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded transition-colors">
            取消
          </button>
          <button 
            onClick={() => { onSave(localConfig); onClose(); }}
            className="px-6 py-2 text-sm font-medium bg-brand-600 text-white rounded hover:bg-brand-700 flex items-center gap-2 shadow-sm shadow-brand-500/30 transition-all active:scale-95"
          >
            <Save className="w-4 h-4" /> 保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiSettings;