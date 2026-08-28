// Great-circle distance between an issue and a volunteer, in kilometers.
// Returns null if any coordinate is missing/non-numeric.
function volunteerDistanceKm(latitude, longitude, volunteerLatitude, volunteerLongitude) {
  if (![latitude, longitude, volunteerLatitude, volunteerLongitude].every(Number.isFinite)) {
    return null;
  }

  const radians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = radians(volunteerLatitude - latitude);
  const longitudeDelta = radians(volunteerLongitude - longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitude)) * Math.cos(radians(volunteerLatitude)) * Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { volunteerDistanceKm };
