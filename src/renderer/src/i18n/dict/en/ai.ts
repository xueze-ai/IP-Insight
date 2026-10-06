import type { zhAi } from '../zh/ai'

export const enAi: typeof zhAi = {
  title: 'AI Network Environment Analysis',
  emptyDesc: 'Complete a full detection first; the AI will then analyze results from all data sources.',
  startDetection: 'Start full detection',
  notConfigured: 'No AI provider configured. Detection data is ready ({n} data sources). Fill in an API key for any provider in Settings to generate the analysis.',
  goSettings: 'Go to AI provider settings',
  kicker: 'AI Analysis · Based on {n} data sources',
  desc: 'Send all normalized detection data and the multi-source cross-validation summary to {provider}{model}. AI only analyzes, summarizes, and explains; raw data can be cross-checked per source on each page.',
  modelSuffix: ' ({model})',
  generate: 'Generate analysis',
  analyzing: 'Analyzing…',
  regenerate: 'Regenerate',
  copyReport: 'Copy report',
  modelSettings: 'Model & parameter settings',
  failed: 'Analysis failed',
  failedHint: 'Common causes: invalid API key / insufficient balance / wrong model name / provider unreachable. Use "Test connection" in Settings to troubleshoot.',
  stage: {
    streaming: 'Streaming… elapsed {elapsed}s · {chars} characters written',
    connected: 'Connected to provider, waiting for the first token… elapsed {elapsed}s (reasoning models such as deepseek-reasoner take longer before the first token; you can keep using other pages meanwhile — the analysis will not be interrupted or restarted)',
    connecting: 'Connecting to provider and sending detection data… elapsed {elapsed}s'
  },
  reportHint: 'The report will include: a quick verdict (overall score / nativeness / risk level / VPN / Proxy / Tor / residential / datacenter / shared egress), [AI comprehensive analysis] [multi-source consistency] [anomalies] [risk notes] [suitable scenarios] [unsuitable scenarios]. Conflicting multi-source items are explicitly marked "currently unconfirmed". Switching pages will not lose a generated analysis.',
  ask: {
    title: 'Scenario Q&A',
    desc: 'Wondering if your current IP fits a specific use? Tap a scenario below or ask directly — the AI will answer with this scan\'s data: does it work, what\'s wrong, and what kind of node to switch to.',
    scNetflix: 'Netflix',
    scGaming: 'Gaming',
    scChatgpt: 'ChatGPT',
    scEcommerce: 'E-commerce',
    qNetflix: 'Is this IP good for Netflix?',
    qGaming: 'Is this IP good for gaming?',
    qChatgpt: 'Is this IP good for ChatGPT?',
    qEcommerce: 'Is this IP good for cross-border e-commerce?',
    placeholder: 'e.g. Is this IP good for Netflix?',
    button: 'Ask AI',
    asking: 'AI is thinking…',
    waiting: 'AI is thinking, please wait… (elapsed {elapsed}s)',
    streaming: 'Writing the answer… (elapsed {elapsed}s)',
    error: 'Failed: {message}'
  }
}
