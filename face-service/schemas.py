from pydantic import BaseModel, Field
from typing import Annotated, List, Optional

# Batas payload base64: mencerminkan limit multer API (10MB attendance, 5MB
# registrasi) setelah encoding base64 (~1.33x dari ukuran biner).
MAX_PHOTO_LENGTH = 14_000_000
MAX_REGISTRATION_PHOTO_LENGTH = 7_000_000


class RegisterRequest(BaseModel):
    userId: Optional[str] = Field(
        default=None,
        description="ID pengguna opsional untuk kompatibilitas dengan Express API"
    )
    photos: Annotated[
        List[Annotated[str, Field(max_length=MAX_REGISTRATION_PHOTO_LENGTH)]],
        Field(min_length=5, max_length=5),
    ] = Field(
        description="5 foto base64: depan, kiri, kanan, senyum, netral"
    )


class RegisterResponse(BaseModel):
    embeddings: List[List[float]]
    photoLabels: List[str]
    provider: str = "deepface"


class VerifyRequest(BaseModel):
    userId: Optional[str] = Field(
        default=None,
        description="ID pengguna opsional untuk kompatibilitas dengan Express API"
    )
    photo: Annotated[str, Field(min_length=1, max_length=MAX_PHOTO_LENGTH)] = Field(
        description="Foto aktual dalam format base64"
    )
    referenceEmbeddings: List[List[float]] = Field(
        min_length=1,
        max_length=5,
        description="1-5 embedding referensi hasil registrasi wajah"
    )


class VerifyResponse(BaseModel):
    verified: bool
    distance: float
    provider: str = "deepface"