/**
 * SettingsController manages the settings panel UI, localStorage preferences,
 * custom select dropdowns, category collapse states, LM Studio server & cache configuration,
 * and external provider API keys with overlay modal.
 */
class SettingsController {
    /**
     * Initializes setting controls and registers DOM listeners.
     * @param {WebviewIPCBridge} ipcBridge IPC bridge instance.
     */
    constructor(ipcBridge) {
        this.ipcBridge = ipcBridge;

        this.serverUrlInput = document.getElementById('settings-server-url');
        this.lmStudioPathInput = document.getElementById('settings-lmstudio-path');
        this.browseLMStudioBtn = document.getElementById('browse-lmstudio-path-btn');
        this.cacheStatusDot = document.getElementById('cache-status-dot');
        this.cacheStatusText = document.getElementById('cache-status-text');

        this.showThinkingToggle = document.getElementById('show-thinking-toggle');
        this.thinkingSubsettings = document.getElementById('thinking-subsettings');
        this.keepThinkingExpandedToggle = document.getElementById('keep-thinking-expanded-toggle');
        this.keepThinkingFinishedExpandedToggle = document.getElementById('keep-thinking-finished-expanded-toggle');
        this.geminiThinkingLevelInput = document.getElementById('gemini-thinking-level-input');
        this.apiKeyInput = document.getElementById('api-key-input');

        this.keysContainer = document.getElementById('keys-container');
        this.manageKeysBtn = document.getElementById('manage-keys-btn');
        this.closeKeysBtn = document.getElementById('close-keys-btn');
        this.dynamicKeysList = document.getElementById('dynamic-keys-list');

        this.freeProviders = [...KAI_CONSTANTS.DEFAULT_FREE_PROVIDERS];
        this.providerReloadButtons = new Map();

        this.initSettings();
        this.initEventListeners();
    }

    /**
     * Initializes setting toggles and custom selects from localStorage.
     */
    initSettings() {
        const i18n = window.KAI_I18N || {};

        // 1. Show thinking process toggle
        const showContainer = document.getElementById('show-thinking-toggle-container');
        if (showContainer) {
            showContainer.innerHTML = '';
            const stored = localStorage.getItem('kai.showThinking');
            const isChecked = stored === null ? true : stored === 'true';
            const el = ToggleComponent.create({
                id: 'show-thinking-toggle',
                checked: isChecked,
                label: i18n.showThinking || 'Show thinking process',
                onChange: (checked) => {
                    localStorage.setItem('kai.showThinking', checked);
                    this.updateSubsettingsVisibility();
                }
            });
            showContainer.appendChild(el);
            this.showThinkingToggle = el.querySelector('input[type="checkbox"]');
        }

        // 2. Keep thinking expanded while generating
        const keepContainer = document.getElementById('keep-thinking-expanded-container');
        if (keepContainer) {
            keepContainer.innerHTML = '';
            const stored = localStorage.getItem('kai.keepThinkingExpanded');
            const isChecked = stored === null ? true : stored === 'true';
            const el = ToggleComponent.create({
                id: 'keep-thinking-expanded-toggle',
                checked: isChecked,
                label: i18n.keepThinkingGenerating || 'Keep thinking expanded while generating',
                onChange: (checked) => {
                    localStorage.setItem('kai.keepThinkingExpanded', checked);
                }
            });
            keepContainer.appendChild(el);
            this.keepThinkingExpandedToggle = el.querySelector('input[type="checkbox"]');
        }

        // 3. Keep thinking expanded after reasoning
        const finishedContainer = document.getElementById('keep-thinking-finished-container');
        if (finishedContainer) {
            finishedContainer.innerHTML = '';
            const stored = localStorage.getItem('kai.keepThinkingFinishedExpanded');
            const isChecked = stored === null ? false : stored === 'true';
            const el = ToggleComponent.create({
                id: 'keep-thinking-finished-expanded-toggle',
                checked: isChecked,
                label: i18n.keepThinkingFinished || 'Keep thinking expanded after reasoning',
                onChange: (checked) => {
                    localStorage.setItem('kai.keepThinkingFinishedExpanded', checked);
                }
            });
            finishedContainer.appendChild(el);
            this.keepThinkingFinishedExpandedToggle = el.querySelector('input[type="checkbox"]');
        }

        // 4. Gemini Default Thinking Level
        if (this.geminiThinkingLevelInput) {
            const storedLevel = localStorage.getItem('kai.geminiThinkingLevel');
            this.geminiThinkingLevelInput.value = storedLevel || 'high';
        }

        this.updateSubsettingsVisibility();

        // 5. Language Custom Select Dropdown
        const langContainer = document.getElementById('language-select-container');
        if (langContainer && typeof CustomSelectComponent !== 'undefined') {
            const initialLang = window.KAI_LANG || 'auto';
            const langOptions = window.KAI_SUPPORTED_LANGUAGES || [
                { value: 'auto', label: 'Auto (System Default)' },
                { value: 'en', label: 'English' },
                { value: 'nl', label: 'Nederlands' }
            ];
            this.languageSelectComponent = new CustomSelectComponent({
                container: langContainer,
                id: 'language-select-input',
                options: langOptions,
                value: initialLang,
                onChange: (selectedLang) => {
                    this.ipcBridge.updateSettings({
                        language: selectedLang
                    });
                }
            });
        }

        // 6. Stream Lookahead Delay Custom Select Dropdown (None, 100ms, 300ms, 500ms, 750ms, 1s)
        const streamDelayContainer = document.getElementById('stream-settle-delay-select-container');
        if (streamDelayContainer && typeof CustomSelectComponent !== 'undefined') {
            const storedDelay = localStorage.getItem('kai.streamSettleDelay') || '0';
            const delayOptions = [
                { value: '0', label: 'None' },
                { value: '100', label: '100ms' },
                { value: '300', label: '300ms' },
                { value: '500', label: '500ms' },
                { value: '750', label: '750ms' },
                { value: '1000', label: '1s' }
            ];
            this.streamDelayComponent = new CustomSelectComponent({
                container: streamDelayContainer,
                id: 'stream-settle-delay-select-input',
                options: delayOptions,
                value: storedDelay,
                onChange: (selectedExtraDelay) => {
                    localStorage.setItem('kai.streamSettleDelay', selectedExtraDelay);
                    const extraMs = parseInt(selectedExtraDelay, 10) || 0;
                    const baseMs = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--stream-settle-base-delay'), 10) || 150;
                    const effectiveMs = baseMs + extraMs;
                    document.documentElement.style.setProperty('--stream-settle-delay', `${effectiveMs}ms`);
                    if (window.chatUIController && typeof window.chatUIController.setStreamSettleDelay === 'function') {
                        window.chatUIController.setStreamSettleDelay(extraMs);
                    }
                }
            });
        }
    }

    /**
     * Registers event listeners for settings controls, categories, and keys overlay.
     */
    initEventListeners() {
        // Collapsible category accordion headers (independent toggle)
        const categoryBtns = document.querySelectorAll('.category-header-btn');
        categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const categoryEl = btn.closest('.settings-category');
                if (!categoryEl) return;
                
                categoryEl.classList.toggle('collapsed');
            });
        });

        if (this.browseLMStudioBtn) {
            this.browseLMStudioBtn.addEventListener('click', () => {
                this.ipcBridge.browseLMStudioFolder();
            });
        }

        if (this.serverUrlInput) {
            this.serverUrlInput.addEventListener('change', () => {
                this.saveAllSettings();
            });
        }

        if (this.lmStudioPathInput) {
            this.lmStudioPathInput.addEventListener('change', () => {
                this.saveAllSettings();
            });
        }

        if (this.geminiThinkingLevelInput) {
            this.geminiThinkingLevelInput.addEventListener('change', () => {
                localStorage.setItem('kai.geminiThinkingLevel', this.geminiThinkingLevelInput.value);
            });
        }

        if (this.apiKeyInput) {
            this.apiKeyInput.addEventListener('input', () => {
                const keyVal = this.apiKeyInput.value.trim();
                localStorage.setItem('kai.geminiApiKey', keyVal);
                localStorage.setItem('kai.apiKey', keyVal);
                if (this.settingsRepo) this.settingsRepo.setProviderKey('geminiApiKey', keyVal);
                window.dispatchEvent(new CustomEvent('kaiProviderKeysUpdated'));
            });
            this.apiKeyInput.addEventListener('change', () => {
                this.saveAllSettings();
            });
        }

        if (this.manageKeysBtn) {
            this.manageKeysBtn.addEventListener('click', () => {
                if (this.keysContainer) {
                    this.keysContainer.classList.remove('hidden');
                    this.renderProviderKeyInputs();
                }
            });
        }

        if (this.closeKeysBtn) {
            this.closeKeysBtn.addEventListener('click', () => {
                this.hideKeysOverlay();
            });
        }
    }

    /**
     * Hides the provider API keys overlay modal.
     */
    hideKeysOverlay() {
        if (this.keysContainer) {
            this.keysContainer.classList.add('hidden');
        }
    }

    /**
     * Retrieves the active Gemini reasoning level setting.
     * @param {string} modelId Model ID string.
     * @returns {string} The active reasoning level string.
     */
    getGeminiThinkingLevel(modelId) {
        if (modelId) {
            const perModel = localStorage.getItem(`kai.geminiThinkingLevel.${modelId}`);
            if (perModel) return perModel;
        }
        const globalSaved = localStorage.getItem('kai.geminiThinkingLevel');
        if (globalSaved) return globalSaved;
        if (this.geminiThinkingLevelInput) {
            return this.geminiThinkingLevelInput.value || 'high';
        }
        return 'high';
    }

    /**
     * Updates settings state and renders API key inputs when connection status arrives from extension host.
     * @param {object} message Connection status message.
     */
    updateConnectionStatus(message) {
        if (!message) return;

        if (message.type === 'providerTestResult' && message.configKey) {
            const btn = this.providerReloadButtons.get(message.configKey);
            if (btn) {
                btn.classList.remove('testing');
                if (message.success) {
                    btn.classList.remove('error');
                    btn.classList.add('success');
                    btn.innerHTML = window.KAI_SVGS.success || '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                    btn.title = 'Connected';
                } else {
                    btn.classList.remove('success');
                    btn.classList.add('error');
                    btn.innerHTML = window.KAI_SVGS.error || '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
                    btn.title = 'Connection failed';
                }
                setTimeout(() => {
                    btn.classList.remove('success', 'error');
                    btn.innerHTML = window.KAI_SVGS.refresh || '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>';
                    btn.title = 'Test connection';
                }, 2500);
            }
            return;
        }

        if (this.serverUrlInput && message.serverUrl !== undefined) {
            this.serverUrlInput.value = message.serverUrl;
        }
        if (this.lmStudioPathInput && message.lmStudioCacheDir !== undefined) {
            this.lmStudioPathInput.value = message.lmStudioCacheDir;
        }
        if (this.apiKeyInput && message.apiKey !== undefined) {
            this.apiKeyInput.value = message.apiKey;
        }

        if (message.lmStudioCacheStatus && this.cacheStatusDot && this.cacheStatusText) {
            const status = message.lmStudioCacheStatus;
            const i18n = window.KAI_I18N || {};
            if (status.valid) {
                this.cacheStatusDot.className = 'status-dot status-connected';
                const template = i18n.cacheLoaded || 'Model index loaded ({count} models detected)';
                this.cacheStatusText.textContent = `✓ ${template.replace('{count}', status.modelCount)}`;
                this.cacheStatusText.style.color = 'var(--app-success, #4ec9b0)';
            } else {
                this.cacheStatusDot.className = 'status-dot status-disconnected';
                this.cacheStatusText.textContent = `✗ ${status.error || i18n.cacheNotFound || 'Model index not found'}`;
                this.cacheStatusText.style.color = 'var(--app-danger, #f44747)';
            }
        }

        if (message.freeProviders && message.freeProviders.length > 0) {
            this.freeProviders = message.freeProviders.map(p => {
                const def = (typeof KAI_CONSTANTS !== 'undefined' && KAI_CONSTANTS.DEFAULT_FREE_PROVIDERS)
                    ? KAI_CONSTANTS.DEFAULT_FREE_PROVIDERS.find(d => d.configKey === p.configKey || d.name === p.name)
                    : null;
                return {
                    ...p,
                    docUrl: p.docUrl || (def ? def.docUrl : '')
                };
            });
        }
        this.renderProviderKeyInputs();
    }

    /**
     * Toggles visibility of thinking subsettings based on showThinkingToggle state.
     */
    updateSubsettingsVisibility() {
        if (this.thinkingSubsettings && this.showThinkingToggle) {
            if (this.showThinkingToggle.checked) {
                this.thinkingSubsettings.classList.remove('hidden');
            } else {
                this.thinkingSubsettings.classList.add('hidden');
            }
        }
    }

    /**
     * Collects all settings (Server URL, LM Studio Path, API keys) and sends updateSettings IPC.
     */
    saveAllSettings() {
        const providerKeys = {};
        document.querySelectorAll('.provider-api-key-input').forEach(input => {
            const configKey = input.dataset.configKey;
            if (configKey) {
                providerKeys[configKey] = input.value;
            }
        });

        this.ipcBridge.updateSettings({
            serverUrl: this.serverUrlInput ? this.serverUrlInput.value : 'http://localhost:1234/v1',
            lmStudioCacheDir: this.lmStudioPathInput ? this.lmStudioPathInput.value : '',
            apiKey: (this.freeProviders.find(p => p.configKey === 'geminiApiKey') || {}).apiKey || '',
            providerKeys: providerKeys
        });
    }

    /**
     * Renders API key input fields for external providers inside the keys modal overlay.
     */
    renderProviderKeyInputs() {
        if (!this.dynamicKeysList) return;
        this.dynamicKeysList.innerHTML = '';
        if (!this.providerReloadButtons) {
            this.providerReloadButtons = new Map();
        } else {
            this.providerReloadButtons.clear();
        }

        const providers = this.freeProviders && this.freeProviders.length > 0 ? this.freeProviders : KAI_CONSTANTS.DEFAULT_FREE_PROVIDERS;

        for (const provider of providers) {
            const defaultDef = (typeof KAI_CONSTANTS !== 'undefined' && KAI_CONSTANTS.DEFAULT_FREE_PROVIDERS)
                ? KAI_CONSTANTS.DEFAULT_FREE_PROVIDERS.find(d => d.configKey === provider.configKey || d.name === provider.name)
                : null;
            const docUrl = provider.docUrl || (defaultDef ? defaultDef.docUrl : '');

            const wrapper = document.createElement('div');
            wrapper.className = 'setting-item';

            // Provider Name with External Link Icon (↗)
            const labelLink = document.createElement('a');
            labelLink.className = 'provider-label-link';
            if (docUrl) {
                labelLink.href = docUrl;
                labelLink.target = '_blank';
                labelLink.rel = 'noopener noreferrer';
                labelLink.title = `Open ${provider.name} documentation`;
                labelLink.addEventListener('click', (e) => {
                    if (this.ipcBridge) {
                        e.preventDefault();
                        this.ipcBridge.sendMessage('openExternalUrl', { url: docUrl });
                    }
                });
            }

            const name = document.createElement('span');
            name.className = 'setting-label';
            name.textContent = `${provider.name} API Key`;
            labelLink.appendChild(name);

            if (docUrl) {
                const docIconSpan = document.createElement('span');
                docIconSpan.className = 'provider-doc-icon';
                docIconSpan.innerHTML = window.KAI_SVGS.external_link || '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
                labelLink.appendChild(docIconSpan);
            }

            const inputContainer = document.createElement('div');
            inputContainer.className = 'provider-input-container';

            const input = document.createElement('input');
            input.type = provider.configKey && provider.configKey.includes('Url') ? 'text' : 'password';
            input.id = `provider-key-${provider.configKey}`;
            input.className = 'settings-input provider-api-key-input';
            input.dataset.configKey = provider.configKey;
            input.placeholder = `${provider.name} API Key`;
            
            const savedKey = provider.configKey ? localStorage.getItem(`kai.${provider.configKey}`) : null;
            input.value = savedKey !== null ? savedKey : (provider.apiKey || '');
            provider.apiKey = input.value;

            const eyeSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            const eyeOffSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'toggle-password-btn';
            toggleBtn.innerHTML = eyeSvg;
            toggleBtn.title = 'Show/Hide';
            toggleBtn.addEventListener('click', () => {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                toggleBtn.innerHTML = isPassword ? eyeOffSvg : eyeSvg;
            });

            // Reload / Check Connection Button
            const reloadBtn = document.createElement('button');
            reloadBtn.type = 'button';
            reloadBtn.className = 'reload-key-btn';
            reloadBtn.innerHTML = window.KAI_SVGS.refresh || '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>';
            reloadBtn.title = 'Test connection';

            if (provider.configKey) {
                this.providerReloadButtons.set(provider.configKey, reloadBtn);
            }

            reloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (reloadBtn.classList.contains('testing')) return;

                const currentKey = input.value.trim();
                provider.apiKey = currentKey;
                if (provider.configKey) {
                    localStorage.setItem(`kai.${provider.configKey}`, currentKey);
                    if (provider.configKey === 'geminiApiKey') {
                        localStorage.setItem('kai.apiKey', currentKey);
                    }
                    if (this.settingsRepo) this.settingsRepo.setProviderKey(provider.configKey, currentKey);
                }
                this.saveAllSettings();

                reloadBtn.classList.remove('success', 'error');
                reloadBtn.classList.add('testing');
                reloadBtn.title = 'Testing connection...';

                if (this.ipcBridge) {
                    this.ipcBridge.sendMessage('testProviderConnection', {
                        configKey: provider.configKey,
                        apiKey: currentKey
                    });
                }
            });

            input.addEventListener('input', () => {
                provider.apiKey = input.value.trim();
                if (provider.configKey) {
                    localStorage.setItem(`kai.${provider.configKey}`, provider.apiKey);
                    if (provider.configKey === 'geminiApiKey') {
                        localStorage.setItem('kai.apiKey', provider.apiKey);
                    }
                    if (this.settingsRepo) this.settingsRepo.setProviderKey(provider.configKey, provider.apiKey);
                    window.dispatchEvent(new CustomEvent('kaiProviderKeysUpdated'));
                }
            });

            input.addEventListener('change', () => this.saveAllSettings());

            inputContainer.appendChild(input);
            inputContainer.appendChild(toggleBtn);

            const inputRow = document.createElement('div');
            inputRow.className = 'provider-input-row';
            inputRow.appendChild(inputContainer);
            inputRow.appendChild(reloadBtn);

            wrapper.appendChild(labelLink);
            wrapper.appendChild(inputRow);
            this.dynamicKeysList.appendChild(wrapper);
        }
    }
}
