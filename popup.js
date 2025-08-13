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

                                function randomDelay(min, max) {
                                    return Math.floor(Math.random() * (max - min + 1)) + min;
                                }

                                // --- 1. Open the DM box ---
                                // const msgBtn = document.getElementById(buttonId);
                                const msgBtn =  document.querySelector('a[componentkey="'+buttonId+'"]');
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
                                    // Replace user_name with the first part of the name and format new lines
                                    let personalizedMessage = messageTemplate.replace('user_name', firstName).replace(/\n/g, '<br>');
                                    // Encode and decode to fix character issues
                                    personalizedMessage = decodeURIComponent(encodeURIComponent(personalizedMessage));
                                    editor.focus(); // Focus on the message box
                                    editor.innerHTML = `<p>${personalizedMessage}</p>`;
                                    editor.dispatchEvent(new Event('input', { bubbles: true }));

                                    // --- 3. Attach the resume ---
                                    await sleep(randomDelay(1000, 2000));
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
                                    // await sleep(2000); // small pause after attaching
                                    await sleep(randomDelay(2000, 3000));
                                    const sendBtn = Array.from(document.querySelectorAll('button'))
                                        .find(b => b.textContent.trim() === 'Send');
                                    if (sendBtn) {
                                        sendBtn.click();
                                        console.log('Message sent');
                                    } else {
                                        console.warn('Send button not found');
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
