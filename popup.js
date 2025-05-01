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
                                const messageButton = document.getElementById(buttonId);
                                if (messageButton) {
                                    messageButton.click();
                                    // Wait for the DM message box to appear and type a message
                                    const waitForMessageBox = setInterval(async () => {
                                        const editableDiv = document.querySelector('div[contenteditable="true"]');

                                        if (editableDiv) {
                                            clearInterval(waitForMessageBox); // Stop checking once the box is found

                                            console.log('Editable message box found. Typing message...');

                                            // Extract the first part of the name
                                            const firstName = name.split(' ')[0];

                                            // Replace user_name with the first part of the name and format new lines
                                            let personalizedMessage = messageTemplate.replace('user_name', firstName).replace(/\n/g, '<br>');

                                            // Encode and decode to fix character issues
                                            personalizedMessage = decodeURIComponent(encodeURIComponent(personalizedMessage));

                                            editableDiv.focus(); // Focus on the message box
                                            editableDiv.innerHTML = `<p>${personalizedMessage}</p>`;

                                            // Trigger a real "input" event
                                            const inputEvent = new Event('input', { bubbles: true });
                                            editableDiv.dispatchEvent(inputEvent);

                                            // After typing message, attach resume
                                            const randomTimeOut = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
                                            setTimeout(async () => {
                                                const fileInput = document.querySelector('input[type="file"]');
                                                if (fileInput) {
                                                    // Fetch the resume again inside the page
                                                    const response = await fetch(resumeUrl);
                                                    const blob = await response.blob();
                                                    const file = new File([blob], 'Resume_Amaldev.pdf', { type: blob.type });

                                                    const dataTransfer = new DataTransfer();
                                                    dataTransfer.items.add(file);
                                                    fileInput.files = dataTransfer.files;

                                                    const changeEvent = new Event('change', { bubbles: true });
                                                    fileInput.dispatchEvent(changeEvent);

                                                    console.log('Resume attached successfully! ✅');
                                                } else {
                                                    console.error('File input not found!');
                                                }
                                            }, randomTimeOut); // 3 seconds wait for safety

                                            // Clicking Send Button 
                                            setTimeout(async () => {
                                                /* const sendBtn = document.querySelector(
                                                    'button.msg-form__send-button.artdeco-button.artdeco-button--1[type="submit"]'
                                                ); */
                                                const sendBtn = Array.from(document.querySelectorAll('button'))
                                                    .find(btn => btn.textContent.trim() === 'Send');
                                                if (sendBtn) {
                                                    sendBtn.click();
                                                } else {
                                                    console.warn("Send button not found");
                                                }
                                            }, randomTimeOut + 5000);
                                        } else {
                                            console.log('Waiting for the editable message box...');
                                        }
                                    }, 500); // Check every 500ms

                                    // Stop after 20 seconds if the box is not found
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

        // Append the table to the body or a specific container
        const container = document.getElementById('tableContainer');
        container.innerHTML = ''; // Clear previous content
        container.appendChild(table);
    });
});
