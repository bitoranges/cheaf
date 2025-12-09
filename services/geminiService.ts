import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Difficulty, VideoProject, ScriptStep, Ingredient } from "../types";

// 定义返回数据的 Schema
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "步骤简短标题" },
          description: { type: Type.STRING, description: "旁白文案和详细动作描述" },
          durationSeconds: { type: Type.INTEGER, description: "预估时长（秒）" },
          shotType: { type: Type.STRING, enum: ['特写', '中景', '全景', '俯拍'] },
          cameraMovement: { type: Type.STRING, enum: ['固定', '摇镜头', '推近', '拉远', '跟拍'] },
          ingredientsUsed: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["title", "description", "durationSeconds", "shotType", "cameraMovement"]
      }
    },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          amount: { type: Type.STRING },
          notes: { type: Type.STRING }
        },
        required: ["name", "amount"]
      }
    }
  },
  required: ["steps", "ingredients"]
};

// 兜底脚本生成器（当 API 失败时使用）
const getFallbackScript = (dishName: string, durationSeconds: number): Partial<VideoProject> => {
  const stepCount = 5;
  const stepDuration = Math.floor(durationSeconds / stepCount);
  
  return {
    steps: [
      {
        id: crypto.randomUUID(),
        order: 1,
        title: "食材展示",
        description: `镜头缓慢扫过制作${dishName}所需的所有新鲜食材，光线明亮自然，展现食材的纹理和色泽。`,
        durationSeconds: stepDuration,
        startTimeSeconds: 0,
        shotType: '中景',
        cameraMovement: '推近',
        ingredientsUsed: [`${dishName}主料`]
      },
      {
        id: crypto.randomUUID(),
        order: 2,
        title: "备菜处理",
        description: `特写展示刀工处理${dishName}的主要食材，动作利落，声音清脆，展现专业的烹饪准备过程。`,
        durationSeconds: stepDuration,
        startTimeSeconds: stepDuration,
        shotType: '特写',
        cameraMovement: '固定',
        ingredientsUsed: []
      },
      {
        id: crypto.randomUUID(),
        order: 3,
        title: "烹饪过程",
        description: `热锅凉油，食材入锅的瞬间，烟火气升腾，通过特写展示${dishName}在锅中的色泽变化，伴随着滋滋的煎炒声。`,
        durationSeconds: stepDuration,
        startTimeSeconds: stepDuration * 2,
        shotType: '特写',
        cameraMovement: '摇镜头',
        ingredientsUsed: []
      },
      {
        id: crypto.randomUUID(),
        order: 4,
        title: "调味收汁",
        description: `加入调味料，汤汁逐渐变得浓郁，颜色诱人，展示${dishName}即将出锅的完美状态，令人垂涎欲滴。`,
        durationSeconds: stepDuration,
        startTimeSeconds: stepDuration * 3,
        shotType: '特写',
        cameraMovement: '推近',
        ingredientsUsed: []
      },
      {
        id: crypto.randomUUID(),
        order: 5,
        title: "完美摆盘",
        description: `将制作好的${dishName}盛入精致的盘中，最后撒上装饰（如葱花或香菜），画面定格在色香味俱全的成品上。`,
        durationSeconds: durationSeconds - (stepDuration * 4),
        startTimeSeconds: stepDuration * 4,
        shotType: '全景',
        cameraMovement: '拉远',
        ingredientsUsed: []
      }
    ],
    ingredients: [
      { name: "主食材", amount: "适量", notes: "根据口味调整" },
      { name: "配料", amount: "少许", notes: "装饰用" }
    ]
  };
};

export const generateCookingScript = async (
  dishName: string,
  durationSeconds: number,
  difficulty: Difficulty
): Promise<Partial<VideoProject>> => {
  
  // 即使没有配置环境变量，也给予一个占位符，防止初始化崩溃，依靠下方的 try-catch 进入兜底逻辑
  const apiKey = process.env.API_KEY || "dummy_key"; 
  
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    const prompt = `
      你是一位专业的厨师和视频导演助手。
      请为这道菜创建一个详细的烹饪视频脚本: "${dishName}"。
      
      目标视频总时长: 严格控制在 ${durationSeconds} 秒左右。
      难度等级: ${difficulty}。
      
      要求:
      1. 将烹饪过程分解为逻辑清晰的视频步骤。
      2. 为每个步骤分配具体的时长（秒）。所有步骤时长总和应接近 ${durationSeconds} 秒。
      3. 为每一步建议最佳的镜头景别 (ShotType: '特写', '中景', '全景', '俯拍') 和 运镜方式 (CameraMovement: '固定', '摇镜头', '推近', '拉远', '跟拍')。
      4. 在 ingredients 数组中列出所需的所有食材及精确计量。
      5. 在每个步骤的 'ingredientsUsed' 字段中，仅列出该步骤实际使用的食材名称。
      6. 所有输出内容必须使用中文。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.4, 
      },
    });

    if (!response.text) {
      throw new Error("API returned empty response");
    }

    const text = response.text;
    const data = JSON.parse(text);
    
    let currentTime = 0;
    const processedSteps: ScriptStep[] = data.steps.map((step: any, index: number) => {
      const s: ScriptStep = {
        id: crypto.randomUUID(),
        order: index + 1,
        title: step.title,
        description: step.description,
        durationSeconds: step.durationSeconds,
        startTimeSeconds: currentTime,
        shotType: step.shotType,
        cameraMovement: step.cameraMovement,
        ingredientsUsed: step.ingredientsUsed || []
      };
      currentTime += step.durationSeconds;
      return s;
    });

    const processedIngredients: Ingredient[] = data.ingredients.map((ing: any) => ({
      name: ing.name,
      amount: ing.amount,
      notes: ing.notes || ""
    }));

    return {
      steps: processedSteps,
      ingredients: processedIngredients
    };

  } catch (error) {
    console.log("Gemini API 调用失败（可能是网络原因或Key无效），切换至离线兜底模式。", error);
    // 核心逻辑：无论发生什么错误，都返回兜底数据，确保用户能看到二级页面
    return getFallbackScript(dishName, durationSeconds);
  }
};