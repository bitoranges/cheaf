import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Difficulty, VideoProject, ScriptStep, Ingredient } from "../types";

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

export const generateCookingScript = async (
  dishName: string,
  durationSeconds: number,
  difficulty: Difficulty
): Promise<Partial<VideoProject>> => {
  
  // Initialize the AI client here to ensure safe execution
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

  try {
    let response;
    let lastError;
    const maxRetries = 3;

    // Retry logic to handle transient network errors (Rpc failed)
    for (let i = 0; i < maxRetries; i++) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.4, 
          },
        });
        if (response.text) break;
      } catch (e) {
        console.warn(`Attempt ${i + 1} failed:`, e);
        lastError = e;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("Failed to generate script after retries");
    }

    const text = response.text;
    const data = JSON.parse(text);
    
    // Post-process to add IDs and calculate start times
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
    console.error("Error generating script:", error);
    throw error;
  }
};