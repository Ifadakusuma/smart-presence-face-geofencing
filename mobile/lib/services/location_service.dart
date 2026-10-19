import 'dart:async';
import 'dart:math' as math;

import 'package:geolocator/geolocator.dart';

class LatLng {
  const LatLng({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;
}

/// A GPS fix that passed the anti-spoofing checks and is safe to submit.
class LocationFix {
  const LocationFix({
    required this.latitude,
    required this.longitude,
    required this.isMocked,
    required this.accuracyMeters,
    required this.speedMps,
    required this.timestamp,
  });

  final double latitude;
  final double longitude;
  final bool isMocked;
  final double accuracyMeters;
  final double speedMps;
  final DateTime timestamp;
}

/// Thrown when the current location cannot be trusted for attendance.
class LocationBlockedException implements Exception {
  const LocationBlockedException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => 'LocationBlockedException($code): $message';
}

class LocationService {
  LocationService({
    this.maxAccuracyMeters = 50,
    this.maxSpeedKph = 20,
    this.sampleCount = 3,
    this.sampleTimeout = const Duration(seconds: 15),
    this.maxSampleSpreadMeters = 50,
  });

  final double maxAccuracyMeters;
  final double maxSpeedKph;
  final int sampleCount;
  final Duration sampleTimeout;
  final double maxSampleSpreadMeters;

  static const _earthRadiusMeters = 6371000.0;

  Future<bool> requestPermission() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.whileInUse ||
        permission == LocationPermission.always;
  }

  /// Lightweight single fix, used only for map previews. This does NOT run
  /// the anti-spoofing checks and must never be used for attendance.
  Future<LatLng> getCurrentPosition() async {
    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 10),
      ),
    );
    return LatLng(latitude: position.latitude, longitude: position.longitude);
  }

  /// Collects a burst of high-accuracy fixes and returns the last one only if
  /// it passes anti-spoofing checks: not mocked, accurate enough, stationary,
  /// and consistent with the other samples.
  Future<LocationFix> getValidatedPosition() async {
    final samples = <Position>[];
    final stream = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
      ),
    );
    try {
      await for (final position
          in stream.take(sampleCount).timeout(sampleTimeout)) {
        samples.add(position);
      }
    } on TimeoutException {
      throw const LocationBlockedException(
        'LOCATION_TIMEOUT',
        'Tidak dapat memperoleh sinyal GPS. Coba di luar ruangan atau dekat jendela.',
      );
    }
    if (samples.isEmpty) {
      throw const LocationBlockedException(
        'LOCATION_UNAVAILABLE',
        'Lokasi tidak tersedia. Silakan coba lagi.',
      );
    }

    final fix = samples.last;
    _checkFix(fix);

    final spread = _maxSpreadMeters(samples);
    if (spread > maxSampleSpreadMeters) {
      throw const LocationBlockedException(
        'LOCATION_INCONSISTENT',
        'Sinyal lokasi tidak stabil. Coba lagi.',
      );
    }

    return LocationFix(
      latitude: fix.latitude,
      longitude: fix.longitude,
      isMocked: fix.isMocked,
      accuracyMeters: fix.accuracy,
      speedMps: fix.speed > 0 ? fix.speed : 0,
      timestamp: fix.timestamp,
    );
  }

  void _checkFix(Position fix) {
    if (fix.isMocked) {
      throw const LocationBlockedException(
        'LOCATION_MOCKED',
        'Lokasi perangkat terdeteksi palsu (mock). Nonaktifkan aplikasi GPS palsu lalu coba lagi.',
      );
    }
    if (fix.accuracy > maxAccuracyMeters) {
      throw LocationBlockedException(
        'LOCATION_ACCURACY_TOO_LOW',
        'Akurasi GPS terlalu rendah (${fix.accuracy.toStringAsFixed(0)} m). '
        'Mendekatlah ke jendela atau ruang terbuka lalu coba lagi.',
      );
    }
    final maxSpeedMps = maxSpeedKph / 3.6;
    if (fix.speed.isFinite && fix.speed > 0 && fix.speed > maxSpeedMps) {
      throw const LocationBlockedException(
        'LOCATION_SPEED_IMPLAUSIBLE',
        'Perangkat bergerak terlalu cepat untuk absensi. Berhenti lalu coba lagi.',
      );
    }
  }

  double _maxSpreadMeters(List<Position> samples) {
    var spread = 0.0;
    final last = samples.last;
    for (final sample in samples) {
      spread = math.max(spread, _distanceMeters(last, sample));
    }
    return spread;
  }

  static double _distanceMeters(Position a, Position b) {
    final dLat = _toRadians(b.latitude - a.latitude);
    final dLon = _toRadians(b.longitude - a.longitude);
    final h = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_toRadians(a.latitude)) *
            math.cos(_toRadians(b.latitude)) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    return _earthRadiusMeters * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h));
  }

  static double _toRadians(double degrees) => degrees * math.pi / 180;
}