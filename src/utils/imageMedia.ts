// Independent local media & image compression utility (no cloud uploads)

export interface ProcessedImageResult {
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  fileName: string;
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Math.round((base64.length * 3) / 4);
}

export async function compressImageFile(
  file: File,
  maxDimension = 1200,
  quality = 0.82
): Promise<ProcessedImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('خواندن فایل تصویر ناموفق بود.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('فایل انتخاب‌شده یک تصویر معتبر نیست.'));
      img.onload = () => {
        let targetW = img.naturalWidth;
        let targetH = img.naturalHeight;

        if (targetW > maxDimension || targetH > maxDimension) {
          const ratio = Math.min(maxDimension / targetW, maxDimension / targetH);
          targetW = Math.max(1, Math.round(targetW * ratio));
          targetH = Math.max(1, Math.round(targetH * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('امکان پردازش تصویر در مرورگر وجود ندارد.'));
          return;
        }

        ctx.drawImage(img, 0, 0, targetW, targetH);

        // Preserve transparency for PNG logos if small; use JPEG otherwise for compact JSON transfer
        const keepPng = file.type === 'image/png' && maxDimension <= 512;
        const outputMime = keepPng ? 'image/png' : 'image/jpeg';
        const dataUrl = keepPng
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', quality);

        resolve({
          dataUrl,
          mimeType: outputMime,
          sizeBytes: estimateDataUrlBytes(dataUrl),
          width: targetW,
          height: targetH,
          fileName: file.name,
        });
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export function estimateJsonSizeBytes(payload: unknown): number {
  const str = JSON.stringify(payload);
  return new Blob([str]).size;
}
