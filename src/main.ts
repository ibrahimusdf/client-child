import { io } from 'socket.io-client';
import { shouldUpdateLocation } from './hooks/useGeolocation';

const SERVER_URL = 'https://bang-2.onrender.com'; // Change to deployed URL later
const socket = io(SERVER_URL);

let lastSentLocation: { latitude: number; longitude: number } | null = null;
let lastSentTime: number | null = null;
let watchId: number | null = null;

const appDiv = document.createElement('div');
appDiv.style.fontFamily = 'sans-serif';
appDiv.style.padding = '20px';
appDiv.style.textAlign = 'center';
appDiv.style.color = '#666';
document.body.appendChild(appDiv);

const statusEl = document.createElement('p');
statusEl.style.fontSize = '12px';
statusEl.textContent = 'Checking system status...';
appDiv.appendChild(statusEl);

// Formulario de configuración (solo se muestra si no hay datos guardados)
const configDiv = document.createElement('div');
configDiv.style.display = 'none';
appDiv.appendChild(configDiv);

const familyInput = document.createElement('input');
familyInput.placeholder = 'Family ID';
familyInput.style.display = 'block';
familyInput.style.margin = '10px auto';
configDiv.appendChild(familyInput);

const childIdInput = document.createElement('input');
childIdInput.placeholder = 'Child ID';
childIdInput.style.display = 'block';
childIdInput.style.margin = '10px auto';
configDiv.appendChild(childIdInput);

const saveBtn = document.createElement('button');
saveBtn.textContent = 'Activate Service';
saveBtn.style.padding = '10px 20px';
configDiv.appendChild(saveBtn);

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
        statusEl.textContent = 'System Error: GPS Off';
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    statusEl.textContent = 'System Active: Monitoring enabled';
  } else {
    statusEl.textContent = 'System Error: GPS Not Supported';
  }
}

saveBtn.onclick = () => {
  const familyId = familyInput.value;
  const childId = childIdInput.value;

  if (!familyId || !childId) {
    alert('Configuration required');
    return;
  }

  localStorage.setItem('familyId', familyId);
  localStorage.setItem('childId', childId);

  configDiv.style.display = 'none';
  startTracking(familyId, childId);
};

// Auto-start if configured
const savedFamilyId = localStorage.getItem('familyId');
const savedChildId = localStorage.getItem('childId');

if (savedFamilyId && savedChildId) {
  startTracking(savedFamilyId, savedChildId);
} else {
  configDiv.style.display = 'block';
  statusEl.textContent = 'Configuration Required';
}
