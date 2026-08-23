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

        this.modeLabels = { chat: 'Chat', ask: 'Ask', agent: 'Agent', planning: 'Plan' };
        this.modeIcons = {
            chat: DOMUtils.getSvgImgString('chat_mode', 'mode-btn-svg', 13),
            ask: DOMUtils.getSvgImgString('ask_mode', 'mode-btn-svg', 13),
            agent: DOMUtils.getSvgImgString('agent_mode', 'mode-btn-svg', 13),
            planning: DOMUtils.getSvgImgString('plan_mode', 'mode-btn-svg', 13)
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

        this.updatePlaceholder();

        if (this.onModeChange) {
            this.onModeChange(mode);
        }
    }

    /**
     * Dynamically updates the message textarea placeholder based on the active mode and current i18n dictionary.
     * @param {object} [customTranslations] Optional translation dictionary override.
     */
    updatePlaceholder(customTranslations = null) {
        if (!this.messageInput) return;
        const i18n = customTranslations || window.KAI_I18N || {};
        const mode = this.appState.activeMode || 'agent';

        if (mode === 'ask') {
            this.messageInput.placeholder = i18n.placeholderAsk || 'Ask questions about your workspace codebase...';
        } else if (mode === 'agent') {
            this.messageInput.placeholder = i18n.placeholderAgent || 'Ask Kai to edit code, execute tasks, or run commands...';
        } else if (mode === 'planning') {
            this.messageInput.placeholder = i18n.placeholderPlanning || 'Describe a project task to generate an implementation plan...';
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
