import 'dart:math';

const double earthRadiusMeters = 6371000;

double _toRadians(double value) => value * pi / 180;

int distanceMeters(double lat1, double lon1, double lat2, double lon2) {
  final dLat = _toRadians(lat2) - _toRadians(lat1);
  final dLon = _toRadians(lon2) - _toRadians(lon1);
  final a = pow(sin(dLat / 2), 2) +
      cos(_toRadians(lat1)) * cos(_toRadians(lat2)) * pow(sin(dLon / 2), 2);
  return (earthRadiusMeters * 2 * atan2(sqrt(a), sqrt(1 - a))).round();
}

bool isInsideGeofence(
  double userLat,
  double userLon,
  double centerLat,
  double centerLon,
  double radiusMeters,
) {
  return distanceMeters(userLat, userLon, centerLat, centerLon) <= radiusMeters;
}
