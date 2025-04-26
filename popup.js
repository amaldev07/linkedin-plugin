document.getElementById('startButton').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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
        const data = injectionResults[0].result;

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

            // Action column with remove and msg buttons
            const actionCell = document.createElement('td');

            // Remove button
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => {
                table.deleteRow(row.rowIndex);
            });
            actionCell.appendChild(removeButton);

            // Msg button
            const msgButton = document.createElement('button');
            msgButton.textContent = 'Msg';
            msgButton.addEventListener('click', () => {
                // Change the row's background color to light green
                row.style.backgroundColor = 'lightgreen';

                // Use the buttonId to find and click the message button in the DOM
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (buttonId, name, messageTemplate) => {
                        const messageButton = document.getElementById(buttonId);
                        if (messageButton) {
                            messageButton.click();

                            // Wait for the DM message box to appear and type a message
                            const waitForMessageBox = setInterval(() => {
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
                    args: [item.buttonId, item.name, `Sub: Referral Request for Sr. Computer Scientist-Frontend Role at Adobe\n\nHi user_name,\nI came across a Frontend engineer opening at Adobe and was wondering if you’d be open to referring me.\n\nJob Id: R153473\nJob Link: https://careers.adobe.com/us/en/job/ADOBUSR153473EXTERNALENUS/Sr-Computer-Scientist-Frontend?utm_source=linkedin&utm_medium=phenom-feeds&source=LinkedIn\n\nSharing my resume here, pfa.\n\nThanks!\nAmaldev | +91-7594072480 | amaldev.psn@gmail.com`],
                });
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
