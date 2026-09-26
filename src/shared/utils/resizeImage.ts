// Scales a picture down so its longer side is at most `maxSide` and re-encodes it as JPEG.
// A photo straight from a phone camera is several megabytes; the resume shows it at 160 px.
export async function resizeToJpeg(file: File, maxSide = 800, quality = 0.88): Promise<Blob> {
  // Honours the EXIF rotation, so a portrait shot from a phone isn't lying on its side.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', quality),
  );
}
