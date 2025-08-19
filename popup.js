// Automatically execute the script when the plugin is opened

chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const [tab] = tabs;

    // Preload the resume file from your extension
    const resumeUrl = chrome.runtime.getURL('resume/resume.pdf');
    const resumeResponse = await fetch(resumeUrl);
    const resumeBlob = await resumeResponse.blob();
    const resumeFile = new File([resumeBlob], 'resume.pdf', { type: resumeBlob.type });

    // Inject script into the active tab
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            // Function to extract user list data from the DOM
            function getUserListData() {
                // const listItems = document.querySelectorAll('ul[role="list"] li');
                const listItems = document.querySelectorAll('div div a div div'); // Updated selector
                const result = [];

                listItems.forEach((li) => {
                    // const nameElement = li.querySelector('span.entity-result__title-text > a > span[aria-hidden="true"]'); // Updated selector
                    const nameElement = li.querySelector('div p a'); // Updated selector
                    const name = nameElement ? nameElement.textContent.trim() : null;

                    const button = li.querySelector('div > div > div > a'); // Selector for the message button remains the same
                    const buttonId = button ? button.attributes.componentkey.value : null;

                    if (name && buttonId) {
                        result.push({ name, buttonId });
                    }
                });

                return result;
            }
            return getUserListData();
        },
    }, (injectionResults) => {
        if (!injectionResults || !injectionResults[0]) {
            console.error('Failed to inject script or no results returned.');
            return;
        }

        const data = injectionResults[0].result;
        console.log('Extracted Data:', data); // Debugging log

        if (!data || data.length === 0) {
            console.error('No data extracted. Ensure the active tab contains the required elements.');
            return;
        }

        // Create a table element
        const table = document.createElement('table');
        table.border = '1';

        // Create table header
        const headerRow = document.createElement('tr');
        ['Name', 'Button ID', 'Action'].forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        // Populate table rows with data
        data.forEach((item) => {
            const row = document.createElement('tr');

            // Name column
            const nameCell = document.createElement('td');
            nameCell.textContent = item.name;
            row.appendChild(nameCell);

            // Button ID column
            const buttonIdCell = document.createElement('td');
            buttonIdCell.textContent = item.buttonId;
            row.appendChild(buttonIdCell);

            // Action column with msg button only
            const actionCell = document.createElement('td');

            // Msg button
            const msgButton = document.createElement('button');
            msgButton.textContent = 'Msg';

            // Modify the 'Msg' button functionality to dynamically load the message from message.txt
            msgButton.addEventListener('click', () => {
                // Change the row's background color to light green
                row.style.backgroundColor = 'lightgreen';

                // Read the message from message.txt dynamically
                fetch(chrome.runtime.getURL('message.txt'))
                    .then(response => response.text())
                    .then(messageTemplate => {
                        // Use the buttonId to find and click the message button in the DOM
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            world: 'MAIN',
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

                                async function waitForLinkedInEditor(timeout = 15000) {
                                    const sleep = ms => new Promise(r => setTimeout(r, ms));

                                    function visible(el) {
                                        const r = el.getBoundingClientRect();
                                        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
                                    }

                                    function* roots(root) {
                                        yield root;
                                        if (root.shadowRoot) yield* roots(root.shadowRoot);
                                        for (const f of root.querySelectorAll('iframe')) {
                                            try { if (f.contentDocument) yield* roots(f.contentDocument); } catch { }
                                        }
                                    }

                                    const start = Date.now();
                                    while (Date.now() - start < timeout) {
                                        // Prefer truly editable elements
                                        for (const r of roots(document)) {
                                            const el = Array.from(r.querySelectorAll('*')).find(e => e.isContentEditable && visible(e));
                                            if (el) return el;
                                        }
                                        // Fallback patterns (covers Slate/Lexical and legacy LI)
                                        for (const r of roots(document)) {
                                            const el =
                                                r.querySelector('[data-slate-editor="true"]') ||
                                                r.querySelector('[data-lexical-editor]') ||
                                                r.querySelector('.msg-form__contenteditable') ||
                                                r.querySelector('[role="textbox"][contenteditable]');
                                            if (el && visible(el)) return el;
                                        }
                                        await sleep(200);
                                    }
                                    throw new Error('Editor not found');
                                }

                                async function waitForAttachFileButton(timeout = 15000) {
                                    const sleep = ms => new Promise(r => setTimeout(r, ms));
                                    const start = Date.now();

                                    function* roots(r) {
                                        yield r;
                                        if (r.shadowRoot) yield* roots(r.shadowRoot);
                                        for (const f of r.querySelectorAll('iframe')) {
                                            try { if (f.contentDocument) yield* roots(f.contentDocument); } catch { }
                                        }
                                    }
                                    function tryFind() {
                                        for (const r of roots(document)) {
                                            // by icon id
                                            const use = r.querySelector('use[href$="#attachment-small"]');
                                            if (use) return use.closest('button');
                                            // by data-test-icon
                                            const icon = r.querySelector('svg[data-test-icon="attachment-small"]');
                                            if (icon) return icon.closest('button');
                                            // by text as a fallback
                                            const btn = Array.from(r.querySelectorAll('button.msg-form__footer-action'))
                                                .find(b => b.textContent.toLowerCase().includes('attach a file'));
                                            if (btn) return btn;
                                        }
                                        return null;
                                    }

                                    let btn = tryFind();
                                    while (!btn && Date.now() - start < timeout) {
                                        await sleep(200);
                                        btn = tryFind();
                                    }
                                    return btn;
                                }





                                function randomDelay(min, max) {
                                    return Math.floor(Math.random() * (max - min + 1)) + min;
                                }

                                // --- 1. Open the DM box ---
                                // const msgBtn = document.getElementById(buttonId);
                                const msgBtn = document.querySelector('a[componentkey="' + buttonId + '"]');
                                if (!msgBtn) {
                                    console.error(`Couldn’t find message button #${buttonId}`);
                                    return;
                                }
                                msgBtn.click();
                                await sleep(randomDelay(1000, 2000));
                                try {
                                    // --- 2. Wait for the editable DIV, then type the message ---
                                    // const editor = await waitForSelector('div[contenteditable="true"]');
                                    const editor = await waitForLinkedInEditor();
                                    console.log('Editor ready, typing…');
                                    // personalize
                                    const firstName = name.split(' ')[0];
                                    // Replace user_name with the first part of the name and format new lines
                                    let personalizedMessage = messageTemplate.replace('user_name', firstName).replace(/\n/g, '<br>');
                                    // Encode and decode to fix character issues
                                    personalizedMessage = decodeURIComponent(encodeURIComponent(personalizedMessage));
                                    editor.focus(); // Focus on the message box
                                    editor.innerHTML = `<p>${personalizedMessage}</p>`;
                                    editor.dispatchEvent(new Event('input', { bubbles: true }));

                                    // --- 3. Attach the resume : Not working---
                                    /* await sleep(randomDelay(1000, 2000));
                                    const fileInput = await waitForAttachFileButton();
                                    const res = await fetch(resumeUrl);
                                    const blob = await res.blob();
                                    const file = new File([blob], 'Resume_Amaldev.pdf', { type: blob.type });
                                    const dt = new DataTransfer();
                                    dt.items.add(file);
                                    fileInput.files = dt.files;
                                    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                                    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                                    console.log('Resume attached'); */

                                    // --- 4. Click “Send” ---
                                    // await sleep(2000); // small pause after attaching
                                    await sleep(randomDelay(2000, 3000));
                                    async function waitForSendControl(timeout = 15000) {
                                        const sleep = ms => new Promise(r => setTimeout(r, ms));
                                        const start = Date.now();

                                        function visible(el) {
                                            if (!el) return false;
                                            const r = el.getBoundingClientRect();
                                            return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
                                        }

                                        function* roots(root) {
                                            yield root;
                                            if (root.shadowRoot) yield* roots(root.shadowRoot);
                                            for (const f of root.querySelectorAll('iframe')) {
                                                try { if (f.contentDocument) yield* roots(f.contentDocument); } catch { }
                                            }
                                        }

                                        const SELS = [
                                            'button.msg-form__send-button[type="submit"]',
                                            'form.msg-form button[type="submit"]',
                                            '.msg-form button[type="submit"]',
                                            'button.msg-form__send-button',
                                            'button[aria-label*="Send"]',
                                            'button[title*="Send"]',
                                        ];

                                        while (Date.now() - start < timeout) {
                                            for (const r of roots(document)) {
                                                // try known selectors
                                                for (const sel of SELS) {
                                                    const el = r.querySelector(sel);
                                                    if (el && visible(el)) return el;
                                                }
                                                // fallback by text content “Send”
                                                const byText = Array.from(r.querySelectorAll('button'))
                                                    .find(b => visible(b) && b.textContent && b.textContent.trim().toLowerCase() === 'send');
                                                if (byText) return byText;
                                            }
                                            await sleep(200);
                                        }
                                        throw new Error('Send button not found within timeout');
                                    }

                                    let snedButton = await waitForSendControl();
                                    if(snedButton){
                                        snedButton.click();
                                        console.log('Message sent');
                                    }

                                    // --- 5. Close the DM overlay ---
                                    // await sleep(2000);
                                    await sleep(randomDelay(1500, 2000));
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
                            },
                            args: [item.buttonId, item.name, messageTemplate, resumeUrl],
                        });
                    })
                    .catch(error => console.error('Failed to load message.txt:', error));
            });

            actionCell.appendChild(msgButton);

            row.appendChild(actionCell);
            table.appendChild(row);
        });

        // Append the table to the body or a specific container
        const container = document.getElementById('tableContainer');
        container.innerHTML = ''; // Clear previous content
        container.appendChild(table);
    });
});
