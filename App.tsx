import React, { useState, useEffect } from 'react';
import ProjectSetup from './components/ProjectSetup';
import Timeline from './components/Timeline';
import IngredientPanel from './components/IngredientPanel';
import ApiSettings from './components/ApiSettings';
import { generateCookingScript } from './services/geminiService';
import { submitVideoTask, checkTaskStatus } from './services/volcengineService';
import { VideoProject, Difficulty, ScriptStep, Ingredient, ApiConfig } from './types';
import { Settings, Download, Film, ChevronLeft, PlayCircle } from 'lucide-react';

export default function App() {
  const [project, setProject] = useState<VideoProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Default Config
  const [apiConfig, setApiConfig] = useState<ApiConfig>({ 
    runwayKey: '', 
    pikaKey: '', 
    jimengAccessKey: '',
    jimengSecretKey: '',
    backendUrl: 'https://cheaf-backend.zeabur.app' // 建议的默认值，用户可修改
  });

  const handleGenerate = async (dishName: string, durationSeconds: number, difficulty: Difficulty) => {
    setIsGenerating(true);
    try {
      const result = await generateCookingScript(dishName, durationSeconds, difficulty);
      
      const newProject: VideoProject = {
        id: crypto.randomUUID(),
        dishName,
        targetDurationSeconds: durationSeconds,
        difficulty,
        createdAt: new Date().toISOString(),
        steps: result.steps || [],
        ingredients: result.ingredients || [],
        status: 'draft'
      };
      setProject(newProject);
    } catch (error) {
      alert("生成脚本失败。请检查您的网络连接或 Gemini API Key。");
    } finally {
      setIsGenerating(false);
    }
  };

  const updateStep = (stepId: string, updates: Partial<ScriptStep>) => {
    if (!project) return;
    const updatedSteps = project.steps.map(s => s.id === stepId ? { ...s, ...updates } : s);
    let currentTime = 0;
    const recalculatedSteps = updatedSteps.map(s => {
      const step = { ...s, startTimeSeconds: currentTime };
      currentTime += s.durationSeconds;
      return step;
    });
    setProject({ ...project, steps: recalculatedSteps });
  };

  const updateIngredients = (ingredients: Ingredient[]) => {
    if (project) setProject({ ...project, ingredients });
  };

  // Handle Video Generation
  const handleGenerateVideo = async (stepId: string) => {
    if (!apiConfig.backendUrl) {
      setShowSettings(true);
      throw new Error("请先配置后端 API 地址");
    }

    const step = project.steps.find(s => s.id === stepId);
    if (!step) return;

    updateStep(stepId, { videoStatus: 'generating' });

    try {
      // Construct Prompt: 包含更详细的视觉描述
      const prompt = `cinematic food shot, ${project.dishName}, ${step.description}, ${step.shotType} shot, ${step.cameraMovement}, 4k, highly detailed, professional lighting`;
      
      // Submit Task
      const taskId = await submitVideoTask(apiConfig, prompt);
      
      updateStep(stepId, { videoStatus: 'generating', videoTaskId: taskId });

      // Poll Status
      const pollInterval = setInterval(async () => {
        try {
          const result = await checkTaskStatus(apiConfig, taskId);
          
          if (result.status === 'completed') {
            clearInterval(pollInterval);
            updateStep(stepId, { videoStatus: 'completed', videoUrl: result.url }); 
          } else if (result.status === 'failed') {
            clearInterval(pollInterval);
            updateStep(stepId, { videoStatus: 'failed' });
          }
          // If running, do nothing and wait for next poll
        } catch (e) {
          console.warn("Poll failed temporarily", e);
          // Don't fail immediately on network blip
        }
      }, 3000);

    } catch (error: any) {
      console.error("Gen Video Error:", error);
      updateStep(stepId, { videoStatus: 'failed' });
      throw error;
    }
  };

  if (!project) {
    return <ProjectSetup onGenerate={handleGenerate} isGenerating={isGenerating} />;
  }

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 overflow-hidden font-sans">
      <aside className="w-16 bg-slate-900 flex flex-col items-center py-6 gap-6 z-20 shadow-xl">
         <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <Film className="text-white w-6 h-6" />
         </div>
         <div className="flex-1"></div>
         <button 
           onClick={() => setShowSettings(true)}
           className="p-2 text-slate-400 hover:text-white transition-colors"
           title="API 设置"
         >
            <Settings className="w-6 h-6" />
         </button>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setProject(null)}
               className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm font-medium"
             >
                <ChevronLeft className="w-4 h-4" /> 返回
             </button>
             <h1 className="text-xl font-bold text-slate-800">{project.dishName}</h1>
             <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 text-xs font-semibold border border-brand-100">
               {project.difficulty}
             </span>
             <span className="text-xs text-slate-400 border-l border-slate-200 pl-4 ml-2">
                目标时长: {project.targetDurationSeconds} 秒
             </span>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 border border-slate-200 transition-colors">
              <PlayCircle className="w-4 h-4" /> 预览
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 shadow-sm shadow-brand-500/20 transition-all active:scale-95">
              <Download className="w-4 h-4" /> 导出视频 (模块 C)
            </button>
          </div>
        </header>

        <div className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-hidden">
          <div className="col-span-8 h-full min-h-0">
            <Timeline 
              steps={project.steps} 
              onUpdateStep={updateStep} 
              onGenerateVideo={handleGenerateVideo}
            />
          </div>

          <div className="col-span-4 h-full min-h-0 flex flex-col gap-6">
            <div className="flex-1 min-h-0">
               <IngredientPanel ingredients={project.ingredients} setIngredients={updateIngredients} />
            </div>
          </div>
        </div>
      </main>

      <ApiSettings 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        config={apiConfig}
        onSave={setApiConfig}
      />
    </div>
  );
}