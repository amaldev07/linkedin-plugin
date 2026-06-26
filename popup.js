document.getElementById('startButton').addEventListener('click', () => {
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
            function getUserListData() {
                function cleanName(text) {
                    return (text || '')
                        .replace(/^send a message to\s+/i, '')
                        .replace(/^message\s+/i, '')
                        .replace(/\bVerified\b/gi, '')
                        .replace(/\s*[\u2022\u00b7]\s*(1st|2nd|3rd\+).*$/i, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                }

                const listItems = document.querySelectorAll('[role="listitem"]');
                const result = [];
                listItems.forEach((li) => {
                    const messageControl = li.querySelector(
                        'a[href*="/messaging/compose/"], button[aria-label*="message" i], a[aria-label*="message" i]'
                    );
                    const profileLink = li.querySelector('a[href*="/in/"]');
                    if (!messageControl || !profileLink) return;

                    let name = cleanName(messageControl.getAttribute('aria-label'));
                    if (!name) {
                        const visibleName = li.querySelector('[aria-labelledby]') || profileLink;
                        name = cleanName(visibleName.textContent.split('\n')[0]);
                    }

                    const href = messageControl.getAttribute('href');
                    const componentKey = messageControl.getAttribute('componentkey');
                    const ariaLabel = messageControl.getAttribute('aria-label');
                    const buttonId = messageControl.id || null;

                    if (name && (buttonId || href || componentKey || ariaLabel)) {
                        result.push({
                            name,
                            buttonId,
                            href,
                            componentKey,
                            ariaLabel,
                            target: buttonId || componentKey || href || ariaLabel
                        });
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
        ['Name', 'Message Target', 'Action', 'Skip'].forEach(headerText => {
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
            const targetCell = document.createElement('td');
            targetCell.textContent = item.target;
            row.appendChild(targetCell);

            // Action column
            const actionCell = document.createElement('td');

            // Msg button
            const msgButton = document.createElement('button');
            msgButton.type = 'button';
            msgButton.textContent = 'Msg';
            msgButton.style.minWidth = '42px';
            msgButton.style.padding = '6px 12px';
            msgButton.style.margin = '2px';
            msgButton.style.cursor = 'pointer';

            // Skip column
            const skipCell = document.createElement('td');
            const skipButton = document.createElement('button');
            skipButton.type = 'button';
            skipButton.textContent = 'X';
            skipButton.title = `Skip ${item.name}`;
            skipButton.style.minWidth = '42px';
            skipButton.style.padding = '6px 12px';
            skipButton.style.margin = '2px';
            skipButton.style.cursor = 'pointer';
            skipButton.addEventListener('click', () => {
                row.remove();
            });

            // Modify the 'Msg' button functionality to dynamically load the message from message.txt
            msgButton.addEventListener('click', () => {
                // Change the row's background color to light green
                row.style.backgroundColor = 'lightgreen';

                // Read the message from message.txt dynamically
                // fetch(chrome.runtime.getURL('message.txt'))
                fetch(chrome.runtime.getURL('message_hr_coldmail.txt'))
                    .then(response => response.text())
                    .then(messageTemplate => {
                        // Use stable message-link metadata to find and click the message control in the DOM
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            world: 'MAIN',
                            func: async (messageTarget, name, messageTemplate, resumeUrl) => {
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

                                function cssValue(value) {
                                    if (window.CSS && CSS.escape) return CSS.escape(value);
                                    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                                }

                                function findMessageControl(target) {
                                    if (target.buttonId) {
                                        const byId = document.getElementById(target.buttonId);
                                        if (byId) return byId;
                                    }
                                    if (target.componentKey) {
                                        const byComponent = document.querySelector(`[componentkey="${cssValue(target.componentKey)}"]`);
                                        if (byComponent) return byComponent;
                                    }
                                    if (target.href) {
                                        const href = target.href;
                                        const byHref = document.querySelector(`a[href="${cssValue(href)}"]`) ||
                                            Array.from(document.querySelectorAll('a[href*="/messaging/compose/"]'))
                                                .find(a => a.getAttribute('href') === href || a.href.endsWith(href));
                                        if (byHref) return byHref;
                                    }
                                    if (target.ariaLabel) {
                                        const label = target.ariaLabel.toLowerCase();
                                        return Array.from(document.querySelectorAll('a[aria-label], button[aria-label]'))
                                            .find(el => el.getAttribute('aria-label').toLowerCase() === label);
                                    }
                                    return null;
                                }

                                // --- 1. Open the DM box ---
                                const msgBtn = findMessageControl(messageTarget);
                                if (!msgBtn) {
                                    console.error('Could not find message control', messageTarget);
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
                                    if (snedButton) {
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
                            args: [item, item.name, messageTemplate, resumeUrl],
                        });
                    })
                    .catch(error => console.error('Failed to load message.txt:', error));
            });

            actionCell.appendChild(msgButton);
            skipCell.appendChild(skipButton);

            row.appendChild(actionCell);
            row.appendChild(skipCell);
            table.appendChild(row);
        });

        // Append the table to the body or a specific container
        const container = document.getElementById('tableContainer');
        container.innerHTML = ''; // Clear previous content
        container.appendChild(table);
    });
});
});
