import type { AiProviderId } from './types'

// =============================================================
// AI 提供商元数据（主进程与渲染层共用）
// 全部走 OpenAI 兼容 Chat Completions 协议；默认 Base URL / 模型可改。
// =============================================================

export interface AiProviderMeta {
  id: AiProviderId
  name: string
  nameEn: string
  desc: string
  descEn: string
  tag?: string
  tagEn?: string
  defaultBaseUrl: string
  defaultModel: string
  modelHint: string
  modelHintEn: string
}

export const AI_PROVIDER_META: AiProviderMeta[] = [
  {
    id: 'qwen',
    nameEn: 'Qwen (Alibaba Cloud)',
    name: '通义千问（阿里云）',
    descEn: 'Stable direct connection in China, good Chinese; DashScope OpenAI-compatible API',
    desc: '国内直连稳定，中文理解好；DashScope OpenAI 兼容接口',
    tagEn: 'Recommended',
    tag: '推荐',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    modelHintEn: 'e.g. qwen-plus / qwen-max / qwen-turbo',
    modelHint: '如 qwen-plus / qwen-max / qwen-turbo'
  },
  {
    id: 'deepseek',
    nameEn: 'DeepSeek',
    name: 'DeepSeek',
    descEn: 'Cost-effective Chinese model, OpenAI-compatible API',
    desc: '高性价比国产模型，OpenAI 兼容接口',
    tagEn: 'Recommended',
    tag: '推荐',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    modelHintEn: 'e.g. deepseek-chat / deepseek-reasoner',
    modelHint: '如 deepseek-chat / deepseek-reasoner'
  },
  {
    id: 'doubao',
    nameEn: 'Doubao (Volcengine)',
    name: '豆包（火山方舟）',
    descEn: 'ByteDance Doubao; fill in the inference endpoint ID or model name',
    desc: '字节豆包；模型栏填推理接入点 ID 或模型名',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-1-5-pro-32k-250115',
    modelHintEn: 'Inference endpoint ID (ep-...) or model name',
    modelHint: '推理接入点 ID（ep-…）或模型名'
  },
  {
    id: 'openai',
    nameEn: 'OpenAI',
    name: 'OpenAI',
    descEn: 'GPT series; requires direct network access to api.openai.com',
    desc: 'GPT 系列模型；需网络环境可直达 api.openai.com',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    modelHintEn: 'e.g. gpt-4o-mini / gpt-4o',
    modelHint: '如 gpt-4o-mini / gpt-4o'
  },
  {
    id: 'ollama',
    nameEn: 'Ollama (local)',
    name: 'Ollama（本地）',
    descEn: 'Local open-source model service, data never leaves your machine; no API key needed',
    desc: '本地开源模型服务，数据不出本机；无需 API Key',
    tagEn: 'Local',
    tag: '本地',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:7b',
    modelHintEn: 'Check installed models via `ollama list`, e.g. qwen2.5:7b / llama3.1',
    modelHint: 'ollama list 查看已安装模型，如 qwen2.5:7b / llama3.1'
  },
  {
    id: 'zhipu',
    nameEn: 'Zhipu GLM',
    name: '智谱 GLM',
    descEn: 'Zhipu open platform, OpenAI-compatible API',
    desc: '智谱开放平台，OpenAI 兼容接口',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-air',
    modelHintEn: 'e.g. glm-4-air / glm-4-plus',
    modelHint: '如 glm-4-air / glm-4-plus'
  },
  {
    id: 'moonshot',
    nameEn: 'Moonshot',
    name: 'Moonshot（月之暗面）',
    descEn: 'Same family as Kimi, OpenAI-compatible API',
    desc: 'Kimi 同源模型，OpenAI 兼容接口',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    modelHintEn: 'e.g. moonshot-v1-8k / v1-32k / v1-128k',
    modelHint: '如 moonshot-v1-8k / v1-32k / v1-128k'
  },
  {
    id: 'siliconflow',
    nameEn: 'SiliconFlow',
    name: '硅基流动 SiliconFlow',
    descEn: 'Inference platform aggregating open-source models, OpenAI-compatible API',
    desc: '聚合多家开源模型的推理平台，OpenAI 兼容接口',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    modelHintEn: 'e.g. Qwen/Qwen2.5-7B-Instruct, THUDM/glm-4-9b-chat',
    modelHint: '如 Qwen/Qwen2.5-7B-Instruct、THUDM/glm-4-9b-chat'
  },
  {
    id: 'custom',
    nameEn: 'Custom (OpenAI-compatible)',
    name: '自定义（OpenAI 兼容）',
    descEn: 'Any OpenAI Chat Completions-compatible endpoint (self-hosted gateway, etc.)',
    desc: '任何兼容 OpenAI Chat Completions 的接口（自建网关等）',
    defaultBaseUrl: '',
    defaultModel: '',
    modelHintEn: 'Fill in Base URL and model name yourself',
    modelHint: '自行填写 Base URL 与模型名'
  }
]

export function chatCompletionsUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '') + '/chat/completions'
}
