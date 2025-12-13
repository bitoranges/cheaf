import { ApiConfig } from "../types";

export const submitVideoTask = async (config: ApiConfig, prompt: string) => {
  if (!config.backendUrl) {
    throw new Error("BackendUrlMissing");
  }
  
  // 关键修复：移除 URL 末尾的斜杠，防止生成 //api/generate_video
  const baseUrl = config.backendUrl.replace(/\/+$/, '');
  
  const payload = {
    prompt: prompt,
    access_key: config.jimengAccessKey || undefined,
    secret_key: config.jimengSecretKey || undefined,
    ratio: "16:9"
  };

  try {
    // POST to Backend V1.7
    const response = await fetch(`${baseUrl}/api/generate_video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      // 404 indicates the route /api/generate_video doesn't exist
      if (response.status === 404) throw new Error("BackendOutdated");
      
      // Try to parse detailed error
      try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.detail) throw new Error(errorJson.detail);
      } catch (e) {}
      
      throw new Error(`Backend Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // Parse Volcengine Response
    if (data.code !== 10000 && data.code !== 0) { 
       console.error("Volcengine API Error Data:", data);
       throw new Error(`API Error: ${JSON.stringify(data)}`);
    }
    
    if (data.data && data.data.task_id) {
       return data.data.task_id;
    }
    
    // Fallback
    if (data.task_id) return data.task_id;
       
    throw new Error(`Unexpected response format: ${JSON.stringify(data)}`);
  } catch (error: any) {
    // 捕获网络层面的错误（如 CORS, 域名解析失败等）
    if (error.message === "Failed to fetch") {
      throw new Error("NetworkError: 无法连接到后端服务器。请检查：1. 域名是否正确 2. 也是否是 HTTPS 协议 3. CORS 配置");
    }
    throw error;
  }
};

export const checkTaskStatus = async (config: ApiConfig, taskId: string) => {
  if (!config.backendUrl) throw new Error("BackendUrlMissing");

  const baseUrl = config.backendUrl.replace(/\/+$/, '');

  const payload = {
    task_id: taskId,
    access_key: config.jimengAccessKey || undefined,
    secret_key: config.jimengSecretKey || undefined
  };

  try {
    const response = await fetch(`${baseUrl}/api/check_status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
       const errorText = await response.text();
       if (response.status === 404) throw new Error("BackendOutdated");
       throw new Error(`Backend Error ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.data) {
       return { status: 'generating' };
    }
    
    const status = data.data.status;
    
    if (status === 'Success') {
       const respData = data.data.resp_data; 
       let videoUrl = "";
       
       if (typeof respData === 'string') {
          try {
              const parsed = JSON.parse(respData);
              videoUrl = parsed.video_url || parsed.results?.[0]?.video_url || parsed.data?.video_url;
          } catch (e) {
              console.warn("Failed to parse resp_data json", e);
          }
       } else if (typeof respData === 'object' && respData !== null) {
          videoUrl = respData.video_url || respData.results?.[0]?.video_url;
       }

       if (videoUrl) {
          return { status: 'completed', url: videoUrl };
       } else {
          return { status: 'failed' };
       }
    } else if (status === 'Fail' || status === 'Failed') {
       return { status: 'failed' };
    }
    
    return { status: 'generating' };
  } catch (error: any) {
     if (error.message === "Failed to fetch") {
        console.warn("Polling network error, ignoring...");
        return { status: 'generating' }; // 轮询时的网络抖动不应直接导致失败
     }
     throw error;
  }
};