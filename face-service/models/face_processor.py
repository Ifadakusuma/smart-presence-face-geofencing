from deepface import DeepFace
import numpy as np


def validate_face_in_guide_box(facial_area: dict, image_shape: tuple):
    """
    Validasi apakah bounding box wajah berada di area benchmark / kotak panduan:
    1. Titik pusat wajah (center_x, center_y) berada di area tengah.
    2. Rasio luas wajah proporsional (tidak terlalu kecil/jauh, tidak terlalu besar/dekat).
    3. Sisi wajah tidak terpotong di tepi frame gambar.

    Args:
        facial_area: dict dengan key {'x', 'y', 'w', 'h'}
        image_shape: tuple dimensi gambar (height, width, ...)

    Raises:
        ValueError: jika posisi atau ukuran wajah melanggar batas kotak panduan
    """
    if not image_shape or len(image_shape) < 2:
        return

    img_h, img_w = image_shape[:2]
    if img_h <= 0 or img_w <= 0:
        return

    x = facial_area.get("x", 0)
    y = facial_area.get("y", 0)
    w = facial_area.get("w", 0)
    h = facial_area.get("h", 0)

    # 1. Boundary check (wajah terpotong di tepi frame kamera)
    margin = 20
    if x <= margin or y <= margin or (x + w) >= (img_w - margin) or (y + h) >= (img_h - margin):
        raise ValueError("Sebagian wajah terpotong tepi kamera. Posisikan wajah utuh di dalam kotak panduan.")

    # 2. Periksa sisi terluar wajah agar tidak meluber keluar garis panduan
    face_left = x / img_w
    face_right = (x + w) / img_w
    face_top = y / img_h
    face_bottom = (y + h) / img_h

    if face_left < 0.22 or face_right > 0.78:
        raise ValueError("Wajah melebihi batas garis panduan. Posisikan seluruh wajah tepat di dalam kotak.")

    if face_top < 0.12 or face_bottom > 0.88:
        raise ValueError("Wajah terlalu tinggi atau terlalu rendah. Posisikan wajah di dalam kotak panduan.")

    # 3. Hitung titik pusat wajah relatif terhadap dimensi gambar (Presisi: 38% - 62%)
    center_x = (x + w / 2.0) / img_w
    center_y = (y + h / 2.0) / img_h

    if not (0.38 <= center_x <= 0.62):
        raise ValueError("Wajah berada di luar area tengah. Posisikan wajah tepat di dalam kotak panduan.")

    if not (0.28 <= center_y <= 0.72):
        raise ValueError("Wajah terlalu tinggi atau terlalu rendah. Posisikan wajah di dalam kotak panduan.")

    # 4. Rasio luas wajah terhadap gambar (Face Area Ratio)
    face_ratio = (w * h) / (img_w * img_h)

    if face_ratio < 0.08:
        raise ValueError("Wajah terlalu jauh dari kamera. Harap mendekat ke kamera.")

    if face_ratio > 0.45:
        raise ValueError("Wajah terlalu dekat ke kamera. Harap sedikit menjauh.")


def generate_embedding(image_path_or_array, enforce_guide_box: bool = False):
    """
    Deteksi wajah (MTCNN) dan generate face embedding (ArcFace)
    dari 1 foto.

    Args:
        image_path_or_array: path ke file foto, ATAU numpy array gambar
                              (hasil decode dari base64)
        enforce_guide_box: jika True, validasi posisi wajah di dalam kotak panduan

    Returns:
        list[float]: embedding wajah (512 dimensi)

    Raises:
        ValueError: kalau wajah tidak terdeteksi di foto atau berada di luar kotak panduan
    """
    try:
        result = DeepFace.represent(
            img_path=image_path_or_array,
            model_name="ArcFace",
            detector_backend="mtcnn",
            enforce_detection=True,
        )
    except ValueError as e:
        # DeepFace lempar ValueError kalau wajah gak kedeteksi
        raise ValueError(f"Wajah tidak terdeteksi: {str(e)}")

    if not result:
        raise ValueError("Wajah tidak terdeteksi")

    # Ambil wajah pertama (asumsi 1 wajah per foto)
    face_data = result[0]

    # Validasi posisi dan ukuran wajah jika diminta (misal saat registrasi)
    if enforce_guide_box and isinstance(image_path_or_array, np.ndarray):
        facial_area = face_data.get("facial_area", {})
        if facial_area:
            validate_face_in_guide_box(facial_area, image_path_or_array.shape)

    embedding = face_data["embedding"]
    return embedding