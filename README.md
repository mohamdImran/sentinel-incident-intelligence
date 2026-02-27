# SENTINEL

**Autonomous Incident Intelligence Platform powered by Elastic Agent Builder**

SENTINEL is a production-grade multi-agent AI platform that detects, investigates, and resolves infrastructure incidents autonomously. It deploys five specialized AI agents to your Elastic Agent Builder instance — each with its own system prompt, reasoning strategy, and native access to your Elasticsearch data through ES|QL and semantic search.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Elastic Agent Builder](https://img.shields.io/badge/Elastic-Agent%20Builder-00BFB3)](https://www.elastic.co)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)](https://www.typescriptlang.org)

---

## What It Does

Production incidents are expensive. On-call engineers spend hours manually correlating logs, metrics, and traces across distributed systems. SENTINEL eliminates that toil by automating the entire incident response lifecycle — from anomaly detection through root cause analysis to remediation — using Elastic's time-series data and Agent Builder's reasoning capabilities.

---

## The Five-Agent Pipeline

SENTINEL deploys five real Agent Builder agents to your Kibana instance. Each is a distinct agent with its own specialized system prompt, reasoning strategy, and tool configuration. They are deployed via the **Deploy** tab with a single click.

| Agent | Role | Avatar |
|---|---|---|
| SENTINEL Planner | Decomposes the incident and orchestrates the pipeline | PL |
| SENTINEL Investigator | Runs targeted ES|QL queries to isolate the root cause | IN |
| SENTINEL Correlator | Maps blast radius across dependent services | CO |
| SENTINEL Remediator | Generates and executes remediation workflows | RE |
| SENTINEL Verifier | Validates the fix and closes the incident | VE |

Each agent uses all five core Agent Builder tools: `execute_esql`, `search`, `list_indices`, `get_index_mapping`, `get_document_by_id`.

---

## Key Features

### Natural Language → ES|QL
Type a plain-English description of what you want to query. The AI Query Composer translates it into a valid, executable ES|QL query using Elastic Agent Builder's reasoning model — enforcing correct syntax, valid aggregate functions, and proper parameter types. The generated query loads directly into the Monaco editor for review and execution.

### AI Tool Creator
Describe a monitoring or analysis tool in plain English. The AI Tool Creator generates a complete, deployment-ready Agent Builder tool definition — including the ES|QL query, parameter schema with correct Elastic types (`keyword`, `long`, `date`, etc.), tags, and description. Review the draft, edit any field in the Monaco editor, and deploy to your Kibana instance in one click.

### One-Click Pipeline Deployment
The Deploy tab provides a "Deploy All 5 Agents" button that creates all five SENTINEL agents in your Kibana instance sequentially, with per-agent progress indicators. Each agent is a real Agent Builder agent with specialized instructions — not a UI simulation.

### Agent Workbench
Real-time orchestration dashboard showing all five agents working in parallel. Each agent's chain-of-thought reasoning streams live as it runs. The workbench auto-follows the currently active agent, shows tool call traces with results, and includes a resizable overview panel with the full pipeline graph.

### ES|QL Workbench
Monaco-powered ES|QL editor with syntax highlighting, live execution against Elasticsearch via `POST /_query`, preset queries, AI-generated query history, and tabular results with column type chips. Includes "Explain query" and "Improve query" actions that fire immediately via Agent Builder — no copy-paste required.

### Agent Builder Integration
Full CRUD for agents and tools. Stream conversations with any agent via SSE. Browse conversation history. Attach context files. Switch between inference connectors (Claude, GPT, Gemini) with a model selector.

### Geographic Intelligence
Live node health map fetching real data from `/_nodes/stats` and `/_cluster/health`. Maps node names and cloud region attributes to geographic coordinates across 40+ AWS and GCP regions. Auto-refreshes every 30 seconds.

---

## Getting Started

### Prerequisites

- Node.js 18+
- An Elastic Cloud deployment with Kibana 9.2+ (required for Agent Builder API)

### Install

```bash
git clone https://github.com/justinDevel/sentinel-incident-intelligence
cd sentinel
npm install
```

### Configure

Copy `.env.example` to `.env` and fill in your credentials:

```env
# Set to false to connect to live Elasticsearch + Agent Builder
VITE_DEMO_MODE=true

# Elasticsearch
VITE_ES_URL=https://your-deployment.es.us-central1.gcp.cloud.es.io:443
VITE_ES_API_KEY=your_base64_api_key

# Kibana / Agent Builder
VITE_KIBANA_URL=https://your-deployment.kb.us-central1.gcp.cloud.es.io
VITE_KIBANA_API_KEY=your_kibana_api_key
```

API keys are created from your Elastic Cloud console under **Security → API Keys**. The Kibana key requires `read_agent_builder` and `manage_agent_builder` cluster privileges.

### Run

```bash
npm run dev
```

The app starts in demo mode by default (`VITE_DEMO_MODE=true`) — no API keys required. All agent reasoning, incident data, and metrics are simulated with realistic scripted scenarios. Set `VITE_DEMO_MODE=false` to connect to live APIs.

### Deploy the Agent Pipeline

1. Set `VITE_DEMO_MODE=false` and configure your Kibana credentials in `.env`
2. Open the **Agent Builder** page in SENTINEL
3. Click the **Deploy** tab
4. Click **Deploy All 5 Agents** — SENTINEL creates all five agents in your Kibana instance with their specialized system prompts and tool configurations
5. Switch to the **Agents** tab to see them listed and start chatting

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SENTINEL                                 │
│                                                                  │
│  Elasticsearch ──► ML Anomaly Detection ──► Incident Trigger     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         Elastic Agent Builder — 5 Real Agents              │ │
│  │                                                            │ │
│  │  Planner ──► Investigator ──► Remediator ──► Verifier      │ │
│  │               Correlator  ──►                              │ │
│  │                                                            │ │
│  │  Tools: execute_esql · search · list_indices               │ │
│  │         get_index_mapping · get_document_by_id             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  React UI ──► /dynamic-proxy ──► Kibana (Agent Builder API)      │
│           ──► /dynamic-proxy ──► Elasticsearch (ES|QL)           │
└─────────────────────────────────────────────────────────────────┘
```

The Vite dev server proxies all API calls through `/dynamic-proxy` to avoid CORS. The proxy reads the target URL from the `X-Proxy-Target` request header and supports SSE streaming for Agent Builder conversations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Code Editor | Monaco Editor (`@monaco-editor/react`) |
| Build | Vite 5 |
| AI / Agents | Elastic Agent Builder API |
| Data | Elasticsearch ES|QL (`POST /_query`) |
| Markdown | react-markdown + remark-gfm |
| Icons | Lucide React |

---

## Project Structure

```
src/
├── config/
│   └── demo.config.ts          # All config driven by .env variables
├── lib/
│   ├── agentBuilder.ts         # Agent Builder API client — CRUD, SSE, 5 agent definitions
│   ├── elasticsearch.ts        # ES|QL query client
│   └── connectionStore.ts      # localStorage connection config + proxy routing
├── pages/
│   ├── AgentBuilderPage.tsx    # Agent Builder UI — chat, history, create, deploy pipeline, AI Tool Creator
│   ├── DashboardPage.tsx       # Mission Control — incident queue, anomaly feed, cluster health
│   ├── AgentsPage.tsx          # Agent Workbench — live reasoning traces, pipeline graph
│   ├── QueriesPage.tsx         # ES|QL Workbench — Monaco editor, AI Query Composer
│   ├── GeoPage.tsx             # Geographic Intelligence — live node health map
│   ├── ImpactPage.tsx          # Impact Metrics — MTTR, revenue protected, resolution history
│   └── IncidentsPage.tsx       # Incident list + root cause detail
├── components/
│   ├── agents/                 # Orchestration graph, agent nodes, connectors, thinking stream
│   ├── ui/
│   │   └── MonacoEditor.tsx    # Shared Monaco editor with SENTINEL dark theme
│   └── ...
├── hooks/
│   ├── useDemoOrchestrator.ts       # rAF-based demo playback engine
│   └── useLiveAgentOrchestrator.ts  # Maps live Agent Builder SSE events to agent state
└── store/
    ├── AgentStoreContext.tsx    # Agent run state (status, reasoning, steps, handoffs)
    ├── DemoStoreContext.tsx     # Demo playback state (play/pause/reset/scenario)
    └── AppStoreContext.tsx      # Navigation and selected incident
```

---

## Agent Builder API Reference

### Endpoints Used

| Feature | Method | Endpoint |
|---|---|---|
| List agents | GET | `/api/agent_builder/agents` |
| Create agent | POST | `/api/agent_builder/agents` |
| Delete agent | DELETE | `/api/agent_builder/agents/{id}` |
| Chat (SSE) | POST | `/api/agent_builder/converse/async` |
| List tools | GET | `/api/agent_builder/tools` |
| Create tool | POST | `/api/agent_builder/tools` |
| Delete tool | DELETE | `/api/agent_builder/tools/{id}` |
| List conversations | GET | `/api/agent_builder/conversations?agent_id={id}` |
| Get conversation | GET | `/api/agent_builder/conversations/{id}` |
| Create attachment | POST | `/api/agent_builder/conversations/{id}/attachments` |
| List connectors | GET | `/api/actions/connectors` |

### SSE Event Format

```
event: reasoning
data: {"reasoning": "Analyzing connection pool metrics...", "transient": false}

event: tool_call
data: {"tool_id": "platform.core.execute_esql", "tool_call_id": "tc-1", "params": {"query": "FROM metrics-db.*..."}}

event: message_chunk
data: {"text_chunk": "Based on the analysis, "}

event: message_complete
data: {"message_content": "The root cause is a missing index on..."}
```

### Valid ES|QL Tool Parameter Types

When creating tools via the API, `params[x].type` must be one of:

`text` · `keyword` · `long` · `integer` · `double` · `float` · `boolean` · `date` · `object` · `nested`

---

## Demo Scenarios

| # | Incident | Root Cause | MTTR |
|---|---|---|---|
| 0 | DB Connection Pool Cascade | Missing index on 847M-row table causing full table scans | 2.3 min |
| 1 | CDN Origin Failover Failure | Health check timeout misconfigured via automated config push | 3.4 min |
| 2 | Credential Stuffing Attack | 892 botnet IPs, 47K login attempts, 376 compromised accounts | 0.9 min |

---

## About This Project

SENTINEL was built for the Elastic Agent Builder Hackathon. The core thesis: incident response is a multi-step reasoning problem that maps naturally to a pipeline of specialized agents — each with a focused role, its own system prompt, and direct access to Elasticsearch data via ES|QL.

The two features we're most proud of:

1. **AI Tool Creator** — natural language to a fully-typed, deployment-ready Agent Builder tool definition in one shot. The AI understands ES|QL syntax, valid parameter types, and the Agent Builder schema.

2. **Natural Language → ES|QL** — the query composer doesn't just generate queries, it enforces correctness: valid aggregate functions only, proper METADATA usage, generic field names that work across index patterns.

The biggest challenge was the SSE streaming protocol — parsing the event stream correctly, handling partial chunks, and mapping `reasoning` / `tool_call` / `message_chunk` events to live UI updates required careful buffering logic.

---

## License

MIT — see [LICENSE](LICENSE)
