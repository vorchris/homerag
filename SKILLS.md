# Claude Code Skills

Available slash commands for this project.

## /simplify
Reviews recently changed code for quality, reuse, and efficiency — then fixes issues found.
Use after finishing a feature or bugfix.

## /update-config
Configures automated Claude Code behaviors via `settings.json` (hooks).
Use for: "whenever I do X, automatically do Y".

## /keybindings-help
Customize keyboard shortcuts in `~/.claude/keybindings.json`.
Use for rebinding keys, adding chord shortcuts, or changing the submit key.

## /loop `[interval]` `[command]`
Runs a prompt or slash command on a recurring interval.
Example: `/loop 5m /simplify` — runs simplify every 5 minutes.
Default interval: 10 minutes.

## /schedule
Creates and manages scheduled remote agents on a cron schedule.
Use for automated recurring tasks that run even when Claude Code is not open.

## /claude-api
Scaffolds code using the Claude API or Anthropic SDK.
Triggered automatically when code imports `anthropic` or `@anthropic-ai/sdk`.
