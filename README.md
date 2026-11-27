# prompt-translator

Three icon buttons in the row above the Claude Code prompt box. Each one rewrites the draft you have typed, in place, before you send it.

| Icon | What it does |
|---|---|
| `文⇄A✦` | Translate between Chinese and English (direction picked automatically), fix grammar and polish it into a clear prompt (Haiku) |
| `文⇄A` | Translate and fix grammar only, keeping your wording (Haiku) |
| `✦` | Polish in the same language, using the current conversation as context (the session's own model) |
| `↶` | Undo: put back your original draft (shown after a rewrite, until you send) |

Code, commands, file paths, URLs, identifiers and error messages are kept as written. If you keep typing while a rewrite runs, the result is discarded instead of overwriting your text.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install prompt-translator --marketplace CreeperZzz/prompt-translator
```

Answer `y` to add the marketplace, then pick a scope (user is the usual choice).

In the Claude Code desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `CreeperZzz/prompt-translator`, then **Add plugin**.
