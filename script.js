// Functionality to handle page navigation for the drop-downs
document.querySelectorAll('.dropdown-content a').forEach(item => {
    item.addEventListener('click', event => {
        alert('Navigating to: ' + event.target.textContent);
    });
});

