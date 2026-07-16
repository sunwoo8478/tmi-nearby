const EARTH_RADIUS_METERS = 6371000;

/**
 * Resolve the current browser location as latitude and longitude.
 *
 * @returns {Promise<{lat: number, lng: number}>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!("navigator" in globalThis) || !globalThis.navigator.geolocation) {
      reject(new Error("Geolocation is not supported."));
      return;
    }

    globalThis.navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 30000,
      },
    );
  });
}

/**
 * Calculate the distance between two coordinates with the haversine formula.
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in meters.
 */
export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lng2 - lng1);

  const a = Math.sin(deltaPhi / 2) ** 2
    + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Format a distance for compact nearby labels.
 *
 * @param {number} meters
 * @returns {string}
 */
export function formatDistanceMeters(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }

  return `${Math.round(meters)}m`;
}

/**
 * Generate a random coordinate within a radius from a center coordinate.
 *
 * @param {number} centerLat
 * @param {number} centerLng
 * @param {number} maxRadiusMeters
 * @returns {{lat: number, lng: number}}
 */
export function assignNearbyCoordinate(centerLat, centerLng, maxRadiusMeters) {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * Math.max(0, maxRadiusMeters);
  const angularDistance = distance / EARTH_RADIUS_METERS;
  const centerPhi = toRadians(centerLat);
  const centerLambda = toRadians(centerLng);

  const targetPhi = Math.asin(
    Math.sin(centerPhi) * Math.cos(angularDistance)
      + Math.cos(centerPhi) * Math.sin(angularDistance) * Math.cos(angle),
  );
  const targetLambda = centerLambda + Math.atan2(
    Math.sin(angle) * Math.sin(angularDistance) * Math.cos(centerPhi),
    Math.cos(angularDistance) - Math.sin(centerPhi) * Math.sin(targetPhi),
  );

  return {
    lat: toDegrees(targetPhi),
    lng: normalizeLongitude(toDegrees(targetLambda)),
  };
}

/**
 * @param {number} degrees
 * @returns {number}
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * @param {number} radians
 * @returns {number}
 */
function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

/**
 * @param {number} lng
 * @returns {number}
 */
function normalizeLongitude(lng) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}
