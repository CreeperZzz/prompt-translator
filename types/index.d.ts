export type TranslatorStatus = 'idle' | 'working'
export type TranslatorMode = 'polish' | 'translate' | 'refine'

declare module 'claude-code' {
  interface PluginState {
    'prompt-translator': {
      status: TranslatorStatus
      original: string | null
      mode: TranslatorMode
    }
  }
}
