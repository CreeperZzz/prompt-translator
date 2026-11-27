# prompt-translator

Three icon buttons in the row above the Claude Code prompt box. Each one rewrites the draft you have typed, in place, before you send it.

| Icon | What it does |
|---|---|
| `文⇄A✦` | Translate between Chinese and English (direction picked automatically), fix grammar and polish it into a clear prompt (Haiku) |
| `文⇄A` | Translate and fix grammar only, keeping your wording (Haiku) |
| `✦` | Polish in the same language, using the current conversation as context (the session's own model) |
| `↶` | Undo: put back your original draft (shown after a rewrite, until you send) |

Code, commands, file paths, URLs, identifiers and error messages are kept as written. If you keep typing while a rewrite runs, the result is discarded instead of overwriting your text.

## First message of a new session

The icon row appears only after a session's first reply. For the first message, type a slash command with your draft after it; the rewrite goes into the prompt box (nothing is sent) for you to check and send:

| Command | Same as |
|---|---|
| `/tr <draft>` | `文⇄A✦` translate 中⇄EN and polish |
| `/tr-only <draft>` | `文⇄A` translate and fix grammar only |
| `/polish <draft>` | `✦` polish in the same language |

If the prompt box can't be filled, the rewritten text is shown instead, to copy.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install prompt-translator --marketplace CreeperZzz/prompt-translator
```

Answer `y` to add the marketplace, then pick a scope (user is the usual choice).

In the Claude Code desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `CreeperZzz/prompt-translator`, then **Add plugin**.
