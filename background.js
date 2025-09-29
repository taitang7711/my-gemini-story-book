// Background script for Chrome extension with side panel
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    path: 'sidepanel.html',
    enabled: true
  });
});

// Handle action click to open side panel
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openTab") {
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ tabId: tab.id });
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === "executeScript") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, request.data, (response) => {
        sendResponse(response);
      });
    });
    return true;
  }
});

// Store data in Chrome storage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveData") {
    chrome.storage.local.set({ [request.key]: request.data }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === "loadData") {
    chrome.storage.local.get([request.key], (result) => {
      sendResponse({ data: result[request.key] });
    });
    return true;
  }
  
  if (request.action === "clearData") {
    if (request.key) {
      chrome.storage.local.remove(request.key, () => {
        if (chrome.runtime.lastError) {
          console.error('Error clearing data:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log(`Data cleared for key: ${request.key}`);
          sendResponse({ success: true });
        }
      });
    } else {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          console.error('Error clearing all data:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('All data cleared');
          sendResponse({ success: true });
        }
      });
    }
    return true;
  }

  if (request.action === "downloadFile") {
    chrome.downloads.download({
      url: 'data:application/json;charset=utf-8,' + encodeURIComponent(request.data),
      filename: request.filename
    }, (downloadId) => {
      sendResponse({ success: true, downloadId });
    });
    return true;
  }

  if (request.action === "saveLog") {
    chrome.storage.local.get(['activityLogs'], (result) => {
      const logs = result.activityLogs || [];
      logs.push({
        timestamp: new Date().toISOString(),
        step: request.step,
        message: request.message,
        type: request.type || 'info'
      });
      
      // Keep only last 100 logs
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      chrome.storage.local.set({ activityLogs: logs }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
});