// Select all <li> elements inside the <ul> with role="list"
const listItems = document.querySelectorAll('ul[role="list"] li');

// Initialize an array to store the objects
const result = [];

// Iterate through each <li> element
listItems.forEach((li) => {
    // Extract the name
    const nameElement = li.querySelector('a span[aria-hidden="true"]');
    const name = nameElement ? nameElement.textContent.trim() : null;

    // Extract the button ID
    const button = li.querySelector('button[aria-label^="Message"]');
    const buttonId = button ? button.id : null;

    // Add the object to the result array
    if (name && buttonId) {
        result.push({ name, buttonId });
    }
});

// Log the result array
console.log(result);