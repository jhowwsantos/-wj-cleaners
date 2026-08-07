import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

export const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
];

/**
 * Compresses an image file (from device gallery or camera photo) to a square avatar JPEG (400x400).
 * Generates an immediate preview and uploads to Firebase Storage or returns an optimized data URL.
 */
export async function processAndUploadAvatar(
  file: File,
  userId: string,
  onPreview?: (dataUrl: string) => void
): Promise<string> {
  // Read raw file as Data URL
  const originalDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

  if (onPreview) {
    onPreview(originalDataUrl);
  }

  // Compress & resize image to 400x400 square JPEG canvas
  const compressedDataUrl = await new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const MAX_SIZE = 400;
      const width = img.width;
      const height = img.height;

      const minDim = Math.min(width, height);
      const startX = (width - minDim) / 2;
      const startY = (height - minDim) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = MAX_SIZE;
      canvas.height = MAX_SIZE;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          img,
          startX,
          startY,
          minDim,
          minDim,
          0,
          0,
          MAX_SIZE,
          MAX_SIZE
        );
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } else {
        resolve(originalDataUrl);
      }
    };
    img.onerror = () => resolve(originalDataUrl);
    img.src = originalDataUrl;
  });

  if (onPreview) {
    onPreview(compressedDataUrl);
  }

  // Attempt Firebase Storage upload
  try {
    if (storage) {
      const cleanUserId = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
      const storageRef = ref(storage, `avatars/${cleanUserId}_${Date.now()}.jpg`);
      await uploadString(storageRef, compressedDataUrl, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);
      if (downloadUrl) {
        return downloadUrl;
      }
    }
  } catch (err) {
    console.warn('Firebase Storage upload notice (using optimized data URL fallback):', err);
  }

  return compressedDataUrl;
}
