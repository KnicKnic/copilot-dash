/**
 * Copilot Dash - Side Panel
 *
 * Fetches matching runs for the current tab URL and displays
 * either a run list or navigates directly to the viewer.
 */

export {}; // ensure this is treated as an ES module

interface RunInfo {
  id: string;
  name: string;
  model: string;
  success: boolean;
  duration: number;
  timestamp: string;
}

interface MatchResponse {
  matched: boolean;
  runs?: RunInfo[];
}

const BACKEND_URL = "http://localhost:3456";
const app = document.getElementById("app")!;

function getActiveTabUrl(): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (chrome?.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: "GET_TAB_URL" }, (response) => {
          if (chrome.runtime.lastError) {
            resolve(undefined);
            return;
          }
          resolve(response?.url || undefined);
        });
        return;
      } catch {
        // Fall through to tabs API
      }
    }

    if (!chrome?.tabs?.query) {
      resolve(undefined);
      return;
    }

    chrome.tabs
      .query({ active: true, lastFocusedWindow: true })
      .then((tabs) => resolve(tabs[0]?.url))
      .catch(() => resolve(undefined));
  });
}

function setStatus(msg: string): void {
  app.innerHTML = `<div class="loading"><div class="spinner"></div><span>${msg}</span></div>`;
}

function showNoMatch(detail?: string): void {
  app.innerHTML = `
    <div class="no-match">
      <h2>No Matching Runs</h2>
      <p>The current page doesn't match any Copilot CLI run patterns.</p>
      ${detail ? `<p style="margin-top:8px;font-size:11px;color:#d1d5db">${detail}</p>` : ""}
    </div>
  `;
}

function showError(msg: string): void {
  app.innerHTML = `
    <div class="no-match">
      <h2>Error</h2>
      <p>${msg}</p>
    </div>
  `;
}

function loadViewer(runId: string): void {
  app.innerHTML = `<iframe src="${BACKEND_URL}/view/${runId}"></iframe>`;
}

function showRunList(runs: RunInfo[]): void {
  if (runs.length === 1) {
    loadViewer(runs[0].id);
    return;
  }

  let html = '<div class="run-list">';
  for (const run of runs) {
    const badge = run.success
      ? '<span class="badge badge-success">✓ Pass</span>'
      : '<span class="badge badge-failure">✗ Fail</span>';
    html += `
      <div class="run-item" data-id="${run.id}">
        <div class="run-name">${run.name} ${badge}</div>
        <div class="run-meta">${run.model} · ${run.duration.toFixed(1)}s · ${new Date(run.timestamp).toLocaleString()}</div>
      </div>
    `;
  }
  html += "</div>";
  app.innerHTML = html;

  document.querySelectorAll<HTMLElement>(".run-item").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      if (id) loadViewer(id);
    });
  });
}

async function init(): Promise<void> {
  // Step 1: Get the active tab URL
  setStatus("Getting tab URL...");
  let url: string | undefined;
  try {
    url = await getActiveTabUrl();
  } catch (e) {
    showError("Failed to get tab URL: " + (e as Error).message);
    return;
  }

  if (!url) {
    showNoMatch("Could not read tab URL");
    return;
  }

  if (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  ) {
    showNoMatch("Internal browser page");
    return;
  }

  // Step 2: Check for matching runs
  setStatus("Checking for matching runs...");
  let data: MatchResponse;
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/runs/match?url=${encodeURIComponent(url)}`
    );
    if (!res.ok) {
      showNoMatch("Server returned " + res.status);
      return;
    }
    data = await res.json();
  } catch {
    showError(
      "Could not reach server at " + BACKEND_URL + ". Is it running?"
    );
    return;
  }

  // Step 3: Show results
  if (data.matched && data.runs && data.runs.length > 0) {
    showRunList(data.runs);
  } else {
    showNoMatch(url);
  }
}

init();
