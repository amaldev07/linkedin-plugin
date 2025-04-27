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
            function getUserListData() {
                const listItems = document.querySelectorAll('ul[role="list"] li');
                const result = [];

                listItems.forEach((li) => {
                    const nameElement = li.querySelector('a span[aria-hidden="true"]');
                    const name = nameElement ? nameElement.textContent.trim() : null;

                    const button = li.querySelector('button[aria-label^="Message"]');
                    const buttonId = button ? button.id : null;

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
        console.log('Extracted Data:', data);

        if (!data || data.length === 0) {
            console.error('No data extracted. Ensure the active tab contains the required elements.');
            return;
        }

        // Create a table element
        const table = document.createElement('table');
        table.border = '1';

        const headerRow = document.createElement('tr');
        ['Name', 'Button ID', 'Action'].forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        data.forEach((item) => {
            const row = document.createElement('tr');

            const nameCell = document.createElement('td');
            nameCell.textContent = item.name;
            row.appendChild(nameCell);

            const buttonIdCell = document.createElement('td');
            buttonIdCell.textContent = item.buttonId;
            row.appendChild(buttonIdCell);

            const actionCell = document.createElement('td');

            const msgButton = document.createElement('button');
            msgButton.textContent = 'Msg';

            msgButton.addEventListener('click', () => {
                row.style.backgroundColor = 'lightgreen';

                fetch(chrome.runtime.getURL('message.txt'))
                    .then(response => response.text())
                    .then(messageTemplate => {
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: async (buttonId, name, messageTemplate, resumeUrl) => {
                                const messageButton = document.getElementById(buttonId);
                                if (messageButton) {
                                    messageButton.click();

                                    const waitForMessageBox = setInterval(async () => {
                                        const editableDiv = document.querySelector('div[contenteditable="true"]');

                                        if (editableDiv) {
                                            clearInterval(waitForMessageBox);

                                            console.log('Editable message box found. Typing message...');

                                            const firstName = name.split(' ')[0];
                                            let personalizedMessage = messageTemplate.replace('user_name', firstName).replace(/\n/g, '<br>');

                                            personalizedMessage = decodeURIComponent(encodeURIComponent(personalizedMessage));

                                            editableDiv.focus();
                                            editableDiv.innerHTML = '';

                                            const p = document.createElement('p');
                                            p.textContent = personalizedMessage;
                                            editableDiv.appendChild(p);

                                            const inputEvent = new InputEvent('input', { bubbles: true });
                                            editableDiv.dispatchEvent(inputEvent);

                                            // After typing message, attach resume
                                            setTimeout(async () => {
                                                const fileInput = document.querySelector('input[type="file"]');
                                                if (fileInput) {
                                                    // Fetch the resume again inside the page
                                                    const response = await fetch(resumeUrl);
                                                    const blob = await response.blob();
                                                    const file = new File([blob], 'resume.pdf', { type: blob.type });

                                                    const dataTransfer = new DataTransfer();
                                                    dataTransfer.items.add(file);
                                                    fileInput.files = dataTransfer.files;

                                                    const changeEvent = new Event('change', { bubbles: true });
                                                    fileInput.dispatchEvent(changeEvent);

                                                    console.log('Resume attached successfully! ✅');
                                                } else {
                                                    console.error('File input not found!');
                                                }
                                            }, 3000); // 3 seconds wait for safety
                                        } else {
                                            console.log('Waiting for the editable message box...');
                                        }
                                    }, 500);

                                    setTimeout(() => {
                                        clearInterval(waitForMessageBox);
                                        console.error('Failed to find the editable message box within the timeout period.');
                                    }, 20000);
                                } else {
                                    console.error('Message button not found for ID:', buttonId);
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

        const container = document.getElementById('tableContainer');
        container.innerHTML = '';
        container.appendChild(table);
    });
});
