
let editingRow = null;
let originalData = {};
let rfqCountChart, submittedReceivedChart, assignedToChart, closedPerMonthChart;

// Show selected page
function showPage(pageId) {
    // Hide all pages
    hideAllPages(); // Hide all pages first
    document.querySelectorAll('.content-page').forEach(page => {
        page.classList.remove('active'); // Remove 'active' class
        page.style.display = 'none'; // Hide the page
    });

    // Show the selected page
    const activePage = document.getElementById(pageId);
    if (activePage) {
        activePage.classList.add('active'); // Add 'active' class to the selected page
        activePage.style.display = 'block'; // Show the selected page

        // Additional logic for specific pages
        if (pageId === "rfqDetailList") {
            populateRFQDetailList(); // Populate RFQ Detail List if the tab is selected
        }
    } else {
        console.error(`Page with ID "${pageId}" not found.`); // Log an error if the page ID doesn't exist
    }
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
    hideAllPages(); // Hide all pages initially
    const defaultPageId = "dashboard"; // Ensure dashboard is the default
    showPage(defaultPageId); // Show the dashboard page
    console.log(`Default page "${defaultPageId}" loaded.`);
    loadDataFromLocal(); // Load local data
    
    restrictEdit(); // Lock cells initially
    initializeListenersForAllRows(); // Set up listeners for existing rows
    populateYearDropdown(); // Populate dropdown for year selection
    document.getElementById("yearSelector").addEventListener("change", updateGraphs); // Attach graph update logic
    restrictEditingOnLoad(); // Ensure fields are locked on page load
    attachResCostListeners(); // Attach listeners for resource cost updates
    attachExtdCostListeners(); // Attach listeners for extended cost updates
    attachCalculationListeners(); // Attach listeners on page load
    attachCalculationListeners(); // Attach event listeners for calculations
    calculateAssemblyTotals(); // Initial calculation of assembly totals
    updateMaterialExtdCost(row);
    updateOperationCosts(row);
    updateBuyItemExtdCost(row);
    attachDynamicListeners(); // Attach listeners for dynamic updates
    calculateAllCosts(); // Trigger initial calculations;

    const rfqNo = document.getElementById("rfqNoDetail").textContent.trim(); // Get RFQ No from the page

    if (rfqNo) {
        loadRFQDetails(rfqNo); // Load saved RFQ details automatically if RFQ No exists
    }

    // Event listener to handle return to the dashboard button
    document.getElementById("returnToDashboardButton").addEventListener("click", () => {
        showPage("dashboard"); // Navigate to the dashboard page
        loadRFQDetails(document.getElementById("rfqNoDetail").textContent.trim());
    });

    // Event listener for reloading RFQ details when revisiting the page
    document.getElementById("rfqDetailsPage").addEventListener("click", () => {
        if (rfqNo) {
            loadRFQDetails(rfqNo); // Reload RFQ details only if RFQ No is present
        }
    });

    // Ensure changes to RFQ item numbers dynamically update their links
    const tableBody = document.querySelector("#rfqDetailsTable tbody");
    tableBody.addEventListener("input", (e) => {
        const cell = e.target.closest("td");
        const row = cell.parentElement;
        const itemType = row.cells[7]?.querySelector("select")?.value;
        const itemNoCell = row.cells[2]; // Item No column
        const itemNoValue = itemNoCell.textContent.trim();

        // Update the item link dynamically if the item type is "Assembly"
        if (itemType === "Assembly" && itemNoValue) {
            itemNoCell.innerHTML = `<a href="#" style="color: blue; text-decoration: underline;">${itemNoValue}</a>`;
        }
    });
});


// Populate Year Dropdown based on unique years from Received Date and Completed Date columns
function populateYearDropdown() {
    const yearSelector = document.getElementById("yearSelector");
    yearSelector.innerHTML = '';
    const years = new Set();

    document.querySelectorAll("#rfqTable tbody tr").forEach(row => {
        const rcvdDateInput = row.querySelector('td:nth-child(6) input');
        const completedDateInput = row.querySelector('td:nth-child(10) input');
        if (rcvdDateInput && rcvdDateInput.value) years.add(new Date(rcvdDateInput.value).getFullYear());
        if (completedDateInput && completedDateInput.value) years.add(new Date(completedDateInput.value).getFullYear());
    });

    const sortedYears = Array.from(years).sort((a, b) => b - a);
    if (sortedYears.length === 0) sortedYears.push(new Date().getFullYear());
    sortedYears.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearSelector.appendChild(option);
    });

    yearSelector.value = sortedYears[0];
    updateGraphs();
}

// Add new RFQ and auto-select the new row
function newRFQ() {
    const tableBody = document.querySelector("#rfqTable tbody");
    const nextRFQNumber = `RFQ${(tableBody.children.length + 1).toString().padStart(3, '0')}`;
    const newRow = document.createElement("tr");

    newRow.innerHTML = `
        <td><input type="radio" name="selectRFQ"></td>
        <td><a href="#" onclick="openRFQDetails('${nextRFQNumber}')">${nextRFQNumber}</a></td>
        <td>0</td>
        <td contenteditable="true">Enquiry Description</td>
        <td><select><option>ABC</option><option>CDF</option><option>ASG</option></select></td>
        <td><input type="date"></td>
        <td><input type="date"></td>
        <td><select><option>Dan</option><option>San</option><option>Jin</option></select></td>
        <td><select><option>Open</option><option>Closed</option><option>Cancelled</option><option>Onhold</option></select></td>
        <td><input type="date"></td>
        <td><select><option value="" selected disabled>Select Status</option><option>Submitted</option><option>Received</option></select></td>
        <td><input type="date"></td>
        <td contenteditable="true">$</td>
        <td contenteditable="true"></td>
        <td><input type="date"></td>
        <td contenteditable="true">$</td>
        <td contenteditable="true"></td>
    `;

    tableBody.appendChild(newRow);
    newRow.querySelector("input[name='selectRFQ']").checked = true;
    editingRow = newRow; // Set the new row as the editing row
}

// Restrict editing until Edit button is clicked
function restrictEdit() {
    document.querySelectorAll("#rfqTable tbody td").forEach(cell => {
        cell.setAttribute("contenteditable", "false");
    });
    document.querySelectorAll("#rfqTable select, #rfqTable input[type='date']").forEach(input => {
        input.disabled = true;
    });
}

// Edit RFQ
function editRFQ() {
    restrictEdit(); // Lock all other rows
    const selectedRow = document.querySelector("input[name='selectRFQ']:checked");

    if (!selectedRow) {
        alert("Select a row to edit.");
        return;
    }

    editingRow = selectedRow.closest("tr");

    // Save original data for cancellation
    originalData = {
        cells: Array.from(editingRow.querySelectorAll("td")).map(cell => {
            const inputElement = cell.querySelector("input, select");
            if (inputElement) {
                if (inputElement.tagName === "SELECT") {
                    return inputElement.value; // Save dropdown value
                } else if (inputElement.type === "date") {
                    return inputElement.value; // Save date input value
                }
            }
            return cell.textContent.trim(); // Save text content for contenteditable cells
        }),
    };

    // Enable editing for the selected row
    editingRow.querySelectorAll("td[contenteditable]").forEach(cell => {
        cell.setAttribute("contenteditable", "true");
    });
    editingRow.querySelectorAll("select, input").forEach(input => {
        input.disabled = false;
    });

    alert("Editing enabled for the selected row.");
}


// Save RFQ
function saveRFQ() {
    console.log("saveRFQ called");
    const selectedRow = document.querySelector("input[name='selectRFQ']:checked");
    
    if (!selectedRow) {
        alert("Please select a row to save.");
        return;
    }

    const row = selectedRow.closest("tr");

    // Retrieve and check the current revision
    const revisionCell = row.querySelector("td:nth-child(3)");
    let currentRevision = parseInt(revisionCell.textContent.trim()) || 0;

    // Display custom revision prompt
    showRevisionPrompt();

    // Define actions for the prompt buttons
    const finalizeSaveWithRevision = (increment) => {
        if (increment) {
            currentRevision += 1;
            revisionCell.textContent = currentRevision;
            console.log("Revision incremented:", currentRevision);
        }


        // Ensure RFQ No is a hyperlink
        const rfqNoCell = row.querySelector("td:nth-child(2)");
        const rfqNo = rfqNoCell.textContent.trim();
        rfqNoCell.innerHTML = `<a href="#" onclick="openRFQDetails('${rfqNo}')">${rfqNo}</a>`;

        finalizeSave(row);
        alert(increment ? "Revision updated and RFQ saved." : "RFQ saved without revision update.");
    };

    // Set up the event listeners dynamically
    const yesButton = document.getElementById("yesButton");
    const noButton = document.getElementById("noButton");
    const cancelButton = document.getElementById("cancelButton");

    yesButton.onclick = () => {
        finalizeSaveWithRevision(true);
        closePrompt();
    };
    noButton.onclick = () => {
        finalizeSaveWithRevision(false);
        closePrompt();
    };
    cancelButton.onclick = closePrompt;
}


// Revision Prompt
function showRevisionPrompt() {
    const revisionPrompt = document.createElement("div");
    revisionPrompt.id = "revisionPrompt";
    revisionPrompt.style.position = "fixed";
    revisionPrompt.style.top = "50%";
    revisionPrompt.style.left = "50%";
    revisionPrompt.style.transform = "translate(-50%, -50%)";
    revisionPrompt.style.backgroundColor = "#f5f5f5"; // Light gray
    revisionPrompt.style.border = "2px solid #5b9bd5"; // Blue border
    revisionPrompt.style.padding = "20px";
    revisionPrompt.style.width = "450px"; // Increased width
    revisionPrompt.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
    revisionPrompt.style.borderRadius = "8px";
    revisionPrompt.style.zIndex = "1000";
    revisionPrompt.innerHTML = `
        <h3 style="margin-bottom: 15px; color: #2b3a42;">Do you want to "UPDATE RFQ REVISION"</h3>
        <ul style="text-align: left; color: #333; margin-bottom: 20px; line-height: 1.5;">
            <li>Click <strong>“Yes”</strong> to UPDATE to Next revision</li>
            <li>Click <strong>“No”</strong> to SAVE without changing the revision</li>
        </ul>
        <div style="display: flex; justify-content: center; gap: 10px;">
            <button id="yesButton" class="modal-button" style="background-color: #4a90d6; padding: 10px 20px; border-radius: 4px;">Yes</button>
            <button id="noButton" class="modal-button" style="background-color: #4a90d6; padding: 10px 20px; border-radius: 4px;">No</button>
            <button id="cancelButton" class="modal-button" style="background-color: #ccc; padding: 10px 20px; border-radius: 4px; color: #333;">Cancel</button>
        </div>
    `;
    document.body.appendChild(revisionPrompt);

    document.getElementById("yesButton").onclick = () => {
        incrementRevision();
        closePrompt();
    };
    document.getElementById("noButton").onclick = () => {
        saveWithoutIncrement();
        closePrompt();
    };
    document.getElementById("cancelButton").onclick = closePrompt;
}


// Increment Revision
function incrementRevision() {
    editingRow.querySelector("td:nth-child(3)").innerText = parseInt(editingRow.querySelector("td:nth-child(3)").innerText) + 1;
    finalizeSave();
}

// Save Without Increment
function saveWithoutIncrement() {
    finalizeSave();
}

// Close Prompt
function closePrompt() {
    const revisionPrompt = document.getElementById("revisionPrompt");
    if (revisionPrompt) {
        document.body.removeChild(revisionPrompt);
    }
}

// Finalize Save
function finalizeSave() {
    editingRow.querySelectorAll("td[contenteditable]").forEach(cell => cell.removeAttribute("contenteditable"));
    editingRow.querySelectorAll("select, input[type='date']").forEach(input => (input.disabled = true));
    editingRow.removeAttribute("data-edited"); // Clear the edited flag after saving
    editingRow = null; // Clear the editing row
    saveDataToLocal(); // Save data to localStorage
}


// Cancel Edit
function cancelEdit() {
    if (!editingRow) {
        alert("No row is currently being edited.");
        return;
    }

    if (!originalData || !originalData.cells) {
        alert("Original data is missing or invalid. Cannot cancel edit.");
        return;
    }

    // Restore original data to the row
    originalData.cells.forEach((originalValue, index) => {
        const cell = editingRow.cells[index];

        const inputElement = cell.querySelector("input, select");
        if (inputElement) {
            if (inputElement.tagName === "SELECT") {
                inputElement.value = originalValue; // Restore dropdown value
            } else if (inputElement.type === "date") {
                inputElement.value = originalValue || ""; // Restore date value
            }
        } else {
            // Special handling for the RFQ number column (assuming it's the second column)
            if (index === 1) {
                cell.innerHTML = `<a href="#" onclick="openRFQDetails('${originalValue}')">${originalValue}</a>`;
            } else {
                cell.textContent = originalValue || ""; // Restore text content for other cells
            }
        }
        disableEditMode(); // Allow form opening again
    });

    // Lock all cells to make them non-editable
    editingRow.querySelectorAll("td[contenteditable]").forEach(cell => {
        cell.removeAttribute("contenteditable");
    });
    editingRow.querySelectorAll("select, input").forEach(input => {
        input.disabled = true;
    });

    // Re-enable the radio button for the row
    const radioButton = editingRow.querySelector("input[type='radio']");
    if (radioButton) {
        radioButton.disabled = false; // Ensure the radio button remains active
    }

    // Reset the editing state
    editingRow = null;
    originalData = {};

    alert("Edit canceled. Changes reverted to the original state.");
}

// Delete RFQ
function deleteRFQ() {
    const selectedRow = document.querySelector("input[name='selectRFQ']:checked");
    if (selectedRow) {
        const row = selectedRow.closest("tr");
        if (confirm("Are you sure you want to delete this row?")) {
            row.remove();
            updateGraphs();
            alert("Row deleted successfully.");
        }
    } else {
        alert("Please select a row to delete.");
    }
}

// Search RFQ by RFQ No
function searchRFQ() {
    const searchValue = document.getElementById("searchRFQ").value.toLowerCase();
    const rows = document.querySelectorAll("#rfqTable tbody tr");
    rows.forEach(row => {
        const rfqNo = row.cells[1].innerText.toLowerCase();
        row.style.display = rfqNo.includes(searchValue) ? "" : "none";
    });
}

// Return to Dashboard
function returnHome() {
    document.getElementById("searchRFQ").value = "";
    showPage("dashboard");
}

// Update graphs on year selection
function updateGraphs() {
    const yearSelector = document.getElementById("yearSelector");
    const selectedYear = parseInt(yearSelector.value);

    const rfqData = Array.from(document.querySelectorAll("#rfqTable tbody tr")).map(row => ({
        status: row.querySelector('td:nth-child(9) select').value,
        assignedTo: row.querySelector('td:nth-child(8) select').value,
        rcvdDate: row.querySelector('td:nth-child(6) input').value,
        completedDate: row.querySelector('td:nth-child(10) input').value,
        submittedDate: row.querySelector('td:nth-child(12) input').value,
        orderReceivedDate: row.querySelector('td:nth-child(15) input').value,
        submittalStatus: row.querySelector('td:nth-child(11) select').value,
        quoteValue: parseFloat(row.querySelector('td:nth-child(13)').innerText.replace('$', '')) || 0,
        orderValue: parseFloat(row.querySelector('td:nth-child(16)').innerText.replace('$', '')) || 0
    }));

    console.log("Graph Data:", rfqData);

    updateRFQCountChart(rfqData, selectedYear);
    updateSubmittedReceivedChart(rfqData, selectedYear);
    updateAssignedToChart(rfqData);
    updateClosedPerMonthChart(rfqData, selectedYear);
}

// Define constants for column indices
const COLUMN_INDICES = {
    RFQ_NO: 2,          // RFQ No column
    REVISION: 3,        // Revision column
    ENQUIRY_DETAILS: 4, // Enquiry Details column
    CUSTOMER_NAME: 5,   // Customer Name column
    RECEIVED_DATE: 6,   // Received Date column
    ACKNOWLEDGED_DATE: 7, // Acknowledged Date column
    ASSIGNED_TO: 8,     // Assigned To column
    STATUS: 9,          // RFQ Status column
    COMPLETED_DATE: 10, // Completed Date column
    SUBMITTAL_STATUS: 11, // Submittal Status column
    SUBMITTED_DATE: 12, // Submitted Date column
    QUOTE_VALUE: 13,    // Quote Value column
    LEAD_TIME: 14,      // Lead Time column
    ORDER_RECEIVED_DATE: 15, // Order Received Date column
    ORDER_VALUE: 16,    // Order Value column
    REMARKS: 17         // Remarks column
};

// Save Data to Local Storage
function saveDataToLocal() {
    const tableData = Array.from(document.querySelectorAll("#rfqTable tbody tr")).map(row => {
        const cells = Array.from(row.children);
        return {
            rfqNo: cells[1].innerText,
            revision: cells[2].innerText,
            enquiryDetails: cells[3].innerText,
            customerName: cells[4].querySelector("select").value,
            rcvdDate: cells[5].querySelector("input").value,
            acknowledgedDate: cells[6].querySelector("input").value,
            assignedTo: cells[7].querySelector("select").value,
            rfqStatus: cells[8].querySelector("select").value,
            dateCompleted: cells[9].querySelector("input").value,
            submittalStatus: cells[10].querySelector("select").value,
            submittedDate: cells[11].querySelector("input").value,
            quoteValue: cells[12].innerText,
            leadTime: cells[13].innerText,
            orderReceivedDate: cells[14].querySelector("input").value,
            orderValue: cells[15].innerText,
            remarks: cells[16].innerText
        };
    });
    localStorage.setItem("rfqData", JSON.stringify(tableData));
}

// Load Data from Local Storage
function loadDataFromLocal() {
    const savedData = localStorage.getItem("rfqData");
    if (savedData) {
        const tableData = JSON.parse(savedData);
        const tableBody = document.querySelector("#rfqTable tbody");
        tableBody.innerHTML = ""; // Clear existing rows

        tableData.forEach(data => {
            const newRow = document.createElement("tr");
            newRow.innerHTML = `
                <td><input type="radio" name="selectRFQ"></td>
                <td><a href="#" onclick="openRFQDetails('${data.rfqNo}')">${data.rfqNo}</a></td> <!-- Hyperlink -->
                <td>${data.revision}</td>
                <td contenteditable="true">${data.enquiryDetails}</td>
                <td><select>
                    <option ${data.customerName === "ABC" ? "selected" : ""}>ABC</option>
                    <option ${data.customerName === "CDF" ? "selected" : ""}>CDF</option>
                    <option ${data.customerName === "ASG" ? "selected" : ""}>ASG</option>
                </select></td>
                <td><input type="date" value="${data.rcvdDate}"></td>
                <td><input type="date" value="${data.acknowledgedDate}"></td>
                <td><select>
                    <option ${data.assignedTo === "Dan" ? "selected" : ""}>Dan</option>
                    <option ${data.assignedTo === "San" ? "selected" : ""}>San</option>
                    <option ${data.assignedTo === "Jin" ? "selected" : ""}>Jin</option>
                </select></td>
                <td><select>
                    <option ${data.rfqStatus === "Open" ? "selected" : ""}>Open</option>
                    <option ${data.rfqStatus === "Closed" ? "selected" : ""}>Closed</option>
                    <option ${data.rfqStatus === "Cancelled" ? "selected" : ""}>Cancelled</option>
                    <option ${data.rfqStatus === "Onhold" ? "selected" : ""}>Onhold</option>
                </select></td>
                <td><input type="date" value="${data.dateCompleted}"></td>
                <td><select>
                    <option value="" ${!data.submittalStatus ? "selected" : ""}>Select Status</option>
                    <option ${data.submittalStatus === "Submitted" ? "selected" : ""}>Submitted</option>
                    <option ${data.submittalStatus === "Received" ? "selected" : ""}>Received</option>
                </select></td>
                <td><input type="date" value="${data.submittedDate}"></td>
                <td contenteditable="true">${data.quoteValue}</td>
                <td contenteditable="true">${data.leadTime}</td>
                <td><input type="date" value="${data.orderReceivedDate}"></td>
                <td contenteditable="true">${data.orderValue}</td>
                <td contenteditable="true">${data.remarks}</td>
            `;
            tableBody.appendChild(newRow);


        });
    }
}



function populateRFQListTable(data) {
    const tableBody = document.querySelector("#rfqTable tbody");
    tableBody.innerHTML = ""; // Clear existing rows

    data.forEach(rfq => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><input type="radio" name="selectRFQ"></td>
            <td><a href="#" onclick="openRFQDetails('${rfq.rfqNo}')">${rfq.rfqNo}</a></td>
            <td>${rfq.revision}</td>
            <td>${rfq.enquiryDetails}</td>
            <td>${rfq.customerName}</td>
            <td>${rfq.rcvdDate}</td>
            <td>${rfq.acknowledgedDate}</td>
            <td>${rfq.assignedTo}</td>
            <td>${rfq.rfqStatus}</td>
            <td>${rfq.dateCompleted}</td>
            <td>${rfq.submittalStatus}</td>
            <td>${rfq.submittedDate}</td>
            <td>${rfq.quoteValue}</td>
            <td>${rfq.leadTime}</td>
            <td>${rfq.orderReceivedDate}</td>
            <td>${rfq.orderValue}</td>
            <td>${rfq.remarks}</td>
        `;
        tableBody.appendChild(row);
    });
}




// Chart functions
function updateRFQCountChart(data, selectedYear) {
    console.log("Data for RFQ Count Chart:", data);

    const monthlyStatusCounts = Array(12).fill(0).map(() => ({
        Open: 0,
        Closed: 0,
        Cancelled: 0,
        Onhold: 0
    }));

    data.forEach(rfq => {
        if (rfq.rcvdDate) {
            const date = new Date(rfq.rcvdDate);
            const month = date.getMonth();
            const year = date.getFullYear();
            const status = rfq.status;

            if (year === selectedYear && monthlyStatusCounts[month][status] !== undefined) {
                monthlyStatusCounts[month][status] += 1;
            }
        }
    });

    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const datasets = Object.keys(monthlyStatusCounts[0]).map(status => ({
        label: status,
        data: monthlyStatusCounts.map(month => month[status]),
        backgroundColor: status === "Open" ? "lightblue"
            : status === "Closed" ? "lightgreen"
            : status === "Cancelled" ? "lightcoral"
            : "lightyellow"
    }));

    if (rfqCountChart) rfqCountChart.destroy();

    const ctx = document.getElementById("rfqCountChart").getContext("2d");
    rfqCountChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: {
                x: { title: { display: true, text: 'Month' } },
                y: { beginAtZero: true, title: { display: true, text: 'Number of RFQs' } }
            }
        }
    });
}

function updateSubmittedReceivedChart(data, selectedYear) {
    console.log("Data for Submitted vs Received Chart:", data); // Add this line
    const submittedData = new Array(12).fill(0);
    const receivedData = new Array(12).fill(0);

    data.forEach(rfq => {
        if (rfq.submittalStatus === "Submitted" && rfq.submittedDate) {
            const date = new Date(rfq.submittedDate);
            if (date.getFullYear() === selectedYear) {
                submittedData[date.getMonth()] += parseFloat(rfq.quoteValue) || 0;
            }
        }
        if (rfq.submittalStatus === "Received" && rfq.orderReceivedDate) {
            const date = new Date(rfq.orderReceivedDate);
            if (date.getFullYear() === selectedYear) {
                receivedData[date.getMonth()] += parseFloat(rfq.orderValue) || 0;
            }
        }
    });

    if (submittedReceivedChart) submittedReceivedChart.destroy();
    submittedReceivedChart = new Chart(document.getElementById("submittedReceivedChart"), {
        type: 'bar',
        data: {
            labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            datasets: [
                { label: "Submitted", backgroundColor: "lightblue", data: submittedData },
                { label: "Received", backgroundColor: "lightcoral", data: receivedData }
            ]
        },
        options: {
            scales: {
                y: { beginAtZero: true, title: { display: true, text: "Value ($)" } },
                x: { title: { display: true, text: "Month" } }
            },
            responsive: true,
            plugins: { legend: { position: "top" }, tooltip: { mode: "index", intersect: false } }
        }
    });
}

function updateAssignedToChart(data) {
    // Initialize an object to count RFQs assigned to each user
    const assignedCounts = {};

    data.forEach(rfq => {
        if (rfq.status === "Open" && rfq.assignedTo) {
            assignedCounts[rfq.assignedTo] = (assignedCounts[rfq.assignedTo] || 0) + 1;
        }
    });

    // Prepare chart labels and values
    const labels = Object.keys(assignedCounts);
    const values = Object.values(assignedCounts);

    // Destroy existing chart if it exists
    if (assignedToChart) assignedToChart.destroy();

    // Create a new chart
    const ctx = document.getElementById("assignedToChart").getContext("2d");
    assignedToChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "RFQs Assigned",
                    data: values,
                    backgroundColor: "lightblue",
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (tooltipItem) {
                            return `Count: ${tooltipItem.raw}`;
                        },
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Number of RFQs",
                    },
                },
                x: {
                    title: {
                        display: true,
                        text: "Assigned To",
                    },
                },
            },
        },
    });
}


function updateClosedPerMonthChart(data, selectedYear) {
    // Initialize an array to count closed RFQs per month
    const closedCounts = new Array(12).fill(0);

    data.forEach(rfq => {
        if (rfq.status === "Closed" && rfq.completedDate) {
            const date = new Date(rfq.completedDate);
            if (date.getFullYear() === selectedYear) {
                closedCounts[date.getMonth()] += 1;
            }
        }
    });

    // Destroy existing chart if it exists
    if (closedPerMonthChart) closedPerMonthChart.destroy();

    // Create a new chart
    const ctx = document.getElementById("closedPerMonthChart").getContext("2d");
    closedPerMonthChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            datasets: [
                {
                    label: "RFQs Closed",
                    data: closedCounts,
                    backgroundColor: "lightgreen",
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (tooltipItem) {
                            return `Closed: ${tooltipItem.raw}`;
                        },
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Number of RFQs Closed",
                    },
                },
                x: {
                    title: {
                        display: true,
                        text: "Month",
                    },
                },
            },
        },
    });
}




//RFQ Details

// Global Variables for RFQ Details
let editingRowDetails = null;
let originalDataDetails = {};

// Save RFQ Details to Local Storage
function saveRFQDetailsToLocal() {
    const rfqNo = document.getElementById("rfqNoDetail").textContent.trim();
    const tableBody = document.querySelector("#rfqDetailsTable tbody");

    if (!rfqNo) {
        alert("RFQ No is missing! Please verify the details.");
        return;
    }

    const rfqDetails = Array.from(tableBody.querySelectorAll("tr")).map(row => {
        const cells = row.querySelectorAll("td");
        return {
            itemNo: cells[2]?.textContent.trim() || "",
            description: cells[3]?.textContent.trim() || "",
            rev: cells[4]?.textContent.trim() || "",
            quantity: parseFloat(cells[5]?.textContent.trim()) || 0,
            uom: cells[6]?.querySelector("select")?.value || "",
            itemType: cells[7]?.querySelector("select")?.value || "",
            status: cells[8]?.querySelector("select")?.value || "",
            unitCost: parseFloat(cells[9]?.textContent.trim()) || 0.0,
            markup: parseFloat(cells[10]?.textContent.trim()) || 0.0,
            unitPrice: parseFloat(cells[11]?.textContent.replace("$", "").trim()) || 0.0,
            extendedPrice: parseFloat(cells[12]?.textContent.replace("$", "").trim()) || 0.0,
            remarks: cells[13]?.textContent.trim() || "",
            leadTime: cells[14]?.textContent.trim() || "",
        };
    });

    // Save to localStorage
    localStorage.setItem(`rfqDetails_${rfqNo}`, JSON.stringify(rfqDetails));

    // Re-apply item link styles and listeners
    rfqDetails.forEach((detail, index) => {
        const row = tableBody.rows[index];
        if (detail.itemType === "Assembly" && detail.itemNo) {
            const itemNoCell = row.cells[2];
            itemNoCell.innerHTML = `<a href="#" class="item-link" data-item-no="${detail.itemNo}" style="color: blue; text-decoration: underline;">${detail.itemNo}</a>`;
        }
    });

    attachItemLinkListeners(); // Reattach listeners for updated links

    alert("RFQ details saved and quote value updated successfully!");
}



function calculateTotalExtdPrice() {
    const tableBody = document.querySelector("#rfqDetailsTable tbody");
    let total = 0;

    Array.from(tableBody.querySelectorAll("tr")).forEach(row => {
        const extdPriceCell = row.querySelector("td:nth-child(13)"); // Assuming Extd Price is in the 13th column
        const extdPrice = parseFloat(extdPriceCell?.textContent.replace("$", "").trim()) || 0;
        total += extdPrice;
    });

    console.log(`Calculated Total Extended Price: $${total.toFixed(2)}`);
    return total;
}



// Optional: Download RFQ Details as JSON File
function downloadRFQDetails(rfqNo, rfqDetails) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rfqDetails, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `RFQ_${rfqNo}_Details.json`);
    document.body.appendChild(downloadAnchor); // Required for Firefox
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
}


// Load RFQ Details with calculations attached
function loadRFQDetails(rfqNo) {
    const savedData = localStorage.getItem(`rfqDetails_${rfqNo}`);
    const tableBody = document.querySelector("#rfqDetailsTable tbody");
    tableBody.innerHTML = ""; // Clear existing rows

    if (!savedData) {
        alert(`No saved details found for RFQ No: ${rfqNo}`);
        return;
    }

    const rfqDetails = JSON.parse(savedData);

    rfqDetails.forEach((data, index) => {
        const newRow = document.createElement("tr");
        const isAssembly = data.itemType === "Assembly";
        const hasForm = data.itemNo && isAssembly; // Check if the item is an Assembly with a valid Item No

        // Render "Item No" as a hyperlink if it has a form connected
        const itemNoDisplay = hasForm
            ? `<a href="#" class="item-link" data-item-no="${data.itemNo}" style="color: blue; text-decoration: underline;">${data.itemNo}</a>`
            : data.itemNo || "New Item";

        newRow.innerHTML = `
            <td><input type="radio" name="selectDetail"></td>
            <td>${index + 1}</td>
            <td>${itemNoDisplay}</td>
            <td>${data.description || ""}</td>
            <td>${data.rev || ""}</td>
            <td>${data.quantity || ""}</td>
            <td>
                <select disabled>
                    <option ${data.uom === "EA" ? "selected" : ""}>EA</option>
                    <option ${data.uom === "KG" ? "selected" : ""}>KG</option>
                    <option ${data.uom === "M" ? "selected" : ""}>M</option>
                </select>
            </td>
            <td>
                <select disabled>
                    <option ${data.itemType === "Assembly" ? "selected" : ""}>Assembly</option>
                    <option ${data.itemType === "Make" ? "selected" : ""}>Make</option>
                    <option ${data.itemType === "Buy" ? "selected" : ""}>Buy</option>
                </select>
            </td>
            <td>
                <select disabled>
                    <option ${data.status === "Open" ? "selected" : ""}>Open</option>
                    <option ${data.status === "Completed" ? "selected" : ""}>Completed</option>
                    <option ${data.status === "OnHold" ? "selected" : ""}>OnHold</option>
                </select>
            </td>
            <td>${parseFloat(data.unitCost || 0).toFixed(2)}</td>
            <td>${parseFloat(data.markup || 0).toFixed(2)}</td>
            <td>$${parseFloat(data.unitPrice || 0).toFixed(2)}</td>
            <td>$${parseFloat(data.extendedPrice || 0).toFixed(2)}</td>
            <td>${data.remarks || ""}</td>
            <td>${data.leadTime || ""}</td>
        `;
        tableBody.appendChild(newRow);
    });

    // Reattach event listeners to hyperlinks
    attachItemLinkListeners();

    // Lock fields after loading
    lockColumnsOnReload();
}

function attachItemLinkListeners() {
    document.querySelectorAll(".item-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const itemNo = link.getAttribute("data-item-no");
            if (itemNo) {
                openAssemblyReviewForm(itemNo); // Function to open the associated form
            } else {
                alert("No Item Number assigned. Cannot open form.");
            }
        });
    });
}



function lockAllFieldsAfterLoad() {
    const rows = document.querySelectorAll("#rfqDetailsTable tbody tr");
    rows.forEach(row => {
        row.querySelectorAll("td").forEach(cell => {
            const dropdown = cell.querySelector("select");
            if (dropdown) {
                dropdown.disabled = true; // Lock dropdown fields
            } else {
                cell.setAttribute("contenteditable", "false"); // Lock text fields
            }
        });
    });

    console.log("Fields locked after load.");
}


// Restrict editing on reload or after saving
function lockColumnsOnReload() {
    const rows = document.querySelectorAll("#rfqDetailsTable tbody tr");
    rows.forEach(row => {
        row.querySelectorAll("td").forEach(cell => {
            const dropdown = cell.querySelector("select");
            if (dropdown) {
                dropdown.disabled = true; // Disable dropdowns
            } else {
                cell.setAttribute("contenteditable", "false"); // Lock text fields
            }
        });
    });
}



// Populate RFQ Details Table
function populateRFQDetailsTable(details) {
    const tableBody = document.querySelector("#rfqDetailsTable tbody");
    tableBody.innerHTML = ""; // Clear existing rows

    details.forEach((detail, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><input type="radio" name="selectDetail"></td>
            <td>${index + 1}</td>
            <td>${detail.itemNo || ""}</td>
            <td>${detail.description || ""}</td>
            <td>${detail.rev || ""}</td>
            <td>${detail.quantity || ""}</td>
            <td><select>
                <option ${detail.uom === "EA" ? "selected" : ""}>EA</option>
                <option ${detail.uom === "KG" ? "selected" : ""}>KG</option>
                <option ${detail.uom === "M" ? "selected" : ""}>M</option>
            </select></td>
            <td><select>
                <option ${detail.itemType === "Assembly" ? "selected" : ""}>Assembly</option>
                <option ${detail.itemType === "Make" ? "selected" : ""}>Make</option>
                <option ${detail.itemType === "Buy" ? "selected" : ""}>Buy</option>
            </select></td>
            <td><select>
                <option ${detail.status === "Open" ? "selected" : ""}>Open</option>
                <option ${detail.status === "Completed" ? "selected" : ""}>Completed</option>
                <option ${detail.status === "OnHold" ? "selected" : ""}>OnHold</option>
            </select></td>
            <td contenteditable="true">${detail.unitCost || ""}</td>
            <td contenteditable="true">${detail.markup || ""}</td>
            <td>${detail.unitPrice || ""}</td>
            <td>${detail.extendedPrice || ""}</td>
            <td contenteditable="true">${detail.remarks || ""}</td>
            <td contenteditable="true">${detail.leadTime || ""}</td>
        `;
        tableBody.appendChild(row);
    });
}
// Add New RFQ Detail
function newRFQDetail() {
    const tableBody = document.querySelector("#rfqDetailsTable tbody");
    const nextSlNo = tableBody.children.length + 1;

    const newRow = document.createElement("tr");
    newRow.innerHTML = `
        <td><input type="radio" name="selectDetail"></td>
        <td>${nextSlNo}</td>
        <td contenteditable="true">New Item</td>
        <td contenteditable="true">Description</td>
        <td contenteditable="true">Rev</td>
        <td contenteditable="true">1</td>
        <td><select><option>EA</option><option>KG</option><option>M</option></select></td>
        <td><select><option>Assembly</option><option>Make</option><option>Buy</option></select></td>
        <td><select><option>Open</option><option>Completed</option><option>OnHold</option></select></td>
        <td contenteditable="true">0.00</td>
        <td contenteditable="true">0</td>
        <td>0.00</td>
        <td>0.00</td>
        <td contenteditable="true">Remarks</td>
        <td contenteditable="true">2 weeks</td>
    `;

    tableBody.appendChild(newRow);
    attachCalculationListeners(newRow); // Ensure calculations work for the new row
}

// Edit Row
function editRFQDetail() {
    const selectedRadio = document.querySelector("input[name='selectDetail']:checked");
    if (!selectedRadio) {
        alert("Please select a row to edit.");
        return;
    }

    const row = selectedRadio.closest("tr");
    console.log("Selected row for editing:", row);

    // Enable editing for specific fields
    const editableColumns = [2, 3, 4, 5, 9, 10, 13, 14]; // Editable columns
    const dropdownColumns = [6, 7, 8]; // Dropdown columns: UOM, Item Type, Status

    editableColumns.forEach(index => {
        const cell = row.cells[index];
        const dropdown = cell.querySelector("select");

        if (dropdownColumns.includes(index) && dropdown) {
	    console.log(`Enabling dropdown for column index ${index}:`, dropdown);
            dropdown.disabled = false; // Enable dropdowns
        } else {
            console.log(`Enabling contenteditable for column index ${index}:`, cell);
            cell.setAttribute("contenteditable", "true"); // Enable text fields
        }
    });

    // Attach calculation logic to Unit Price and Extended Price
    const unitCostCell = row.cells[9]; // Unit Cost
    const markupCell = row.cells[10]; // Markup (%)
    const quantityCell = row.cells[5]; // Quantity
    const unitPriceCell = row.cells[11]; // Unit Price
    const extendedPriceCell = row.cells[12]; // Extended Price

    // Function to calculate values using shared helpers
    const updatePrices = () => {
        const unitCost = parseFloat(unitCostCell.textContent.trim()) || 0;
        const markup = parseFloat(markupCell.textContent.trim()) || 0;
        const quantity = parseFloat(quantityCell.textContent.trim()) || 0;

	console.log("Unit Cost:", unitCost, "Markup:", markup, "Quantity:", quantity);

        const unitPrice = calculateUnitPrice(unitCost, markup); // Helper function
        const extendedPrice = calculateExtendedPrice(unitCost, markup, quantity); // Helper function

	console.log("Calculated Unit Price:", unitPrice, "Calculated Extended Price:", extendedPrice);

        unitPriceCell.textContent = unitPrice || ""; // Update Unit Price
        extendedPriceCell.textContent = extendedPrice || ""; // Update Extended Price
    };

    // Add event listeners for real-time updates
    [unitCostCell, markupCell, quantityCell].forEach(cell => {
	console.log("Attaching input event listener to cell:", cell);
        cell.addEventListener("input", updatePrices);
    });

    // Trigger calculations on edit initialization
    console.log("Initializing price calculations for the selected row.");
    updatePrices();

    // Save the editing row for global access
    editingRowDetails = row;

    // Notify user
    alert("Editing enabled for the selected row.");
}

function restrictEditingOnLoad() {
    const rows = document.querySelectorAll("#rfqDetailsTable tbody tr");
    rows.forEach(row => {
        row.querySelectorAll("td").forEach(cell => {
            const dropdown = cell.querySelector("select");
            if (dropdown) {
                dropdown.disabled = true; // Disable dropdowns
            } else {
                cell.setAttribute("contenteditable", "false"); // Lock text fields
            }
        });
    });
}

function updateQuoteValueInRFQList(rfqNo, totalExtdPrice) {
    const rows = document.querySelectorAll("#rfqTable tbody tr");

    rows.forEach(row => {
        const rfqNoCell = row.querySelector("td:nth-child(2)"); // Assuming RFQ No is in the 2nd column
        const quoteValueCell = row.querySelector("td:nth-child(13)"); // Assuming Quote Value is in the 13th column

        // Match the RFQ No and update the Quote Value
        if (rfqNoCell && rfqNoCell.textContent.trim() === rfqNo) {
            quoteValueCell.textContent = `$${totalExtdPrice.toFixed(2)}`; // Format with $ and two decimals
        }
    });
}



// Attach event listeners for dynamic calculation of Unit Price and Extended Price
function attachCalculationListeners(row) {
    const unitCostCell = row.cells[9]; // Unit Cost
    const markupCell = row.cells[10]; // Markup (%)
    const quantityCell = row.cells[5]; // Quantity
    const unitPriceCell = row.cells[11]; // Unit Price
    const extendedPriceCell = row.cells[12]; // Extended Price

    const updatePrices = () => {
        const unitCost = parseFloat(unitCostCell.textContent.trim()) || 0;
        const markup = parseFloat(markupCell.textContent.trim()) || 0;
        const quantity = parseFloat(quantityCell.textContent.trim()) || 0;

        const unitPrice = unitCost * (1 + markup / 100); // Calculate Unit Price
        const extendedPrice = unitPrice * quantity; // Calculate Extd Price

        unitPriceCell.textContent = `$${unitPrice.toFixed(2)}`;
        extendedPriceCell.textContent = `$${extendedPrice.toFixed(2)}`;
    };

    [unitCostCell, markupCell, quantityCell].forEach(cell => {
        cell.addEventListener("input", updatePrices);
    });

    updatePrices(); // Initial calculation
}


// Save Row
function saveRFQDetail() {
    if (editingRowDetails) {
        // Lock all fields in the edited row
        editingRowDetails.querySelectorAll("td[contenteditable]").forEach(cell => {
            cell.removeAttribute("contenteditable");
        });
        editingRowDetails.querySelectorAll("select").forEach(select => {
            select.disabled = true;
        });

        saveRFQDetailsToLocal(); // Save all rows to localStorage
        editingRowDetails = null; // Clear editing state
    } else {
        alert("No row is currently being edited.");
    }
}



// Finalize Save
function finalizeSaveDetails() {
    if (editingRowDetails) {
        editingRowDetails.querySelectorAll("td[contenteditable]").forEach(cell => {
            cell.removeAttribute("contenteditable");
        });
        editingRowDetails.querySelectorAll("select").forEach(select => {
            select.disabled = true;
        });

        editingRowDetails = null; // Clear editing state
    }

    saveRFQDetailsToLocal(); // Save to local storage
}



// Delete Row
function deleteRFQDetail() {
    const selectedRow = document.querySelector("input[name='selectDetail']:checked");
    if (selectedRow) {
        const row = selectedRow.closest("tr");
        if (confirm("Are you sure you want to delete this row?")) {
            row.remove();
            saveRFQDetailsToLocal();
        }
    } else {
        alert("Please select a row to delete.");
    }
}

// Open RFQ Details Page from RFQ List
function openRFQDetails(rfqNo) {
    // Ensure RFQ No is valid
    if (!rfqNo) {
        alert("RFQ No is missing!");
        return;
    }

    // Update RFQ No and Rev fields in the RFQ Details section
    document.getElementById("rfqNoDetail").textContent = rfqNo;
    document.getElementById("rfqRevDetail").textContent = "0"; // Default revision for now

    // Load RFQ details from localStorage
    const savedData = localStorage.getItem(`rfqDetails_${rfqNo}`);
    const tableBody = document.querySelector("#rfqDetailsTable tbody");
    tableBody.innerHTML = ""; // Clear existing rows before loading

    if (savedData) {
        const rfqDetails = JSON.parse(savedData);

        // Populate the RFQ Details table
        rfqDetails.forEach((data, index) => {
            const newRow = document.createElement("tr");
            newRow.innerHTML = `
                <td><input type="radio" name="selectDetail"></td>
                <td>${index + 1}</td>
                <td>${data.itemNo || ""}</td>
                <td>${data.description || ""}</td>
                <td>${data.rev || ""}</td>
                <td>${data.quantity || ""}</td>
                <td>
                    <select disabled>
                        <option ${data.uom === "EA" ? "selected" : ""}>EA</option>
                        <option ${data.uom === "KG" ? "selected" : ""}>KG</option>
                        <option ${data.uom === "M" ? "selected" : ""}>M</option>
                    </select>
                </td>
                <td>
                    <select disabled>
                        <option ${data.itemType === "Assembly" ? "selected" : ""}>Assembly</option>
                        <option ${data.itemType === "Make" ? "selected" : ""}>Make</option>
                        <option ${data.itemType === "Buy" ? "selected" : ""}>Buy</option>
                    </select>
                </td>
                <td>
                    <select disabled>
                        <option ${data.status === "Open" ? "selected" : ""}>Open</option>
                        <option ${data.status === "Completed" ? "selected" : ""}>Completed</option>
                        <option ${data.status === "OnHold" ? "selected" : ""}>OnHold</option>
                    </select>
                </td>
                <td>${parseFloat(data.unitCost || 0).toFixed(2)}</td>
                <td>${parseFloat(data.markup || 0).toFixed(2)}</td>
                <td>${parseFloat(data.unitPrice || 0).toFixed(2)}</td>
                <td>${parseFloat(data.extendedPrice || 0).toFixed(2)}</td>
                <td>${data.remarks || ""}</td>
                <td>${data.leadTime || ""}</td>
            `;
            tableBody.appendChild(newRow);

            // Attach dynamic calculation listeners for rows
            attachCalculationListeners(newRow);
        });

        // Lock fields after loading data
        lockColumnsOnReload();
    } else {
        // No data found for the given RFQ No
        alert(`No saved details found for RFQ No: ${rfqNo}`);
    }

    // Switch to the RFQ Details page
    showPage("rfqDetails");
}

function addNewRow() {
    isEditMode = true; // Set edit mode to true during row addition


    const tableBody = document.querySelector("#rfqDetailsTable tbody");
    const nextSlNo = tableBody.children.length + 1;
    const newRow = document.createElement("tr");

    newRow.innerHTML = `
        <td><input type="radio" name="selectDetail"></td>
        <td>${nextSlNo}</td>
        <td contenteditable="true">New Item</td> <!-- Item No -->
        <td contenteditable="true">Description</td>
        <td contenteditable="true">Rev</td>
        <td contenteditable="true">1</td>
        <td><select><option>EA</option><option>KG</option><option>M</option></select></td>
        <td><select><option>Assembly</option><option>Make</option><option>Buy</option></select></td>
        <td><select><option>Open</option><option>Completed</option><option>OnHold</option></select></td>
        <td contenteditable="true">0.00</td>
        <td contenteditable="true">0.00</td>
        <td>$0.00</td>
        <td>$0.00</td>
        <td contenteditable="true">Remarks</td>
        <td contenteditable="true">2 weeks</td>
    `;

    // Append the new row to the table
    tableBody.appendChild(newRow);

    // Attach event listeners for calculations
    attachCalculationListeners(newRow);

    alert("New row added successfully.");
}


// Function to handle changes in the table and calculate Unit Price and Extended Price
function addRowChangeListeners(row) {
    const markupCell = row.querySelector('[data-column="markup"]');
    const unitCostCell = row.querySelector('[data-column="unitCost"]');
    const quantityCell = row.querySelector('[data-column="quantity"]');
    const unitPriceCell = row.querySelector('[data-column="unitPrice"]');
    const extendedPriceCell = row.querySelector('[data-column="extendedPrice"]');

    const updatePrices = () => {
        const markup = parseFloat(markupCell.innerText) || 0; // Default to 0 if empty
        const unitCost = parseFloat(unitCostCell.innerText) || 0; // Default to 0 if empty
        const quantity = parseFloat(quantityCell.innerText) || 0; // Default to 0 if empty

        // Calculate Unit Price and Extended Price
        const unitPrice = unitCost * (1 + markup / 100);
        const extendedPrice = unitPrice * quantity;

        // Update the Unit Price and Extended Price cells
        unitPriceCell.innerText = unitPrice > 0 ? unitPrice.toFixed(2) : "";
        extendedPriceCell.innerText = extendedPrice > 0 ? extendedPrice.toFixed(2) : "";
    };

    // Add event listeners to recalculate prices on input changes
    [markupCell, unitCostCell, quantityCell].forEach(cell => {
        cell.addEventListener("input", updatePrices);
    });
}


// Calculation helper functions
function calculateUnitPrice(unitCost, markup) {
    return unitCost * (1 + markup / 100);
    return parseFloat(unitPrice.toFixed(2)); // Restrict to 2 decimals
}

function calculateExtendedPrice(unitCost, markup, quantity) {
    const parsedUnitCost = parseFloat(unitCost) || 0;
    const parsedMarkup = parseFloat(markup) || 0;
    const parsedQuantity = parseFloat(quantity) || 0;
    const unitPrice = parsedUnitCost * (1 + parsedMarkup / 100);
    const extendedPrice = unitPrice * parsedQuantity;
    return extendedPrice.toFixed(2); // Restrict to 2 decimals
}

// Function to recalculate and update the Quote Value on page load
function recalculateQuoteValuesOnLoad() {
    const rfqTableRows = document.querySelectorAll("#rfqTable tbody tr");

    rfqTableRows.forEach(row => {
        const rfqNoCell = row.querySelector("td:nth-child(2)"); // Assuming RFQ No is in the 2nd column
        const quoteValueCell = row.querySelector("td:nth-child(13)"); // Assuming Quote Value is in the 13th column

        if (rfqNoCell) {
            const rfqNo = rfqNoCell.textContent.trim();
            const totalExtendedPrice = calculateTotalExtdPriceFromDetails(rfqNo); // Calculate total from RFQ Details
            if (totalExtendedPrice !== null) {
                quoteValueCell.textContent = `$${totalExtendedPrice.toFixed(2)}`; // Update the Quote Value
                console.log(`Quote Value for RFQ ${rfqNo} updated to $${totalExtendedPrice}`);
            } else {
                quoteValueCell.textContent = `$0.00`; // Default to 0 if no data is available
                console.warn(`No RFQ Details found for RFQ ${rfqNo}`);
            }
        }
    });
}

// Function to calculate Total Extended Price from RFQ Details (used on reload)
function calculateTotalExtdPriceFromDetails(rfqNo) {
    const savedDetails = localStorage.getItem(`rfqDetails_${rfqNo}`);
    if (!savedDetails) return null;

    const rfqDetails = JSON.parse(savedDetails);
    let totalExtendedPrice = 0;

    rfqDetails.forEach(detail => {
        totalExtendedPrice += parseFloat(detail.extendedPrice || 0); // Sum up the Extd Price
    });

    return totalExtendedPrice;
}

// Attach event listeners to all rows after loading data
function initializeListenersForAllRows() {
    const rows = document.querySelectorAll("#rfqDetailsTable tbody tr");
    rows.forEach(row => attachCalculationListeners(row));
}

function saveDataToLocalStorage() {
    localStorage.setItem("rfqDetailsData", JSON.stringify(rfqDetailsData));
}

function loadDataFromLocalStorage() {
    const savedData = localStorage.getItem("rfqDetailsData");
    if (savedData) {
        rfqDetailsData = JSON.parse(savedData);
    }
}

function saveRFQDetails() {
    const rfqNo = document.getElementById("rfqNoDetail").textContent.trim();
    const tableBody = document.querySelector("#rfqDetailsTable tbody");

    if (!rfqNo) {
        alert("No RFQ No found! Please ensure RFQ No is populated.");
        return;
    }

    // Collect data from RFQ Details Table
    const rfqDetails = Array.from(tableBody.querySelectorAll("tr")).map(row => {
        const cells = row.querySelectorAll("td");
        const itemNoCell = cells[2];

        // Update appearance of Item No to indicate a form is attached
        const itemNo = cells[2]?.textContent.trim() || "";
        const itemType = cells[7]?.querySelector("select").value || "";

        if (itemType === "Assembly" && itemNo) {
            itemNoCell.innerHTML = `<a href="#" style="color: blue; text-decoration: underline;">${itemNo}</a>`;
        }

        return {
            itemNo: cells[2]?.textContent.trim() || "",
            description: cells[3]?.textContent.trim() || "",
            rev: cells[4]?.textContent.trim() || "",
            quantity: parseFloat(cells[5]?.textContent.trim()) || 0,
            uom: cells[6]?.querySelector("select")?.value || "",
            itemType: cells[7]?.querySelector("select")?.value || "",
            status: cells[8]?.querySelector("select")?.value || "",
            unitCost: parseFloat(cells[9]?.textContent.trim()) || 0.0,
            markup: parseFloat(cells[10]?.textContent.trim()) || 0.0,
            extendedPrice: parseFloat(cells[12]?.textContent.replace("$", "").trim()) || 0.0,
            remarks: cells[13]?.textContent.trim() || "",
            leadTime: cells[14]?.textContent.trim() || "",
        };
    });

    // Save RFQ Details to Local Storage
    localStorage.setItem(`rfqDetails_${rfqNo}`, JSON.stringify(rfqDetails));

    // Calculate and Update Quote Value
    const totalExtendedPrice = rfqDetails.reduce((total, item) => total + (item.extendedPrice || 0), 0);
    updateQuotedValue(rfqNo, totalExtendedPrice);

    alert("RFQ Details saved successfully and Quote Value updated!");
    updateLeadTimeCounts()
    lockColumnsOnReload()
 

    isEditMode = false; // Exit edit mode after saving
    
}



function restrictEditingAfterSave() {
    const rows = document.querySelectorAll("#rfqDetailsTable tbody tr");
    rows.forEach(row => {
        row.querySelectorAll("td").forEach(cell => {
            const dropdown = cell.querySelector("select");
            if (dropdown) {
                dropdown.disabled = true;
            } else {
                cell.setAttribute("contenteditable", "false");
            }
        });
    });
}


function editRFQDetails() {
    const selectedRadio = document.querySelector("input[name='selectDetail']:checked");

    if (!selectedRadio) {
        alert("Please select a row to edit.");
        return;
    }

    const selectedRow = selectedRadio.closest("tr");

    // Save the selected row to global state
    editingRowDetails = selectedRow;

    // Save original data for cancellation
    originalDataDetails = Array.from(selectedRow.cells).map(cell => {
        const inputElement = cell.querySelector("input, select");
        if (inputElement) {
            return inputElement.value; // Store input or dropdown value
        }
        return cell.textContent.trim(); // Store text content
    });

    // Enable editing for specific fields
    const editableColumns = [2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14];
    editableColumns.forEach(index => {
        const cell = selectedRow.cells[index];
        const dropdown = cell.querySelector("select");

        if (dropdown) {
            dropdown.disabled = false; // Enable dropdown fields
        } else {
            cell.setAttribute("contenteditable", "true"); // Enable text fields
        }
    });

    alert("Editing enabled for the selected row.");
}

function cancelEditDetails() {
    isEditMode = false; // Exit edit mode after canceling

    if (!editingRowDetails) {
        alert("No row is currently being edited.");
        return;
    }

    // Ensure original data exists
    if (!originalDataDetails || Object.keys(originalDataDetails).length === 0) {
        alert("Original data is missing. Cannot cancel edit.");
        return;
    }

    // Restore the original data in the editing row
    Array.from(editingRowDetails.cells).forEach((cell, index) => {
        const inputElement = cell.querySelector("input, select");
        if (inputElement) {
            if (inputElement.tagName === "SELECT") {
                inputElement.value = originalDataDetails[index]; // Restore dropdown value
            } else {
                inputElement.value = originalDataDetails[index]; // Restore input value
            }
        } else {
            cell.textContent = originalDataDetails[index]; // Restore cell text
        }
    });

    // Lock fields to make them non-editable
    editingRowDetails.querySelectorAll("td[contenteditable]").forEach(cell => {
        cell.removeAttribute("contenteditable");
    });
    editingRowDetails.querySelectorAll("select, input").forEach(input => {
        input.disabled = true;
    });

    // Re-enable the radio button for row selection
    const radioButton = editingRowDetails.querySelector("input[type='radio']");
    if (radioButton) {
        radioButton.disabled = false; // Ensure radio button remains active
    }

    // Clear editing state
    editingRowDetails = null;
    originalDataDetails = {};

    console.log("Edit canceled.");
    alert("Edit canceled. Changes reverted to the original state.");
}

function updateQuotedValue(rfqNo, totalExtendedPrice) {
    const rows = document.querySelectorAll("#rfqTable tbody tr");

    rows.forEach(row => {
        const rfqNoCell = row.querySelector("td:nth-child(2)"); // Assuming RFQ No is in 2nd column
        const quoteValueCell = row.querySelector("td:nth-child(13)"); // Assuming Quote Value is in 13th column

        if (rfqNoCell && rfqNoCell.textContent.trim() === rfqNo) {
            quoteValueCell.textContent = `$${totalExtendedPrice.toFixed(2)}`;
            console.log(`Quote value updated for RFQ No '${rfqNo}' to $${totalExtendedPrice}`);
        }
    });

    // Save the updated RFQ List back to Local Storage
    saveDataToLocal();
}

function updateLeadTimeCounts() {
    // Loop through each RFQ in the RFQ list
    const rfqListRows = document.querySelectorAll("#rfqTable tbody tr");
    rfqListRows.forEach(rfqRow => {
        // Get RFQ No from the current row
        const rfqNo = rfqRow.querySelector("td:nth-child(2)").innerText.trim();

        // Retrieve RFQ Details for this RFQ No from localStorage
        const rfqDetails = JSON.parse(localStorage.getItem(`rfqDetails_${rfqNo}`) || "[]");

        // Calculate total line items and completed line items
        const totalLineItems = rfqDetails.length;
        const completedItems = rfqDetails.filter(detail => detail.status === "Completed").length;

        // Update the Lead Time column (assuming it's the 14th column in the RFQ List)
        const leadTimeCell = rfqRow.querySelector("td:nth-child(14)");
        leadTimeCell.textContent = `${completedItems}/${totalLineItems}`;
    });
}

// Call this function after loading data or when RFQ Details are updated
updateLeadTimeCounts();


// Function to return to the Dashboard
function returnToHome() {
    // Clear any selections or temporary states
    editingRowDetails = null;
    originalDataDetails = {};

    // Switch back to the Dashboard
    showPage("dashboard");
}


//Unit cost update codes for updating value in RFQ details page from the review form
function updateUnitCostFromReview(itemNo, unitCost) {
    const tableBody = document.querySelector("#rfqDetailsTable tbody");

    // Find the row matching the itemNo
    const matchingRow = Array.from(tableBody.querySelectorAll("tr")).find(row => {
        const rowItemNo = row.cells[2]?.textContent.trim(); // Assuming Item No is in the 3rd column
        return rowItemNo === itemNo;
    });

    if (matchingRow) {
        const unitCostCell = matchingRow.cells[9]; // Assuming Unit Cost is in the 10th column
        unitCostCell.textContent = parseFloat(unitCost).toFixed(2); // Update Unit Cost

        // Save updated data to localStorage
        saveRFQDetailsToLocal();

        console.log(`Updated Unit Cost for Item No: ${itemNo} to $${unitCost}`);
    } else {
        console.warn(`No matching row found for Item No: ${itemNo}`);
    }
    showPage("rfqDetails");
}






//RFQDetail list
function populateRFQDetailList() {
    const rfqDetailTableBody = document.querySelector("#rfqDetailTable tbody");
    rfqDetailTableBody.innerHTML = ""; // Clear the table

    const rfqData = JSON.parse(localStorage.getItem("rfqData")) || [];
    
    rfqData.forEach(rfq => {
        const rfqDetails = JSON.parse(localStorage.getItem(`rfqDetails_${rfq.rfqNo}`)) || [];
        
        rfqDetails.forEach((detail, index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${rfq.rfqNo}</td>
                <td>${rfq.revision}</td>
		<td>${rfq.customerName}</td>
		<td>${rfq.rcvdDate}</td>
                <td>${rfq.assignedTo}</td>
                <td>${rfq.rfqStatus}</td>
                <td>${rfq.submittedDate || ""}</td>
                <td>${rfq.quoteValue}</td>
                <td>${index + 1}</td>
                <td>${detail.itemNo || ""}</td>
                <td>${detail.description || ""}</td>
                <td>${detail.rev || ""}</td>
                <td>${detail.quantity || ""}</td>
                <td>${detail.uom || ""}</td>
                <td>${detail.itemType || ""}</td>
                <td>${detail.status || ""}</td>
                <td>${formatCurrency(detail.unitCost)}</td>
                <td>${detail.markup || ""}</td>
                <td>${formatCurrency(detail.unitPrice)}</td>
                <td>${formatCurrency(detail.extendedPrice)}</td>
                <td>${detail.remarks || ""}</td>
                <td>${detail.leadTime || ""}</td>
		<td>${rfq.orderReceivedDate}</td>
		<td>${rfq.orderValue}</td>
            `;
            rfqDetailTableBody.appendChild(row);
        });
    });
}

function formatCurrency(value) {
    if (isNaN(value) || value === null || value === "") {
        return "$0.00"; // Default for invalid or empty values
    }
    return `$${parseFloat(value).toFixed(2)}`; // Format to 2 decimal places
}


function searchRFQDetails() {
    const searchRFQ = document.getElementById("searchRFQDetail").value.toLowerCase();
    const searchItem = document.getElementById("searchItem").value.toLowerCase();
    const searchDescription = document.getElementById("searchDescription").value.toLowerCase();
    const customername = document.getElementById("customername").value.toLowerCase();

    const rows = document.querySelectorAll("#rfqDetailTable tbody tr");
    rows.forEach(row => {
        const rfqNo = row.cells[0].textContent.toLowerCase(); // RFQ NO
        const itemNo = row.cells[9].textContent.toLowerCase(); // Item No
        const description = row.cells[10].textContent.toLowerCase(); // Description
        const customerName = row.cells[2].textContent.toLowerCase(); // Customer Name (assume it's the 3rd cell)

        if (
            (rfqNo.includes(searchRFQ) || searchRFQ === "") &&
            (itemNo.includes(searchItem) || searchItem === "") &&
            (description.includes(searchDescription) || searchDescription === "") &&
            (customerName.includes(customername) || customername === "")
        ) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}

// Attach event listeners
document.getElementById("searchRFQDetail").addEventListener("input", searchRFQDetails);
document.getElementById("searchItem").addEventListener("input", searchRFQDetails);
document.getElementById("searchDescription").addEventListener("input", searchRFQDetails);
document.getElementById("customername").addEventListener("input", searchRFQDetails);

function exportToExcel() {
    const table = document.getElementById("rfqDetailTable");
    const rows = Array.from(table.rows);
    const csvData = rows.map(row => {
        const cells = Array.from(row.cells);
        return cells.map(cell => `"${cell.textContent}"`).join(",");
    }).join("\n");

    const blob = new Blob([csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "RFQ_Detail_List.csv";
    a.click();
    URL.revokeObjectURL(url);
}




//Review Forms
// Event Listener for RFQ Details Table
// Event Listener for RFQ Details Table
document.querySelector("#rfqDetailsTable").addEventListener("click", function (e) {
    if (e.target.tagName === "TD" && e.target.cellIndex === 2) {
        const row = e.target.parentElement;

        if (isEditMode) {
            alert("Cannot open the form during add or edit mode.");
            return;
        }

        const itemType = row.cells[7]?.querySelector("select")?.value?.trim();
        const itemNo = e.target.textContent.trim();
        const rfqNo = document.getElementById("rfqNoDetail")?.textContent.trim();
        const rfqSlNo = row.cells[1]?.textContent.trim();
        const rev = row.cells[4]?.textContent.trim();

        if (!itemType || !itemNo || !rfqNo) {
            console.error("Missing required data for opening the form:", { itemType, itemNo, rfqNo });
            alert("Cannot open the form. Missing required details.");
            return;
        }

        if (itemType === "Make") {
            const context = {
                source: "RFQDetails",
                rfqNo: rfqNo,
                rfqSlNo: rfqSlNo,
                assySlNo: "",
                itemNo: itemNo,
                description: row.cells[3]?.textContent.trim(),
                rev: rev
            };
            openManufacturingReviewForm(context); // Open the form
        } else if (itemType === "Assembly") {
            openAssemblyReviewForm(itemNo, row); // Handle assembly items
        } else {
            console.warn("Item type is neither 'Make' nor 'Assembly'. No action taken.");
        }
    }
});



// Open Assembly Review Form
function openAssemblyReviewForm(itemNo, row) {
    try {
        const rfqNo = document.getElementById("rfqNoDetail").textContent.trim();
        const slNo = row.cells[1]?.textContent.trim();

        if (!rfqNo || !slNo) {
            alert("RFQ No and SL No are required to load the form.");
            return;
        }

        const storageKey = `assemblyReviewForm_${rfqNo}_${slNo}`;
        const savedData = JSON.parse(localStorage.getItem(storageKey)) || {};

        // Populate RFQ Details
        document.getElementById("assemblyRFQNo").textContent = rfqNo;
        document.getElementById("assemblySLNo").textContent = slNo;
        document.getElementById("assemblyItemNo").textContent = savedData.itemNo || itemNo || "N/A";
        document.getElementById("assemblyDescription").textContent =
            savedData.description || row.cells[3]?.textContent.trim() || "N/A";
        document.getElementById("assemblyRev").textContent =
            savedData.rev || row.cells[4]?.textContent.trim() || "N/A";

        // Update the Item No cell to indicate form is attached
        const itemNoCell = row.cells[2];
        itemNoCell.innerHTML = `<a href="#" style="color: blue; text-decoration: underline;">${itemNo}</a>`;

        // Populate Routing Table
        populateRoutingTable(savedData.routing);

        // Populate BOM Table
        populateBOMTable(savedData.bom);

        // Show the form
        showPage("assemblyReviewForm");

        // Attach Listeners
        attachResCostListeners();
        attachExtdCostListeners();

        // Update Totals
        calculateAssemblyTotals();
    } catch (error) {
        console.error("Error opening Assembly Review Form:", error.message);
        alert("An error occurred while loading the Assembly Review Form.");
    }
}


// Populate Routing Table
function populateRoutingTable(data = []) {
    const routingTable = document.querySelector("#assemblyRouting tbody");
    routingTable.innerHTML = "";
    const defaultData = [
        { seq: 100, description: "Pull Parts from Inventory", hours: "", resCost: "", ovCost: "" },
        { seq: 200, description: "Assemble per Drawing", hours: "", resCost: "", ovCost: "" },
        { seq: 300, description: "Drift Test", hours: "", resCost: "", ovCost: "" },
        { seq: 400, description: "Hydraulic Test", hours: "", resCost: "", ovCost: "" },
        { seq: 500, description: "Hydrostatic Test", hours: "", resCost: "", ovCost: "" },
        { seq: 600, description: "Push-Pull Test", hours: "", resCost: "", ovCost: "" },
        { seq: 700, description: "Gas Test", hours: "", resCost: "", ovCost: "" },
        { seq: 800, description: "Marking And Stenciling", hours: "", resCost: "", ovCost: "" },
        { seq: 900, description: "Painting", hours: "", resCost: "", ovCost: "" },
        { seq: 1000, description: "Packaging & Shipping", hours: "", resCost: "", ovCost: "" },
        { seq: 1100, description: "OV Cost If Any", hours: "", resCost: "", ovCost: "" },
        { seq: 1200, description: "Third Party Inspection", hours: "", resCost: "", ovCost: "" },
    ];

    const rows = data.length ? data : defaultData;
    rows.forEach(step => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${step.seq}</td>
            <td>${step.description}</td>
            <td contenteditable="true">${step.hours || ""}</td>
            <td>${step.resCost || ""}</td>
            <td contenteditable="true">${step.ovCost || ""}</td>
        `;
        routingTable.appendChild(row);

        // Attach listener for OV Cost updates
        row.cells[4].addEventListener("input", () => {
            calculateAssemblyTotals();
        });
    });
}

// Populate BOM Table
function populateBOMTable(data = []) {
    const bomTable = document.querySelector("#billOfMaterial tbody");
    bomTable.innerHTML = "";
    data.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><input type="radio" name="selectBOM"></td>
            <td>${item.slNo || ""}</td>
            <td contenteditable="true">${item.childItemNo || ""}</td>
            <td contenteditable="true">${item.description || ""}</td>
            <td contenteditable="true">${item.rev || ""}</td>
            <td contenteditable="true">${item.quantity || "0"}</td>
            <td><select><option ${item.uom === "EA" ? "selected" : ""}>EA</option></select></td>
            <td><select><option ${item.itemType === "Make" ? "selected" : ""}>Make</option></select></td>
            <td><select><option ${item.status === "Open" ? "selected" : ""}>Open</option></select></td>
            <td contenteditable="true">${item.unitCost || "0"}</td>
            <td>${item.extdCost || "0"}</td>
        `;
        bomTable.appendChild(row);

        // Attach listeners for Extd Cost updates
        row.cells[5].addEventListener("input", () => updateExtdCost(row)); // Quantity
        row.cells[9].addEventListener("input", () => updateExtdCost(row)); // Unit Cost
    });
}

// Add New BOM Row
function addBOMRow() {
    const bomTableBody = document.querySelector("#billOfMaterial tbody");
    const newRow = document.createElement("tr");
    newRow.innerHTML = `
        <td><input type="radio" name="selectBOM"></td>
        <td></td> <!-- SL No -->
        <td contenteditable="true"></td> <!-- Child Item No -->
        <td contenteditable="true"></td> <!-- Description -->
        <td contenteditable="true"></td> <!-- Rev -->
        <td contenteditable="true"></td> <!-- Quantity -->
        <td><select><option>EA</option></select></td> <!-- UOM -->
        <td><select><option>Make</option></select></td> <!-- Item Type -->
        <td><select><option>Open</option></select></td> <!-- Status -->
        <td contenteditable="true"></td> <!-- Unit Cost -->
        <td></td> <!-- Extd Cost -->
    `;
    bomTableBody.appendChild(newRow);
    updateSLNumbers(); // Update SL numbers dynamically

    // Attach event listeners to the new row
    newRow.cells[5].addEventListener("input", () => updateExtdCost(newRow)); // Quantity
    newRow.cells[9].addEventListener("input", () => updateExtdCost(newRow)); // Unit Cost
}

// Update SL Numbers
function updateSLNumbers() {
    const rows = document.querySelectorAll("#billOfMaterial tbody tr");
    rows.forEach((row, index) => {
        const slNoCell = row.querySelector("td:nth-child(2)");
        if (slNoCell) slNoCell.textContent = index + 1;
    });
}

// Attach Listeners for Res Cost Updates
function attachResCostListeners() {
    const routingRows = document.querySelectorAll("#assemblyRouting tbody tr");
    routingRows.forEach(row => {
        row.cells[2].addEventListener("input", () => updateResCost(row));
    });
}

// Update Res Cost
function updateResCost(row) {
    const hours = parseFloat(row.cells[2].textContent.trim()) || 0;
    const shopRate = 70;
    row.cells[3].textContent = (hours * shopRate).toFixed(2);
    calculateAssemblyTotals();
}

// Attach Listeners for Extd Cost Updates
function attachExtdCostListeners() {
    const bomRows = document.querySelectorAll("#billOfMaterial tbody tr");
    bomRows.forEach(row => {
        row.cells[5].addEventListener("input", () => updateExtdCost(row)); // Quantity
        row.cells[9].addEventListener("input", () => updateExtdCost(row)); // Unit Cost
    });
}

function updateExtdCost(row) {
    const quantity = parseFloat(row.cells[5].textContent.trim()) || 0; // Quantity column
    const unitCost = parseFloat(row.cells[9].textContent.trim()) || 0; // Unit Cost column
    const extdCost = quantity * unitCost; // Calculate Extd Cost
    row.cells[10].textContent = extdCost.toFixed(2); // Update Extd Cost column
    calculateAssemblyTotals(); // Recalculate totals
}


// Attach Listeners for Res Cost Updates
function attachResCostListeners() {
    const routingRows = document.querySelectorAll("#assemblyRouting tbody tr");
    routingRows.forEach(row => {
        row.cells[2].addEventListener("input", () => updateResCost(row));
    });
}

// Update Res Cost
function updateResCost(row) {
    const hours = parseFloat(row.cells[2].textContent.trim()) || 0;
    const shopRate = 70;
    row.cells[3].textContent = (hours * shopRate).toFixed(2);
    calculateAssemblyTotals();
}

function calculateAssemblyTotals() {
    let totalResCost = 0;
    let totalOVCost = 0;
    let totalExtdCost = 0;

    // Sum Res Cost and OV Cost from Routing Table
    document.querySelectorAll("#assemblyRouting tbody tr").forEach(row => {
        totalResCost += parseFloat(row.cells[3].textContent.trim()) || 0; // Res Cost
        totalOVCost += parseFloat(row.cells[4].textContent.trim()) || 0; // OV Cost
    });

    // Sum Extd Cost from BOM Table
    document.querySelectorAll("#billOfMaterial tbody tr").forEach(row => {
        totalExtdCost += parseFloat(row.cells[10].textContent.trim()) || 0; // Extd Cost
    });

    // Update Unit Cost in the form
    document.getElementById("assemblyUnitCost").textContent = `$${(totalResCost + totalOVCost + totalExtdCost).toFixed(2)}`;
}

// Save Assembly Review Form
function saveAssemblyReviewForm() {
    try {
        console.log("Starting saveAssemblyReviewForm...");

        // Gather data from the form
        const rfqNo = document.getElementById("assemblyRFQNo")?.textContent.trim();
        const slNo = document.getElementById("assemblySLNo")?.textContent.trim();
        console.log("RFQ No:", rfqNo);
        console.log("SL No:", slNo);

        if (!rfqNo || !slNo) {
            alert("RFQ No and SL No are required to save the form.");
            return;
        }

        const storageKey = `assemblyReviewForm_${rfqNo}_${slNo}`;
        console.log("Storage Key:", storageKey);

        // Ensure totals are calculated
        calculateAssemblyTotals(); // Update unit cost in the form

        // Get the current Unit Cost
        const unitCostText = document.getElementById("assemblyUnitCost")?.textContent.replace('$', '').trim();
        const unitCost = parseFloat(unitCostText) || 0;
        console.log("Unit Cost:", unitCost);

        if (!unitCost) {
            alert("Unit Cost calculation failed. Please verify the form data.");
            return;
        }

        // Initialize the assembly data object
        const assemblyData = {
            rfqNo,
            slNo,
            itemNo: document.getElementById("assemblyItemNo")?.textContent.trim() || "",
            description: document.getElementById("assemblyDescription")?.textContent.trim() || "",
            rev: document.getElementById("assemblyRev")?.textContent.trim() || "",
            unitCost,
            matlCost: parseFloat(document.getElementById("assemblyMatlCost")?.textContent.replace('$', '').trim()) || 0,
            leadTime: document.getElementById("assemblyLeadTime")?.textContent.trim() || "",
            remarks: document.getElementById("assemblyRemarks")?.textContent.trim() || "",
            routing: [],
            bom: []
        };
        console.log("Initialized Assembly Data:", assemblyData);

        // Collect Routing Table Data
        const routingRows = document.querySelectorAll("#assemblyRouting tbody tr");
        routingRows.forEach((row, index) => {
            const seq = row.cells[0]?.textContent.trim() || "";
            const description = row.cells[1]?.textContent.trim() || "";
            const hours = parseFloat(row.cells[2]?.textContent.trim()) || 0;
            const resCost = parseFloat(row.cells[3]?.textContent.trim()) || 0;
            const ovCost = parseFloat(row.cells[4]?.textContent.trim()) || 0;

            if (seq && description) {
                assemblyData.routing.push({ seq, description, hours, resCost, ovCost });
                console.log(`Routing Row ${index + 1}:`, { seq, description, hours, resCost, ovCost });
            }
        });

        // Collect BOM Table Data
        const bomRows = document.querySelectorAll("#billOfMaterial tbody tr");
        bomRows.forEach((row, index) => {
            const slNo = row.cells[1]?.textContent.trim() || "";
            const childItemNo = row.cells[2]?.textContent.trim() || "";
            const description = row.cells[3]?.textContent.trim() || "";
            const rev = row.cells[4]?.textContent.trim() || "";
            const quantity = parseFloat(row.cells[5]?.textContent.trim()) || 0;
            const uom = row.cells[6]?.querySelector("select")?.value || "";
            const itemType = row.cells[7]?.querySelector("select")?.value || "";
            const status = row.cells[8]?.querySelector("select")?.value || "";
            const unitCost = parseFloat(row.cells[9]?.textContent.trim()) || 0;
            const extdCost = parseFloat(row.cells[10]?.textContent.trim()) || 0;
            const remarks = row.cells[11]?.textContent.trim() || "";
            const leadTime = row.cells[12]?.textContent.trim() || "";

            if (slNo && childItemNo) {
                assemblyData.bom.push({
                    slNo,
                    childItemNo,
                    description,
                    rev,
                    quantity,
                    uom,
                    itemType,
                    status,
                    unitCost,
                    extdCost,
                    remarks,
                    leadTime
                });
                console.log(`BOM Row ${index + 1}:`, {
                    slNo,
                    childItemNo,
                    description,
                    rev,
                    quantity,
                    uom,
                    itemType,
                    status,
                    unitCost,
                    extdCost,
                    remarks,
                    leadTime
                });
            }
        });

        // Get the current Item No
        const itemNo = document.getElementById("assemblyItemNo")?.textContent.trim();
        console.log("Item No:", itemNo);

        if (!itemNo) {
            console.warn("Item No is missing!");
            alert("Item No is missing! Cannot update Unit Cost.");
            return;
        }

        // Update the Unit Cost in the RFQ Details Table
        console.log("Updating Unit Cost in RFQ Details...");
        updateUnitCostFromReview(itemNo, unitCost);

        // Save Data to Local Storage
        console.log("Saving data to localStorage...");
        localStorage.setItem(storageKey, JSON.stringify(assemblyData));
        console.log("Data saved successfully!");

        // Notify the user only once
        alert("Assembly Review Form and RFQ details saved successfully!");
    } catch (error) {
        console.error("Error saving Assembly Review Form:", error); // Logs full error details
        alert("An error occurred while saving the form. Please try again.");
    }
}


// Load Assembly Review Form
function loadAssemblyReviewForm(rfqNo, slNo) {
    try {
        const storageKey = `assemblyReviewForm_${rfqNo}_${slNo}`;
        const savedData = JSON.parse(localStorage.getItem(storageKey));

        if (!savedData) {
            alert("No saved data found for the selected RFQ and SL No.");
            return;
        }

        // Populate top-level details
        document.getElementById("assemblyRFQNo").textContent = savedData.rfqNo;
        document.getElementById("assemblySLNo").textContent = savedData.slNo;
        document.getElementById("assemblyItemNo").textContent = savedData.itemNo;
        document.getElementById("assemblyDescription").textContent = savedData.description;
        document.getElementById("assemblyRev").textContent = savedData.rev;
        document.getElementById("assemblyUnitCost").textContent = `$${savedData.unitCost.toFixed(2)}`;
        document.getElementById("assemblyMatlCost").textContent = `$${savedData.matlCost.toFixed(2)}`;
        document.getElementById("assemblyLeadTime").textContent = savedData.leadTime;
        document.getElementById("assemblyRemarks").textContent = savedData.remarks;

        // Populate Routing Table
        populateRoutingTable(savedData.routing);

        // Populate BOM Table
        populateBOMTable(savedData.bom);

        alert("Assembly Review Form loaded successfully!");
    } catch (error) {
        console.error("Error loading Assembly Review Form:", error.message);
        alert("An error occurred while loading the form.");
    }
}

// Enable Edit Button Functionality
function editBOMRow() {
    const selectedRadio = document.querySelector("input[name='selectBOM']:checked");
    if (!selectedRadio) {
        alert("Please select a row to edit.");
        return;
    }
    const row = selectedRadio.closest("tr");
    Array.from(row.cells).forEach((cell, index) => {
        if (index > 1 && index < 12) cell.setAttribute("contenteditable", "true");
    });
}

// Enable Cancel Edit Button Functionality
function cancelEditBOMRow() {
    const selectedRadio = document.querySelector("input[name='selectBOM']:checked");
    if (!selectedRadio) {
        alert("Please select a row to cancel editing.");
        return;
    }
    const row = selectedRadio.closest("tr");
    Array.from(row.cells).forEach(cell => {
        cell.removeAttribute("contenteditable");
    });
}

// Enable Delete Button Functionality
function deleteBOMRow() {
    const selectedRadio = document.querySelector("input[name='selectBOM']:checked");
    if (!selectedRadio) {
        alert("Please select a row to delete.");
        return;
    }
    const row = selectedRadio.closest("tr");
    row.remove();
    updateSLNumbers(); // Update SL Numbers
}

function returnToRFQDetails() {
    showPage("rfqDetails");
}

function closeAssemblyForm() {
    showPage("rfqDetails");
}

// Global flag to track edit or add mode
let isEditMode = false;

// Event Listener for RFQ Details Table
document.querySelector("#rfqDetailsTable").addEventListener("click", function (e) {
    if (e.target.tagName === "TD" && e.target.cellIndex === 2) { // Check if clicking on the Item No column
        const row = e.target.parentElement;

        // Restrict opening the form if in edit or add mode
        if (isEditMode) {
            console.warn("Cannot open Manufacturing Review Form during add or edit mode.");
            return;
        }

        const itemType = row.cells[7].querySelector("select").value; // Get item type
        const itemNo = e.target.textContent.trim();
        const rfqNo = document.getElementById("rfqNoDetail").textContent.trim();
        const rfqSlNo = row.cells[1]?.textContent.trim(); // Assuming SL No is in the second column
        const rev = row.cells[4]?.textContent.trim(); // Assuming Revision is in the fifth column

        if (itemType === "Make") {
            // Open Manufacturing Review Form for RFQ Details
            const context = {
                source: "RFQDetails",
                rfqNo: rfqNo,
                rfqSlNo: rfqSlNo,
                assySlNo: "", // Blank when opened from RFQ Details
                itemNo: itemNo,
                description: row.cells[3]?.textContent.trim(), // Assuming Description is in the fourth column
                rev: rev
            };
            openManufacturingReviewForm(context);
        } else if (itemType === "Assembly") {
            openAssemblyReviewForm(itemNo, row);
        } else {
            console.warn("Item type is not Assembly or Make. No form opened.");
        }
    }
});


// Functions to toggle edit/add mode
function enableEditMode() {
    isEditMode = true;
}

function disableEditMode() {
    isEditMode = false;
}


// Event listener for the Assembly BOM Table
document.querySelector("#assemblyBOMTable").addEventListener("click", function (e) {
    if (e.target.tagName === "TD" && e.target.cellIndex === 2) { // Check if clicking on the Item No column
        const row = e.target.parentElement;

        // Restrict opening the form if in edit or add mode
        if (isEditMode) {
            console.warn("Cannot open Manufacturing Review Form during add or edit mode.");
            return;
        }

        const itemType = row.cells[7].querySelector("select").value; // Get item type
        const itemNo = e.target.textContent.trim();
        const rfqNo = document.getElementById("assemblyRFQNo").textContent.trim();
        const rfqSlNo = document.getElementById("assemblyRFQSlNo").textContent.trim();
        const assySlNo = row.cells[1]?.textContent.trim(); // Assuming SL No in Assembly BOM is in the second column
        const rev = row.cells[4]?.textContent.trim(); // Assuming Revision is in the fifth column

        if (itemType === "Make") {
            // Open Manufacturing Review Form for Assembly BOM
            const context = {
                source: "AssemblyBOM",
                rfqNo: rfqNo,
                rfqSlNo: rfqSlNo,
                assySlNo: assySlNo,
                itemNo: itemNo,
                description: row.cells[3]?.textContent.trim(), // Assuming Description is in the fourth column
                rev: rev
            };
            openManufacturingReviewForm(context);
        } else {
            console.warn("Item type is not Make. No form opened.");
        }
    }
});

// Open Manufacturing Review Form
function openManufacturingReviewForm(context) {
    // Prevent editing conflicts
    if (isEditMode) {
        alert("Cannot open the Manufacturing Review Form while in edit mode. Please save or cancel your edits.");
        return;
    }

    try {
        // Hide all other pages
        hideAllPages();

        // Get the form
        const form = document.getElementById("manufacturingReviewForm");

        // Check if the form exists
        if (!form) {
            console.error("Manufacturing Review Form not found.");
            return;
        }

        // Clear previous data in the form
        document.querySelectorAll(".review-field").forEach((field) => (field.textContent = ""));
        document.querySelectorAll(".review-table tbody").forEach((tbody) => (tbody.innerHTML = ""));

        // Validate and populate context
        if (context) {
            document.getElementById("rfqNo").textContent = context.rfqNo || "";
            document.getElementById("rfqSlNo").textContent = context.rfqSlNo || "";
            document.getElementById("itemNo").textContent = context.itemNo || "";
            document.getElementById("description").textContent = context.description || "";
            document.getElementById("rev").textContent = context.rev || "";
        } else {
            alert("Invalid context. Cannot open form.");
            return;
        }

        // Display the form
        form.style.display = "flex";
        document.body.style.overflow = "hidden";

        // Load existing form data from storage
        reloadManufacturingReviewForm(context);

        // Attach listeners for calculations
        attachCalculationListeners();
    } catch (error) {
        console.error("Error opening Manufacturing Review Form:", error.message);
    }
}


document.getElementById("saveManufacturingFormButton").addEventListener("click", () => {
    saveManufacturingReviewForm();
    alert("Manufacturing Review Form saved successfully!");
});


document.getElementById("returnToRFQDetailsButton").addEventListener("click", () => {
    showPage("rfqDetails");
});


// Save Manufacturing Review Form
function saveManufacturingReviewForm() {
    try {
        const rfqNo = document.getElementById("rfqNo").textContent.trim();
        const rfqSlNo = document.getElementById("rfqSlNo").textContent.trim();
        const assySlNo = document.getElementById("assySlNo").textContent.trim();
        const itemNo = document.getElementById("itemNo").textContent.trim();

        // Extract costs from header
        const unitCostText = document.getElementById("unitCost").textContent.replace("$", "").trim();
        const matlCostText = document.getElementById("matlCost").textContent.replace("$", "").trim();
        const resCostText = document.getElementById("resCost").textContent.replace("$", "").trim();
        const ovCostText = document.getElementById("ovCost").textContent.replace("$", "").trim();

        const unitCost = parseFloat(unitCostText) || 0;
        const matlCost = parseFloat(matlCostText) || 0;
        const resCost = parseFloat(resCostText) || 0;
        const ovCost = parseFloat(ovCostText) || 0;

        if (!rfqNo || !rfqSlNo || !itemNo) {
            alert("Required fields are missing. Please verify the form.");
            return;
        }

        // Extract data from tables
        const materialData = extractTableDataWithCalculations("materialCostTable");
        const operationData = extractTableData("operationsTable");
        const vendorData = extractTableData("vendorCostTable");
        const buyItemData = extractTableData("buyItemTable");

        // Save all data
        const manufacturingData = {
            rfqNo,
            rfqSlNo,
            assySlNo,
            itemNo,
            unitCost,
            matlCost,
            resCost,
            ovCost,
            materialData,
            operationData,
            vendorData,
            buyItemData,
        };

        const storageKey = assySlNo
            ? `manufacturingReview_${rfqNo}_${rfqSlNo}_${assySlNo}`
            : `manufacturingReview_${rfqNo}_${rfqSlNo}`;

        console.log("Saving manufacturing data:", manufacturingData);
        localStorage.setItem(storageKey, JSON.stringify(manufacturingData));

        alert("Manufacturing Review Form saved successfully!");
    } catch (error) {
        console.error("Error saving Manufacturing Review Form:", error);
        alert("An error occurred while saving the form. Please try again.");
    }
    onManufacturingReviewFormSubmit(itemNo);
}

// Helper function to extract table data including calculated fields
function extractTableDataWithCalculations(tableId) {
    const table = document.getElementById(tableId);
    if (!table) {
        console.error(`Table with ID "${tableId}" not found.`);
        return [];
    }

    const rows = table.querySelectorAll("tbody tr");
    return Array.from(rows).map(row => {
        return Array.from(row.cells).map(cell => cell.textContent.trim());
    });
}

// Helper function to extract table data and ensure default row is included
function extractTableDataWithDefault(tableId, defaultRow) {
    const table = document.getElementById(tableId);
    if (!table) {
        console.error(`Table with ID "${tableId}" not found.`);
        return [defaultRow];
    }
    const rows = table.querySelectorAll("tbody tr");
    const tableData = Array.from(rows).map(row => {
        return Array.from(row.cells).map(cell => cell.textContent.trim());
    });

    // Ensure the default row is always included
    if (tableData.length === 0) {
        tableData.push(defaultRow);
    }

    return tableData;
}

// Helper Function to Extract Table Data
function extractTableData(tableId) {
    const table = document.getElementById(tableId);
    if (!table) {
        console.error(`Table with ID "${tableId}" not found.`);
        return [];
    }

    const rows = table.querySelectorAll("tbody tr");
    return Array.from(rows).map(row => {
        return Array.from(row.cells).map(cell => cell.textContent.trim());
    });
}

function reloadManufacturingReviewForm(context) {
    try {
        // Construct storage key
        const storageKey = context.assySlNo
            ? `manufacturingReview_${context.rfqNo}_${context.rfqSlNo}_${context.assySlNo}`
            : `manufacturingReview_${context.rfqNo}_${context.rfqSlNo}`;

        // Fetch saved data
        const savedData = localStorage.getItem(storageKey);
        if (savedData) {
            const manufacturingData = JSON.parse(savedData);

            // Reload header data
            document.getElementById("rfqNo").textContent = manufacturingData.rfqNo || "";
            document.getElementById("rfqSlNo").textContent = manufacturingData.rfqSlNo || "";
            document.getElementById("assySlNo").textContent = manufacturingData.assySlNo || "";
            document.getElementById("itemNo").textContent = manufacturingData.itemNo || "";
            document.getElementById("description").textContent = manufacturingData.description || "";
            document.getElementById("rev").textContent = manufacturingData.rev || "";
            document.getElementById("unitCost").textContent = `$${(manufacturingData.unitCost || 0).toFixed(2)}`;
            document.getElementById("matlCost").textContent = `$${(manufacturingData.matlCost || 0).toFixed(2)}`;
            document.getElementById("resCost").textContent = `$${(manufacturingData.resCost || 0).toFixed(2)}`;
            document.getElementById("ovCost").textContent = `$${(manufacturingData.ovCost || 0).toFixed(2)}`;

            // Reload table data
            populateTableData("materialCostTable", manufacturingData.materialData || [], true);
            populateTableData("operationsTable", manufacturingData.operationData || [], true);
            populateTableData("vendorCostTable", manufacturingData.vendorData || [], true);
            populateTableData("buyItemTable", manufacturingData.buyItemData || [], true);

            console.log("Form reloaded with saved data:", manufacturingData);
        } else {
            console.warn("No saved data found for key:", storageKey);

            // Reset header and table data to default state
            document.querySelectorAll("#manufacturingReviewForm .review-field").forEach(field => {
                field.textContent = ""; // Clear all header fields
            });
            document.querySelectorAll("#manufacturingReviewForm .review-table tbody").forEach(tbody => {
                tbody.innerHTML = ""; // Clear table rows
            });

            console.log("Form reset to default state.");
        }

        // Attach listeners for calculations after reload
        attachCalculationListeners();

        // Attach dynamic calculation listeners
        attachDynamicListeners();

        // Recalculate totals
        calculateAllCosts();
    } catch (error) {
        console.error("Error reloading Manufacturing Review Form:", error.message);
    }
}



// Close Manufacturing Review Form and Redirect
function closeManufacturingReviewForm() {
    const form = document.getElementById("manufacturingReviewForm");
    if (form) {
        form.style.display = "none";
        document.body.style.overflow = "auto"; // Restore scrolling
    }

    console.log("Closed Manufacturing Review Form and redirected to RFQ Details.");
    onManufacturingReviewFormSubmit(); // Trigger submission logic
}

// On Manufacturing Review Form Submit
function onManufacturingReviewFormSubmit() {
    try {
        // Get the item number from the review form
        const itemNo = document.getElementById("itemNo").textContent.trim();

        // Calculate the total unit cost from the Manufacturing Review Form
        const unitCost = parseFloat(
            document.getElementById("unitCost").textContent.replace('$', '').trim()
        );

        if (itemNo && !isNaN(unitCost)) {
            updateUnitCostFromManufacturingReview(itemNo, unitCost);

            // Display a confirmation message
            alert(`Unit Cost for Item No: ${itemNo} updated to $${unitCost.toFixed(2)}`);
        } else {
            console.error("Item No or Unit Cost is missing or invalid.");
        }

        // Redirect to RFQ Details page
        showPage("rfqDetails");
    } catch (error) {
        console.error("Error submitting Manufacturing Review Form:", error.message);
    }
}

// Update Unit Cost in the RFQ Details Table
function updateUnitCostFromManufacturingReview(itemNo, unitCost) {
    try {
        // Locate rows in the RFQ details table
        const rows = document.querySelectorAll("#rfqDetailsTable tbody tr");

        rows.forEach(row => {
            const rowItemNo = row.cells[2]?.textContent.trim(); // Assuming column 2 is Item No
            const rowItemType = row.cells[6]?.textContent.trim(); // Assuming column 6 is Item Type

            // Update only rows matching Item No and 'Make' type
            if (rowItemNo === itemNo && rowItemType === 'Make') {
                const unitCostCell = row.cells[9]; // Assuming column 9 is Unit Cost
                if (unitCostCell) {
                    unitCostCell.textContent = parseFloat(unitCost).toFixed(2);

                    // Save updated data if needed
                    saveRFQDetailsToLocal();

                    console.log(`Updated Unit Cost for Item No: ${itemNo} to $${unitCost.toFixed(2)}.`);
                }
            }
        });
    } catch (error) {
        console.error("Error updating Unit Cost in RFQ Details Table:", error.message);
    }
}



// Function to hide all pages
function hideAllPages() {
    try {
        document.querySelectorAll(".page").forEach((page) => {
            page.style.display = "none";
        });
    } catch (error) {
        console.error("Error hiding pages:", error.message);
    }
}


// Updated populateTableData Function
function populateTableData(tableId, tableData, isEditable = false) {
    try {
        const tableBody = document.querySelector(`#${tableId} tbody`);
        if (!tableBody) {
            console.error(`Table with ID "${tableId}" not found.`);
            return;
        }

        // Clear existing rows
        tableBody.innerHTML = "";

        // Populate rows with saved data
        tableData.forEach(rowData => {
            const row = document.createElement("tr");
            rowData.forEach((cellData, cellIndex) => {
                const cell = document.createElement("td");

                // Handle UOM column for "Buy Item Table"
                if (tableId === "buyItemTable" && cellIndex === 5) { // Assuming column index 5 is UOM
                    const select = document.createElement("select");
                    const uomOptions = ["EA", "Lbs", "kg", "FT", "IN", "Litres"]; // Example UOM options
                    uomOptions.forEach(optionValue => {
                        const option = document.createElement("option");
                        option.value = optionValue;
                        option.textContent = optionValue;
                        if (cellData === optionValue) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                    if (isEditable) select.disabled = false; // Allow editing
                    cell.appendChild(select);
                } else {
                    cell.textContent = cellData || ""; // Populate cell with data or empty string
                    if (isEditable) cell.contentEditable = true; // Make cells editable
                }
                row.appendChild(cell);
            });
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error(`Error populating data for table "${tableId}":`, error.message);
    }
}


function attachCalculationListeners() {
    try {
        // Material Cost Table: Length and Unit Cost Columns
        document.querySelectorAll("#materialCostTable tbody tr").forEach(row => {
            const lengthCell = row.cells[4];
            const unitCostCell = row.cells[7];

            if (lengthCell && unitCostCell) {
                [lengthCell, unitCostCell].forEach(cell => {
                    cell.addEventListener("input", () => updateMaterialExtdCost(row));
                });
            }
        });

        // Operations Table: Setup Hours and Run Hours Columns
        document.querySelectorAll("#operationsTable tbody tr").forEach(row => {
            const setupHoursCell = row.cells[3];
            const runHoursCell = row.cells[4];

            if (setupHoursCell && runHoursCell) {
                [setupHoursCell, runHoursCell].forEach(cell => {
                    cell.addEventListener("input", () => updateOperationCosts(row));
                });
            }
        });

        // Buy Item Table: Quantity and Unit Cost Columns
        document.querySelectorAll("#buyItemTable tbody tr").forEach(row => {
            const qtyCell = row.cells[4];
            const unitCostCell = row.cells[6];

            if (qtyCell && unitCostCell) {
                [qtyCell, unitCostCell].forEach(cell => {
                    cell.addEventListener("input", () => updateBuyItemExtdCost(row));
                });
            }
        });

        console.log("Calculation listeners attached.");
    } catch (error) {
        console.error("Error attaching calculation listeners:", error.message);
    }
}


function updateMaterialExtdCost() {
    try {
        // Iterate over each row in the material cost table
        document.querySelectorAll("#materialCostTable tbody tr").forEach(row => {
            const length = parseFloat(row.cells[4]?.textContent.trim()) || 0; // Length column
            const unitCost = parseFloat(row.cells[7]?.textContent.trim()) || 0; // Unit Cost column
            const extdCost = length * unitCost;

            // Check if the Extended Cost column exists before updating
            if (row.cells[8]) {
                row.cells[8].textContent = extdCost.toFixed(2); // Update Extended Cost column
            }
        });

        console.log("Material Extended Costs updated successfully.");
    } catch (error) {
        console.error("Error updating Material Extended Cost:", error.message);
    }
}


function updateOperationCosts() {
    try {
        // Iterate over each row in the operations table
        document.querySelectorAll("#operationsTable tbody tr").forEach(row => {
            const setupHours = parseFloat(row.cells[3]?.textContent.trim()) || 0; // Setup Hours (column 3)
            const runHours = parseFloat(row.cells[4]?.textContent.trim()) || 0; // Run Hours (column 4)

            // Calculate costs with a fixed rate
            const setupCost = setupHours * 70; // Fixed rate for setup cost
            const runCost = runHours * 70; // Fixed rate for run cost

            // Update Setup Cost (column 5)
            if (row.cells[5]) {
                row.cells[5].textContent = setupCost.toFixed(2);
            }

            // Update Run Cost (column 6)
            if (row.cells[6]) {
                row.cells[6].textContent = runCost.toFixed(2);
            }
        });

        console.log("Operation Costs updated successfully.");
    } catch (error) {
        console.error("Error updating Operation Costs:", error.message);
    }
}


function updateBuyItemExtdCost() {
    try {
        // Iterate over each row in the Buy Item table
        document.querySelectorAll("#buyItemTable tbody tr").forEach(row => {
            const qty = parseFloat(row.cells[4]?.textContent.trim()) || 0; // Quantity (column 4)
            const unitCost = parseFloat(row.cells[6]?.textContent.trim()) || 0; // Unit Cost (column 6)
            const extdCost = qty * unitCost; // Calculate Extended Cost

            // Update Extended Cost (column 7)
            if (row.cells[7]) {
                row.cells[7].textContent = extdCost.toFixed(2);
            }
        });

        console.log("Buy Item Extended Costs updated successfully.");
    } catch (error) {
        console.error("Error updating Buy Item Extended Costs:", error.message);
    }
}


// Calculate Overall Unit Cost
function calculateOverallUnitCost() {
    let totalMatlCost = 0, totalSetupCost = 0, totalRunCost = 0, totalBuyItemExtdCost = 0, totalOVCost = 0;

    // Sum Material Costs
    document.querySelectorAll("#materialCostTable tbody tr").forEach(row => {
        totalMatlCost += parseFloat(row.cells[8]?.textContent.trim()) || 0; // Material Extd Cost
    });

    // Sum Operation Costs
    document.querySelectorAll("#operationsTable tbody tr").forEach(row => {
        totalSetupCost += parseFloat(row.cells[5]?.textContent.trim()) || 0; // Setup Cost
        totalRunCost += parseFloat(row.cells[6]?.textContent.trim()) || 0; // Run Cost
    });

    // Sum Buy Item Costs
    document.querySelectorAll("#buyItemTable tbody tr").forEach(row => {
        totalBuyItemExtdCost += parseFloat(row.cells[7]?.textContent.trim()) || 0; // Buy Item Extd Cost
    });

    // Sum Outside/Vendor Process Costs
    document.querySelectorAll("#vendorCostTable tbody tr").forEach(row => {
        totalOVCost += parseFloat(row.cells[4]?.textContent.trim()) || 0; // OV Cost
    });

    // Calculate Material Cost
    const matlCost = (totalMatlCost + totalBuyItemExtdCost).toFixed(2);

    // Calculate Resource Cost
    const resCost = (totalSetupCost + totalRunCost).toFixed(2);

    // Calculate OV Cost
    const ovCost = totalOVCost.toFixed(2);

    // Calculate Total Unit Cost
    const unitCost = (
        parseFloat(matlCost) +
        parseFloat(resCost) +
        parseFloat(ovCost)
    ).toFixed(2);

    // Update Costs in the Manufacturing Review Form
    document.getElementById("matlCost").textContent = `$${matlCost}`;
    document.getElementById("resCost").textContent = `$${resCost}`;
    document.getElementById("ovCost").textContent = `$${ovCost}`;
    document.getElementById("unitCost").textContent = `$${unitCost}`;

    console.log("Overall costs updated: Matl Cost:", matlCost, "Res Cost:", resCost, "OV Cost:", ovCost, "Unit Cost:", unitCost);
}

// Trigger All Calculations
function calculateAllCosts() {
    updateMaterialExtdCost(row);
    updateOperationCosts(row);
    updateBuyItemExtdCost(row);
    calculateOverallUnitCost();
    console.log("All costs calculated.");
}

// Reset the Manufacturing Review Form
function resetManufacturingReviewForm() {
    document.querySelectorAll("#manufacturingReviewForm .review-field").forEach(field => {
        if (field.tagName === "INPUT" || field.tagName === "TEXTAREA") {
            field.value = "";
        } else {
            field.textContent = "";
        }
    });

    document.querySelectorAll("#manufacturingReviewForm .review-table tbody").forEach(tbody => {
        tbody.innerHTML = "";
    });
    console.log("Manufacturing Review Form reset.");
}

// Add event listeners for dynamic updates
function attachDynamicListeners() {
    try {
        // Monitor Material Cost Extended Cost changes
        document.querySelectorAll("#materialCostTable tbody tr").forEach(row => {
            const lengthCell = row.cells[4];
            const unitCostCell = row.cells[7];

            if (lengthCell && unitCostCell) {
                [lengthCell, unitCostCell].forEach(cell => {
                    cell.addEventListener("input", () => {
                        updateMaterialExtdCost();
                        calculateOverallUnitCost(); // Recalculate overall costs dynamically
                    });
                });
            }
        });

        // Monitor Operation Table changes (Setup Cost, Run Cost)
        document.querySelectorAll("#operationsTable tbody tr").forEach(row => {
            const setupHoursCell = row.cells[3]; // Setup Hours
            const runHoursCell = row.cells[4]; // Run Hours

            if (setupHoursCell && runHoursCell) {
                [setupHoursCell, runHoursCell].forEach(cell => {
                    cell.addEventListener("input", () => {
                        // Trigger recalculation for operation costs and overall unit cost
                        updateOperationCosts();
                        calculateOverallUnitCost();
                    });
                });
            }
        });

        // Monitor Vendor Process Cost Table changes (Cost column)
        document.querySelectorAll("#vendorCostTable tbody tr").forEach(row => {
            const costCell = row.cells[4];
            if (costCell) {
                costCell.addEventListener("input", () => {
                    calculateOverallUnitCost(); // Update OV costs dynamically
                });
            }
        });

        // Monitor Buy Item Table changes (Extended Cost)
        document.querySelectorAll("#buyItemTable tbody tr").forEach(row => {
            const qtyCell = row.cells[4];
            const unitCostCell = row.cells[6];

            if (qtyCell && unitCostCell) {
                [qtyCell, unitCostCell].forEach(cell => {
                    cell.addEventListener("input", () => {
                        updateBuyItemExtdCost();
                        calculateOverallUnitCost(); // Recalculate overall costs dynamically
                    });
                });
            }
        });

        console.log("Dynamic listeners attached for recalculations.");
    } catch (error) {
        console.error("Error attaching dynamic listeners:", error.message);
    }
}

