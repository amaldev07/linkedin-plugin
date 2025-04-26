document.getElementById('clicker').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const button = document.getElementById('ember6311');
        if (button) {
          button.click();
        } else {
          alert('Button with id "xyz" not found!');
        }
      }
    });
  });
  