import React, { useState } from 'react';
import { Difficulty } from '../types';
import { ChefHat, Loader2, Sparkles, Clock, BarChart } from 'lucide-react';

interface ProjectSetupProps {
  onGenerate: (dish: string, durationSeconds: number, difficulty: Difficulty) => void;
  isGenerating: boolean;
}

const ProjectSetup: React.FC<ProjectSetupProps> = ({ onGenerate, isGenerating }) => {
  const [dish, setDish] = useState('');
  const [duration, setDuration] = useState(60); // Default 60 seconds
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Medium);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dish.trim()) {
      onGenerate(dish, duration, difficulty);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 p-4">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-brand-600 p-8 text-white text-center">
          <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
            <ChefHat className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Cheaf 1.0</h1>
          <p className="text-brand-100">将简单的菜名转化为专业级的视频拍摄脚本。</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">今天要做什么菜？</label>
            <div className="relative">
              <input
                type="text"
                value={dish}
                onChange={(e) => setDish(e.target.value)}
                placeholder="例如：惠灵顿牛排、麻婆豆腐..."
                className="w-full pl-4 pr-10 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                required
              />
              <Sparkles className="absolute right-3 top-3.5 w-5 h-5 text-brand-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4" /> 目标时长 (秒)
              </label>
              <input
                type="number"
                min={10}
                max={600}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-slate-400">推荐 30-90 秒</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                <BarChart className="w-4 h-4" /> 难度等级
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 bg-white"
              >
                {Object.values(Difficulty).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isGenerating || !dish.trim()}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/20"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                正在生成脚本...
              </>
            ) : (
              <>
                开始制作
                <span className="text-xl">→</span>
              </>
            )}
          </button>
        </form>
        
        <div className="px-8 pb-8 text-center text-xs text-slate-400">
           模块 A-1: 输入与锁定 • V1.0 需求合规
        </div>
      </div>
    </div>
  );
};

export default ProjectSetup;