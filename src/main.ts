import { io } from 'socket.io-client';
import { shouldUpdateLocation } from './hooks/useGeolocation';
import './style.css';

const SERVER_URL = 'https://bang-2.onrender.com';
const socket = io(SERVER_URL);

let lastSentLocation: { latitude: number; longitude: number } | null = null;
let lastSentTime: number | null = null;
let watchId: number | null = null;

// --- UI CONSTRUCTION ---
const appContainer = document.createElement('div');
appContainer.id = 'app-container';
document.body.appendChild(appContainer);

const configCard = document.createElement('div');
configCard.className = 'config-card';
appContainer.appendChild(configCard);

const cardHeader = document.createElement('div');
cardHeader.className = 'card-header';
cardHeader.innerHTML = `
  <h1>📍 Child Tracker</h1>
  <p>Secure real-time location sharing</p>
`;
configCard.appendChild(cardHeader);

const inputGroup = document.createElement('div');
inputGroup.className = 'input-group';

const familyField = document.createElement('div');
familyField.className = 'field';
familyField.innerHTML = `
  <label>Family ID</label>
  <input type="text" id="family-id" class="styled-input" placeholder="Enter family ID...">
`;
inputGroup.appendChild(familyField);

const childField = document.createElement('div');
childField.className = 'field';
childField.innerHTML = `
  <label>Child ID</label>
  <input type="text" id="child-id" class="styled-input" placeholder="Enter your ID...">
`;
inputGroup.appendChild(childField);

configCard.appendChild(inputGroup);

const saveBtn = document.createElement('button');
saveBtn.className = 'btn-primary';
saveBtn.textContent = 'Activate Service';
configCard.appendChild(saveBtn);

const statusContainer = document.createElement('div');
statusContainer.className = 'status-container';
statusContainer.style.display = 'none';
configCard.appendChild(statusContainer);

function updateStatusUI(isActive: boolean) {
  statusContainer.style.display = 'block';
  statusContainer.innerHTML = isActive
    ? `<div class="status-badge status-active"><div class="status-dot dot-active"></div>System Active: Monitoring</div>`
    : `<div class="status-badge status-inactive"><div class="status-dot dot-inactive"></div>System Inactive</div>`;
}

// --- LOGIC ---
function startTracking(familyId: string, childId: string) {
  socket.emit('join_family', { familyId, role: 'child', userId: childId });

  if ('geolocation' in navigator) {
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const currentPos = { latitude, longitude };

        if (shouldUpdateLocation(currentPos, lastSentLocation, lastSentTime)) {
          socket.emit('update_location', {
            familyId,
            childId,
            lat: latitude,
            lng: longitude
          });

          lastSentLocation = currentPos;
          lastSentTime = Date.now();
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        updateStatusUI(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    updateStatusUI(true);
  } else {
    updateStatusUI(false);
  }
}

saveBtn.onclick = () => {
  const familyInput = document.getElementById('family-id') as HTMLInputElement;
  const childInput = document.getElementById('child-id') as HTMLInputElement;
  const familyId = familyInput.value;
  const childId = childInput.value;

  if (!familyId || !childId) {
    alert('Configuration required');
    return;
  }

  localStorage.setItem('familyId', familyId);
  localStorage.setItem('childId', childId);

  startTracking(familyId, childId);
};

// Auto-start if configured
const savedFamilyId = localStorage.getItem('familyId');
const savedChildId = localStorage.getItem('childId');

if (savedFamilyId && savedChildId) {
  startTracking(savedFamilyId, savedChildId);
} else {
  // Show input group, hide status
  statusContainer.style.display = 'none';
}
