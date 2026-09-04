import { io, Socket } from 'socket.io-client';
import { shouldUpdateLocation } from './hooks/useGeolocation';
import './style.css';

const SERVER_URL = 'https://bang-2.onrender.com';
const socket: Socket = io(SERVER_URL, { reconnection: true, reconnectionDelay: 3000, reconnectionAttempts: Infinity });

let lastSentLocation: { latitude: number; longitude: number } | null = null;
let lastSentTime: number | null = null;
let watchId: number | null = null;
let trackingActive = false;
let locationCount = 0;
let savedFamilyId: string | null = null;
let savedChildId: string | null = null;

// --- DOM ELEMENTS ---
const appContainer = document.createElement('div');
appContainer.id = 'app-container';
document.body.appendChild(appContainer);

const configCard = document.createElement('div');
configCard.className = 'config-card';
appContainer.appendChild(configCard);

const cardHeader = document.createElement('div');
cardHeader.className = 'card-header';
cardHeader.innerHTML = `
  <h1>&#x1F4CD; Child Tracker</h1>
  <p>Secure real-time location sharing</p>
`;
configCard.appendChild(cardHeader);

// Connection status bar
const connectionBar = document.createElement('div');
connectionBar.className = 'connection-bar connection-disconnected';
connectionBar.textContent = 'Connecting...';
configCard.appendChild(connectionBar);

// Config form
const configForm = document.createElement('div');
configForm.className = 'config-form';

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

configForm.appendChild(inputGroup);

const buttonGroup = document.createElement('div');
buttonGroup.className = 'button-group';

const saveBtn = document.createElement('button');
saveBtn.className = 'btn-primary';
saveBtn.textContent = 'Activate Service';
buttonGroup.appendChild(saveBtn);

configForm.appendChild(buttonGroup);
configCard.appendChild(configForm);

// Active tracking panel (hidden by default)
const trackingPanel = document.createElement('div');
trackingPanel.className = 'tracking-panel';
trackingPanel.style.display = 'none';
configCard.appendChild(trackingPanel);

const trackingInfo = document.createElement('div');
trackingInfo.className = 'tracking-info';
trackingPanel.appendChild(trackingInfo);

const statusBadge = document.createElement('div');
statusBadge.className = 'status-badge';
trackingPanel.appendChild(statusBadge);

const stopBtn = document.createElement('button');
stopBtn.className = 'btn-danger';
stopBtn.textContent = 'Stop & Forget';
trackingPanel.appendChild(stopBtn);

// --- UI ---
function updateConnectionStatus(connected: boolean) {
  connectionBar.className = `connection-bar ${connected ? 'connection-connected' : 'connection-disconnected'}`;
  connectionBar.textContent = connected ? 'Connected to server' : 'Reconnecting...';
}

function showTrackingPanel(familyId: string, childId: string) {
  configForm.style.display = 'none';
  trackingPanel.style.display = 'block';
  trackingInfo.innerHTML = `
    <div class="info-row"><span class="info-label">Family:</span> <span class="info-value">${familyId}</span></div>
    <div class="info-row"><span class="info-label">Child:</span> <span class="info-value">${childId}</span></div>
    <div class="info-row"><span class="info-label">Updates sent:</span> <span class="info-value" id="update-count">${locationCount}</span></div>
  `;
  statusBadge.className = 'status-badge status-active';
  statusBadge.innerHTML = '<div class="status-dot dot-active"></div>Tracking Active';
}

function showConfigForm() {
  configForm.style.display = 'block';
  trackingPanel.style.display = 'none';
}

// --- TRACKING ---
function joinSocket(familyId: string, childId: string) {
  socket.emit('join_family', { familyId, role: 'child', userId: childId });
}

function startTracking(familyId: string, childId: string) {
  if (trackingActive) return;

  savedFamilyId = familyId;
  savedChildId = childId;
  trackingActive = true;
  locationCount = 0;

  joinSocket(familyId, childId);
  showTrackingPanel(familyId, childId);

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
          locationCount++;

          const countEl = document.getElementById('update-count');
          if (countEl) countEl.textContent = String(locationCount);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        statusBadge.className = 'status-badge status-error';
        statusBadge.innerHTML = '<div class="status-dot dot-error"></div>GPS Error - Check permissions';
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    );
  } else {
    statusBadge.className = 'status-badge status-error';
    statusBadge.innerHTML = '<div class="status-dot dot-error"></div>Geolocation not supported';
  }
}

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  trackingActive = false;
  lastSentLocation = null;
  lastSentTime = null;
  locationCount = 0;
  savedFamilyId = null;
  savedChildId = null;
  localStorage.removeItem('familyId');
  localStorage.removeItem('childId');
  showConfigForm();
}

// --- EVENT HANDLERS ---
saveBtn.onclick = () => {
  const familyInput = document.getElementById('family-id') as HTMLInputElement;
  const childInput = document.getElementById('child-id') as HTMLInputElement;
  const familyId = familyInput.value.trim();
  const childId = childInput.value.trim();

  if (!familyId || !childId) {
    alert('Please fill in both fields');
    return;
  }

  localStorage.setItem('familyId', familyId);
  localStorage.setItem('childId', childId);
  startTracking(familyId, childId);
};

stopBtn.onclick = () => stopTracking();

// --- SOCKET EVENTS ---
socket.on('connect', () => {
  updateConnectionStatus(true);
  // Re-join family on reconnect
  if (savedFamilyId && savedChildId) {
    joinSocket(savedFamilyId, savedChildId);
  }
});

socket.on('disconnect', () => updateConnectionStatus(false));
socket.on('connect_error', () => updateConnectionStatus(false));

socket.on('error', (data: { message: string }) => {
  console.error('Server error:', data.message);
  if (trackingActive) {
    statusBadge.className = 'status-badge status-error';
    statusBadge.innerHTML = `<div class="status-dot dot-error"></div>Error: ${data.message}`;
  }
});

// --- AUTO-START ---
savedFamilyId = localStorage.getItem('familyId');
savedChildId = localStorage.getItem('childId');

if (savedFamilyId && savedChildId) {
  startTracking(savedFamilyId, savedChildId);
}
