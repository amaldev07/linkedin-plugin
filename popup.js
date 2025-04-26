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

            // Action column with remove button
            const actionCell = document.createElement('td');
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => {
                table.deleteRow(row.rowIndex);
            });
            actionCell.appendChild(removeButton);
            row.appendChild(actionCell);

            table.appendChild(row);
        });

        // Append the table to the body or a specific container
        const container = document.getElementById('tableContainer');
        container.innerHTML = ''; // Clear previous content
        container.appendChild(table);
    });
});
