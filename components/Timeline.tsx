import React, { useMemo, useState } from 'react';
import { ScriptStep } from '../types';
import { Clock, Video, Camera, Zap, Film, Loader2, AlertCircle, Play, RefreshCw, Wand2 } from 'lucide-react';

interface TimelineProps {
  steps: ScriptStep[];
  onUpdateStep: (id: string, updates: Partial<ScriptStep>) => void;
  onGenerateVideo: (stepId: string) => void;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const Timeline: React.FC<TimelineProps> = ({ steps, onUpdateStep, onGenerateVideo }) => {
  const [errorMsg, setErrorMsg] = useState<Record<string, string>>({});

  const totalDuration = useMemo(() => steps.reduce((acc, s) => acc + s.durationSeconds, 0), [steps]);

  const handleGenerate = async (id: string) => {
    setErrorMsg(prev => ({ ...prev, [id]: '' }));
    try {
      await onGenerateVideo(id);
    } catch (e: any) {
      console.error("Generation failed in UI:", e);
      setErrorMsg(prev => ({ ...prev, [id]: e.message || "请求失败" }));
    }
  };

  const handleDurationChange = (id: string, newDuration: number) => {
    if (isNaN(newDuration) || newDuration < 0) return;
    onUpdateStep(id, { durationSeconds: newDuration });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 backdrop-blur-sm sticky top-0 z-20">
        <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
          <Film className="w-5 h-5 text-brand-600" />
          时间轴编辑器
        </h2>
        <div className="flex items-center gap-4">
          <div className="text-xs font-medium text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            总时长: <span className="font-mono text-slate-700">{formatTime(totalDuration)}</span>
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/30">
        {steps.map((step, index) => (
          <div key={step.id} className="relative pl-8">
            {/* Timeline Connector Line */}
            {index !== steps.length - 1 && (
              <div className="absolute left-[19px] top-8 bottom-[-32px] w-0.5 bg-slate-200"></div>
            )}
            
            {/* Step Circle & Time */}
            <div className={`absolute left-[11px] top-6 w-4 h-4 rounded-full border-[3px] z-10 shadow-sm transition-colors duration-300 ${
              step.videoStatus === 'completed' 
                ? 'bg-green-500 border-white ring-1 ring-green-200' 
                : step.videoStatus === 'failed'
                ? 'bg-red-500 border-white ring-1 ring-red-200'
                : 'bg-white border-brand-500'
            }`}></div>
            
            <div className="absolute -left-16 top-6 text-xs font-mono font-medium text-slate-400 w-14 text-right">
              {formatTime(step.startTimeSeconds)}
            </div>

            {/* Step Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 group">
              <div className="flex flex-col md:flex-row gap-6">
                
                {/* Text Content */}
                <div className="flex-1 space-y-4">
                  {/* Title Row */}
                  <div className="flex items-center gap-3">
                     <span className="flex-shrink-0 bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-md border border-slate-200">
                       STEP {step.order}
                     </span>
                     <input 
                        type="text" 
                        value={step.title}
                        onChange={(e) => onUpdateStep(step.id, { title: e.target.value })}
                        className="font-bold text-lg text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-500 focus:ring-0 outline-none w-full px-1 transition-colors"
                        placeholder="输入步骤标题..."
                     />
                  </div>

                  {/* Description Area */}
                  <div className="relative">
                    <label className="absolute -top-2.5 left-2 px-1 bg-white text-[10px] font-semibold text-slate-400">
                      脚本 / 旁白
                    </label>
                    <textarea
                      value={step.description}
                      onChange={(e) => onUpdateStep(step.id, { description: e.target.value })}
                      className="w-full text-sm leading-relaxed text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 outline-none transition-all resize-none min-h-[80px]"
                      placeholder="在此输入详细的视觉描述或语音旁白..."
                    />
                  </div>

                  {/* Controls: Shot Type & Duration */}
                  <div className="flex flex-wrap gap-3 pt-1">
                     <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:border-brand-300 transition-colors shadow-sm">
                        <Camera className="w-3.5 h-3.5 text-brand-500" />
                        <span className="text-slate-500">景别:</span>
                        <select 
                          value={step.shotType}
                          onChange={(e) => onUpdateStep(step.id, { shotType: e.target.value as any })}
                          className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer hover:text-brand-600"
                        >
                          {['特写', '中景', '全景', '俯拍'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                     </div>

                     <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:border-brand-300 transition-colors shadow-sm">
                        <Zap className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-slate-500">运镜:</span>
                        <select 
                          value={step.cameraMovement}
                          onChange={(e) => onUpdateStep(step.id, { cameraMovement: e.target.value as any })}
                          className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer hover:text-brand-600"
                        >
                          {['固定', '摇镜头', '推近', '拉远', '跟拍'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                     </div>
                     
                     <div className="flex-1"></div>

                     <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs shadow-sm group-focus-within:border-brand-300">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="number"
                          value={step.durationSeconds}
                          onChange={(e) => handleDurationChange(step.id, parseInt(e.target.value))}
                          className="w-10 text-center font-mono font-medium text-slate-700 outline-none border-b border-transparent focus:border-brand-500 bg-transparent"
                        />
                        <span className="text-slate-400">秒</span>
                     </div>
                  </div>
                </div>
                
                {/* Video Generation Column */}
                <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-3">
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-inner group-hover:shadow transition-shadow">
                    {step.videoStatus === 'completed' && step.videoUrl ? (
                      <div className="w-full h-full relative group/video">
                         <video src={step.videoUrl} className="w-full h-full object-cover" controls />
                      </div>
                    ) : step.videoStatus === 'generating' ? (
                       <div className="w-full h-full flex flex-col items-center justify-center text-brand-600 gap-3 bg-slate-50">
                         <Loader2 className="w-8 h-8 animate-spin opacity-80" />
                         <span className="text-xs font-medium animate-pulse">正在渲染视频...</span>
                       </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                          <Video className="w-5 h-5 text-slate-400" />
                        </div>
                        <span className="text-[10px] text-slate-400">等待生成</span>
                      </div>
                    )}

                    {/* Overlay Button for Generate/Regenerate */}
                    {step.videoStatus !== 'generating' && (
                        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity ${step.videoStatus === 'failed' ? 'opacity-100 bg-red-500/10' : ''}`}>
                             <button 
                                onClick={() => handleGenerate(step.id)}
                                className="bg-white text-slate-900 hover:bg-brand-50 hover:text-brand-600 px-4 py-2 rounded-full font-medium text-xs shadow-lg flex items-center gap-2 transform hover:scale-105 transition-all"
                             >
                               {step.videoStatus === 'completed' ? (
                                 <><RefreshCw className="w-3.5 h-3.5" /> 重新生成</>
                               ) : step.videoStatus === 'failed' ? (
                                 <><RefreshCw className="w-3.5 h-3.5" /> 重试</>
                               ) : (
                                 <><Wand2 className="w-3.5 h-3.5" /> AI 生成</>
                               )}
                             </button>
                        </div>
                    )}
                  </div>
                  
                  {/* Error Message */}
                  {(step.videoStatus === 'failed' || errorMsg[step.id]) && (
                     <div className="flex items-start gap-2 text-[10px] text-red-600 bg-red-50 p-2.5 rounded border border-red-100">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span className="leading-tight break-all">
                           {errorMsg[step.id] || "生成失败，请检查 API 配置"}
                        </span>
                     </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        ))}
        
        {/* Empty State / Bottom Padding */}
        <div className="h-20"></div>
      </div>
    </div>
  );
};

export default Timeline;