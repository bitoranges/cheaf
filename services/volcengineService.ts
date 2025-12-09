import { ApiConfig } from "../types";

export const submitVideoTask = async (config: ApiConfig, prompt: string) => {
  if (!config.backendUrl) {
    throw new Error("请先在设置中配置后端 API 地址");
  }

  const baseUrl = config.backendUrl.replace(/\/$/, '');
  const proxyUrl = `${baseUrl}/api/generate_video`;

  try {
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt,
        // 如果客户端填了就传，没填传空字符串，后端会判断
        access_key: config.jimengAccessKey || "",
        secret_key: config.jimengSecretKey || "",
        ratio: "16:9"
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `服务器请求失败 (${response.status})`;
      try {
        const jsonErr = JSON.parse(errText);
        if (jsonErr.detail) errMsg = jsonErr.detail;
      } catch (e) {}
      throw new Error(errMsg);
    }

    const data = await response.json();
    
    // 适配后端返回结构
    // 成功时 Volcengine 通常返回 { code: 10000, data: { ... } }
    if (data.code === 10000 || (data.ResponseMetadata && !data.ResponseMetadata.Error)) {
        // 尝试从不同的返回结构中获取 task_id
        const taskId = data.data?.task_id || data.Result?.task_id;
        if (taskId) return taskId;
    }
    
    // 处理业务级错误
    if (data.ResponseMetadata && data.ResponseMetadata.Error) {
        throw new Error(`API Error: ${data.ResponseMetadata.Error.Message}`);
    }

    if (data.detail) {
        throw new Error(data.detail);
    }

    throw new Error(data.message || `未获取到任务 ID (Code: ${data.code || 'Unknown'})`);

  } catch (e: any) {
    console.error("Video Task Submission Failed:", e);
    throw e;
  }
};

export const checkTaskStatus = async (config: ApiConfig, taskId: string) => {
  if (!config.backendUrl) return { status: 'failed' };

  const baseUrl = config.backendUrl.replace(/\/$/, '');
  const proxyUrl = `${baseUrl}/api/check_status`;

  try {
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: taskId,
        access_key: config.jimengAccessKey || "",
        secret_key: config.jimengSecretKey || ""
      })
    });
    
    const data = await response.json();
    
    // 简单的状态映射逻辑，具体视后端实现而定
    // 假设后端透传了火山的结构
    const status = data.data?.status || data.Result?.status;
    const url = data.data?.resp_data || data.Result?.resp_data;

    if (status === 'succeeded' || status === 'SUCCESS') {
        return { status: 'completed', url: url };
    } else if (status === 'failed' || status === 'FAILED') {
      return { status: 'failed' };
    } else {
      return { status: 'running' };
    }
  } catch (e) {
    console.error("Status Check Failed:", e);
    return { status: 'running' };
  }
};
