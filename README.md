# Smart Presence: Face Recognition & Geofencing

Potongan kode dari proyek Kerja Praktik **Smart Presence** (platform presensi dengan verifikasi wajah dan geofencing). Repositori ini berisi kode yang dibahas di Bab IV laporan KP, **bukan aplikasi lengkap**.

## Alur singkat

```
Flutter (kamera + GPS) -> Express -> Face Service (Python) -> PostgreSQL
Web admin (React): registrasi wajah dan pengaturan titik geofence
```

## Daftar file

| Komponen | File |
|---|---|
| Panel pengambilan foto | `web-admin/src/features/dashboard/FaceCapturePanel.jsx` |
| Skema request/response | `face-service/schemas.py` |
| Pembuatan embedding wajah | `face-service/models/face_processor.py` |
| Layanan kamera | `mobile/lib/services/camera_service.dart` |
| Cosine distance | `face-service/utils/distance.py` |
| Layanan lokasi GPS | `mobile/lib/services/location_service.dart` |
| Pemilihan titik dan radius geofence | `web-admin/src/features/dashboard/SettingsModal.jsx` |
| Jarak Haversine dan geofence | `mobile/lib/utils/distance.dart` |