import { useState, useEffect, useRef } from 'react';
import { Locate, Plus, Minus, Info, AlertCircle, MapPin, Check } from 'lucide-react';
import L from 'leaflet';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { getLocations, createLocation, updateLocation, getSchedules, createSchedule, updateSchedule } from '../../services/api';
import StatusModal from '../../components/ui/StatusModal';

// Modern Custom SVG Pin Marker for Leaflet
const createCustomPinIcon = () => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 24px; height: 24px; background: rgba(37, 99, 235, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 32px; height: 32px; background: #2563eb; border: 2.5px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
          <div style="width: 10px; height: 10px; background: #ffffff; border-radius: 50%; transform: rotate(45deg);"></div>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 34],
    popupAnchor: [0, -32],
  });
};

export default function SettingsModal({ onClose, onSuccess }) {
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [scheduleId, setScheduleId] = useState(null);
  const [checkInTime, setCheckInTime] = useState('08:00');
  const [checkOutTime, setCheckOutTime] = useState('16:00');
  const [form, setForm] = useState({
    locationName: 'Kantor Redesma',
    latitude: -6.208763,
    longitude: 106.845599,
    radiusMeter: 100,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [statusPopup, setStatusPopup] = useState(null);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // 1. Ambil data lokasi dari Backend API
  useEffect(() => {
    let isMounted = true;
    const fetchLocations = async () => {
      try {
        const [resLocations, resSchedules] = await Promise.all([
          getLocations().catch(() => ({ items: [] })),
          getSchedules().catch(() => ({ items: [] }))
        ]);
        
        const items = resLocations.items || resLocations || [];
        if (isMounted && items.length > 0) {
          setLocations(items);
          const first = items[0];
          setSelectedLocationId(first.id || first.location_id);
          setForm({
            locationName: first.locationName || first.location_name || 'Kantor Redesma',
            latitude: Number(first.latitude) || -6.208763,
            longitude: Number(first.longitude) || 106.845599,
            radiusMeter: Number(first.radiusMeter || first.radius_meter) || 100,
          });
        }

        const schedItems = resSchedules.items || resSchedules || [];
        if (isMounted && schedItems.length > 0) {
          const firstSched = schedItems[0];
          setScheduleId(firstSched.id || firstSched.schedule_id);
          
          const extractTime = (timeStr) => {
            if (!timeStr) return '';
            if (timeStr.includes('T')) {
              const d = new Date(timeStr);
              if (!isNaN(d.getTime())) {
                 return d.toISOString().split('T')[1].substring(0,5);
              }
              return timeStr.split('T')[1].substring(0,5);
            }
            return timeStr.substring(0,5);
          };
          
          if (firstSched.checkInTime || firstSched.check_in_time) {
            setCheckInTime(extractTime(firstSched.checkInTime || firstSched.check_in_time));
          }
          if (firstSched.checkOutTime || firstSched.check_out_time) {
            setCheckOutTime(extractTime(firstSched.checkOutTime || firstSched.check_out_time));
          }
        }
      } catch (err) {
        console.warn('Tidak dapat memuat pengaturan dari API:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchLocations();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Inisialisasi Peta Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = Number(form.latitude) || -6.200000;
      const initialLng = Number(form.longitude) || 106.816666;
      const initialRadius = Number(form.radiusMeter) || 100;

      // Inisialisasi Leaflet Map
      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 16,
        zoomControl: false, // Kita buat tombol zoom kustom
      });

      // Tile Layer OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Marker
      const marker = L.marker([initialLat, initialLng], {
        icon: createCustomPinIcon(),
        draggable: true,
      }).addTo(map);

      // Geofence Circle
      const circle = L.circle([initialLat, initialLng], {
        radius: initialRadius,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(map);

      // Event: Marker digeser oleh admin
      marker.on('drag', (e) => {
        const { lat, lng } = e.target.getLatLng();
        circle.setLatLng([lat, lng]);
        setForm((prev) => ({
          ...prev,
          latitude: parseFloat(lat.toFixed(6)),
          longitude: parseFloat(lng.toFixed(6)),
        }));
      });

      // Event: Admin klik di peta untuk memindahkan marker
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        setForm((prev) => ({
          ...prev,
          latitude: parseFloat(lat.toFixed(6)),
          longitude: parseFloat(lng.toFixed(6)),
        }));
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;

      // Fix render layout modal Leaflet
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isLoading]);

  // 3. Sinkronisasi perubahan input form ke peta & lingkaran geofence
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;

    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    const radius = Number(form.radiusMeter);

    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      const currentPos = markerRef.current.getLatLng();
      if (Math.abs(currentPos.lat - lat) > 0.00001 || Math.abs(currentPos.lng - lng) > 0.00001) {
        markerRef.current.setLatLng([lat, lng]);
        circleRef.current.setLatLng([lat, lng]);
        mapInstanceRef.current.panTo([lat, lng]);
      }
    }

    if (Number.isFinite(radius) && radius > 0) {
      circleRef.current.setRadius(radius);
    }
  }, [form.latitude, form.longitude, form.radiusMeter]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'radiusMeter' || name === 'latitude' || name === 'longitude'
        ? (value === '' ? '' : value)
        : value,
    }));
  };

  // 4. Fitur Deteksi GPS / Lokasi Saat Ini
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatusPopup({ type: 'error', message: 'Geolocation tidak didukung oleh browser Anda.' });
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lng = parseFloat(position.coords.longitude.toFixed(6));

        setForm((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));

        if (mapInstanceRef.current && markerRef.current && circleRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          circleRef.current.setLatLng([lat, lng]);
          mapInstanceRef.current.setView([lat, lng], 17);
        }

        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        setStatusPopup({ type: 'error', message: 'Gagal mendeteksi lokasi GPS. Pastikan izin akses lokasi aktif di browser.' });
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Zoom Controls
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  // 5. Submit data lokasi ke Backend API
  const handleSubmit = async (e) => {
    e.preventDefault();

    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    const radius = Number(form.radiusMeter);

    if (!form.locationName.trim()) {
      setStatusPopup({ type: 'error', message: 'Nama lokasi wajib diisi.' });
      return;
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setStatusPopup({ type: 'error', message: 'Latitude tidak valid (antara -90 s/d 90).' });
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setStatusPopup({ type: 'error', message: 'Longitude tidak valid (antara -180 s/d 180).' });
      return;
    }
    if (!Number.isFinite(radius) || radius <= 0) {
      setStatusPopup({ type: 'error', message: 'Radius harus lebih besar dari 0 meter.' });
      return;
    }

    if (!checkInTime || !checkOutTime) {
      setStatusPopup({ type: 'error', message: 'Jam masuk dan jam keluar wajib diisi.' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        locationName: form.locationName.trim(),
        latitude: lat,
        longitude: lng,
        radiusMeter: radius,
      };

      if (selectedLocationId) {
        await updateLocation(selectedLocationId, payload);
      } else {
        await createLocation(payload);
      }

      const schedulePayload = { name: 'Regular Shift', checkInTime, checkOutTime };
      if (scheduleId) {
        await updateSchedule(scheduleId, schedulePayload);
      } else {
        await createSchedule(schedulePayload);
      }

      setStatusPopup({ type: 'success', message: 'Pengaturan sistem berhasil disimpan!' });
    } catch (err) {
      console.error(err);
      setStatusPopup({ type: 'error', message: err.message || 'Gagal menyimpan konfigurasi ke server.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      title="Pengaturan Sistem"
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
          >
            Batal
          </button>
          <Button onClick={handleSubmit} disabled={isSaving || isLoading}>
            {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
          <h4 className="text-sm font-semibold text-slate-800">Pengaturan Jam Kerja</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jam Masuk</label>
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jam Keluar</label>
              <input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono"
                required
              />
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
          <h4 className="text-sm font-semibold text-slate-800">Pengaturan Lokasi Absensi</h4>
          <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lokasi Perusahaan</label>
          <input
            name="locationName"
            value={form.locationName}
            onChange={handleChange}
            placeholder="Contoh: Kantor Redesma"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
            <input
              name="latitude"
              type="number"
              step="any"
              value={form.latitude}
              onChange={handleChange}
              placeholder="-6.200000"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
            <input
              name="longitude"
              type="number"
              step="any"
              value={form.longitude}
              onChange={handleChange}
              placeholder="106.816666"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-slate-700">Radius Geofence Presensi (meter)</label>
            <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              {form.radiusMeter || 0} meter
            </span>
          </div>
          <input
            type="number"
            name="radiusMeter"
            min={10}
            max={1000}
            value={form.radiusMeter}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            Karyawan hanya dapat melakukan absensi jika berada di dalam radius lingkaran ini.
          </p>
        </div>

        {/* Container Peta Interaktif Leaflet */}
        <div>
          <div className="relative h-64 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 shadow-inner">
            {/* Peta Leaflet diconnect ke ref ini */}
            <div ref={mapContainerRef} className="w-full h-full z-0" />

            {/* Tombol Lokasi Saat Ini */}
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
              className="absolute top-2.5 right-2.5 z-[1000] flex items-center gap-1.5 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 shadow-md border border-slate-200 hover:bg-white hover:text-blue-600 transition disabled:opacity-50"
            >
              <Locate size={14} className={isLocating ? 'animate-spin text-blue-600' : ''} />
              {isLocating ? 'Mencari GPS...' : 'Lokasi Saat Ini'}
            </button>

            {/* Tombol Kustom Zoom */}
            <div className="absolute bottom-2.5 right-2.5 z-[1000] flex flex-col gap-1">
              <button
                type="button"
                onClick={handleZoomIn}
                className="w-8 h-8 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-md shadow-md border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-white transition font-bold"
                title="Zoom In"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="w-8 h-8 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-md shadow-md border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-white transition font-bold"
                title="Zoom Out"
              >
                <Minus size={16} />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-2 flex items-start gap-1.5">
            <Info size={14} className="mt-0.5 shrink-0 text-blue-600" />
            <span>
              <strong>Tips:</strong> Klik area mana saja pada peta atau <strong>geser pin biru</strong> untuk menyesuaikan koordinat kantor. Lingkaran biru menandakan area geofence absensi.
            </span>
          </p>
        </div>
        </div>
      </form>
      
      {statusPopup && (
        <StatusModal
          type={statusPopup.type}
          title={statusPopup.type === 'success' ? 'Berhasil' : 'Gagal'}
          message={statusPopup.message}
          onClose={() => {
            setStatusPopup(null);
            if (statusPopup.type === 'success') {
               onSuccess?.();
               onClose(); // Menutup SettingsModal HANYA JIKA SUKSES
            }
          }}
        />
      )}
    </Modal>
  );
}