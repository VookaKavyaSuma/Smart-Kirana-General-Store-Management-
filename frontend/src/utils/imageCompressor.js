/**
 * Client-Side Image Resizer & Compressor (FR-3.2)
 *
 * Rules:
 * - Accepted formats: JPG and PNG
 * - Limit: 5 MB maximum raw size
 * - Shrinks the image in the browser before upload to minimize bandwidth and storage
 */

export async function compressImage(
  rawFile,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.8
) {
  // 1. Format validation
  const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (!validTypes.includes(rawFile.type)) {
    throw new Error('Please select a JPG or PNG image file.');
  }

  // 2. 5 MB raw limit
  const MAX_BYTES = 5 * 1024 * 1024;
  if (rawFile.size > MAX_BYTES) {
    throw new Error('Image file is too large. Maximum size allowed is 5 MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio scaling
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context could not be created.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const outputType = rawFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Image compression failed.'));
              return;
            }

            const compressedFile = new File([blob], rawFile.name, {
              type: outputType,
              lastModified: Date.now(),
            });

            const previewUrl = URL.createObjectURL(blob);

            resolve({
              file: compressedFile,
              previewUrl,
              originalSize: rawFile.size,
              compressedSize: compressedFile.size,
              width,
              height,
            });
          },
          outputType,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image.'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(rawFile);
  });
}
