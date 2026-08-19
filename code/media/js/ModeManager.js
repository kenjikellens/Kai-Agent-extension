/**
 * ModeManager manages context mode state ('ask', 'agent', 'planning'),
 * input placeholders, mode badges, and UI item selections in VS Code Extension.
 */
class ModeManager {
    /**
     * Initializes mode manager with DOM references and initial active mode.
     * @param {object|AppState} appStateOrOptions Application state instance or options map.
     * @param {HTMLElement} [messageInput] Input textarea element.
     * @param {HTMLElement} [contextModeSelector] Mode selector container.
     * @param {HTMLElement} [atMentionTriggerBtn] At-mention mode trigger button.
     */
    constructor(appStateOrOptions, messageInput = null, contextModeSelector = null, atMentionTriggerBtn = null) {
        if (appStateOrOptions && appStateOrOptions.appState) {
            this.appState = appStateOrOptions.appState;
            this.messageInput = appStateOrOptions.messageInput || document.getElementById('message-input');
            this.contextModeSelector = appStateOrOptions.contextModeSelector || document.getElementById('context-options-menu');
            this.atMentionTriggerBtn = appStateOrOptions.atMentionTriggerBtn || document.getElementById('at-mention-trigger-btn');
            this.contextOptionsMenu = appStateOrOptions.contextOptionsMenu || document.getElementById('context-options-menu');
            this.onModeChange = appStateOrOptions.onModeChange || null;
        } else {
            this.appState = appStateOrOptions;
            this.messageInput = messageInput || document.getElementById('message-input');
            this.contextModeSelector = contextModeSelector || document.getElementById('context-options-menu');
            this.atMentionTriggerBtn = atMentionTriggerBtn || document.getElementById('at-mention-trigger-btn');
            this.contextOptionsMenu = document.getElementById('context-options-menu');
            this.onModeChange = null;
        }

        this.modeLabels = { ask: 'Ask', agent: 'Agent', planning: 'Plan' };
        this.modeIcons = {
            ask: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
            agent: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
            planning: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>'
        };

        this.initEventListeners();
    }

    /**
     * Updates active mode, persists to localStorage, and updates UI placeholders and icons.
     * @param {'ask'|'agent'|'planning'} mode Target mode.
     */
    setActiveMode(mode) {
        if (!mode || (mode !== 'ask' && mode !== 'agent' && mode !== 'planning')) {
            mode = 'agent';
        }
        this.appState.activeMode = mode;
        this.appState.isPlanningModeEnabled = (mode === 'planning');
        localStorage.setItem('kai.activeMode', mode);

        const modeOptAgent = document.getElementById('mode-opt-agent');
        const modeOptAsk = document.getElementById('mode-opt-ask');
        const modeOptPlanning = document.getElementById('mode-opt-planning');

        if (modeOptAgent) modeOptAgent.classList.toggle('active', mode === 'agent');
        if (modeOptAsk) modeOptAsk.classList.toggle('active', mode === 'ask');
        if (modeOptPlanning) modeOptPlanning.classList.toggle('active', mode === 'planning');

        if (this.atMentionTriggerBtn) {
            this.atMentionTriggerBtn.classList.toggle('active-mode', mode !== 'agent');
            const iconEl = document.getElementById('active-mode-icon');
            if (iconEl && this.modeIcons[mode]) {
                iconEl.innerHTML = this.modeIcons[mode];
            }
            const textEl = document.getElementById('active-mode-text');
            if (textEl) {
                textEl.textContent = this.modeLabels[mode] || 'Agent';
            }
            this.atMentionTriggerBtn.title = `Mode: ${this.modeLabels[mode] || 'Agent'} (@)`;
        }

        if (this.messageInput) {
            if (mode === 'ask') {
                this.messageInput.placeholder = 'Ask questions about your workspace codebase...';
            } else if (mode === 'agent') {
                this.messageInput.placeholder = 'Ask Kai to edit code, execute tasks, or run commands...';
            } else if (mode === 'planning') {
                this.messageInput.placeholder = 'Describe a project task to generate an implementation plan...';
            }
        }

        if (this.onModeChange) {
            this.onModeChange(mode);
        }
    }

    /**
     * Updates workspace active state.
     * @param {boolean} hasWorkspace Whether a workspace is currently active.
     */
    setWorkspaceState(hasWorkspace) {
        // VS Code extension is always within workspace context
    }

    /**
     * Registers context mode selector click events.
     * @private
     */
    initEventListeners() {
        const modeOptAgent = document.getElementById('mode-opt-agent');
        const modeOptAsk = document.getElementById('mode-opt-ask');
        const modeOptPlanning = document.getElementById('mode-opt-planning');

        if (modeOptAgent) {
            modeOptAgent.addEventListener('click', () => {
                this.setActiveMode('agent');
                if (this.contextOptionsMenu) this.contextOptionsMenu.classList.add('hidden');
            });
        }
        if (modeOptAsk) {
            modeOptAsk.addEventListener('click', () => {
                this.setActiveMode('ask');
                if (this.contextOptionsMenu) this.contextOptionsMenu.classList.add('hidden');
            });
        }
        if (modeOptPlanning) {
            modeOptPlanning.addEventListener('click', () => {
                this.setActiveMode('planning');
                if (this.contextOptionsMenu) this.contextOptionsMenu.classList.add('hidden');
            });
        }

        if (this.atMentionTriggerBtn && this.contextOptionsMenu) {
            this.atMentionTriggerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.contextOptionsMenu.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!this.contextOptionsMenu.contains(e.target) && !this.atMentionTriggerBtn.contains(e.target)) {
                    this.contextOptionsMenu.classList.add('hidden');
                }
            });
        }
    }
}
