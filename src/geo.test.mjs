import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { haversineDistanceMeters, formatDistanceMeters, assignNearbyCoordinate } from "./geo.js";

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// Independent great-circle formula (spherical law of cosines) used only to
// cross-check haversineDistanceMeters without duplicating its algorithm.
function lawOfCosinesDistanceMeters(lat1, lng1, lat2, lng2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lng2 - lng1);
  const cosValue = Math.min(
    1,
    Math.max(-1, Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)),
  );
  return EARTH_RADIUS_METERS * Math.acos(cosValue);
}

describe("haversineDistanceMeters", () => {
  test("returns 0 for identical coordinates", () => {
    assert.equal(haversineDistanceMeters(37.5665, 126.978, 37.5665, 126.978), 0);
  });

  test("matches exact geometry along the equator (1 degree of longitude)", () => {
    const expected = EARTH_RADIUS_METERS * toRadians(1);
    const actual = haversineDistanceMeters(0, 0, 0, 1);
    assert.ok(Math.abs(actual - expected) < 1e-6, `expected ~${expected}m, got ${actual}m`);
  });

  test("matches exact geometry from equator to pole (quarter circumference)", () => {
    const expected = (EARTH_RADIUS_METERS * Math.PI) / 2;
    const actual = haversineDistanceMeters(0, 0, 90, 0);
    assert.ok(Math.abs(actual - expected) < 1e-6, `expected ~${expected}m, got ${actual}m`);
  });

  test("agrees with an independent great-circle formula for real-world coordinates", () => {
    // Seoul City Hall -> Tokyo Metropolitan Government Building
    const seoul = { lat: 37.5665, lng: 126.978 };
    const tokyo = { lat: 35.6895, lng: 139.6917 };

    const actual = haversineDistanceMeters(seoul.lat, seoul.lng, tokyo.lat, tokyo.lng);
    const reference = lawOfCosinesDistanceMeters(seoul.lat, seoul.lng, tokyo.lat, tokyo.lng);

    assert.ok(
      Math.abs(actual - reference) < 1,
      `haversine (${actual}m) and law-of-cosines (${reference}m) should closely agree`,
    );
    // Sanity bound against the well-known real-world distance (~1,150-1,165km).
    assert.ok(actual > 1_000_000 && actual < 1_300_000, `expected roughly 1000-1300km, got ${actual}m`);
  });

  test("is symmetric regardless of argument order", () => {
    const a = haversineDistanceMeters(37.5665, 126.978, 35.1796, 129.0756);
    const b = haversineDistanceMeters(35.1796, 129.0756, 37.5665, 126.978);
    assert.ok(Math.abs(a - b) < 1e-6);
  });

  test("returns half the earth's circumference for pole-to-pole (latitude extremes)", () => {
    const expected = EARTH_RADIUS_METERS * Math.PI;
    const actual = haversineDistanceMeters(90, 0, -90, 0);
    assert.ok(Math.abs(actual - expected) < 1e-6, `expected ~${expected}m, got ${actual}m`);
  });

  test("returns 0 between two points at the same pole regardless of longitude", () => {
    const actual = haversineDistanceMeters(90, -170, 90, 165);
    assert.ok(Math.abs(actual) < 1e-6, `expected ~0m, got ${actual}m`);
  });

  test("returns half the earth's circumference for antipodal equatorial points (longitude extremes)", () => {
    const expected = EARTH_RADIUS_METERS * Math.PI;
    const actual = haversineDistanceMeters(0, -180, 0, 0);
    assert.ok(Math.abs(actual - expected) < 1e-6, `expected ~${expected}m, got ${actual}m`);
  });

  test("treats crossing the antimeridian as a short distance, not the long way around", () => {
    // 179° and -179° are 2 degrees apart across the date line, not 358 degrees.
    const short = haversineDistanceMeters(0, 179, 0, -179);
    const twoDegrees = EARTH_RADIUS_METERS * toRadians(2);
    assert.ok(Math.abs(short - twoDegrees) < 1e-6, `expected ~${twoDegrees}m, got ${short}m`);
  });

  test("handles negative latitude/longitude coordinates (southern/western hemisphere)", () => {
    // Sydney -> Buenos Aires, both negative lat/lng.
    const sydney = { lat: -33.8688, lng: 151.2093 };
    const buenosAires = { lat: -34.6037, lng: -58.3816 };
    const actual = haversineDistanceMeters(sydney.lat, sydney.lng, buenosAires.lat, buenosAires.lng);
    const reference = lawOfCosinesDistanceMeters(sydney.lat, sydney.lng, buenosAires.lat, buenosAires.lng);
    assert.ok(Math.abs(actual - reference) < 1, `expected close to ${reference}m, got ${actual}m`);
  });
});

describe("formatDistanceMeters", () => {
  test("formats sub-kilometer distances in rounded meters", () => {
    assert.equal(formatDistanceMeters(0), "0m");
    assert.equal(formatDistanceMeters(42.4), "42m");
    assert.equal(formatDistanceMeters(999), "999m");
  });

  test("switches to kilometers exactly at the 1000m boundary", () => {
    assert.equal(formatDistanceMeters(999.4), "999m");
    assert.equal(formatDistanceMeters(1000), "1.0km");
  });

  test("formats kilometer distances with one decimal place", () => {
    assert.equal(formatDistanceMeters(1234), "1.2km");
    assert.equal(formatDistanceMeters(1500), "1.5km");
    assert.equal(formatDistanceMeters(12345), "12.3km");
  });
});

describe("assignNearbyCoordinate", () => {
  const center = { lat: 37.5665, lng: 126.978 };

  test("always generates a coordinate within the requested radius (50m)", () => {
    const radius = 50;
    for (let i = 0; i < 500; i++) {
      const { lat, lng } = assignNearbyCoordinate(center.lat, center.lng, radius);
      const distance = haversineDistanceMeters(center.lat, center.lng, lat, lng);
      assert.ok(distance <= radius + 1e-6, `sample ${i}: distance ${distance}m exceeded radius ${radius}m`);
    }
  });

  test("holds for a larger radius too (5000m)", () => {
    const radius = 5000;
    for (let i = 0; i < 200; i++) {
      const { lat, lng } = assignNearbyCoordinate(center.lat, center.lng, radius);
      const distance = haversineDistanceMeters(center.lat, center.lng, lat, lng);
      assert.ok(distance <= radius + 1e-6, `sample ${i}: distance ${distance}m exceeded radius ${radius}m`);
    }
  });

  test("collapses to the center point when radius is 0", () => {
    const { lat, lng } = assignNearbyCoordinate(center.lat, center.lng, 0);
    const distance = haversineDistanceMeters(center.lat, center.lng, lat, lng);
    assert.ok(distance < 1e-6, `expected ~0m, got ${distance}m`);
  });

  test("keeps longitude normalized to [-180, 180] across the antimeridian", () => {
    for (let i = 0; i < 200; i++) {
      const { lng } = assignNearbyCoordinate(center.lat, 179.9999, 50000);
      assert.ok(lng >= -180 && lng <= 180, `lng ${lng} out of range`);
    }
  });

  test("produces varied coordinates across samples", () => {
    const samples = new Set();
    for (let i = 0; i < 20; i++) {
      const { lat, lng } = assignNearbyCoordinate(center.lat, center.lng, 100);
      samples.add(`${lat},${lng}`);
    }
    assert.ok(samples.size > 1, "expected random samples to differ");
  });

  test("stays within radius and keeps latitude in range when centered at the north pole", () => {
    for (let i = 0; i < 200; i++) {
      const { lat, lng } = assignNearbyCoordinate(90, 0, 500);
      const distance = haversineDistanceMeters(90, 0, lat, lng);
      assert.ok(distance <= 500 + 1e-6, `sample ${i}: distance ${distance}m exceeded radius`);
      assert.ok(lat >= -90 && lat <= 90, `lat ${lat} out of range`);
      assert.ok(lng >= -180 && lng <= 180, `lng ${lng} out of range`);
    }
  });

  test("stays within radius when centered at the south pole", () => {
    for (let i = 0; i < 200; i++) {
      const { lat, lng } = assignNearbyCoordinate(-90, 0, 500);
      const distance = haversineDistanceMeters(-90, 0, lat, lng);
      assert.ok(distance <= 500 + 1e-6, `sample ${i}: distance ${distance}m exceeded radius`);
      assert.ok(lat >= -90 && lat <= 90, `lat ${lat} out of range`);
    }
  });
});
