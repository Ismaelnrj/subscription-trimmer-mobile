'use strict';

const R = 6371000; // Earth radius in metres

export function toRad(deg) { return deg * Math.PI / 180; }
export function toDeg(rad) { return rad * 180 / Math.PI; }

/** Haversine distance in metres between two lat/lng points */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/** Compass bearing (0=North, 90=East, CW) from point 1 to point 2 */
export function bearing(lat1, lng1, lat2, lng2) {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Given a lat/lng origin and north/east offsets in metres,
 * returns the resulting lat/lng. Used for DEV_MODE drop placement.
 */
export function offsetLatLng(lat, lng, northM, eastM) {
  const newLat = lat + (northM / R) * (180 / Math.PI);
  const newLng = lng + (eastM / (R * Math.cos(toRad(lat)))) * (180 / Math.PI);
  return { lat: newLat, lng: newLng };
}

/**
 * Magnetic heading from Expo Magnetometer { x, y, z }.
 * x = East, y = North in portrait orientation.
 * Returns 0–360 degrees (0 = magnetic North, 90 = East).
 */
export function magnetometerToHeading({ x, y }) {
  let angle = Math.atan2(y, x) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  // Convert math angle (0=East, CCW) → compass bearing (0=North, CW)
  return (90 - angle + 360) % 360;
}

/**
 * Shortest signed angular difference: how many degrees to turn from
 * `from` to `to` (positive = clockwise, negative = counter-clockwise).
 */
export function angleDelta(from, to) {
  let d = ((to - from) + 540) % 360 - 180;
  return d;
}
