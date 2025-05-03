func: async (buttonId, name, messageTemplate, resumeUrl) => {
    // --- Helpers ---
    const sleep = ms => new Promise(res => setTimeout(res, ms));
  
    async function waitForSelector(selector, timeout = 20000) {
      const interval = 200;
      let elapsed = 0;
      return new Promise((resolve, reject) => {
        const timer = setInterval(() => {
          const el = document.querySelector(selector);
          if (el) {
            clearInterval(timer);
            resolve(el);
          } else if ((elapsed += interval) >= timeout) {
            clearInterval(timer);
            reject(new Error(`Timed out waiting for "${selector}"`));
          }
        }, interval);
      });
    }
  
    function randomDelay(min = 1000, max = 2000) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
  
    // --- 1. Open the DM box ---
    const msgBtn = document.getElementById(buttonId);
    if (!msgBtn) {
      console.error(`Couldn’t find message button #${buttonId}`);
      return;
    }
    msgBtn.click();
  
    try {
      // --- 2. Wait for the editable DIV, then type the message ---
      const editor = await waitForSelector('div[contenteditable="true"]');
      console.log('Editor ready, typing…');
  
      // personalize
      const firstName = name.split(' ')[0];
      const htmlMsg = messageTemplate
        .replace(/user_name/g, firstName)
        .split('\n')
        .map(line => `<p>${line}</p>`)
        .join('');
  
      editor.focus();
      editor.innerHTML = htmlMsg;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
  
      // --- 3. Attach the resume ---
      await sleep(randomDelay());
      const fileInput = await waitForSelector('input[type="file"]');
      const res = await fetch(resumeUrl);
      const blob = await res.blob();
      const file = new File([blob], 'Resume_Amaldev.pdf', { type: blob.type });
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('Resume attached');
  
      // --- 4. Click “Send” ---
      await sleep(500); // small pause after attaching
      const sendBtn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.trim() === 'Send');
      if (sendBtn) {
        sendBtn.click();
        console.log('Message sent');
      } else {
        console.warn('Send button not found');
      }
  
      // --- 5. Close the DM overlay ---
      await sleep(1000);
      const closeBtn = Array.from(document.querySelectorAll('button.artdeco-button'))
        .find(b => b.textContent.trim().startsWith('Close your conversation'));
      if (closeBtn) {
        closeBtn.click();
        console.log('Overlay closed');
      } else {
        console.warn('Close button not found');
      }
  
    } catch (err) {
      console.error(err);
    }
  }
  