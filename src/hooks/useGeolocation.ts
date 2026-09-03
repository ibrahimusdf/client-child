export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export function shouldUpdateLocation(
  currentPos: { latitude: number; longitude: number },
  lastPos: { latitude: number; longitude: number } | null,
  lastSentTime: number | null
): boolean {
  if (!lastPos || !lastSentTime) return true;

  const distance = calculateDistance(
    currentPos.latitude,
    currentPos.longitude,
    lastPos.latitude,
    lastPos.longitude
  );

  const now = Date.now();
  const timeElapsed = now - lastSentTime;

  // Thresholds: 20 meters or 5 minutes (300,000 ms)
  if (distance > 20 || timeElapsed > 300000) {
    return true;
  }

  return false;
}
