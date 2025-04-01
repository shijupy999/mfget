// Dropdown alert (existing behavior)
document.querySelectorAll('.dropdown-content a').forEach(item => {
  item.addEventListener('click', event => {
    alert('Navigating to: ' + event.target.textContent);
  });
});

// Enquiry form submission logic
const enquiryForm = document.getElementById('enquiryForm');
if (enquiryForm) {
  enquiryForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const tool = document.getElementById('toolType').value;

    fetch("https://mfget-backend.onrender.com/save-enquiry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ toolType: tool })
    })
    .then(res => {
      if (!res.ok) throw new Error("Network response was not OK");
      return res.json();
    })
    .then(data => {
      alert("✅ Enquiry sent: " + data.message);
    })
    .catch(error => {
      console.error("❌ Error sending enquiry:", error);
      alert("❌ Failed to send enquiry. Please try again.");
    });
  });
}
