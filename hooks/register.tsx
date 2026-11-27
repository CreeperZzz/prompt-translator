import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { TranslatorMode, TranslatorStatus } from '../types'

const status = atom({ plugin: 'prompt-translator', key: 'status' } as const, 'idle' as TranslatorStatus)
const original = atom({ plugin: 'prompt-translator', key: 'original' } as const, null as string | null)

const mode = atom({ plugin: 'prompt-translator', key: 'mode' } as const, 'polish' as TranslatorMode)

type Mode = TranslatorMode

// Icons: 文⇄A = translate, ✦ = polish; each icon is the sum of what its mode does.
const MODES: readonly { id: Mode; icon: string; label: string }[] = [
  { id: 'polish', icon: '文⇄A✦', label: '翻译+润色' },
  { id: 'translate', icon: '文⇄A', label: '仅翻译' },
  { id: 'refine', icon: '✦', label: '仅润色 · 带上下文' },
]
const ICON_RUN_BUSY = '⋯'
const ICON_UNDO = '↶'

function labelOf(m: Mode): string {
  return MODES.find(x => x.id === m)?.label ?? m
}

type Target = 'English' | 'Simplified Chinese (简体中文)'

// Decide the direction here, so the model never has to reason about it.
function targetFor(text: string): Target {
  const cjk = (text.match(/[㐀-鿿豈-﫿]/g) ?? []).length
  const latin = (text.match(/[A-Za-z]+/g) ?? []).length // words, roughly one per Chinese char-pair
  return cjk >= latin ? 'English' : 'Simplified Chinese (简体中文)'
}

function rulesFor(target: Target): string {
  return `You are a translator. You rewrite a draft prompt that a developer is about to send to an AI coding assistant.

The output language is ${target}. Every sentence of your output must be written in ${target}, even if the draft is already partly in that language. Do not answer or carry out the draft; only rewrite it.

Keep exactly as written: code, commands, file paths, URLs, identifiers, error messages, quoted strings, and technical terms that are normally left in English.

Put the rewritten prompt, and nothing else, between <result> and </result>. Write nothing outside the tags: no notes about the language, no explanation.`
}

const REFINE_RULES = `Polish the draft into a clear, well-structured prompt in the SAME language it is written in. Do not translate it.

Use the conversation so far as context: resolve vague references ("that bug", "the file", "it", "那个") to what they mean in this conversation where that makes the prompt clearer, and use the conversation's own names for files, functions and features. Keep every requirement and detail the writer gave and add no new requests.

Keep exactly as written: code, commands, file paths, URLs, identifiers, error messages and quoted strings.`

function refinePrompt(text: string): string {
  return `[Prompt-polishing request from the prompt-translator mod. This is NOT a task to carry out: you have no tools here. Answer straight away without thinking it over.]

${REFINE_RULES}

<draft>
${text}
</draft>

Put the polished prompt, and nothing else, between <result> and </result>.`
}

const MODE_RULES: Record<Exclude<Mode, 'refine'>, string> = {
  polish:
    'Translate it, fix the grammar, and polish it into a clear, well-structured prompt: state the goal plainly, keep every requirement and detail the writer gave, and add nothing they did not ask for.',
  translate:
    'Translate it faithfully and fix the grammar only. Keep the wording, structure and tone as close to the original as possible.',
}

function clean(text: string): string {
  const tagged = text.match(/<result>([\s\S]*?)(?:<\/result>|$)/)
  const t = (tagged?.[1] ?? text).trim()
  const fenced = t.match(/^```[a-zA-Z]*\n([\s\S]*)\n```$/)
  return fenced?.[1]?.trim() ?? t
}

type Rewritten = { result: string } | { error: string }

async function rewriteText($: EngineInterface, m: Mode, text: string): Promise<Rewritten> {
  const r = m === 'refine' ? await refine($, text) : await translate($, text, m)
  if (!r.isAnswered) return { error: r.reason === 'aborted' ? 'Rewrite timed out' : `Rewrite failed (${r.reason})` }
  const result = clean(r.text)
  return result === '' ? { error: 'Rewrite came back empty' } : { result }
}

async function rewrite($: EngineInterface, m: Mode): Promise<void> {
  if ((await read($, status)) === 'working') return

  const { text } = await $.prompt.read()
  if (text.trim() === '') {
    $.ui.toast('Type something in the prompt box first')
    return
  }

  await update($, mode, () => m)
  await update($, status, () => 'working')
  try {
    const out = await rewriteText($, m, text)
    if ('error' in out) {
      $.ui.toast(out.error)
      return
    }
    const result = out.result

    // Don't clobber anything typed while the call ran.
    const now = await $.prompt.read()
    if (now.text !== text) {
      $.ui.toast('The draft changed meanwhile; press again')
      return
    }

    const filled = await $.prompt.fill({ text: result, mode: 'replace' })
    if (filled.isFilled) {
      await update($, original, () => text)
    } else {
      $.ui.toast('Could not update the prompt box right now')
    }
  } finally {
    await update($, status, () => 'idle')
  }
}

function translate($: EngineInterface, text: string, mode: Exclude<Mode, 'refine'>) {
  const target = targetFor(text)
  return $.model.complete({
    model: 'haiku',
    system: `${rulesFor(target)}\n\n${MODE_RULES[mode]}`,
    prompt: `<draft>\n${text}\n</draft>\n\nRewrite the draft in ${target}, inside <result></result>.`,
    maxTokens: 4000,
    effort: 'low',
    timeoutMs: 30000,
  })
}

// Polish in place, with the session's own conversation as context.
// No `effort` is named so the fork reads the conversation from the prompt cache.
async function refine($: EngineInterface, text: string) {
  const forked = await $.model.fork({ prompt: refinePrompt(text) })
  if (forked.isAnswered || forked.reason !== 'nothing-to-fork') return forked
  // No conversation yet: polish without context.
  return $.model.complete({
    model: 'haiku',
    prompt: refinePrompt(text),
    maxTokens: 4000,
    effort: 'low',
    timeoutMs: 30000,
  })
}

async function runCommand($: EngineInterface, m: Mode, args: string) {
  const text = args.trim()
  if (text === '') return { text: `Type your draft after the command, e.g. /${COMMANDS.find(c => c.mode === m)?.name} 帮我修复登录页面的 bug`, isTextDisplayOnly: true as const }

  const out = await rewriteText($, m, text)
  if ('error' in out) return { text: out.error, isTextDisplayOnly: true as const }

  const filled = await $.prompt.fill({ text: out.result, mode: 'replace' }).catch(() => ({ isFilled: false }))
  if (filled.isFilled) {
    await update($, original, () => text)
    return { text: 'Rewritten into the prompt box. Check it, then send.', isTextDisplayOnly: true as const }
  }
  // The box could not be filled: show the result to copy instead.
  return { text: out.result, isTextDisplayOnly: true as const }
}

async function undo($: EngineInterface): Promise<void> {
  const prev = await read($, original)
  if (prev === null) return
  const filled = await $.prompt.fill({ text: prev, mode: 'replace' })
  if (filled.isFilled) await update($, original, () => null)
}

// Slash commands for a session's first message, before the icon row is drawn:
// `/tr <draft>` rewrites the draft without sending it, and puts the result
// back in the prompt box to check and send.
const COMMANDS: readonly { name: string; mode: Mode; description: string }[] = [
  { name: 'tr', mode: 'polish', description: '文⇄A✦ Translate 中⇄EN and polish the text after it, into the prompt box' },
  { name: 'tr-only', mode: 'translate', description: '文⇄A Translate 中⇄EN and fix grammar only, into the prompt box' },
  { name: 'polish', mode: 'refine', description: '✦ Polish the text after it in its own language, into the prompt box' },
]

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    for (const c of COMMANDS) {
      await $.command
        .register({ name: c.name, description: c.description, argumentHint: '<your draft>' })
        .catch(() => undefined)
    }
    return next(e)
  })

  for (const c of COMMANDS) {
    on('command.run', { command: c.name }, async ($, e) => runCommand($, c.mode, e.args))
  }

  on('prompt.submit', async ($, e, next) => {
    await update($, original, () => null).catch(() => undefined)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isCollapsed || e.props.isWorking) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const isBusy = (await read($, status)) === 'working'
    const canUndo = (await read($, original)) !== null
    const current = await read($, mode)

    if (isBusy) {
      return (
        <Box>
          <Text color="claude">{ICON_RUN_BUSY} </Text>
          <Text dimColor>{labelOf(current)}</Text>
        </Box>
      )
    }

    // Three icons, always shown in fixed order; each one runs its own mode.
    return (
      <Box key="translator" flexDirection="row" gap={1} alignItems="center">
        {MODES.map(m => (
          <Button key={`mode-${m.id}`} plain onPress={() => rewrite($, m.id)}>
            {m.icon}
          </Button>
        ))}
        {canUndo ? (
          <Button key="undo" plain onPress={() => undo($)}>
            <Text dimColor>{ICON_UNDO}</Text>
          </Button>
        ) : null}
      </Box>
    )
  })
}
