const IMAGE_MAX_DIMENSION = 3840;
const IMAGE_TARGET_SIZE = 5 * 1024 * 1024;
const IMAGE_QUALITY_START = 0.92;
const IMAGE_QUALITY_MIN = 0.7;
const IMAGE_QUALITY_STEP = 0.05;

const VIDEO_TARGET_SIZE = 100 * 1024 * 1024;

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      type,
      quality
    );
  });
}

function calcScaledSize(w: number, h: number, maxDim: number): { width: number; height: number } {
  if (w <= maxDim && h <= maxDim) return { width: w, height: h };
  const ratio = Math.min(maxDim / w, maxDim / h);
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}

async function compressImage(file: File, targetSize: number): Promise<CompressionResult> {
  const originalSize = file.size;

  const skipTypes = ['image/gif', 'image/svg+xml'];
  if (skipTypes.includes(file.type)) {
    return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
  }

  try {
    const { width, height } = await getImageDimensions(file);
    const needsResize = width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION;
    const needsCompress = file.size > targetSize;

    if (!needsResize && !needsCompress) {
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }

    const scaled = calcScaledSize(width, height, IMAGE_MAX_DIMENSION);
    const canvas = document.createElement('canvas');
    canvas.width = scaled.width;
    canvas.height = scaled.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, scaled.width, scaled.height);
    URL.revokeObjectURL(img.src);

    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

    if (outputType === 'image/png') {
      const blob = await canvasToBlob(canvas, 'image/png', 1);
      if (blob.size < originalSize) {
        const compressed = new File([blob], file.name, { type: 'image/png', lastModified: Date.now() });
        return { file: compressed, originalSize, compressedSize: blob.size, wasCompressed: true };
      }
      return { file, originalSize, compressedSize: originalSize, wasCompressed: needsResize };
    }

    let quality = IMAGE_QUALITY_START;
    let bestBlob = await canvasToBlob(canvas, outputType, quality);

    while (bestBlob.size > targetSize && quality > IMAGE_QUALITY_MIN) {
      quality -= IMAGE_QUALITY_STEP;
      bestBlob = await canvasToBlob(canvas, outputType, quality);
    }

    if (bestBlob.size >= originalSize && !needsResize) {
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }

    const ext = outputType === 'image/jpeg' ? '.jpg' : '.png';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const compressed = new File([bestBlob], baseName + ext, { type: outputType, lastModified: Date.now() });
    return { file: compressed, originalSize, compressedSize: bestBlob.size, wasCompressed: true };
  } catch (e) {
    console.error('[compress] Image compression failed:', e);
    return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
  }
}

async function compressVideo(file: File, targetSize: number): Promise<CompressionResult> {
  const originalSize = file.size;

  if (file.size <= targetSize) {
    return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
  }

  try {
    if (file.type === 'video/mp4' || file.type === 'video/webm') {
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }

    const outputType = 'video/webm';
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = reject;
      video.src = url;
    });

    const canvas = document.createElement('canvas');
    const w = video.videoWidth;
    const h = video.videoHeight;
    const maxDim = 1920;
    const scaled = calcScaledSize(w, h, maxDim);
    canvas.width = scaled.width;
    canvas.height = scaled.height;

    const stream = canvas.captureStream(30);

    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    } catch {
      // no audio track
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm',
      videoBitsPerSecond: Math.min(4_000_000, (targetSize * 8) / Math.max(1, video.duration)),
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const ctx = canvas.getContext('2d')!;

    const recordingDone = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: outputType });
        resolve(blob);
      };
    });

    recorder.start(100);
    video.play();

    const drawFrame = () => {
      if (video.paused || video.ended) {
        recorder.stop();
        return;
      }
      ctx.drawImage(video, 0, 0, scaled.width, scaled.height);
      requestAnimationFrame(drawFrame);
    };
    requestAnimationFrame(drawFrame);

    video.onended = () => recorder.stop();
    const blob = await recordingDone;

    URL.revokeObjectURL(url);

    if (blob.size >= originalSize) {
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const compressed = new File([blob], baseName + '.webm', { type: outputType, lastModified: Date.now() });
    return { file: compressed, originalSize, compressedSize: blob.size, wasCompressed: true };
  } catch (e) {
    console.error('[compress] Video compression failed:', e);
    return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
  }
}

export async function compressFile(file: File, options?: { imageTargetSize?: number; videoTargetSize?: number }): Promise<CompressionResult> {
  const imageTarget = options?.imageTargetSize ?? IMAGE_TARGET_SIZE;
  const videoTarget = options?.videoTargetSize ?? VIDEO_TARGET_SIZE;

  if (file.type.startsWith('image/')) {
    return compressImage(file, imageTarget);
  }

  if (file.type.startsWith('video/')) {
    return compressVideo(file, videoTarget);
  }

  return { file, originalSize: file.size, compressedSize: file.size, wasCompressed: false };
}

export function formatCompressionInfo(result: CompressionResult): string {
  if (!result.wasCompressed) return '';
  const saved = result.originalSize - result.compressedSize;
  const pct = Math.round((saved / result.originalSize) * 100);
  const formatSize = (b: number) => {
    if (b > 1e6) return (b / 1e6).toFixed(1) + ' МБ';
    if (b > 1e3) return (b / 1e3).toFixed(1) + ' КБ';
    return b + ' Б';
  };
  return `Сжато: ${formatSize(result.originalSize)} → ${formatSize(result.compressedSize)} (−${pct}%)`;
}

export default compressFile;
