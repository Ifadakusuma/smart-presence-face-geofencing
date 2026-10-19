import numpy as np


def cosine_distance(embedding_a, embedding_b):
    """
    Hitung cosine distance antara 2 embedding.
    distance = 1 - cosine_similarity

    Returns:
        float: nilai antara 0 sampai 2 (makin kecil = makin mirip)
    """
    a = np.array(embedding_a)
    b = np.array(embedding_b)

    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 1.0  # kondisi ekstrem, anggap distance maksimal (gak mirip)

    similarity = dot_product / (norm_a * norm_b)
    distance = 1 - similarity

    return float(distance)


def find_best_match(actual_embedding, reference_embeddings):
    """
    Bandingkan 1 embedding aktual terhadap beberapa embedding referensi,
    ambil distance TERKECIL (paling mirip).

    Args:
        actual_embedding: embedding hasil foto absensi (list[float])
        reference_embeddings: list of embeddings referensi (list[list[float]])

    Returns:
        dict: { "best_distance": float, "best_index": int }
    """
    if not reference_embeddings:
        raise ValueError("Tidak ada embedding referensi untuk dibandingkan")

    distances = [
        cosine_distance(actual_embedding, ref) for ref in reference_embeddings
    ]

    best_index = int(np.argmin(distances))  # <- argMIN, bukan argMAX
    best_distance = distances[best_index]

    return {"best_distance": best_distance, "best_index": best_index}