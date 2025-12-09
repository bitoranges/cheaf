
export enum Difficulty {
  Easy = "入门",
  Medium = "中级",
  Hard = "高级",
  Professional = "专业"
}

export interface Ingredient {
  name: string;
  amount: string;
  notes?: string;
}

export interface ScriptStep {
  id: string;
  order: number;
  title: string;
  description: string; // The script/voiceover text
  durationSeconds: number; // Duration of this specific clip
  startTimeSeconds: number; // Calculated start time
  shotType: '特写' | '中景' | '全景' | '俯拍';
  cameraMovement: '固定' | '摇镜头' | '推近' | '拉远' | '跟拍';
  ingredientsUsed: string[]; // Names of ingredients used in this step
  
  // Video Generation Status
  videoStatus?: 'idle' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  videoTaskId?: string;
}

export interface VideoProject {
  id: string;
  dishName: string;
  targetDurationSeconds: number; // Changed from Minutes to Seconds
  difficulty: Difficulty;
  createdAt: string;
  steps: ScriptStep[];
  ingredients: Ingredient[];
  status: 'draft' | 'generating' | 'ready';
}

export interface ApiConfig {
  runwayKey: string;
  pikaKey: string;
  // Jimeng / Volcengine
  jimengAccessKey: string;
  jimengSecretKey: string;
  // Backend Proxy URL (Optional, to bypass CORS)
  backendUrl?: string;
}
