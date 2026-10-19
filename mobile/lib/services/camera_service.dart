import 'dart:io';
import 'dart:typed_data';
import 'package:camera/camera.dart';
import 'package:flutter/widgets.dart';
import 'package:image/image.dart' as img;

class CapturedPhoto {
  const CapturedPhoto({required this.bytes, required this.mimeType});

  final Uint8List bytes;
  final String mimeType;
}

class CameraService {
  CameraController? _controller;

  bool get isInitialized => _controller?.value.isInitialized ?? false;

  CameraController? get controller => _controller;

  // Pilih kamera depan (front). Fallback ke kamera pertama bila tidak ada front.
  Future<CameraDescription?> _frontCamera() async {
    final cameras = await availableCameras();
    for (final camera in cameras) {
      if (camera.lensDirection == CameraLensDirection.front) return camera;
    }
    return cameras.isNotEmpty ? cameras.first : null;
  }

  Future<bool> initialize({Duration timeout = const Duration(seconds: 8)}) async {
    try {
      if (_controller != null && _controller!.value.isInitialized) return true;
      final camera = await _frontCamera().timeout(timeout);
      if (camera == null) return false;
      _controller = CameraController(
        camera,
        ResolutionPreset.medium, // <-- resolusi target (lihat bagian 3 rencana)
        enableAudio: false,      // <-- tanpa audio / izin mikrofon
        imageFormatGroup: ImageFormatGroup.jpeg,
      );
      await _controller!.initialize().timeout(timeout);
      return _controller!.value.isInitialized;
    } on Exception {
      return false;
    }
  }

  Widget buildPreview() => CameraPreview(_controller!); // viewfinder

  // Fallback: inisialisasi → ambil foto → dispose dalam sekali panggilan.
  // Dipakai layar proses bila foto tidak tersedia (tanpa preview persistent).
  Future<CapturedPhoto?> captureSelfieOnce() async {
    final ok = await initialize();
    if (!ok) return null;
    try {
      return await takePhoto();
    } finally {
      await dispose();
    }
  }

  Future<CapturedPhoto?> takePhoto() async {
    if (_controller == null || !_controller!.value.isInitialized) return null;
    final file = await _controller!.takePicture(); // sekali saja, tanpa image stream
    try {
      final decoded = img.decodeImage(await file.readAsBytes());
      if (decoded == null) return null;
      final oriented = img.bakeOrientation(decoded); // rotasi dari tag EXIF -> tegak
      final bytes = Uint8List.fromList(img.encodeJpg(oriented, quality: 80));
      return CapturedPhoto(bytes: bytes, mimeType: 'image/jpeg');
    } on CameraException {
      return null;
    } finally {
      try {
        await File(file.path).delete(); // hapus file cache
      } catch (_) {}
    }
  }

  Future<void> dispose() async {
    try {
      await _controller?.dispose();
    } catch (_) {}
    _controller = null;
  }
}