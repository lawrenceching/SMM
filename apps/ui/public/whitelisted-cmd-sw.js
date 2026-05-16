/* global self */
/** Shared arg builders + executeCmd fetch helper for download-service-worker.js */

const VIDEOCAPTIONER_DUMMY_API_KEY = 'dummykey'
const YTDLP_DOWNLOAD_ALLOWED_ARGS = ['--write-thumbnail', '--embed-thumbnail', '--embed-metadata']

function ensureVcApiKey(args) {
  if (!args.includes('--api-key')) {
    args.push('--api-key', VIDEOCAPTIONER_DUMMY_API_KEY)
  }
}

function buildYtdlpDownloadArgs(input) {
  const outputTemplate = `${input.folder.replace(/\\/g, '/')}/%(title)s [%(id)s].%(ext)s`
  const args = ['--output', outputTemplate, '--print', 'after_move:filepath']
  if (input.format && String(input.format).trim()) {
    args.push('-f', String(input.format).trim())
  }
  args.push(input.url)
  if (input.args && input.args.length) {
    for (const a of input.args) {
      if (!YTDLP_DOWNLOAD_ALLOWED_ARGS.includes(a)) {
        throw new Error(`Disallowed yt-dlp arg: ${a}`)
      }
    }
    args.push(...input.args)
  }
  return args
}

function parseYtdlpDownloadStdout(stdout) {
  const lines = stdout.trim().split('\n').filter((l) => l.trim())
  return lines[lines.length - 1]?.trim() || ''
}

function buildVcTranscribeArgs(mediaPath, vc) {
  const args = ['transcribe', mediaPath, '--asr', vc?.asr || 'bijian']
  if (vc?.language) args.push('--language', String(vc.language).trim())
  if (vc?.wordTimestamps === true) args.push('--word-timestamps')
  args.push('--format', vc?.format || 'srt')
  ensureVcApiKey(args)
  return args
}

function buildVcTranslateArgs(body) {
  const args = [
    'subtitle',
    body.subtitlePath,
    '--translator',
    body.translator,
    '--target-language',
    String(body.targetLanguage).trim(),
    '--no-optimize',
    '--no-split',
  ]
  if (body.reflect === true) args.push('--reflect')
  if (body.layout) args.push('--layout', body.layout)
  if (body.translator === 'llm' && body.llm && body.llm.apiKey) {
    args.push('--api-key', body.llm.apiKey)
    if (body.llm.apiBase) args.push('--api-base', body.llm.apiBase)
    if (body.llm.model) args.push('--model', body.llm.model)
  }
  ensureVcApiKey(args)
  return args
}

function buildVcSynthesizeArgs(body) {
  const args = ['synthesize', body.videoPath, '-s', body.subtitlePath]
  if (body.subtitleMode) args.push('--subtitle-mode', body.subtitleMode)
  if (body.quality) args.push('--quality', body.quality)
  if (body.style) args.push('--style', body.style)
  if (body.renderMode) args.push('--render-mode', body.renderMode)
  if (body.layout) args.push('--layout', body.layout)
  ensureVcApiKey(args)
  return args
}

function buildVcProcessArgs(mediaPath, data) {
  const args = ['process', mediaPath]
  args.push('--asr', data.asr || 'bijian')
  if (data.language) args.push('--language', String(data.language).trim())
  if (data.wordTimestamps === true) args.push('--word-timestamps')
  args.push('--format', data.format || 'srt')
  if (data.noOptimize === true) args.push('--no-optimize')
  if (data.noSplit === true) args.push('--no-split')
  if (data.noTranslate === true) {
    args.push('--no-translate')
  } else if (data.translator && data.targetLanguage) {
    args.push('--translator', data.translator)
    args.push('--target-language', String(data.targetLanguage).trim())
    if (data.reflect === true) args.push('--reflect')
    if (data.layout) args.push('--layout', data.layout)
    if (data.prompt) args.push('--prompt', String(data.prompt).trim())
    if (data.translator === 'llm' && data.llm && data.llm.apiKey) {
      args.push('--api-key', data.llm.apiKey)
      if (data.llm.apiBase) args.push('--api-base', data.llm.apiBase)
      if (data.llm.model) args.push('--model', data.llm.model)
    }
  }
  if (data.noSynthesize === true) {
    args.push('--no-synthesize')
  } else {
    if (data.subtitleMode) args.push('--subtitle-mode', data.subtitleMode)
    if (data.quality) args.push('--quality', data.quality)
    if (data.style) args.push('--style', data.style)
    if (data.renderMode) args.push('--render-mode', data.renderMode)
    if (data.synthesizeLayout) args.push('--layout', data.synthesizeLayout)
  }
  ensureVcApiKey(args)
  return args
}

async function executeCmdViaFetch(command, args, options) {
  const headers = { 'Content-Type': 'application/json' }
  if (options?.timeoutMs) headers['X-Timeout'] = String(options.timeoutMs)
  if (options?.executionId) headers['X-Command-Execution-Id'] = options.executionId

  const res = await fetch('/api/executeCmd', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ command, args }),
    signal: options?.signal,
  })

  const executionId = res.headers.get('X-Command-Execution-Id')
  const logRelativePath = res.headers.get('X-Command-Log-Path')

  if (!res.ok) {
    let err = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j.error) err = j.error
    } catch (_) {}
    return { success: false, error: err, executionId, logRelativePath }
  }

  const reader = res.body?.getReader()
  if (!reader) {
    return { success: false, error: 'Response body not readable', executionId, logRelativePath }
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let stdout = ''
  let stderr = ''
  let exitCode = null
  let systemMessage

  while (true) {
    const { done, value } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const msg = JSON.parse(line)
        if (msg.type === 'stdout') stdout += msg.data
        else if (msg.type === 'stderr') stderr += msg.data
        else if (msg.type === 'system') {
          if (msg.data.event === 'exit') exitCode = msg.data.code ?? null
          else if (msg.data.event === 'error') systemMessage = msg.data.message
          else if (msg.data.event === 'timeout') systemMessage = 'command timed out'
        }
      } catch (_) {}
    }
    if (done) break
  }

  const success = exitCode === 0 && !systemMessage
  let error
  if (!success) {
    const tail = stderr.trim().slice(0, 500)
    error = systemMessage || `${command} exited with code ${exitCode ?? 'unknown'}${tail ? `: ${tail}` : ''}`
  }

  return { success, error, stdout, stderr, exitCode, executionId, logRelativePath }
}

self.whitelistedCmdSw = {
  buildYtdlpDownloadArgs,
  parseYtdlpDownloadStdout,
  buildVcTranscribeArgs,
  buildVcTranslateArgs,
  buildVcSynthesizeArgs,
  buildVcProcessArgs,
  executeCmdViaFetch,
}
