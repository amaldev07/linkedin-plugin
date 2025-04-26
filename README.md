iterate through this dom and create a array of objects
in each objet represent the li inside this
<ul role="list">
i wanna collect 
{


}







----------------------------
to get name 
// Select the <ul> with role="list" and find the first <li> element
const listItem = document.querySelector('ul[role="list"] li');

// From the <li>, find the <a> tag containing the name
const nameElement = listItem?.querySelector('a span[aria-hidden="true"]');

// Log the name or perform actions
if (nameElement) {
    console.log('Person name:', nameElement.textContent.trim());
} else {
    console.log('Name element not found');
}