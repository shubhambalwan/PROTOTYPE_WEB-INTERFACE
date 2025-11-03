// DOM Elements
const tempVal = document.getElementById("tempVal");
const humVal = document.getElementById("humVal");
const soilVal = document.getElementById("soilVal");
const lightVal = document.getElementById("lightVal");

const aiText = document.getElementById("aiText");
const aiTips = document.getElementById("aiTips");

const endpointInput = document.getElementById("endpoint");
const applyBtn = document.getElementById("applyBtn");
const manualFetchBtn = document.getElementById("manualFetch");
const intervalSelect = document.getElementById("intervalSelect");
const mockToggle = document.getElementById("mockToggle");

let endpointURL = "http://192.168.4.1/sensor";
let pollInterval = 5000;
let pollTimer;
let isMock = true;

// CHARTS
const tempCtx = document.getElementById("tempChart").getContext("2d");
const tempChart = new Chart(tempCtx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Temperature (°C)",
        data: [],
        borderColor: "#2d6a4f",
        backgroundColor: "rgba(45,106,79,0.15)",
        tension: 0.4,
        fill: true,
      },
      {
        label: "Humidity (%)",
        data: [],
        borderColor: "#0077b6",
        backgroundColor: "rgba(0,119,182,0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  },
  options: {
    responsive: true,
    plugins: { legend: { display: true, position: "bottom" } },
    scales: { y: { beginAtZero: false }, x: { grid: { display: false } } },
  },
});

const soilChart = new Chart(document.getElementById("soilChart"), {
  type: "line",
  data: { labels: [], datasets: [{ label: "Soil Moisture (%)", data: [], borderColor: "#f4a261", backgroundColor: "rgba(244,162,97,0.2)", fill: true, tension: 0.4 }] },
  options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } } } },
});

const lightChart = new Chart(document.getElementById("lightChart"), {
  type: "line",
  data: { labels: [], datasets: [{ label: "Light (lx)", data: [], borderColor: "#ffb703", backgroundColor: "rgba(255,183,3,0.2)", fill: true, tension: 0.4 }] },
  options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } } } },
});

// Mock data generator
function generateMockData() {
  return {
    temperature: (22 + Math.random() * 6).toFixed(1),
    humidity: (40 + Math.random() * 30).toFixed(0),
    soil: (30 + Math.random() * 20).toFixed(0),
    light: (400 + Math.random() * 600).toFixed(0),
  };
}

// Update dashboard
function updateDashboard(data) {
  tempVal.textContent = `${data.temperature} °C`;
  humVal.textContent = `${data.humidity} %`;
  soilVal.textContent = `${data.soil} %`;
  lightVal.textContent = `${data.light} lx`;

  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const charts = [tempChart, soilChart, lightChart];
  charts.forEach(chart => {
    if (chart.data.labels.length > 12) {
      chart.data.labels.shift();
      chart.data.datasets.forEach(ds => ds.data.shift());
    }
    chart.data.labels.push(time);
  });

  tempChart.data.datasets[0].data.push(data.temperature);
  tempChart.data.datasets[1].data.push(data.humidity);
  soilChart.data.datasets[0].data.push(data.soil);
  lightChart.data.datasets[0].data.push(data.light);

  charts.forEach(c => c.update());
  updateAIInsight(data);
}

// Fetch data
async function fetchData() {
  try {
    const data = isMock ? generateMockData() : await (await fetch(endpointURL)).json();
    updateDashboard(data);
  } catch {
    aiText.textContent = "Error fetching data. Using mock values.";
    updateDashboard(generateMockData());
  }
}

// AI tips
function updateAIInsight(data) {
  aiTips.innerHTML = "";
  aiText.textContent = "AI Growth Insight";
  const tips = [];
  if (data.soil < 40) tips.push("Soil moisture is low — water your plants.");
  if (data.light < 500) tips.push("Light is low — adjust LEDs or move plants.");
  if (data.temperature > 30) tips.push("Temperature is high — improve airflow.");
  if (data.humidity < 40) tips.push("Humidity is low — mist leaves.");
  if (!tips.length) tips.push("All parameters are optimal 🌱");
  tips.forEach(t => aiTips.innerHTML += `<li>${t}</li>`);
}

// Polling
function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(fetchData, pollInterval);
  fetchData();
}

// Events
applyBtn.onclick = () => { endpointURL = endpointInput.value.trim() || endpointURL; aiText.textContent = "Updated ESP32 endpoint."; };
manualFetchBtn.onclick = fetchData;
intervalSelect.onchange = e => { pollInterval = +e.target.value; startPolling(); };
mockToggle.onchange = e => { isMock = e.target.checked; aiText.textContent = isMock ? "Mock data enabled" : "Using live ESP32 data"; fetchData(); };

// Init
startPolling();
