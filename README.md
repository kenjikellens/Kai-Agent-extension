# Kai Agent - VS Code Extension

Kai Agent is an offline-first autonomous AI developer extension for Visual Studio Code and compatible editors (such as Antigravity IDE). It bridges local LM Studio instances and external cloud AI providers directly into the editor to deliver multi-turn reasoning, precision codebase modifications, and autonomous tool orchestration.

---

## Table of Contents

1. Architecture Explanation
2. Codebase Overview and File Structure
3. Installation and Setup Guide
4. Operational Modes
5. Tool Protocol and Execution Lifecycle
6. Deep Reasoning and Thinking Engine
7. Settings Reference
8. Commands and Keybindings
9. License

---

## 1. Architecture Explanation

The extension implements a decoupled client-server architecture inside the IDE process boundaries:

```
+-----------------------------------------------------------------------+
| VS Code Extension Host (Node.js Environment)                          |
|                                                                       |
|  +------------------------+      +---------------------------------+  |
|  | extension.ts           | ---> | SidebarProvider.ts              |  |
|  | (Activation/Commands)  |      | (Webview Lifecycle & IPC Hub)   |  |
|  +------------------------+      +---------------------------------+  |
|                                      |                                |
|                                      v                                |
|  +-----------------------------------------------------------------+  |
|  | AgentExecutor.ts (Autonomous Execution Loop)                    |  |
|  | - System Prompt Construction                                    |  |
|  | - XML Tool Tag Parsing & Dispatch                               |  |
|  | - Multi-Turn Context Memory                                     |  |
|  +-----------------------------------------------------------------+  |
|          |                                   |                        |
|          v                                   v                        |
|  +---------------------------+   +---------------------------------+  |
|  | Local / Cloud Providers   |   | Workspace Tool Handlers         |  |
|  | - LMStudioClient.ts       |   | - File Read / Write / Replace   |  |
|  | - GeminiClient.ts         |   | - Ripgrep Regex Search          |  |
|  | - MistralClient.ts        |   | - Terminal Command Execution    |  |
|  | - FreeProviderClient.ts   |   | - Language Server Diagnostics   |  |
|  +---------------------------+   +---------------------------------+  |
+-----------------------------------------------------------------------+
                                   |
                     Webview IPC PostMessage Protocol
                                   |
+-----------------------------------------------------------------------+
| Webview UI (Isolated Browser Sandbox)                                 |
|                                                                       |
|  +-----------------------------------------------------------------+  |
|  | main.js (Entry Orchestrator)                                    |  |
|  +-----------------------------------------------------------------+  |
|          |                                                            |
|          +---> WebviewIPCBridge.js (Typed Bidirectional Messaging)    |
|          +---> AppState.js (Reactive Central Store)                   |
|          +---> ChatUIController.js (DOM Streaming & Message Bubbles)  |
|          +---> ModelDropdownController.js (Model Selector & Flyout)   |
|          +---> SettingsController.js (Global Config & API Keys)       |
|          +---> HelpModalController.js (Guide Modal Dialog)            |
|          +---> FileUploadController.js (Attachment Pipeline)          |
|          +---> HistoryManager.js (Persistent Session Storage)         |
|          +---> MarkdownFormatter.js (Markdown & Syntax Highlighting)  |
|          +---> main.css (Dark Design Tokens & 250ms Transitions)      |
+-----------------------------------------------------------------------+
```

### Communication Lifecycle

1. **User Interaction**: The user enters a prompt, toggles thinking effort, or switches modes in the Webview UI.
2. **IPC Dispatch**: `WebviewIPCBridge` serializes the state and sends a typed `sendMessage` payload to the Extension Host.
3. **Execution Loop**: `SidebarProvider` routes the request to `AgentExecutor`.
4. **Provider Inference**: `AgentExecutor` queries the selected provider (`LMStudioClient` or cloud client).
5. **Tool Parsing**: When the model outputs XML tool tags (e.g. `<read_file>`, `<replace_file_content>`, `<run_command>`), `AgentExecutor` executes the tool against the active workspace, collects stdout/stderr, appends results to history, and recursively triggers the next step until completion.
6. **Streaming UI Feedback**: Progress events (`agentProgress`, `streamChunk`, `toolStatus`) stream back to the webview in real time.

---

## 2. Codebase Overview and File Structure

Below is an exhaustive breakdown of the extension source directories and their technical responsibilities:

```
Kai-Agent-extension/
├── code/
│   ├── src/                                    # Extension Host TypeScript Source
│   │   ├── extension.ts                        # Extension entry point, command registration, status bar item
│   │   ├── SidebarProvider.ts                  # Webview view provider, HTML generator, IPC message router
│   │   ├── AgentExecutor.ts                    # Autonomous multi-turn agent loop and tool execution engine
│   │   ├── LMStudioClient.ts                   # HTTP client for local LM Studio OpenAI-compatible endpoints
│   │   ├── ConfigManager.ts                    # VS Code workspace and global configuration manager
│   │   ├── I18nManager.ts                      # Backend internationalization dictionary manager
│   │   ├── DiffManager.ts                      # Side-by-side VS Code diff view manager for code review
│   │   ├── DiagnosticsHelper.ts                # VS Code language server error/warning extraction helper
│   │   ├── InlinePromptEditor.ts               # Inline code selection transformation controller
│   │   ├── SessionManager.ts                   # Conversation history disk persistence manager
│   │   ├── SystemPromptBuilder.ts              # System prompt builder with workspace rules and tool specs
│   │   └── providers/                          # AI Provider Implementations
│   │       ├── ILLMProvider.ts                 # Common interface definition for all LLM clients
│   │       ├── LLMProviderFactory.ts           # Factory resolving provider instances based on model ID
│   │       ├── LMStudioReasoningEngine.ts      # Model capability detection and thinking parameter injection
│   │       ├── LMStudioManifestParser.ts       # Read-only parser for LM Studio Jinja template manifests
│   │       ├── MuseGlimmerStreamParser.ts      # Stream transformer for embedded reasoning blocks
│   │       ├── GeminiClient.ts                 # Google Gemini API connector with thinking budget support
│   │       ├── GeminiThinkingConfig.ts         # Configuration mapping for Gemini reasoning levels
│   │       ├── MistralClient.ts                # Mistral AI and Codestral API connector
│   │       ├── FreeProviderClient.ts           # OpenRouter, Cerebras, Cohere, Zhipu, Together AI connectors
│   │       └── ReasoningContent.ts             # Data models for thinking and reasoning segments
│   │
│   ├── media/                                  # Webview Frontend Assets
│   │   ├── main.css                            # Core stylesheet: tokens, animations, responsive layout
│   │   ├── main.js                             # Webview initialization script and controller wiring
│   │   ├── js/                                 # Modular ES6 OOP Controllers
│   │   │   ├── AppState.js                     # Centralized reactive state store
│   │   │   ├── WebviewIPCBridge.js             # Bidirectional IPC communication layer
│   │   │   ├── ChatUIController.js             # Chat stream renderer, message bubbles, view switching
│   │   │   ├── ModelDropdownController.js      # Primary model selector and thinking flyout controller
│   │   │   ├── SettingsController.js           # Settings accordion and API key manager
│   │   │   ├── HelpModalController.js          # Modal dialog controller for quick guide and shortcuts
│   │   │   ├── FileUploadController.js         # File attachment drag-and-drop and upload handling
│   │   │   ├── HistoryManager.js               # History sidebar view and conversation restoration
│   │   │   ├── ModeManager.js                  # Operational mode manager (Agent, Ask, Plan)
│   │   │   ├── MarkdownFormatter.js            # Custom markdown parser and syntax highlighter
│   │   │   ├── DOMUtils.js                     # DOM manipulation and element creation helpers
│   │   │   ├── Constants.js                    # UI constants, default models, and provider metadata
│   │   │   └── WelcomeHeroComponent.js         # Greeting banner and prompt starter pills
│   │   └── svg/                                # Standalone SVG icon assets
│   │
│   ├── package.json                            # Extension manifest, commands, settings contribution
│   ├── tsconfig.json                           # TypeScript compiler configuration
│   └── README.md                               # Extension documentation
│
├── install.bat                                 # Full VSIX package compilation and install script
├── update.bat                                  # Fast incremental code sync script (~1 second)
└── README.md                                   # Root extension documentation
```

---

## 3. Installation and Setup Guide

### Prerequisites
- Visual Studio Code version `1.80.0` or higher (or Antigravity IDE).
- Node.js `18.x` or higher and `npm`.
- LM Studio installed locally (for offline private models).

### Setup and Compilation

1. **Install Dependencies**:
   Open a terminal in the `Kai-Agent-extension/code` folder:
   ```bash
   cd "Kai-Agent-extension/code"
   npm install
   ```

2. **Compile TypeScript**:
   ```bash
   npm run compile
   ```

3. **Deploy to IDE**:
   - **Method A (Fast Incremental Sync - Recommended)**:
     Run `update.bat` from the `Kai-Agent-extension` root. This script compiles TypeScript and immediately copies compiled output and media files into your local `.vscode/extensions` or `.antigravity/extensions` folder in ~1 second.
   - **Method B (Full VSIX Package Installation)**:
     Run `install.bat` from the `Kai-Agent-extension` root. This generates a `.vsix` file and executes `code --install-extension`.

4. **Reload IDE Window**:
   In VS Code, press `Ctrl+Shift+P`, type `Developer: Reload Window`, and press Enter.

5. **Start Local LM Studio Server**:
   - Open LM Studio.
   - Load any GGUF model (such as Qwen 2.5 Coder, Mistral Small, or DeepSeek R1 Distill).
   - In the Developer tab, start the local server on `http://localhost:1234`.
   - Open the Kai sidebar in VS Code; the status dot will turn green automatically.

---

## 4. Operational Modes

Switch modes using the `@` button in the prompt toolbar:

- **Agent Mode**: Full access to all tools. Reads files, writes files, applies non-contiguous replacements, searches workspaces with ripgrep, checks diagnostics, and runs terminal commands autonomously.
- **Ask Mode**: Read-only exploration. The agent can read files, inspect folders, and search code, but cannot modify files or execute shell commands.
- **Plan Mode**: Forces the agent to output an implementation plan before touching code. The plan is rendered with a `Proceed with Plan` action for user review.

---

## 5. Tool Protocol and Execution Lifecycle

The agent executes actions through structured XML tags emitted by the model:

| Tool | XML Syntax | Description |
| :--- | :--- | :--- |
| `read_file` | `<read_file path="path/to/file"/>` | Reads file content with optional line slicing (`start_line`, `end_line`) |
| `write_file` | `<write_file path="path/to/file">content</write_file>` | Writes full file content, creating parent directories if missing |
| `replace_file_content` | `<replace_file_content path="file"><target>old</target><replacement>new</replacement></replace_file_content>` | Replaces an exact single contiguous block of code |
| `multi_replace_file_content` | `<multi_replace_file_content path="file">...</multi_replace_file_content>` | Applies multiple non-contiguous edits in a single turn |
| `delete_item` | `<delete_item path="path/to/item"/>` | Deletes a file or directory inside the workspace |
| `list_dir` | `<list_dir path="path/to/dir"/>` | Lists folder contents with sizes and child counts |
| `grep_search` | `<grep_search query="regex" path="dir"/>` | Fast ripgrep search with line-number matching |
| `symbol_search` | `<symbol_search query="name"/>` | Searches workspace symbols across language servers |
| `get_diagnostics` | `<get_diagnostics path="file"/>` | Retrieves compiler/linter diagnostics for a file |
| `run_command` | `<run_command>command</run_command>` | Executes PowerShell/Bash shell commands in the workspace root |
| `web_search` | `<web_search query="search terms"/>` | Runs live online web searches |
| `fetch_url` | `<fetch_url url="https://..."/>` | Scrapes web page and converts content to markdown |

---

## 6. Deep Reasoning and Thinking Engine

### 100% Manifest-Driven Parameter Extraction
When connected to LM Studio, `LMStudioManifestParser` scans local model manifests to detect Jinja template variables. If the manifest contains `enable_thinking`, `reasoning_effort`, or custom template kwargs, `LMStudioReasoningEngine` maps UI selections directly to the exact expected format.

### Ephemeral Per-Request Injection
Parameters are transmitted strictly inside the JSON body of each prompt request:
```json
{
  "model": "qwen2.5-coder-7b-instruct",
  "messages": [...],
  "chat_template_kwargs": {
    "enable_thinking": true
  },
  "reasoning_effort": "high"
}
```
No files, model presets, or system configuration within LM Studio are ever modified.

---

## 7. Settings Reference

| Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `kai.serverUrl` | string | `http://localhost:1234/v1` | LM Studio local server endpoint |
| `kai.lmStudioCacheDir` | string | `""` | Optional explicit path to LM Studio cache folder |
| `kai.temperature` | number | `0.2` | Generation sampling temperature |
| `kai.language` | string | `en` | UI language (`en`, `nl`, `fr`, `de`, `es`, `zh`, `ja`) |
| `kai.thinkingDisplayStyle` | string | `accordion` | Display mode for reasoning blocks (`accordion`, `inline`, `hidden`) |
| `kai.keepThinkingExpanded` | boolean | `false` | Keep reasoning blocks expanded during streaming |
| `kai.keepThinkingFinished` | boolean | `false` | Keep reasoning blocks expanded after stream completion |

---

## 8. Commands and Keybindings

- `Ctrl+Shift+P` -> `Kai: Open Chat`: Opens and focuses the sidebar chat interface.
- `Ctrl+Shift+P` -> `Kai: New Chat`: Clears current session and opens a new chat.
- `Ctrl+Shift+P` -> `Kai: Send Code Selection to Chat`: Forwards highlighted code to the chat input with line numbers and file path.
- `Ctrl+Alt+K`: Opens inline code transformation editor on active selection.

---

## 9. License

Proprietary. Developed by Kenji Kellens. All rights reserved.
