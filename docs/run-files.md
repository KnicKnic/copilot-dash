# Run File Format & Producer Scripts

Copilot Dash scans configured directories for `.copilot_runs/**/run_details.json` files. This document describes the file format, the wrapper script that produces them, and example use cases.

## run_details.json Format

Each run is a JSON file at `<scan_dir>/.copilot_runs/<name>/run_details.json`:

```json
{
  "version": "0",
  "exitCode": 0,
  "success": true,
  "sessionId": "c1aa6e33-e1f2-485c-a30d-a3cf891ac5be",
  "workingDirectory": "C:\\code\\my-project",
  "name": "issues/4521",
  "agent": null,
  "agentFile": null,
  "promptName": "triage",
  "promptFile": ".github/prompts/triage.prompt.md",
  "displayFiles": ["output/issues/4521.md"],
  "urlRegexp": "https://github\.com/owner/repo/issues/4521",
  "timestamp": "2026-02-08T14:38:56.0286470-08:00",
  "gitCommit": "afb4fafa862dfbfe7c3a3db04a993595b31a4640",
  "gitBranch": "main",
  "model": "claude-opus-4.6",
  "duration": 167.63,
  "systemMessage": "You are helpful fully autonomous agent.",
  "mcpConfigPath": "C:\\code\\my-project\\mcp-config.json"
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Schema version for idempotent re-runs (`-RunOnce` skips if version matches) |
| `exitCode` | number | Process exit code (0 = success) |
| `success` | boolean | Whether the run completed successfully |
| `sessionId` | string | Copilot SDK session ID — used for resuming sessions in the dashboard |
| `workingDirectory` | string | Absolute path to the working directory used during the run |
| `name` | string | Hierarchical run name (e.g., `issues/4521`, `reports/2026-03-07`) — used for tree grouping |
| `agent` | string? | Agent name if one was used |
| `agentFile` | string? | Absolute path to the `.agent.md` file |
| `promptName` | string | Name derived from the prompt file (e.g., `dri` from `dri.prompt.md`) |
| `promptFile` | string | Relative path to the prompt file |
| `displayFiles` | string[] | Files to render in the Output tab (relative to `workingDirectory`) |
| `urlRegexp` | string? | Regex pattern for matching browser URLs — powers the Edge extension |
| `timestamp` | string | ISO 8601 timestamp of when the run started |
| `gitCommit` | string? | Git commit hash at time of run |
| `gitBranch` | string? | Git branch at time of run |
| `model` | string | Model used (e.g., `claude-opus-4.6`, `gpt-5.2-codex`) |
| `duration` | number | Run duration in seconds |
| `systemMessage` | string? | System message used for the session — reused when resuming |
| `mcpConfigPath` | string? | Absolute path to `mcp-config.json` — MCP servers are loaded from this when resuming |

### Session Resume Behavior

When you resume a session from the dashboard, Copilot Dash uses these fields from `run_details.json`:

- **`model`** — resumed session uses the same model
- **`workingDirectory`** — tools operate in the same directory
- **`mcpConfigPath`** — MCP servers from this config are re-attached to the session
- **`systemMessage`** — reused as-is; defaults to `"You are helpful fully autonomous agent."` if absent

## Producer Script: Invoke-CopilotTask.ps1

The [`Invoke-CopilotTask.ps1`](examples/Invoke-CopilotTask.ps1) script is a PowerShell wrapper that:

1. Converts `.vscode/mcp.json` into SDK-compatible `mcp-config.json`
2. Parses `.prompt.md` files (with YAML frontmatter for agent/tool config)
3. Reads `.agent.md` files and prepends agent instructions to the prompt
4. Creates and manages a Copilot SDK session
5. Saves all run metadata to `.copilot_runs/<name>/run_details.json`

### Dependencies

This script requires the **CopilotShell** PowerShell module, which provides the `New-CopilotClient`, `New-CopilotSession`, `Send-CopilotMessage`, and other cmdlets.

**CopilotShell** is available from:
- **Repo:** [KnicKnic/copilot-pwsh](https://github.com/KnicKnic/copilot-pwsh)
- **PSGallery:** `Install-Module CopilotShell`

**Install requirements:**

| Requirement | Version |
|---|---|
| PowerShell | 7+ |
| Copilot CLI | Installed and on PATH |

```powershell
# Install CopilotShell from PSGallery
Install-Module CopilotShell

# Verify
Import-Module CopilotShell
```

### Basic Usage

```powershell
# Simple one-off run
.\Invoke-CopilotTask.ps1 "Explain the authentication flow" `
    -Name "docs/auth-flow"

# With a prompt file
.\Invoke-CopilotTask.ps1 -PromptFile .github/prompts/review.prompt.md `
    -Name "review/pr-1042"

# With URL matching (for Edge extension) — e.g. triage a GitHub issue
$issue = 4521
.\Invoke-CopilotTask.ps1 "Triage issue $issue" `
    -PromptFile .github/prompts/triage.prompt.md `
    -Name "issues/$issue" `
    -UrlRegexp "https://github\.com/owner/repo/issues/$issue" `
    -DisplayFiles "output/issues/$issue.md"

# Date-stamped daily report
$date = Get-Date -Format "yyyy-MM-dd"
.\Invoke-CopilotTask.ps1 "Generate daily summary for $date" `
    -PromptFile .github/prompts/daily-report.prompt.md `
    -Name "reports/$date" `
    -RunOnce `
    -DisplayFiles "reports/$date.md"

# Idempotent (skip if already succeeded with same version)
.\Invoke-CopilotTask.ps1 "Analyze this" -Name "analysis/v1" -RunOnce -Version "1"

# Different model
.\Invoke-CopilotTask.ps1 "Quick question" -Model gpt-5.2-codex
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `-PrependPrompt` | `""` | Text to prepend (or use as entire prompt if no `-PromptFile`) |
| `-PromptFile` | `""` | Path to a `.prompt.md` file with optional YAML frontmatter |
| `-Name` | auto-generated | Run name — determines `.copilot_runs/<name>/` path |
| `-Model` | `claude-opus-4.6` | Model to use |
| `-Agent` | `""` | Agent name (loads from `.github/agents/<name>.agent.md`) |
| `-McpConfigSource` | `.vscode/mcp.json` | Source MCP config to convert |
| `-SkipMcpConfig` | `$false` | Skip MCP config generation |
| `-RunOnce` | `$false` | Skip if previous run succeeded with same `-Version` |
| `-Version` | `"0"` | Version string for `-RunOnce` idempotency |
| `-DisplayFiles` | `@()` | Files to show in the dashboard Output tab |
| `-UrlRegexp` | `$null` | URL pattern for Edge extension matching |

## Directory Structure

After running, your project will contain:

```
your-project/
├── .copilot_runs/
│   ├── issues/
│   │   ├── 4521/
│   │   │   ├── run_details.json    # Run metadata
│   │   │   ├── prompt.txt          # The prompt that was sent
│   │   │   ├── mcp-config.json     # MCP config snapshot
│   │   │   └── pwsh_capture.md     # Streaming session log
│   │   └── 4522/
│   │       └── ...
│   ├── ci/
│   │   ├── 14928374651/
│   │   │   └── run_details.json
│   │   └── 14891234567/
│   │       └── run_details.json
│   ├── reports/
│   │   ├── 2026-03-07/
│   │   │   └── run_details.json
│   │   └── 2026-03-08/
│   │       └── run_details.json
│   └── docs/
│       └── auth-flow/
│           └── run_details.json
├── output/
│   ├── issues/
│   │   └── 4521.md             # Generated triage (displayFile)
│   └── reports/
│       └── 2026-03-07.md       # Generated daily report (displayFile)
├── ci-failures/
│   ├── 14928374651.md          # CI failure diagnosis (displayFile)
│   └── 14891234567.md
├── mcp-config.json             # Generated from .vscode/mcp.json
├── .github/
│   └── prompts/
│       ├── triage.prompt.md        # Issue triage prompt
│       ├── daily-report.prompt.md  # Daily report prompt
│       └── ci-failure.prompt.md    # Failed CI run diagnosis
├── get-failed-runs.ps1             # Lists failed Actions runs via gh CLI
├── triage-ci-failures.ps1          # Batch: pipe runs → Invoke-CopilotTask
└── Invoke-CopilotTask.ps1          # The wrapper script
```

## Use Case: Diagnosing Failed CI Runs

A real-world example: every time a CI run fails, automatically diagnose it — then browse to the failed run on GitHub and see the root cause and suggested fix in the Edge extension side panel.

### The prompt: ci-failure.prompt.md

[`ci-failure.prompt.md`](examples/ci-failure.prompt.md) instructs Copilot to:

- Fetch the failed run logs and identify the exact failing step and error
- Diff the triggering commit against the last passing run to find what changed
- Attribute the failure to a specific file/line where possible
- Produce a diagnosis with a concrete suggested fix and a confidence level

### Running a single failed run

```powershell
$run = 14928374651
.\Invoke-CopilotTask.ps1 "Diagnose failed CI run $run in owner/repo" `
    -PromptFile .github/prompts/ci-failure.prompt.md `
    -Name "ci/$run" `
    -RunOnce `
    -UrlRegexp "https://github\.com/owner/repo/actions/runs/$run" `
    -DisplayFiles "ci-failures/$run.md"
```

Browse to `https://github.com/owner/repo/actions/runs/14928374651` — the extension icon lights up and the side panel shows the diagnosis.

### Batch: diagnose all recent failures

Two companion scripts in [`docs/examples/`](examples/) handle the batch workflow:

**`get-failed-runs.ps1`** — queries GitHub CLI for failed runs in the past N days:

```powershell
# List failed runs as a table (human-readable)
.\get-failed-runs.ps1 -Repo owner/repo -Days 7

# Output IDs only for piping
.\get-failed-runs.ps1 -Repo owner/repo -Days 1 -IdsOnly
```

Optional parameters: `-Workflow <name>` to filter by workflow file, `-Limit <n>` (default 100).

**`triage-ci-failures.ps1`** — orchestrates the full pipeline with logging, throttling and dry-run:

```powershell
# Preview what would run (no Copilot calls)
.	riage-ci-failures.ps1 -Repo owner/repo -Days 1 -DryRun

# Run for real, process 2 runs in parallel
.	riage-ci-failures.ps1 -Repo owner/repo -Days 1 -Throttle 2

# Scope to a single workflow
.	riage-ci-failures.ps1 -Repo owner/repo -Days 7 -Workflow ci.yml
```

Each execution is logged to `.logs/triage-ci-failures/<timestamp>.log`. The `-RunOnce` flag on `Invoke-CopilotTask.ps1` means already-diagnosed runs are skipped, so it is safe to run on a schedule without duplicating work.

The resulting tree in the dashboard:

```
ci/
├── 14928374651    ✓ 89s   claude-opus-4.6
├── 14891234567    ✓ 112s  claude-opus-4.6
└── 14876543210    ✓ 76s   claude-opus-4.6
```

## Scheduling with Task Scheduler

Run `triage-ci-failures.ps1` on a schedule so new CI failures are diagnosed automatically — no manual intervention required. Use `-WindowStyle Hidden` to prevent a console window from appearing.

### Creating a scheduled task for CI failure diagnosis

Replace `owner/repo` with your GitHub repository and `C:\code\my-project` with the path where you placed the scripts.

```powershell
# Run triage-ci-failures.ps1 every hour, processing runs from the last day
$action = New-ScheduledTaskAction `
    -Execute '"C:\Program Files\PowerShell\7\pwsh.exe"' `
    -Argument '-WindowStyle Hidden -c "C:\code\my-project\triage-ci-failures.ps1 -Repo owner/repo -Days 1"' `
    -WorkingDirectory 'C:\code\my-project'

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Hours 1) `
    -RepetitionDuration (New-TimeSpan -Days 9999)

Register-ScheduledTask `
    -TaskName "CopilotDash - CI Failure Diagnosis" `
    -Action $action `
    -Trigger $trigger `
    -Description "Diagnose failed GitHub Actions runs every hour"
```

Because `Invoke-CopilotTask.ps1` uses `-RunOnce`, any run already diagnosed will be skipped — so running hourly with `-Days 1` is safe and won't duplicate work.

### Task Scheduler UI settings

| Field | Value |
|-------|-------|
| **Program/script** | `C:\Program Files\PowerShell\7\pwsh.exe` |
| **Add arguments** | `-WindowStyle Hidden -c "C:\code\my-project\triage-ci-failures.ps1 -Repo owner/repo -Days 1"` |
| **Start in** | `C:\code\my-project` |

> **Tip:** Select **"Run whether user is logged on or not"** on the General tab for a fully invisible execution — no window will appear at all, regardless of `-WindowStyle Hidden`.
