import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'prompt-translator',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 5,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 5 },
    view: {},
  },
} as const

test('Polish replaces the draft and Undo restores it', async ($, on) => {
  let draft = '帮我修复登录页面的bug'
  let asked = ''
  on('prompt.read', () => ({ value: { text: draft, cursor: draft.length } }))
  on('prompt.fill', (_, e) => {
    draft = e.text
    return { isFilled: true }
  })
  on('model.complete', (_, e) => {
    asked = JSON.stringify(e)
    return {
      value: {
        isAnswered: true,
        text: 'Please fix the bug on the login page.',
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    } as const
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'mode-polish' })
  expect(asked).toContain('帮我修复登录页面的bug')
  expect(draft).toBe('Please fix the bug on the login page.')

  await ui.press({ key: 'undo' })
  expect(draft).toBe('帮我修复登录页面的bug')
  await ui.unmount()
})

test('an empty draft is left alone', async ($, on) => {
  let called = false
  on('prompt.read', () => ({ value: { text: '  ', cursor: 0 } }))
  on('model.complete', () => {
    called = true
    return { value: { isAnswered: false, reason: 'empty-reply', usage: { input_tokens: 0, output_tokens: 0 } } } as const
  })
  on('ui.toast', () => ({ value: undefined }))

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'mode-translate' })
  expect(called).toBe(false)
  await ui.unmount()
})

test('an English draft is sent to Chinese and only the tagged result is kept', async ($, on) => {
  let draft = 'please fix the login bug'
  let asked = ''
  on('prompt.read', () => ({ value: { text: draft, cursor: draft.length } }))
  on('prompt.fill', (_, e) => {
    draft = e.text
    return { isFilled: true }
  })
  on('model.complete', (_, e) => {
    asked = JSON.stringify(e)
    return {
      value: {
        isAnswered: true,
        text: 'The draft is mostly English, so the output should be in Simplified Chinese.\n<result>请修复登录页面的 bug。</result>',
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    } as const
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'mode-polish' })
  expect(asked).toContain('Simplified Chinese')
  expect(draft).toBe('请修复登录页面的 bug。')
  await ui.unmount()
})

test('Polish only uses the conversation and does not translate', async ($, on) => {
  let draft = 'fix that bug we talked about'
  let forked = ''
  on('prompt.read', () => ({ value: { text: draft, cursor: draft.length } }))
  on('prompt.fill', (_, e) => {
    draft = e.text
    return { isFilled: true }
  })
  on('model.fork', (_, e) => {
    forked = e.prompt
    return {
      value: {
        isAnswered: true,
        text: '<result>Fix the null-session crash in src/auth.ts that we discussed.</result>',
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    } as const
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'mode-refine' })
  expect(forked).toContain('Do not translate')
  expect(forked).toContain('fix that bug we talked about')
  expect(draft).toBe('Fix the null-session crash in src/auth.ts that we discussed.')
  await ui.unmount()
})

test('Polish only falls back to Haiku before any conversation', async ($, on) => {
  let draft = 'make it faster'
  let model = ''
  on('prompt.read', () => ({ value: { text: draft, cursor: draft.length } }))
  on('prompt.fill', (_, e) => {
    draft = e.text
    return { isFilled: true }
  })
  on('model.fork', () => ({ value: { isAnswered: false, reason: 'nothing-to-fork' } } as const))
  on('model.complete', (_, e) => {
    model = e.model
    return { value: { isAnswered: true, text: '<result>Make it faster.</result>', usage: { input_tokens: 1, output_tokens: 1 } } } as const
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'mode-refine' })
  expect(model).toBe('haiku')
  expect(draft).toBe('Make it faster.')
  await ui.unmount()
})

test('three icons are always shown in fixed order and each runs its own mode', async ($, on) => {
  let asked = ''
  on('prompt.read', () => ({ value: { text: 'hi', cursor: 2 } }))
  on('prompt.fill', () => ({ isFilled: true }))
  on('model.complete', (_, e) => {
    asked = e.system ?? ''
    return { value: { isAnswered: true, text: '<result>你好</result>', usage: { input_tokens: 1, output_tokens: 1 } } } as const
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const texts = async () => Promise.all(['polish', 'translate', 'refine'].map(async id => (await ui.find({ key: `mode-${id}` }))?.text))
  expect(await texts()).toEqual(['文⇄A✦', '文⇄A', '✦'])

  await ui.press({ key: 'mode-translate' })
  expect(asked).toContain('Translate it faithfully')
  expect(await texts()).toEqual(['文⇄A✦', '文⇄A', '✦'])
  await ui.unmount()
})
