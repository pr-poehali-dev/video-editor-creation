import type {
  Track,
  MediaAsset,
  ExportSettings,
} from "@/types/editor";
import { media as mediaApi } from "@/lib/api";

type ProgressCallback = (progress: number, stage: string) => void;

interface RenderResult {
  blob: Blob;
  url: string;
  fileName: string;
}

const QUALITY_MAP: Record<ExportSettings["quality"], { width: number; height: number; bitrate: number }> = {
  low: { width: 1280, height: 720, bitrate: 2_000_000 },
  medium: { width: 1920, height: 1080, bitrate: 5_000_000 },
  high: { width: 1920, height: 1080, bitrate: 8_000_000 },
  ultra: { width: 1920, height: 1080, bitrate: 12_000_000 },
};

interface ClipInfo {
  assetId?: string;
  type: string;
  startTime: number;
  duration: number;
  opacity: number;
  volume: number;
  name: string;
  text?: string;
  fontSize?: number;
  fontColor?: string;
  trackMuted: boolean;
}

export class VideoRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private cancelled = false;

  async init(): Promise<void> {
    this.cancelled = false;
  }

  async render(
    tracks: Track[],
    assets: MediaAsset[],
    exportSettings: ExportSettings,
    onProgress?: ProgressCallback
  ): Promise<RenderResult> {
    this.cancelled = false;

    const report = (progress: number, stage: string) => {
      onProgress?.(Math.min(Math.max(progress, 0), 1), stage);
    };

    const quality = QUALITY_MAP[exportSettings.quality];
    const [width, height] = this.parseResolution(exportSettings.resolution, quality.width, quality.height);
    const fps = Math.min(exportSettings.fps || 30, 30);
    const totalDuration = this.computeTotalDuration(tracks);

    if (totalDuration <= 0) {
      throw new Error("Таймлайн пуст — нечего рендерить");
    }

    report(0, "Загрузка ресурсов");

    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d")!;

    const assetMap = new Map<string, MediaAsset>();
    for (const a of assets) assetMap.set(a.id, a);

    const clips = this.collectAllClips(tracks);

    const imageCache = new Map<string, HTMLImageElement>();

    let loadedCount = 0;
    const assetsToLoad = new Set<string>();
    for (const c of clips) {
      if (c.assetId) assetsToLoad.add(c.assetId);
    }

    for (const assetId of assetsToLoad) {
      if (this.cancelled) throw new Error("Отменено");
      const asset = assetMap.get(assetId);
      if (!asset) continue;

      report(loadedCount / Math.max(assetsToLoad.size, 1) * 0.2, `Загрузка ${asset.name}`);

      const resolvedUrl = this.resolveAssetUrl(assetId, asset.url);

      if (asset.type === "image") {
        const img = await this.loadImage(resolvedUrl);
        imageCache.set(assetId, img);
      } else if (asset.type === "video") {
        const img = await this.loadImage(resolvedUrl).catch(() => null);
        if (img) imageCache.set(assetId, img);
      }

      loadedCount++;
    }

    report(0.2, "Подготовка аудио");

    const isWebm = exportSettings.format === "webm" || exportSettings.format === "gif";
    const mimeType = isWebm ? "video/webm;codecs=vp9,opus" : "video/webm;codecs=vp9,opus";
    const supportedMime = MediaRecorder.isTypeSupported(mimeType)
      ? mimeType
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";

    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();

    const audioClips = clips.filter(c => {
      if (c.trackMuted) return false;
      const asset = c.assetId ? assetMap.get(c.assetId) : null;
      return asset?.type === "audio";
    });

    const audioBufferMap = new Map<string, AudioBuffer>();

    for (const ac of audioClips) {
      if (!ac.assetId || audioBufferMap.has(ac.assetId)) continue;
      const asset = assetMap.get(ac.assetId);
      if (!asset) continue;

      const audioSrc = this.resolveAssetUrl(ac.assetId, asset.url);

      try {
        const response = await fetch(audioSrc);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioBufferMap.set(ac.assetId, audioBuffer);
      } catch {
        console.warn(`Не удалось загрузить аудио: ${asset.name}`);
      }
    }

    const scheduledSources: AudioBufferSourceNode[] = [];
    const scheduledGains: GainNode[] = [];

    const stream = this.canvas.captureStream(fps);
    for (const audioTrack of destination.stream.getAudioTracks()) {
      stream.addTrack(audioTrack);
    }

    const bitrate = exportSettings.bitrate > 0 ? exportSettings.bitrate * 1000 : quality.bitrate;
    const recorder = new MediaRecorder(stream, {
      mimeType: supportedMime,
      videoBitsPerSecond: bitrate,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.start(100);

    const audioCtxStartTime = audioCtx.currentTime;

    for (const ac of audioClips) {
      if (!ac.assetId) continue;
      const buffer = audioBufferMap.get(ac.assetId);
      if (!buffer) continue;

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = ac.volume;

      source.connect(gainNode);
      gainNode.connect(destination);

      const clipAudioDuration = Math.min(ac.duration, buffer.duration);
      source.start(audioCtxStartTime + ac.startTime, 0, clipAudioDuration);

      scheduledSources.push(source);
      scheduledGains.push(gainNode);
    }

    report(0.25, "Рендеринг видео");

    const totalFrames = Math.ceil(totalDuration * fps);
    const frameDurationMs = 1000 / fps;
    const renderStartTime = performance.now();

    for (let frame = 0; frame <= totalFrames; frame++) {
      if (this.cancelled) {
        recorder.stop();
        scheduledSources.forEach(s => { try { s.stop(); } catch (_e) { /* stopped */ } });
        await audioCtx.close();
        throw new Error("Отменено");
      }

      const currentTime = frame / fps;
      const progress = 0.25 + (frame / totalFrames) * 0.65;
      if (frame % Math.max(1, Math.floor(fps / 2)) === 0) {
        report(progress, "Рендеринг видео");
      }

      this.ctx.fillStyle = "#000000";
      this.ctx.fillRect(0, 0, width, height);

      for (const clip of clips) {
        if (currentTime < clip.startTime || currentTime >= clip.startTime + clip.duration) continue;

        if ((clip.type === "image" || clip.type === "video") && clip.assetId) {
          const img = imageCache.get(clip.assetId);
          if (img) {
            this.ctx.globalAlpha = clip.opacity;
            this.drawImageFit(img, width, height);
            this.ctx.globalAlpha = 1;
          }
        }

        if (clip.type === "text") {
          this.ctx.globalAlpha = clip.opacity;
          const fontSize = Math.round((clip.fontSize || 48) * (height / 1080));
          this.ctx.font = `bold ${fontSize}px sans-serif`;
          this.ctx.fillStyle = clip.fontColor || "#ffffff";
          this.ctx.textAlign = "center";
          this.ctx.textBaseline = "middle";
          this.ctx.shadowColor = "rgba(0,0,0,0.7)";
          this.ctx.shadowBlur = 8;
          this.ctx.fillText(clip.text || clip.name, width / 2, height / 2);
          this.ctx.shadowBlur = 0;
          this.ctx.globalAlpha = 1;
        }
      }

      const targetTime = renderStartTime + frame * frameDurationMs;
      const now = performance.now();
      const sleepMs = targetTime - now;
      if (sleepMs > 1) {
        await new Promise(r => setTimeout(r, sleepMs));
      }
    }

    report(0.92, "Завершение записи");

    scheduledSources.forEach(s => { try { s.stop(); } catch (_e) { /* stopped */ } });

    const audioEndTime = audioCtxStartTime + totalDuration;
    const remainingAudioMs = (audioEndTime - audioCtx.currentTime) * 1000;
    if (remainingAudioMs > 0) {
      await new Promise(r => setTimeout(r, Math.min(remainingAudioMs + 200, 2000)));
    }

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    await audioCtx.close();

    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const fileName = `${exportSettings.format === "gif" ? "animation" : "video"}_${Date.now()}.webm`;

    report(1, "Готово");

    return { blob, url, fileName };
  }

  terminate(): void {
    this.cancelled = true;
    this.canvas = null;
    this.ctx = null;
  }

  private parseResolution(resolution: string, defaultW: number, defaultH: number): [number, number] {
    const match = resolution.match(/^(\d+)\s*[xX×]\s*(\d+)$/);
    if (match) {
      const w = parseInt(match[1], 10);
      const h = parseInt(match[2], 10);
      if (w <= 1920 && h <= 1080) return [w, h];
      return [1920, 1080];
    }
    return [defaultW, defaultH];
  }

  private computeTotalDuration(tracks: Track[]): number {
    let max = 0;
    for (const track of tracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + clip.duration;
        if (end > max) max = end;
      }
    }
    return max;
  }

  private collectAllClips(tracks: Track[]): ClipInfo[] {
    const result: ClipInfo[] = [];
    for (const track of tracks) {
      if (!track.visible && track.type !== "audio") continue;
      for (const clip of track.clips) {
        result.push({
          assetId: clip.assetId,
          type: clip.type || track.type,
          startTime: clip.startTime,
          duration: clip.duration,
          opacity: clip.opacity ?? 1,
          volume: clip.volume ?? 1,
          name: clip.name,
          text: clip.text,
          fontSize: clip.fontSize,
          fontColor: clip.fontColor,
          trackMuted: track.muted,
        });
      }
    }
    return result.sort((a, b) => a.startTime - b.startTime);
  }

  private resolveAssetUrl(assetId: string, originalUrl: string): string {
    if (assetId.startsWith("server_")) {
      const serverId = parseInt(assetId.replace("server_", ""), 10);
      if (!isNaN(serverId)) {
        return mediaApi.proxyUrl(serverId);
      }
    }
    return originalUrl;
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${url}`));
      img.src = url;
    });
  }

  private drawImageFit(img: HTMLImageElement, canvasW: number, canvasH: number) {
    if (!this.ctx) return;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = canvasW / canvasH;
    let drawW: number, drawH: number, drawX: number, drawY: number;

    if (imgRatio > canvasRatio) {
      drawW = canvasW;
      drawH = canvasW / imgRatio;
      drawX = 0;
      drawY = (canvasH - drawH) / 2;
    } else {
      drawH = canvasH;
      drawW = canvasH * imgRatio;
      drawX = (canvasW - drawW) / 2;
      drawY = 0;
    }

    this.ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }
}

export default VideoRenderer;