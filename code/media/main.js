/**
 * Client-side entry script for Kai Agent Chat Webview.
 * Instantiates and orchestrates ES6 OOP modules.
 */
(function () {
    // 1. Instantiate Core State and Utility Modules
    const appState = new AppState();
    const formatter = new MarkdownFormatter();
    const ipcBridge = new WebviewIPCBridge();
    const fileSummaryWidget = new FileSummaryWidget();

    // 2. Instantiate Feature and View Controllers
    const settingsController = new SettingsController(ipcBridge);
    const fileUploadController = new FileUploadController(ipcBridge, appState);
    const helpModalController = new HelpModalController(ipcBridge);

    const modelDropdownController = new ModelDropdownController(formatter, (selectedModel) => {
        appState.selectedModelValue = selectedModel;
        saveCurrentChat();
    });

    const historyManager = new HistoryManager(ipcBridge, (viewName) => {
        chatUIController.showView(viewName);
    });

    const chatUIController = new ChatUIController(
        formatter,
        ipcBridge,
        fileSummaryWidget,
        settingsController,
        helpModalController,
        modelDropdownController
    );

    // Wire Retry Callback (Rolls back last turn and re-runs previous prompt)
    chatUIController.onRetry = async (assistantMessageElement) => {
        if (appState.isWaitingForResponse) return;

        // Find last user prompt
        const lastUserMsg = [...appState.messages].reverse().find(m => m.role === 'user');
        if (!lastUserMsg) return;

        // Remove the last assistant message from UI
        if (assistantMessageElement) {
            assistantMessageElement.remove();
        }

        // Pop last assistant message from history & uiEvents
        if (appState.messages.length > 0 && appState.messages[appState.messages.length - 1].role === 'assistant') {
            appState.messages.pop();
        }
        if (appState.uiEvents.length > 0 && appState.uiEvents[appState.uiEvents.length - 1].type === 'assistant') {
            appState.uiEvents.pop();
        }

        chatUIController.resetAssistantStream();
        chatUIController.setUiLoading(true, appState);
        saveCurrentChat();

        const modelDetails = modelDropdownController.getSelectedModelDetails();
        const geminiThinkingLevel = modelDetails.reasoningEffort || settingsController.getGeminiThinkingLevel(modelDetails.model);

        ipcBridge.sendUserPrompt(
            appState.messages,
            modelDetails.model,
            modelDetails.thinking,
            geminiThinkingLevel,
            appState.activeMode === 'planning',
            [],
            appState.activeMode,
            appState.currentChatId
        );
    };

    // Wire Edit Prompt Callback
    chatUIController.onEditPrompt = async (userMessageRowElement, editedText) => {
        if (appState.isWaitingForResponse) return;
        if (!editedText || !editedText.trim()) return;

        const textToSend = editedText.trim();

        // Add the edited prompt to state & UI
        appState.addMessage({ role: 'user', content: textToSend });
        appState.addUiEvent({ type: 'user', text: textToSend });
        chatUIController.appendMessage('user', textToSend);

        chatUIController.resetAssistantStream();
        chatUIController.setUiLoading(true, appState);
        saveCurrentChat();

        const modelDetails = modelDropdownController.getSelectedModelDetails();
        const geminiThinkingLevel = modelDetails.reasoningEffort || settingsController.getGeminiThinkingLevel(modelDetails.model);

        ipcBridge.sendUserPrompt(
            appState.messages,
            modelDetails.model,
            modelDetails.thinking,
            geminiThinkingLevel,
            appState.activeMode === 'planning',
            [],
            appState.activeMode,
            appState.currentChatId
        );
    };

    // DOM Element References for Input Orchestration
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const attachFileBtn = document.getElementById('attach-file-btn');
    const atMentionTriggerBtn = document.getElementById('at-mention-trigger-btn');
    const contextOptionsMenu = document.getElementById('context-options-menu');
    const modeOptAgent = document.getElementById('mode-opt-agent');
    const modeOptAsk = document.getElementById('mode-opt-ask');
    const modeOptPlanning = document.getElementById('mode-opt-planning');

    /**
     * Sets active mode in state and highlights the selected mode option in the @ menu.
     * @param {'agent'|'ask'|'planning'} mode Target mode.
     */
    function setActiveMode(mode) {
        appState.activeMode = mode;
        appState.isPlanningModeEnabled = (mode === 'planning');
        localStorage.setItem('kai.activeMode', mode);

        if (modeOptAgent) modeOptAgent.classList.toggle('active', mode === 'agent');
        if (modeOptAsk) modeOptAsk.classList.toggle('active', mode === 'ask');
        if (modeOptPlanning) modeOptPlanning.classList.toggle('active', mode === 'planning');

        if (atMentionTriggerBtn) {
            atMentionTriggerBtn.classList.toggle('active-mode', mode !== 'agent');
        }
    }

    if (modeOptAgent) modeOptAgent.addEventListener('click', () => { setActiveMode('agent'); if (contextOptionsMenu) contextOptionsMenu.classList.add('hidden'); });
    if (modeOptAsk) modeOptAsk.addEventListener('click', () => { setActiveMode('ask'); if (contextOptionsMenu) contextOptionsMenu.classList.add('hidden'); });
    if (modeOptPlanning) modeOptPlanning.addEventListener('click', () => { setActiveMode('planning'); if (contextOptionsMenu) contextOptionsMenu.classList.add('hidden'); });

    // Initialize initial mode from state
    setActiveMode(appState.activeMode || 'agent');

    // Delegate Proceed button inside plan card: switches mode to agent and executes
    if (chatUIController.chatContainer) {
        chatUIController.chatContainer.addEventListener('click', (e) => {
            const proceedBtn = e.target.closest('.plan-proceed-btn');
            if (proceedBtn) {
                if (appState.isWaitingForResponse) return;
                proceedBtn.disabled = true;
                setActiveMode('agent');
                if (messageInput) {
                    messageInput.value = 'Proceed with the implementation plan.';
                }
                sendMessage();
            }
        });
    }

    let isDirty = false;

    /**
     * Marks state as changed so the 500ms debounced timer will persist it.
     */
    function markDirty() {
        isDirty = true;
    }

    /**
     * Persists current active chat session to workspace state.
     */
    function saveCurrentChat() {
        const details = modelDropdownController.getSelectedModelDetails();
        ipcBridge.saveChat(appState.toChatPayload(details.thinking));
        isDirty = false;
    }

    // Auto-save interval checking every 500ms if there are unsaved state changes
    setInterval(() => {
        if (isDirty && appState.currentChatId) {
            saveCurrentChat();
        }
    }, 500);

    /**
     * Sends user prompt input to extension host or aborts ongoing generation.
     */
    function sendMessage() {
        if (appState.isWaitingForResponse) {
            ipcBridge.abort();
            chatUIController.setUiLoading(false, appState);
            chatUIController.resetAssistantStream();
            chatUIController.appendMessage('system', 'Generation stopped.');
            return;
        }

        const text = messageInput ? messageInput.value.trim() : '';
        if (!text && !appState.selectedCodeContext) {
            return;
        }

        chatUIController.resetAssistantStream();

        let userPrompt = '';
        if (appState.selectedCodeContext) {
            userPrompt += `Here is the selected code context from the editor:\n\`\`\`\n${appState.selectedCodeContext}\n\`\`\`\n\n`;
        }
        userPrompt += text;

        appState.addMessage({ role: 'user', content: userPrompt });
        const userDisplayText = text || 'Sent selected code context';
        appState.addUiEvent({ type: 'user', text: userDisplayText });

        chatUIController.appendMessage('user', userDisplayText);

        if (messageInput) {
            messageInput.value = '';
            autoResizeInput();
        }
        appState.selectedCodeContext = '';

        chatUIController.setUiLoading(true, appState);
        saveCurrentChat();

        const modelDetails = modelDropdownController.getSelectedModelDetails();
        const geminiThinkingLevel = modelDetails.reasoningEffort || settingsController.getGeminiThinkingLevel(modelDetails.model);

        const attachedFilesCopy = fileUploadController.getAttachedFiles();
        fileUploadController.clear();

        ipcBridge.sendUserPrompt(
            appState.messages,
            modelDetails.model,
            modelDetails.thinking,
            geminiThinkingLevel,
            appState.isPlanningModeEnabled,
            attachedFilesCopy,
            appState.activeMode,
            appState.currentChatId
        );
    }

    /**
     * Loads a saved chat session into state and updates UI views.
     * @param {object} chat Saved chat session object.
     */
    function loadChatSession(chat) {
        if (!chat) return;
        chatUIController.resetAssistantStream();
        appState.loadSession(chat);

        chatUIController.renderUiEvents(appState.uiEvents, appState.messages);
        modelDropdownController.setSelectedModel(appState.selectedModelValue);

        chatUIController.setUiLoading(false, appState);
        chatUIController.showView('chat');
        ipcBridge.checkConnection();
    }

    // Bind Primary UI Buttons & Input Handlers
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (atMentionTriggerBtn && contextOptionsMenu) {
        atMentionTriggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            contextOptionsMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!contextOptionsMenu.contains(e.target) && !atMentionTriggerBtn.contains(e.target)) {
                contextOptionsMenu.classList.add('hidden');
            }
        });
    }

    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            if (appState.isWaitingForResponse) {
                ipcBridge.abort();
            }
            appState.resetChat();
            chatUIController.clearChatContainer();
            chatUIController.resetAssistantStream();
            chatUIController.setUiLoading(false, appState);
            chatUIController.showView('chat');
        });
    }

    /**
     * Auto-resizes the input textarea as user types, up to MAX_HEIGHT.
     */
    function autoResizeInput() {
        if (!messageInput) return;
        messageInput.style.height = 'auto';
        const MAX_HEIGHT = 200;
        const newHeight = Math.min(messageInput.scrollHeight, MAX_HEIGHT);
        messageInput.style.height = `${newHeight}px`;
        messageInput.style.overflowY = messageInput.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
    }

    if (messageInput) {
        messageInput.addEventListener('input', autoResizeInput);
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Register Incoming IPC Message Handlers
    ipcBridge.on('initialState', (message) => {
        if (message.isRunning) {
            chatUIController.setUiLoading(true, appState);
            if (message.messages && message.messages.length > 0) {
                appState.messages = message.messages;
                chatUIController.clearChatContainer();
                appState.messages.forEach(msg => {
                    if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'file-summary') {
                        chatUIController.appendMessage(msg.role, msg.content);
                    }
                });
            }
            if (message.streamingText) {
                chatUIController.currentAssistantText = message.streamingText;
                chatUIController.appendMessage('assistant', message.streamingText);
            }
        }
    });

    ipcBridge.on('connectionStatus', (message) => {
        if (message.translations) {
            window.KAI_I18N = message.translations;
            if (messageInput && message.translations.messagePlaceholder) {
                messageInput.placeholder = message.translations.messagePlaceholder;
            }
            const thinkingLabel = document.getElementById('thinking-toggle-label');
            if (thinkingLabel && message.translations.thinkingToggle) {
                thinkingLabel.textContent = message.translations.thinkingToggle;
            }
        }
        
        settingsController.updateConnectionStatus(message);
        modelDropdownController.updateConnectionStatus(message);
    });

    ipcBridge.on('addCodeSelection', (message) => {
        appState.selectedCodeContext = message.text;
        if (messageInput) {
            messageInput.focus();
        }
    });



    const handleAgentProgress = (message) => {
        const payload = message.event || message;
        if (payload.type && !payload.progressType) {
            payload.progressType = payload.type;
        }
        chatUIController.handleAgentProgress(payload, appState);
        markDirty();
    };

    ipcBridge.on('agentProgress', handleAgentProgress);
    ipcBridge.on('toolActivity', handleAgentProgress);

    ipcBridge.on('typing', () => {
        chatUIController.setUiLoading(true, appState);
        chatUIController.resetAssistantStream();
    });

    /**
     * Handles final assistant completion replies, updates UI bubble and persists chat history.
     * @param {object} message Reply payload from extension host.
     */
    const handleReply = (message) => {
        chatUIController.setUiLoading(false, appState);
        appState.finalizeAssistantUiEvent();

        let forceThinkingCollapsed = null;
        if (chatUIController.currentAssistantMsgElement) {
            const existingThinking = chatUIController.currentAssistantMsgElement.querySelector('.thinking-content');
            if (existingThinking) {
                forceThinkingCollapsed = existingThinking.classList.contains('collapsed');
            }
        }

        const replyContent = message.content !== undefined ? message.content : (message.text || '');
        const isThinkingChecked = (settingsController && settingsController.showThinkingToggle) 
            ? settingsController.showThinkingToggle.checked 
            : (localStorage.getItem('kai.showThinking') !== 'false');
        const formatted = formatter.formatMarkdown(replyContent, forceThinkingCollapsed, isThinkingChecked);

        const modelDetails = modelDropdownController.getSelectedModelDetails();
        const effectiveMeta = {
            model: modelDetails.model,
            thinking: modelDetails.thinking,
            reasoningEffort: modelDetails.reasoningEffort,
            mode: appState.activeMode
        };

        if (chatUIController.currentAssistantMsgElement) {
            if (formatted.trim()) {
                chatUIController.currentAssistantMsgElement.querySelector('.message-content').innerHTML = formatted;
                // Append action bar if not present
                const existingActions = chatUIController.currentAssistantMsgElement.querySelector('.message-actions');
                if (!existingActions) {
                    chatUIController.currentAssistantMsgElement.appendChild(chatUIController.createAssistantActionBar(appState.activeMode, effectiveMeta));
                }
            } else {
                chatUIController.currentAssistantMsgElement.remove();
            }
        } else if (formatted.trim()) {
            chatUIController.appendMessage('assistant', replyContent, appState.activeMode, effectiveMeta);
        }

        if (message.fullHistory) {
            appState.messages = message.fullHistory;
        } else {
            appState.addMessage({ role: 'assistant', content: replyContent });
        }

        // If assistant content was not already streamed into uiEvents, add it now
        const lastEvt = appState.uiEvents[appState.uiEvents.length - 1];
        if (replyContent && (!lastEvt || lastEvt.type !== 'assistant')) {
            appState.addUiEvent({
                type: 'assistant',
                content: replyContent,
                mode: appState.activeMode,
                model: effectiveMeta.model,
                thinking: effectiveMeta.thinking,
                reasoningEffort: effectiveMeta.reasoningEffort
            });
        }

        if (message.modifiedFiles && message.modifiedFiles.length > 0) {
            appState.addMessage({ role: 'file-summary', content: JSON.stringify(message.modifiedFiles) });
            appState.addUiEvent({ type: 'file-summary', files: message.modifiedFiles });
            chatUIController.appendMessage('file-summary', JSON.stringify(message.modifiedFiles));
        }

        saveCurrentChat();
        chatUIController.resetAssistantStream();
    };

    ipcBridge.on('reply', handleReply);
    ipcBridge.on('replyComplete', handleReply);

    ipcBridge.on('replyError', (message) => {
        chatUIController.setUiLoading(false, appState);
        chatUIController.removeActivityStatus();
        chatUIController.appendMessage('system', `Error: ${message.message}`);
        saveCurrentChat();
        chatUIController.resetAssistantStream();
    });

    ipcBridge.on('chatHistory', (message) => {
        historyManager.renderHistoryList(message.chats, appState.isWaitingForResponse);
    });

    ipcBridge.on('loadChat', (message) => {
        loadChatSession(message.chat);
    });

    // Start periodic server connection health checks
    ipcBridge.checkConnection();
    setInterval(() => ipcBridge.checkConnection(), 15000);
})();
