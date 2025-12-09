import React, { useState, useEffect } from 'react';
import ProjectSetup from './components/ProjectSetup';
import Timeline from './components/Timeline';
import IngredientPanel from './components/IngredientPanel';
import ApiSettings from './components/ApiSettings';
import { generateCookingScript } from './services/geminiService';
import { submitVideoTask, checkTaskStatus } from './services/volcengineService';
import { VideoProject, Difficulty, ScriptStep, Ingredient, ApiConfig } from './types';
import { Settings, Download, Film, ChevronLeft, PlayCircle, WifiOff, Home } from 'lucide-react';

export default function App() {
  const [project, setProject] = useState<VideoProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Default Config
  // 重要修改：将 backendUrl 留空，避免用户误用前端地址
  const [apiConfig, setApiConfig] = useState<ApiConfig>({ 
    runwayKey: '', 
    pikaKey: '', 
    jimengAccessKey: '',
    jimengSecretKey: '',
    backendUrl: '' 
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
      console.error("Critical error in generation:", error);
      alert("程序发生未知错误，请刷新重试。");
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
      return;
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
      alert(`生成失败: ${error.message}`);
    }
  };

  if (!project) {
    return (
      <>
        <ProjectSetup onGenerate={handleGenerate} isGenerating={isGenerating} />
        <div className="fixed bottom-4 left-4 z-50">
           <button 
             onClick={() => setShowSettings(true)}
             className="p-2 bg-white/80 backdrop-blur rounded-full shadow-lg hover:bg-white transition-all text-slate-600"
             title="API 设置"
           >
             <Settings className="w-5 h-5" />
           </button>
        </div>
        <ApiSettings 
          isOpen={showSettings} 
          onClose={() => setShowSettings(false)} 
          config={apiConfig}
          onSave={setApiConfig}
        />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-16 bg-slate-900 flex flex-col items-center py-6 gap-6 z-20 shadow-xl">
         <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30 shrink-0">
            <Film className="text-white w-6 h-6" />
         </div>
         
         <div className="flex-1 flex flex-col gap-4 w-full items-center pt-4">
            <button 
              onClick={() => setProject(null)}
              className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              title="返回首页"
            >
              <Home className="w-6 h-6" />
            </button>
         </div>

         <div className="flex flex-col gap-4 w-full items-center pb-4">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              title="设置"
            >
              <Settings className="w-6 h-6" />
            </button>
         </div>
      </aside>

      {/* Main Content */}
       <main className="flex-1 overflow-hidden flex flex-col relative">
          {/* Header */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
             <div className="flex items-center gap-4">
                <button 
                  onClick={() => setProject(null)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                   <h1 className="text-xl font-bold text-slate-800">{project.dishName}</h1>
                   <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">{project.difficulty}</span>
                      <span>•</span>
                      <span>{project.targetDurationSeconds} 秒</span>
                   </div>
                </div>
             </div>
             
             <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10">
                <Download className="w-4 h-4" />
                导出脚本
             </button>
          </header>

          <div className="flex-1 overflow-hidden p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-full min-h-0">
               <Timeline 
                 steps={project.steps} 
                 onUpdateStep={updateStep}
                 onGenerateVideo={handleGenerateVideo}
               />
            </div>
            <div className="h-full min-h-0">
               <IngredientPanel 
                 ingredients={project.ingredients} 
                 setIngredients={updateIngredients}
               />
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