const autoBtn = document.getElementById('autoCapture');
const fullBtn = document.getElementById('fullPage');
const pickBtn = document.getElementById('pickElement');
const status = document.getElementById('status');

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureInjected(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

autoBtn.addEventListener('click', async () => {
  status.textContent = 'Detecting & scrolling…';
  try {
    const tab = await getActiveTab();
    await ensureInjected(tab.id);
    chrome.tabs.sendMessage(tab.id, { type: 'AUTO_CAPTURE' }, (res) => {
      if (chrome.runtime.lastError) {
        status.textContent = 'Error: ' + chrome.runtime.lastError.message;
        return;
      }
      status.textContent = res && res.ok ? 'Done — check your downloads.' : 'Failed: ' + (res && res.error);
    });
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
  }
});

fullBtn.addEventListener('click', async () => {
  status.textContent = 'Capturing…';
  try {
    const tab = await getActiveTab();
    await ensureInjected(tab.id);
    chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_FULL_PAGE' }, (res) => {
      if (chrome.runtime.lastError) {
        status.textContent = 'Error: ' + chrome.runtime.lastError.message;
        return;
      }
      status.textContent = res && res.ok ? 'Done — check your downloads.' : 'Failed: ' + (res && res.error);
    });
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
  }
});

pickBtn.addEventListener('click', async () => {
  try {
    const tab = await getActiveTab();
    await ensureInjected(tab.id);
    chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_PICK' });
    window.close();
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
  }
});
