document.addEventListener("DOMContentLoaded", function () {
    populateMaterialGrades('inch');
    populateMaterialGrades('metric');
    
    // Add event listeners for radio buttons (unit system toggle)
    document.querySelectorAll('input[name="unit-system"]').forEach((radio) => {
        radio.addEventListener("change", convertUnits);
    });
    
    // Add event listeners for material type (to show/hide inner dia)
    document.getElementById("materialTypeInch").addEventListener("change", toggleInnerDiaInch);
    document.getElementById("materialTypeMetric").addEventListener("change", toggleInnerDiaMetric);
    
    toggleInnerDiaInch(); // Initial call for inch system
    toggleInnerDiaMetric(); // Initial call for metric system
    toggleUnitSystem(); // Initial load
});

function toggleUnitSystem() {
    const unitSystem = document.querySelector('input[name="unit-system"]:checked').value;
    document.getElementById("material-form-inch").style.display = unitSystem === 'inch' ? 'block' : 'none';
    document.getElementById("material-form-metric").style.display = unitSystem === 'metric' ? 'block' : 'none';
}

// Conversion function to handle the change between inch and metric
function convertUnits() {
    const unitSystem = document.querySelector('input[name="unit-system"]:checked').value;
    
    if (unitSystem === 'metric') {
        // Convert Inch values to Metric
        const outerDiaInch = parseFloat(document.getElementById("outerDiaInch").value) || 0;
        const innerDiaInch = parseFloat(document.getElementById("innerDiaInch").value) || 0;
        const lengthInch = parseFloat(document.getElementById("lengthInch").value) || 0;
        
        // Convert to metric
        document.getElementById("outerDiaMetric").value = (outerDiaInch * 25.4).toFixed(2);
        document.getElementById("innerDiaMetric").value = (innerDiaInch * 25.4).toFixed(2);
        document.getElementById("lengthMetric").value = (lengthInch * 25.4).toFixed(2);
        
        // Preserve the selected material type and grade
        const materialInch = document.getElementById("materialGradeInch").value;
        document.getElementById("materialGradeMetric").value = materialInch;
        const materialTypeInch = document.getElementById("materialTypeInch").value;
        document.getElementById("materialTypeMetric").value = materialTypeInch;

        // Call toggle to show or hide the inner dia based on material type
        toggleInnerDiaMetric();

    } else if (unitSystem === 'inch') {
        // Convert Metric values to Inch
        const outerDiaMetric = parseFloat(document.getElementById("outerDiaMetric").value) || 0;
        const innerDiaMetric = parseFloat(document.getElementById("innerDiaMetric").value) || 0;
        const lengthMetric = parseFloat(document.getElementById("lengthMetric").value) || 0;
        
        // Convert to inch
        document.getElementById("outerDiaInch").value = (outerDiaMetric / 25.4).toFixed(2);
        document.getElementById("innerDiaInch").value = (innerDiaMetric / 25.4).toFixed(2);
        document.getElementById("lengthInch").value = (lengthMetric / 25.4).toFixed(2);
        
        // Preserve the selected material type and grade
        const materialMetric = document.getElementById("materialGradeMetric").value;
        document.getElementById("materialGradeInch").value = materialMetric;
        const materialTypeMetric = document.getElementById("materialTypeMetric").value;
        document.getElementById("materialTypeInch").value = materialTypeMetric;

        // Call toggle to show or hide the inner dia based on material type
        toggleInnerDiaInch();
    }

    toggleUnitSystem();  // Display the correct form
}

// Toggle Inner Diameter field for Inch system
function toggleInnerDiaInch() {
    const materialTypeInch = document.getElementById("materialTypeInch").value;
    const innerDiaInchField = document.getElementById("innerDiaInch");
    
    if (materialTypeInch === 'Bar') {
        innerDiaInchField.value = ""; // Clear value if it was set
        innerDiaInchField.disabled = true; // Disable input
        innerDiaInchField.style.backgroundColor = "#e9ecef"; // Gray out the background
    } else {
        innerDiaInchField.disabled = false; // Enable input
        innerDiaInchField.style.backgroundColor = ""; // Reset background color
    }
}

// Toggle Inner Diameter field for Metric system
function toggleInnerDiaMetric() {
    const materialTypeMetric = document.getElementById("materialTypeMetric").value;
    const innerDiaMetricField = document.getElementById("innerDiaMetric");
    
    if (materialTypeMetric === 'Bar') {
        innerDiaMetricField.value = ""; // Clear value if it was set
        innerDiaMetricField.disabled = true; // Disable input
        innerDiaMetricField.style.backgroundColor = "#e9ecef"; // Gray out the background
    } else {
        innerDiaMetricField.disabled = false; // Enable input
        innerDiaMetricField.style.backgroundColor = ""; // Reset background color
    }
}

function populateMaterialGrades(system) {
    const materials = [
        "300", "303", "316", "416", "431", "718", "925", "1015", "1018", "1040", "1044", "4130", "4140",
        "4142", "4145", "4330", "4340", "4360", "4715", "4815", "8620", "8630", "9310", "4145H", "A36"
    ];

    const materialGradeSelect = document.getElementById(`materialGrade${capitalize(system)}`);
    materials.forEach(material => {
        const option = document.createElement("option");
        option.value = material;
        option.textContent = material;
        materialGradeSelect.appendChild(option);
    });
}

function calculateWeight(system) {
    const materialType = document.getElementById(`materialType${capitalize(system)}`).value;
    let outerDia, innerDia, length;

    if (system === 'inch') {
        outerDia = parseFloat(document.getElementById(`outerDia${capitalize(system)}`).value);
        innerDia = parseFloat(document.getElementById(`innerDia${capitalize(system)}`).value) || 0;
        length = parseFloat(document.getElementById(`length${capitalize(system)}`).value);
    } else if (system === 'metric') {
        outerDia = parseFloat(document.getElementById(`outerDia${capitalize(system)}`).value) / 25.4; // Convert mm to inches
        innerDia = parseFloat(document.getElementById(`innerDia${capitalize(system)}`).value) / 25.4 || 0; // Convert mm to inches
        length = parseFloat(document.getElementById(`length${capitalize(system)}`).value) / 25.4; // Convert mm to inches
    }

    const materialGrade = document.getElementById(`materialGrade${capitalize(system)}`).value;
    const density = getDensity(materialGrade); 
    
    let weight;
    if (materialType === "Bar") {
        weight = Math.PI * Math.pow(outerDia / 2, 2) * length * density;
    } else if (materialType === "Tube") {
        weight = Math.PI * (Math.pow(outerDia / 2, 2) - Math.pow(innerDia / 2, 2)) * length * density;
    }

    const weightElement = document.getElementById(`weight${capitalize(system)}`);
    if (system === 'inch') {
        weightElement.value = weight.toFixed(2); // in pounds
    } else {
        weightElement.value = (weight * 0.453592).toFixed(2); // Convert pounds to kilograms
    }
}

function getDensity(materialGrade) {
    const densityTable = {
        "300": 0.289,
        "303": 0.289,
        "4140": 0.284, // Example density for 4140 alloy steel in lbs/in³
        // Add other densities as needed
    };
    return densityTable[materialGrade] || 0.284; // Default to 0.284 if not found
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
