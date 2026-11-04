/**
 * Calculates the distance between two points on Earth using the Haversine formula
 * @param lat1 Latitude of the first point in decimal degrees
 * @param lon1 Longitude of the first point in decimal degrees
 * @param lat2 Latitude of the second point in decimal degrees
 * @param lon2 Longitude of the second point in decimal degrees
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Earth's radius in meters
  const R = 6371000;
  
  // Convert latitude and longitude from degrees to radians
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  
  // Haversine formula
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Checks if a user is within the specified radius of a location
 * @param userLat User's latitude
 * @param userLon User's longitude
 * @param locationLat Location's latitude
 * @param locationLon Location's longitude
 * @param radius Radius in meters
 * @returns Boolean indicating if user is within the radius
 */
export function isWithinRadius(
  userLat: number,
  userLon: number,
  locationLat: number,
  locationLon: number,
  radius: number
): boolean {
  const distance = calculateDistance(userLat, userLon, locationLat, locationLon);
  return distance <= radius;
}

/**
 * Custom GeolocationError class with additional properties
 */
export class GeolocationError extends Error {
  code?: number;
  
  constructor(message: string, code?: number) {
    super(message);
    this.name = 'GeolocationError';
    this.code = code;
  }
}

/**
 * Geolocation error codes for reference
 */
export const GEOLOCATION_ERROR_CODES = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3
};

/**
 * Gets the current position of the user
 * @returns Promise that resolves to the user's coordinates
 */
export function getCurrentPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const error = new GeolocationError('Geolocation is not supported by your browser. Please use a modern browser with location services.');
      reject(error);
      return;
    }
    
    // Try to get the position with high accuracy first
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(position.coords);
      },
      (error) => {
        // Provide more specific error messages based on the error code
        let errorMessage = 'Unable to get your current location.';
        let errorSolution = '';
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += ' Location permission was denied.';
            errorSolution = ' Please enable location services in your browser settings by clicking the lock icon in the address bar and allowing location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += ' Location information is unavailable.';
            errorSolution = ' Please check your device\'s GPS or network connection and try again.';
            break;
          case error.TIMEOUT:
            errorMessage += ' The request to get your location timed out.';
            errorSolution = ' Please check your internet connection and try again.';
            break;
          default:
            errorSolution = ' Please ensure location services are enabled on your device.';
        }
        
        const enhancedError = new GeolocationError(errorMessage + errorSolution, error.code);
        reject(enhancedError);
      },
      { 
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout for better reliability
        maximumAge: 0
      }
    );
  });
}

/**
 * Checks if the browser has geolocation permission
 * @returns Promise that resolves with the permission state: 'granted', 'denied', 'prompt', or 'unsupported'
 */
export const checkGeolocationPermission = async (): Promise<PermissionState | 'unsupported'> => {
  // Check if Permissions API is supported
  if (!navigator.permissions || !navigator.permissions.query) {
    return 'unsupported';
  }
  
  try {
    const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return permissionStatus.state;
  } catch (error) {
    console.error('Error checking geolocation permission:', error);
    return 'unsupported';
  }
};

/**
 * Attempts to get location with a fallback to low accuracy if high accuracy fails
 * Optimized for speed - tries low accuracy first (faster), then high accuracy
 * @returns Promise that resolves to the user's coordinates
 */
export function getLocationWithFallback(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeolocationError('Geolocation is not supported by your browser'));
      return;
    }

    // Strategy: Try low accuracy FIRST (much faster, typically < 1 second)
    // Then upgrade to high accuracy if needed for better precision
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Low accuracy succeeded quickly - resolve immediately
        resolve(position.coords);
      },
      (lowAccuracyError) => {
        // Low accuracy failed - try high accuracy as fallback
        if (
          lowAccuracyError.code === lowAccuracyError.TIMEOUT ||
          lowAccuracyError.code === lowAccuracyError.POSITION_UNAVAILABLE
        ) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve(position.coords);
            },
            (highAccuracyError) => {
              // Both failed - reject with the original error
              const enhancedError = new GeolocationError(
                getGeolocationErrorMessage(lowAccuracyError),
                lowAccuracyError.code
              );
              reject(enhancedError);
            },
            { enableHighAccuracy: true, timeout: 2500, maximumAge: 10000 } // High accuracy with 2.5s timeout
          );
        } else {
          // Permission denied or other errors - reject immediately
          const enhancedError = new GeolocationError(
            getGeolocationErrorMessage(lowAccuracyError),
            lowAccuracyError.code
          );
          reject(enhancedError);
        }
      },
      { enableHighAccuracy: false, timeout: 2000, maximumAge: 60000 } // Low accuracy with 2s timeout, use cached positions aggressively
    );
  });
}

/**
 * Helper function to get a user-friendly error message for geolocation errors
 */
function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  let message = 'Unable to get your current location. ';
  
  switch (error.code) {
    case error.PERMISSION_DENIED:
      message += 'Location permission was denied. Please enable location services in your browser settings by clicking the lock icon in the address bar and allowing location access.';
      break;
    case error.POSITION_UNAVAILABLE:
      message += 'Location information is unavailable. Please check your device\'s GPS or network connection and try again.';
      break;
    case error.TIMEOUT:
      message += 'The request to get your location timed out. Please check your internet connection and try again.';
      break;
    default:
      message += 'An unknown error occurred. Please ensure location services are enabled on your device.';
  }
  
  return message;
}

/**
 * Provides browser-specific instructions for enabling location permissions
 * @returns Instructions specific to the user's browser
 */
export function getBrowserLocationInstructions(): string {
  const ua = navigator.userAgent;
  
  // Chrome or Edge
  if (ua.includes('Chrome') || ua.includes('Edg')) {
    return `
      1. Click the lock/info icon in the address bar
      2. Find "Location" in the site settings
      3. Change the permission to "Allow"
      4. Refresh the page
    `;
  }
  // Firefox
  else if (ua.includes('Firefox')) {
    return `
      1. Click the lock/info icon in the address bar
      2. Click "Connection Secure" or "More Information"
      3. Go to "Permissions" tab
      4. Change "Access Your Location" to "Allow"
      5. Refresh the page
    `;
  }
  // Safari
  else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    return `
      1. Click Safari in the menu bar
      2. Select "Settings" or "Preferences"
      3. Go to "Websites" tab
      4. Select "Location" on the left
      5. Find this website and set permission to "Allow"
      6. Refresh the page
    `;
  }
  // Generic instructions
  else {
    return `
      1. Click the lock/info icon in the address bar
      2. Find location permissions in the site settings
      3. Change the permission to "Allow"
      4. Refresh the page
    `;
  }
}