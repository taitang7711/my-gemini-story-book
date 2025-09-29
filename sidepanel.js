// Side Panel JS - Main logic for Chrome extension side panel
class StorybookTTSSidePanel {
    constructor() {
        this.currentStep = 1;
        this.storybookData = null;
        this.audioData = null;
        this.autoCheckInterval = null;
        this.audioGenerationPaused = false;
        this.currentAudioIndex = 0;
        this.init();
    }

    async init() {
        await this.loadStoredData();
        this.setupEventListeners();
        this.updateUI();
        await this.loadLogs();
        this.logActivity(0, 'Extension initialized', 'info');
    }

    setupEventListeners() {
        // Step 1 - Gemini Storybook
        document.getElementById('openGeminiBtn').addEventListener('click', () => {
            this.openGeminiTab();
        });

        document.getElementById('sendPromptBtn').addEventListener('click', () => {
            this.sendPromptToGemini();
        });

        // Step 2 - Extract Data
        document.getElementById('extractDataBtn').addEventListener('click', () => {
            this.extractStorybookData();
        });

        document.getElementById('checkDataBtn').addEventListener('click', () => {
            this.checkStorybookData();
        });

        document.getElementById('autoCheckBtn').addEventListener('click', () => {
            this.toggleAutoCheck();
        });

        // Step 3 - Generate Audio
        document.getElementById('openAIStudioBtn').addEventListener('click', () => {
            this.openAIStudioTab();
        });

        document.getElementById('generateAudioBtn').addEventListener('click', () => {
            this.generateAudio();
        });

        document.getElementById('pauseAudioBtn').addEventListener('click', () => {
            this.toggleAudioGeneration();
        });

        // Step 4 - Export
        document.getElementById('exportDataBtn').addEventListener('click', () => {
            this.exportFinalData('json');
        });

        document.getElementById('exportTxtBtn').addEventListener('click', () => {
            this.exportFinalData('txt');
        });

        document.getElementById('clearAllDataBtn').addEventListener('click', () => {
            this.clearAllData();
        });

        // Auto-save inputs
        document.getElementById('promptInput').addEventListener('input', () => {
            this.saveData('promptInput', document.getElementById('promptInput').value);
        });

        document.getElementById('styleInstruction').addEventListener('input', () => {
            this.saveData('styleInstruction', document.getElementById('styleInstruction').value);
        });
        
        // Logs section buttons - Add event listeners to override onclick handlers
        try {
            // Override refresh logs button
            const refreshLogsBtn = document.querySelector('button[onclick="refreshLogs()"]');
            if (refreshLogsBtn) {
                refreshLogsBtn.removeAttribute('onclick');
                refreshLogsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('Refresh logs button clicked');
                    this.loadLogs();
                });
                console.log('Refresh logs button event listener added');
            }
            
            // Override clear logs button
            const clearLogsBtn = document.querySelector('button[onclick="clearLogs()"]');
            if (clearLogsBtn) {
                clearLogsBtn.removeAttribute('onclick');
                clearLogsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('Clear logs button clicked');
                    this.clearAllLogs();
                });
                console.log('Clear logs button event listener added');
            }
        } catch (error) {
            console.error('Error setting up logs button event listeners:', error);
        }
        
        // Add event listeners for clear step data buttons to override onclick
        try {
            // Find all buttons with onclick="clearStepData(...)"
            const clearButtons = document.querySelectorAll('button[onclick*="clearStepData"]');
            console.log(`Found ${clearButtons.length} clear step data buttons`);
            
            clearButtons.forEach(button => {
                // Extract step number from onclick attribute
                const onclickAttr = button.getAttribute('onclick');
                const stepMatch = onclickAttr.match(/clearStepData\((\d+)\)/);
                
                if (stepMatch) {
                    const step = parseInt(stepMatch[1]);
                    console.log(`Setting up clear button for step ${step}`);
                    
                    // Remove onclick attribute to prevent conflicts
                    button.removeAttribute('onclick');
                    
                    // Add proper event listener
                    button.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log(`Clear button clicked for step ${step}`);
                        await this.clearStepData(step);
                    });
                }
            });
        } catch (error) {
            console.error('Error setting up clear step data buttons:', error);
        }
    }

    async openGeminiTab() {
        this.updateStatus(1, '🌐 Đang mở Gemini Storybook...', 'info');
        this.logActivity(1, 'Opening Gemini Storybook tab', 'info');
        
        try {
            const response = await this.sendMessage({
                action: "openTab",
                url: "https://gemini.google.com/gem/storybook"
            });
            
            this.updateStatus(1, '✅ Đã mở Gemini Storybook. Vui lòng chờ trang tải xong.', 'success');
            this.logActivity(1, 'Gemini Storybook tab opened successfully', 'success');
            
            // Enable send button after delay
            setTimeout(() => {
                document.getElementById('sendPromptBtn').disabled = false;
            }, 3000);
        } catch (error) {
            this.updateStatus(1, `❌ Lỗi: ${error.message}`, 'error');
            this.logActivity(1, `Error opening Gemini tab: ${error.message}`, 'error');
        }
    }

    async sendPromptToGemini() {
        const prompt = document.getElementById('promptInput').value.trim();
        if (!prompt) {
            this.updateStatus(1, '⚠️ Vui lòng nhập prompt', 'warning');
            this.logActivity(1, 'Attempted to send empty prompt', 'warning');
            return;
        }

        this.updateStatus(1, '📤 Đang gửi prompt...', 'info');
        this.logActivity(1, `Sending prompt: ${prompt.substring(0, 50)}...`, 'info');
        
        try {
            const response = await this.sendMessage({
                action: "executeScript",
                data: { action: "sendPrompt", prompt: prompt }
            });

            if (response && response.success) {
                this.updateStatus(1, '✅ Đã gửi prompt thành công! Chờ Gemini tạo storybook...', 'success');
                this.logActivity(1, 'Prompt sent successfully to Gemini', 'success');
                
                this.currentStep = 2;
                this.updateUI();
                document.getElementById('extractDataBtn').disabled = false;
                document.getElementById('checkDataBtn').disabled = false;
                document.getElementById('autoCheckBtn').disabled = false;
                
                // Auto-save progress
                await this.saveData('currentStep', this.currentStep);
            } else {
                this.updateStatus(1, '❌ Lỗi khi gửi prompt', 'error');
                this.logActivity(1, 'Failed to send prompt to Gemini', 'error');
            }
        } catch (error) {
            this.updateStatus(1, `❌ Lỗi: ${error.message}`, 'error');
            this.logActivity(1, `Error sending prompt: ${error.message}`, 'error');
        }
    }

    async extractStorybookData() {
        this.updateStatus(2, '📥 Đang trích xuất dữ liệu...', 'info');
        this.logActivity(2, 'Starting data extraction from Gemini Storybook', 'info');
        
        try {
            const response = await this.sendMessage({
                action: "executeScript",
                data: { action: "extractData" }
            });

            if (response && response.data) {
                this.storybookData = response.data;
                await this.saveData('storybookData', this.storybookData);
                this.displayStorybookData(this.storybookData);
                
                const pagesCount = this.storybookData.pages ? this.storybookData.pages.length : 0;
                this.updateStatus(2, `✅ Trích xuất thành công! Tìm thấy ${pagesCount} trang.`, 'success');
                this.logActivity(2, `Data extracted successfully: ${pagesCount} pages, cover: ${this.storybookData.cover ? 'yes' : 'no'}`, 'success');
                
                // Check if data is complete
                if (this.isStorybookDataComplete(this.storybookData)) {
                    this.currentStep = 3;
                    this.updateUI();
                    document.getElementById('openAIStudioBtn').disabled = false;
                    await this.saveData('currentStep', this.currentStep);
                    this.logActivity(2, 'Storybook data is complete, ready for TTS generation', 'success');
                }
            } else {
                this.updateStatus(2, '⚠️ Chưa có dữ liệu. Vui lòng đợi Gemini tạo xong storybook.', 'warning');
                this.logActivity(2, 'No data found - storybook not ready yet', 'warning');
            }
        } catch (error) {
            this.updateStatus(2, `❌ Lỗi: ${error.message}`, 'error');
            this.logActivity(2, `Error extracting data: ${error.message}`, 'error');
        }
    }

    async checkStorybookData() {
        await this.extractStorybookData();
    }

    toggleAutoCheck() {
        if (this.autoCheckInterval) {
            clearInterval(this.autoCheckInterval);
            this.autoCheckInterval = null;
            document.getElementById('autoCheckBtn').textContent = '⏰ Auto Check (30s)';
            this.logActivity(2, 'Auto-check disabled', 'info');
        } else {
            this.autoCheckInterval = setInterval(() => {
                this.extractStorybookData();
            }, 30000);
            document.getElementById('autoCheckBtn').textContent = '⏹️ Stop Auto Check';
            this.logActivity(2, 'Auto-check enabled (30s interval)', 'info');
        }
    }

    isStorybookDataComplete(data) {
        return data && 
               data.cover && 
               data.pages && 
               data.pages.length > 0 &&
               data.pages.every(page => page.text && page.image);
    }

    displayStorybookData(data) {
        if (!data) return;

        document.getElementById('storybookData').classList.remove('hidden');
        
        // Display in table
        const tbody = document.getElementById('storybookTableBody');
        tbody.innerHTML = '';

        if (data.cover) {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = 'Cover';
            row.insertCell(1).textContent = `${data.cover.title} - ${data.cover.author}`;
            row.insertCell(2).textContent = data.cover.image ? '✅ Có' : '❌ Không';
        }

        if (data.pages && data.pages.length > 0) {
            data.pages.forEach(page => {
                const row = tbody.insertRow();
                row.insertCell(0).textContent = page.pageNumber || 'N/A';
                row.insertCell(1).textContent = page.text ? page.text.substring(0, 50) + '...' : '❌ Không có';
                row.insertCell(2).textContent = page.image ? '✅ Có' : '❌ Không';
            });
        }

        // Display raw JSON
        document.getElementById('rawStorybookData').value = JSON.stringify(data, null, 2);
    }

    async openAIStudioTab() {
        this.updateStatus(3, '🌐 Đang mở AI Studio...', 'info');
        this.logActivity(3, 'Opening AI Studio tab', 'info');
        
        try {
            await this.sendMessage({
                action: "openTab",
                url: "https://aistudio.google.com/generate-speech"
            });
            
            this.updateStatus(3, '✅ Đã mở AI Studio. Vui lòng chờ trang tải xong.', 'success');
            this.logActivity(3, 'AI Studio tab opened successfully', 'success');
            
            setTimeout(() => {
                document.getElementById('generateAudioBtn').disabled = false;
            }, 3000);
        } catch (error) {
            this.updateStatus(3, `❌ Lỗi: ${error.message}`, 'error');
            this.logActivity(3, `Error opening AI Studio: ${error.message}`, 'error');
        }
    }

    async generateAudio() {
        if (!this.storybookData || !this.storybookData.pages) {
            this.updateStatus(3, '❌ Không có dữ liệu storybook để tạo audio', 'error');
            this.logActivity(3, 'Cannot generate audio - no storybook data', 'error');
            return;
        }

        const styleInstruction = document.getElementById('styleInstruction').value.trim();
        document.getElementById('audioProgress').classList.remove('hidden');
        document.getElementById('pauseAudioBtn').disabled = false;
        
        this.updateStatus(3, '🎵 Đang tạo audio cho từng trang...', 'info');
        this.logActivity(3, `Starting audio generation for ${this.storybookData.pages.length} pages`, 'info');

        this.audioGenerationPaused = false;
        this.currentAudioIndex = 0;

        try {
            const audioResults = [];
            const pages = this.storybookData.pages;

            for (let i = this.currentAudioIndex; i < pages.length; i++) {
                if (this.audioGenerationPaused) {
                    this.logActivity(3, `Audio generation paused at page ${i + 1}`, 'info');
                    break;
                }

                const page = pages[i];
                this.currentAudioIndex = i;
                
                this.updateAudioProgress(`🎙️ Đang xử lý trang ${i + 1}/${pages.length}: ${page.pageNumber}`);
                this.updateAudioProgressBar((i / pages.length) * 100);

                const response = await this.sendMessage({
                    action: "executeScript",
                    data: {
                        action: "generateTTS",
                        text: page.text,
                        styleInstruction: styleInstruction
                    }
                });

                if (response && response.audioSrc) {
                    audioResults.push({
                        pageNumber: page.pageNumber,
                        audioSrc: response.audioSrc
                    });
                    
                    this.updateAudioProgress(`✅ Hoàn thành trang ${i + 1}/${pages.length}`);
                    this.logActivity(3, `Audio generated for page ${page.pageNumber}`, 'success');
                } else {
                    this.updateAudioProgress(`❌ Lỗi trang ${i + 1}: Không tạo được audio`);
                    this.logActivity(3, `Failed to generate audio for page ${page.pageNumber}`, 'error');
                }

                // Wait between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            this.audioData = audioResults;
            await this.saveData('audioData', this.audioData);
            
            this.updateStatus(3, `🎉 Đã tạo xong ${audioResults.length}/${pages.length} audio`, 'success');
            this.logActivity(3, `Audio generation completed: ${audioResults.length}/${pages.length} successful`, 'success');
            
            this.updateAudioProgressBar(100);
            this.currentStep = 4;
            this.updateUI();
            document.getElementById('exportDataBtn').disabled = false;
            document.getElementById('exportTxtBtn').disabled = false;
            await this.saveData('currentStep', this.currentStep);

        } catch (error) {
            this.updateStatus(3, `❌ Lỗi: ${error.message}`, 'error');
            this.logActivity(3, `Error in audio generation: ${error.message}`, 'error');
        } finally {
            document.getElementById('pauseAudioBtn').disabled = true;
        }
    }

    toggleAudioGeneration() {
        this.audioGenerationPaused = !this.audioGenerationPaused;
        const btn = document.getElementById('pauseAudioBtn');
        
        if (this.audioGenerationPaused) {
            btn.textContent = '▶️ Tiếp tục';
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-success');
            this.logActivity(3, 'Audio generation paused by user', 'info');
        } else {
            btn.textContent = '⏸️ Tạm dừng';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-secondary');
            this.logActivity(3, 'Audio generation resumed by user', 'info');
        }
    }

    updateAudioProgress(message) {
        document.getElementById('audioProgressDetail').innerHTML = `<div class="spinner"></div>${message}`;
    }

    updateAudioProgressBar(percentage) {
        document.getElementById('audioProgressBar').style.width = `${percentage}%`;
    }

    async exportFinalData(format = 'json') {
        if (!this.storybookData) {
            this.updateStatus(4, '❌ Không có dữ liệu để xuất', 'error');
            this.logActivity(4, 'Export failed - no data available', 'error');
            return;
        }

        // Combine storybook data with audio data
        const finalData = JSON.parse(JSON.stringify(this.storybookData));

        if (this.audioData && this.audioData.length > 0) {
            finalData.pages = finalData.pages.map(page => {
                const audio = this.audioData.find(a => a.pageNumber == page.pageNumber);
                return {
                    ...page,
                    audioSrc: audio ? audio.audioSrc : null
                };
            });
        }

        // Display final data
        document.getElementById('finalData').classList.remove('hidden');

        if (format === 'json') {
            const jsonContent = JSON.stringify(finalData, null, 2);
            document.getElementById('finalJsonData').value = jsonContent;
            
            // Download JSON file
            await this.downloadFile(jsonContent, 'storybook-with-audio.json', 'json');
            this.updateStatus(4, '✅ Đã xuất file JSON thành công!', 'success');
            this.logActivity(4, 'JSON export completed successfully', 'success');
            
        } else if (format === 'txt') {
            const txtContent = this.convertToTxt(finalData);
            document.getElementById('finalJsonData').value = txtContent;
            
            // Download TXT file
            await this.downloadFile(txtContent, 'storybook-with-audio.txt', 'txt');
            this.updateStatus(4, '✅ Đã xuất file TXT thành công!', 'success');
            this.logActivity(4, 'TXT export completed successfully', 'success');
        }
    }

    convertToTxt(data) {
        let txtContent = '';
        
        if (data.cover) {
            txtContent += `STORYBOOK\n`;
            txtContent += `Title: ${data.cover.title}\n`;
            txtContent += `Author: ${data.cover.author}\n`;
            txtContent += `Cover Image: ${data.cover.image}\n\n`;
        }

        txtContent += `PAGES:\n\n`;

        if (data.pages && data.pages.length > 0) {
            data.pages.forEach((page, index) => {
                txtContent += `Page ${page.pageNumber || index + 1}:\n`;
                txtContent += `Text: ${page.text}\n`;
                txtContent += `Image: ${page.image}\n`;
                if (page.audioSrc) {
                    txtContent += `Audio: ${page.audioSrc}\n`;
                }
                txtContent += `\n`;
            });
        }

        return txtContent;
    }

    async downloadFile(content, filename, type) {
        const mimeType = type === 'json' ? 'application/json' : 'text/plain';
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async clearStepData(step) {
        console.log(`Extension clearStepData called with step: ${step}`);
        
        const stepNames = {
            1: 'Prompt Input',
            2: 'Storybook Data',
            3: 'Audio Data',
            4: 'Export Data'
        };

        if (confirm(`Bạn có chắc muốn xóa dữ liệu bước ${step} (${stepNames[step]})?`)) {
            try {
                console.log(`Clearing step ${step} data...`);
                
                switch (step) {
                    case 1:
                        const promptInput = document.getElementById('promptInput');
                        if (promptInput) {
                            promptInput.value = '';
                        } else {
                            console.warn('promptInput element not found');
                        }
                        
                        await this.clearData('promptInput');
                        this.updateStatus(1, '🗑️ Đã xóa prompt input', 'info');
                        
                        // Reset to step 1 if we cleared prompt
                        if (this.currentStep > 1) {
                            this.currentStep = 1;
                            await this.saveData('currentStep', this.currentStep);
                        }
                        break;
                        
                    case 2:
                        this.storybookData = null;
                        await this.clearData('storybookData');
                        
                        const storybookDataEl = document.getElementById('storybookData');
                        if (storybookDataEl) {
                            storybookDataEl.classList.add('hidden');
                        }
                        
                        const rawStorybookData = document.getElementById('rawStorybookData');
                        if (rawStorybookData) {
                            rawStorybookData.value = '';
                        }
                        
                        const tbody = document.getElementById('storybookTableBody');
                        if (tbody) {
                            tbody.innerHTML = '';
                        }
                        
                        this.updateStatus(2, '🗑️ Đã xóa dữ liệu storybook', 'info');
                        
                        // Reset to step 2 if we cleared storybook data
                        if (this.currentStep > 2) {
                            this.currentStep = 2;
                            await this.saveData('currentStep', this.currentStep);
                        }
                        break;
                        
                    case 3:
                        this.audioData = null;
                        await this.clearData('audioData');
                        
                        const audioProgress = document.getElementById('audioProgress');
                        if (audioProgress) {
                            audioProgress.classList.add('hidden');
                        }
                        
                        const audioProgressDetail = document.getElementById('audioProgressDetail');
                        if (audioProgressDetail) {
                            audioProgressDetail.innerHTML = '';
                        }
                        
                        const audioProgressBar = document.getElementById('audioProgressBar');
                        if (audioProgressBar) {
                            audioProgressBar.style.width = '0%';
                        }
                        
                        this.updateStatus(3, '🗑️ Đã xóa dữ liệu audio', 'info');
                        
                        // Reset to step 3 if we cleared audio data
                        if (this.currentStep > 3) {
                            this.currentStep = 3;
                            await this.saveData('currentStep', this.currentStep);
                        }
                        break;
                        
                    case 4:
                        const finalData = document.getElementById('finalData');
                        if (finalData) {
                            finalData.classList.add('hidden');
                        }
                        
                        const finalJsonData = document.getElementById('finalJsonData');
                        if (finalJsonData) {
                            finalJsonData.value = '';
                        }
                        
                        this.updateStatus(4, '🗑️ Đã xóa dữ liệu export', 'info');
                        break;
                }
                
                // Update UI after clearing
                this.updateUI();
                await this.logActivity(step, `Step ${step} data cleared successfully`, 'info');
                console.log(`Step ${step} data cleared successfully`);
                
            } catch (error) {
                console.error('Error clearing step data:', error);
                this.updateStatus(step, `❌ Lỗi xóa dữ liệu: ${error.message}`, 'error');
                await this.logActivity(step, `Error clearing step ${step}: ${error.message}`, 'error');
            }
        } else {
            console.log(`User cancelled clearing step ${step}`);
        }
    }

    async clearAllData() {
        if (confirm('Bạn có chắc muốn xóa tất cả dữ liệu?')) {
            try {
                // Stop any ongoing processes
                if (this.autoCheckInterval) {
                    clearInterval(this.autoCheckInterval);
                    this.autoCheckInterval = null;
                }
                this.audioGenerationPaused = true;
                
                // Clear storage
                await this.clearStorage();
                
                // Reset variables
                this.currentStep = 1;
                this.storybookData = null;
                this.audioData = null;
                this.currentAudioIndex = 0;
                
                // Clear UI elements
                document.getElementById('promptInput').value = '';
                document.getElementById('styleInstruction').value = 'Read this like a children\'s story with a gentle, warm voice';
                document.getElementById('storybookData').classList.add('hidden');
                document.getElementById('audioProgress').classList.add('hidden');
                document.getElementById('finalData').classList.add('hidden');
                document.getElementById('rawStorybookData').value = '';
                document.getElementById('finalJsonData').value = '';
                
                // Clear table data
                const tbody = document.getElementById('storybookTableBody');
                if (tbody) tbody.innerHTML = '';
                
                // Clear progress bars
                document.getElementById('audioProgressDetail').innerHTML = '';
                document.getElementById('audioProgressBar').style.width = '0%';
                
                // Reset button states
                document.getElementById('autoCheckBtn').textContent = '⏰ Auto Check (30s)';
                document.getElementById('pauseAudioBtn').textContent = '⏸️ Tạm dừng';
                document.getElementById('pauseAudioBtn').classList.remove('btn-success');
                document.getElementById('pauseAudioBtn').classList.add('btn-secondary');
                
                // Update UI and status
                this.updateUI();
                this.updateStatus(1, '🗑️ Đã xóa tất cả dữ liệu', 'info');
                await this.logActivity(0, 'All data cleared by user', 'info');
                
            } catch (error) {
                console.error('Error clearing all data:', error);
                this.updateStatus(1, `❌ Lỗi xóa dữ liệu: ${error.message}`, 'error');
                await this.logActivity(0, `Error clearing all data: ${error.message}`, 'error');
            }
        }
    }

    updateUI() {
        // Update progress bar
        const progress = (this.currentStep / 4) * 100;
        document.getElementById('progressFill').style.width = progress + '%';

        // Update step states
        for (let i = 1; i <= 4; i++) {
            const step = document.getElementById(`step${i}`);
            step.classList.remove('active', 'completed');
            
            if (i < this.currentStep) {
                step.classList.add('completed');
            } else if (i === this.currentStep) {
                step.classList.add('active');
            }
        }

        // Update button states based on current step
        this.updateButtonStates();
    }

    updateButtonStates() {
        // Reset all buttons
        const buttons = document.querySelectorAll('button:not(.btn-danger):not(#clearAllDataBtn):not(#autoCheckBtn):not(#pauseAudioBtn)');
        buttons.forEach(btn => {
            btn.disabled = true;
        });

        // Enable appropriate buttons based on current step
        if (this.currentStep >= 1) {
            document.getElementById('openGeminiBtn').disabled = false;
        }
        
        if (this.currentStep >= 2) {
            document.getElementById('extractDataBtn').disabled = false;
            document.getElementById('checkDataBtn').disabled = false;
            document.getElementById('autoCheckBtn').disabled = false;
        }
        
        if (this.currentStep >= 3) {
            document.getElementById('openAIStudioBtn').disabled = false;
        }
        
        if (this.currentStep >= 4) {
            document.getElementById('exportDataBtn').disabled = false;
            document.getElementById('exportTxtBtn').disabled = false;
        }
    }

    updateStatus(step, message, type) {
        const statusEl = document.getElementById(`status${step}`);
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
    }

    async sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    async saveData(key, data) {
        await this.sendMessage({
            action: "saveData",
            key: key,
            data: data
        });
    }

    async loadData(key) {
        const response = await this.sendMessage({
            action: "loadData",
            key: key
        });
        return response ? response.data : null;
    }

    async clearData(key) {
        try {
            const response = await this.sendMessage({
                action: "clearData",
                key: key
            });
            if (!response || !response.success) {
                throw new Error(`Failed to clear data for key: ${key}`);
            }
            return response;
        } catch (error) {
            console.error(`Error clearing data for key ${key}:`, error);
            throw error;
        }
    }

    async clearStorage() {
        try {
            const response = await this.sendMessage({
                action: "clearData"
            });
            if (!response || !response.success) {
                throw new Error('Failed to clear all storage');
            }
            return response;
        } catch (error) {
            console.error('Error clearing all storage:', error);
            throw error;
        }
    }

    async logActivity(step, message, type) {
        await this.sendMessage({
            action: "saveLog",
            step: step,
            message: message,
            type: type
        });
        
        // Update logs display if visible
        await this.loadLogs();
    }

    async loadLogs() {
        try {
            const logs = await this.loadData('activityLogs');
            const logsContainer = document.getElementById('logsContainer');
            
            if (logs && logs.length > 0) {
                logsContainer.innerHTML = '';
                
                logs.slice(-20).forEach(log => { // Show last 20 logs
                    const logEntry = document.createElement('div');
                    logEntry.className = `log-entry ${log.type}`;
                    logEntry.textContent = `[${new Date(log.timestamp).toLocaleString()}] Step ${log.step}: ${log.message}`;
                    logsContainer.appendChild(logEntry);
                });
                
                // Scroll to bottom
                logsContainer.scrollTop = logsContainer.scrollHeight;
            } else {
                logsContainer.innerHTML = '<div class="log-entry info">No logs available</div>';
            }
        } catch (error) {
            console.error('Error loading logs:', error);
            const logsContainer = document.getElementById('logsContainer');
            if (logsContainer) {
                logsContainer.innerHTML = '<div class="log-entry error">Error loading logs</div>';
            }
        }
    }
    
    async clearAllLogs() {
        try {
            if (confirm('Bạn có chắc muốn xóa tất cả logs?')) {
                await this.clearData('activityLogs');
                const logsContainer = document.getElementById('logsContainer');
                if (logsContainer) {
                    logsContainer.innerHTML = '<div class="log-entry info">Logs cleared</div>';
                }
                console.log('Activity logs cleared successfully');
                // Log the clear action
                await this.logActivity(0, 'Activity logs cleared by user', 'info');
            }
        } catch (error) {
            console.error('Error clearing logs:', error);
            alert('Lỗi xóa logs: ' + error.message);
        }
    }

    async loadStoredData() {
        try {
            // Load stored data
            const promptInput = await this.loadData('promptInput');
            const styleInstruction = await this.loadData('styleInstruction');
            const currentStep = await this.loadData('currentStep');
            this.storybookData = await this.loadData('storybookData');
            this.audioData = await this.loadData('audioData');

            // Restore UI
            if (promptInput) {
                document.getElementById('promptInput').value = promptInput;
            }
            if (styleInstruction) {
                document.getElementById('styleInstruction').value = styleInstruction;
            }

            // Determine current step
            if (currentStep && currentStep > 0) {
                this.currentStep = currentStep;
            } else {
                // Determine step based on available data
                if (this.audioData && this.audioData.length > 0) {
                    this.currentStep = 4;
                } else if (this.storybookData && this.isStorybookDataComplete(this.storybookData)) {
                    this.currentStep = 3;
                } else if (this.storybookData) {
                    this.currentStep = 2;
                } else {
                    this.currentStep = 1;
                }
            }

            // Display loaded data
            if (this.storybookData) {
                this.displayStorybookData(this.storybookData);
            }

        } catch (error) {
            console.error('Error loading stored data:', error);
        }
    }
}

// Global functions for UI interactions
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const parent = section.previousElementSibling;
    
    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        parent.classList.remove('collapsed');
    } else {
        section.classList.add('hidden');
        parent.classList.add('collapsed');
    }
}

// Global fallback function for onclick handlers (should not be needed if event listeners work)
async function clearStepData(step) {
    console.log(`Global clearStepData called with step: ${step} (fallback method)`);
    
    try {
        // Check if extension is initialized
        if (!window.storybookExtension) {
            console.warn('Extension not initialized yet, waiting...');
            // Wait up to 5 seconds for extension to initialize
            let attempts = 0;
            while (!window.storybookExtension && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }
            
            if (!window.storybookExtension) {
                throw new Error('Extension failed to initialize after 5 seconds');
            }
        }
        
        // Check if clearStepData method exists
        if (typeof window.storybookExtension.clearStepData !== 'function') {
            throw new Error('clearStepData method not available on extension');
        }
        
        console.log('Calling extension clearStepData method...');
        // Call the extension method (it's async so we should await it)
        await window.storybookExtension.clearStepData(step);
        console.log(`Successfully cleared step ${step} data`);
        
    } catch (error) {
        console.error('Error in global clearStepData:', error);
        alert(`Lỗi xóa dữ liệu bước ${step}: ${error.message}`);
    }
}

function refreshLogs() {
    console.log('Global refreshLogs called (fallback)');
    if (window.storybookExtension && typeof window.storybookExtension.loadLogs === 'function') {
        window.storybookExtension.loadLogs();
    } else {
        console.error('Extension not initialized or loadLogs method not available');
    }
}

function clearLogs() {
    console.log('Global clearLogs called (fallback)');
    if (window.storybookExtension && typeof window.storybookExtension.clearAllLogs === 'function') {
        window.storybookExtension.clearAllLogs();
    } else {
        console.error('Extension not initialized or clearAllLogs method not available');
    }
}

// Initialize the extension when side panel loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Side panel DOM loaded, initializing extension...');
    try {
        window.storybookExtension = new StorybookTTSSidePanel();
        console.log('Storybook extension initialized successfully');
        console.log('Extension object:', window.storybookExtension);
        console.log('clearStepData method available:', typeof window.storybookExtension.clearStepData);
        
        // Add a small delay to ensure all elements are ready
        setTimeout(() => {
            console.log('Extension ready for user interaction');
            
            // Test if clear buttons are working
            const clearButtons = document.querySelectorAll('button[title*="Xóa dữ liệu"]');
            console.log(`Found ${clearButtons.length} clear buttons with titles`);
        }, 500);
        
    } catch (error) {
        console.error('Error initializing storybook extension:', error);
        alert('Lỗi khởi tạo extension: ' + error.message);
    }
});