// Find the button element by its ID
const messageButton = document.getElementById('ember6500');

// Check if the button exists
if (messageButton) {
    // Create a sample text input field dynamically
    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.value = 'Sample Text'; // Set the sample text
    inputField.style.marginLeft = '10px'; // Add some spacing for better visibility

    // Append the input field next to the button
    messageButton.parentNode.insertBefore(inputField, messageButton.nextSibling);
} else {
    console.error('Message button not found');
}