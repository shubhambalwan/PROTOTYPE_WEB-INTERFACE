// ----------------------
// CONFIG
// ----------------------
let useMock = true; // default: mock data ON
let endpointURL = ""; // set via UI (e.g. http://192.168.4.1/sensor)
let pollInterval = 5000; // ms

// Chart data buffers
const maxPoints = 40;
const labels = Array.from({length: maxPoints}, (_,i)=>""); // simple rolling labels

// ----------------------
// Helpers
// ----------------------
function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString();
}

function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

// ----------------------
// Initialize DOM
// ----------------------
const tempVal = document.getElementById("tempVal");
const humVal = document.getElementById("humVal");
const soilVal = document.getElementById("soilVal");
const lightVal = document.getElementById("lightVal");
const aiText = document.getElementById("aiText");
const aiTips = document.getElementById("aiTips");

const endpointInput = document.getElementById("endpoint");
const applyBtn = document.getElementById("applyBtn");
const manualFetch = document.getElementById("manualFetch");
const intervalSelect = document.getElementById("intervalSelect");
const mockToggle = document.getElementById("mockToggle");
const themeBtn = document.getElementById("themeBtn"); // Note: themeBtn not in HTML, but logic exists.

// ----------------------
// CHARTS (Chart.js)
// ----------------------
const tempCtx = document.getElementById("tempChart").getContext("2d");
const soilCtx = document.getElementById("soilChart").getContext("2d");
const lightCtx = document.getElementById("lightChart").getContext("2d");

const tempData = {
  labels: labels.slice(),
  datasets: [
    {
      label: "Temperature (°C)",
      data: Array(maxPoints).fill(null),
      tension: 0.25,
      pointRadius: 0,
      borderWidth: 2,
      fill: true,
      backgroundColor: (ctx) => {
        return ctx.chart.options.color || "rgba(14,165,162,0.06)"
      }
    },
    {
      label: "Humidity (%)",
      data: Array(maxPoints).fill(null),
      tension: 0.25,
      pointRadius: 0,
      borderWidth: 2,
      fill: false
    }
  ]
};

const tempChart = new Chart(tempCtx, {
  type: "line",
  data: tempData,
  options: {
    responsive:true,
    maintainAspectRatio:false,
    interaction:{intersect:false,mode:"index"},
    plugins:{legend:{display:true}},
    scales:{
      x:{display:false},
      y:{beginAtZero:false}
    }
  }
});

const soilChart = new Chart(soilCtx, {
  type: "doughnut",
  data: {
    labels:["Soil Moisture", "Remaining"],
    datasets:[{
      data:[0,100],
      circumference: 180,
      rotation: -90,
      cutout: "70%",
      borderWidth:0
    }]
  },
  options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
});

const lightChart = new Chart(lightCtx, {
  type: "bar",
  data: {
    labels:["Light"],
    datasets:[{label:"Lux",data:[0],borderRadius:6,barThickness:36}]
  },
  options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{display:false}}}
});

// ----------------------
// Data ingestion
// ----------------------
async function fetchDataOnce(){
  if(useMock){
    return generateMock();
  }
  if(!endpointURL){
    console.warn("No endpoint set - falling back to mock.");
    return generateMock();
  }
  try{
    const res = await fetch(endpointURL, {cache:"no-cache"});
    if(!res.ok) throw new Error("Network response not ok: "+res.status);
    const json = await res.json();
    // expect { temperature, humidity, soil, light, [optional nutrient, water] }
    return json;
  } catch(err){
    console.error("Fetch failed:", err);
    return generateMock(); // graceful fallback
  }
}

function generateMock(){
  // produce realistic fluctuations
  const t = 18 + 10*Math.sin(Date.now()/60000) + (Math.random()-0.5)*0.8;
  const h = 45 + 20*Math.cos(Date.now()/45000) + (Math.random()-0.5)*1.4;
  const s = 35 + 35*Math.sin(Date.now()/90000) + (Math.random()-0.5)*3;
  const l = 120 + 200*Math.abs(Math.sin(Date.now()/30000)) + (Math.random()-0.5)*20;
  return {
    temperature: +(t.toFixed(1)),
    humidity: +(h.toFixed(1)),
    soil: Math.round(clamp(s, 0, 100)),
    light: Math.round(clamp(l, 0, 2000))
  };
}

// ----------------------
// Update UI + charts
// ----------------------
function pushPoint(chartDataset, value){
  chartDataset.shift();
  chartDataset.push(value);
}

function updateUI(data){
  // update stat values
  tempVal.textContent = (data.temperature==null? "--" : `${data.temperature} °C`);
  humVal.textContent = (data.humidity==null? "--" : `${data.humidity} %`);
  soilVal.textContent = (data.soil==null? "--" : `${data.soil} %`);
  lightVal.textContent = (data.light==null? "--" : `${data.light} lx`);

  // charts
  pushPoint(tempData.datasets[0].data, data.temperature);
  pushPoint(tempData.datasets[1].data, data.humidity);
  tempChart.update();

  soilChart.data.datasets[0].data = [data.soil, Math.max(0,100-data.soil)];
  soilChart.update();

  lightChart.data.datasets[0].data = [data.light];
  lightChart.update();

  // AI suggestions
  updateAIAdvice(data);
}

// ----------------------
// AI Growth Insight (rules-based engine - simple & explainable)
// ----------------------
function updateAIAdvice(d){
  const tips = [];

  if(d.soil < 30) tips.push("Soil too dry — consider watering soon.");
  if(d.soil >=30 && d.soil < 45) tips.push("Soil moisture moderate — monitor for changes.");
  if(d.soil >=45) tips.push("Soil moisture healthy.");

  if(d.temperature < 18) tips.push("Temperature low — provide gentle heat or move to warmer zone.");
  if(d.temperature >= 18 && d.temperature <= 28) tips.push("Temperature within ideal range.");
  if(d.temperature > 28) tips.push("Temperature high — increase ventilation or shade.");

  if(d.humidity < 40) tips.push("Humidity low — consider misting or humidifier.");
  if(d.humidity > 80) tips.push("Humidity high — risk of fungal growth; improve airflow.");

  if(d.light < 150) tips.push("Light low — increase exposure or turn on grow lights.");
  if(d.light > 1200) tips.push("High light levels — ensure plants tolerate strong light or provide shading.");

  // Compose primary insight
  const primary = tips.length ? tips[0] : "All sensors nominal.";
  aiText.textContent = primary;

  // list top 4 tips (unique)
  aiTips.innerHTML = "";
  [...new Set(tips)].slice(0,4).forEach(tip => {
    const li = document.createElement("li");
    li.textContent = tip;
    aiTips.appendChild(li);
  });
}

// ----------------------
// Polling control
// ----------------------
let pollTimer = null;
async function pollOnce(){
  const data = await fetchDataOnce();
  updateUI(data);
}
function startPolling(){
  stopPolling();
  pollTimer = setInterval(pollOnce, pollInterval);
}
function stopPolling(){
  if(pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

// ----------------------
// UI event wiring
// ----------------------
applyBtn.addEventListener("click", ()=> {
  endpointURL = endpointInput.value.trim();
  useMock = mockToggle.checked;
  startPolling();
});

manualFetch.addEventListener("click", ()=> pollOnce());

intervalSelect.addEventListener("change", (e)=>{
  pollInterval = parseInt(e.target.value, 10);
  startPolling();
});

mockToggle.addEventListener("change", (e)=>{
  useMock = e.target.checked;
});

// Theme toggle - NOTE: themeBtn not in the HTML provided
// themeBtn.addEventListener("click", ()=>{
//   document.body.classList.toggle("dark");
//   themeBtn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
// });

// init default endpoint placeholder (example)
endpointInput.value = endpointURL || "http://192.168.4.1/sensor";

// Seed charts with nulls for a smooth look
(function seed(){
  // already seeded with nulls on creation
})();

// start
startPolling();
pollOnce(); // immediate fetch


const facts = [
  "Plants release water vapor that cools the air around them.",
  "A sunflower can absorb radiation and toxins from soil!",
  "Aloe vera can live for years without water!",
  "Bamboo is one of the fastest-growing plants in the world.",
  "Some plants 'sleep' at night by folding their leaves."
];

function updateGreeting() {
  const hour = new Date().getHours();
  const greetingText = document.getElementById("greetingText");
  // Check for null/undefined before using textContent - safer practice
  if (greetingText) { 
    if (hour < 12) greetingText.textContent = "Good Morning, Grower 🌞";
    else if (hour < 18) greetingText.textContent = "Good Afternoon, Grower 🌤️";
    else greetingText.textContent = "Good Evening, Grower 🌙";
  }
}

function updatePlantFact() {
  const plantFactElement = document.getElementById("plantFact");
  if (plantFactElement) {
    const fact = facts[Math.floor(Math.random() * facts.length)];
    plantFactElement.textContent = `Did you know? ${fact}`; // Added "Did you know?" for consistency
  }
}

updateGreeting();
updatePlantFact();
setInterval(updatePlantFact, 10000); // change fact every 10 seconds