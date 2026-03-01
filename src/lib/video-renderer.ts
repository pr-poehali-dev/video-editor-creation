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

    report(0, "Loading assets");

    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d")!;

    const assetMap = new Map<string, MediaAsset>();
    for (const a of assets) assetMap.set(a.id, a);

    const clips = this.collectAllClips(tracks);

    const imageCache = new Map<string, HTMLImageElement>();
    const audioBuffers = new Map<string, { element: HTMLAudioElement; url: string }>();

    let loadedCount = 0;
    const assetsToLoad = new Set<string>();
    for (const c of clips) {
      if (c.assetId) assetsToLoad.add(c.assetId);
    }

    for (const assetId of assetsToLoad) {
      if (this.cancelled) throw new Error("Отменено");
      const asset = assetMap.get(assetId);
      if (!asset) continue;

      report(loadedCount / Math.max(assetsToLoad.size, 1) * 0.2, `Loading ${asset.name}`);

      const resolvedUrl = this.resolveAssetUrl(assetId, asset.url);

      if (asset.type === "image") {
        const img = await this.loadImage(resolvedUrl);
        imageCache.set(assetId, img);
      } else if (asset.type === "audio") {
        audioBuffers.set(assetId, { element: new Audio(), url: resolvedUrl });
      } else if (asset.type === "video") {
        const img = await this.loadImage(resolvedUrl).catch(() => null);
        if (img) imageCache.set(assetId, img);
      }

      loadedCount++;
    }

    report(0.2, "Rendering");

    const isWebm = exportSettings.format === "webm" || exportSettings.format === "gif";
    const mimeType = isWebm ? "video/webm;codecs=vp9" : "video/webm;codecs=vp9";
    const supportedMime = MediaRecorder.isTypeSupported(mimeType)
      ? mimeType
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : "video/webm";

    const stream = this.canvas.captureStream(fps);

    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();

    const audioClips = clips.filter(c => {
      if (c.trackMuted) return false;
      const asset = c.assetId ? assetMap.get(c.assetId) : null;
      return asset?.type === "audio";
    });

    const activeAudioElements: Array<{ element: HTMLAudioElement; source: MediaElementAudioSourceNode; gainNode: GainNode; clip: ClipInfo }> = [];

    for (const ac of audioClips) {
      if (!ac.assetId) continue;
      const asset = assetMap.get(ac.assetId);
      if (!asset) continue;

      const audioEl = new Audio();
      audioEl.crossOrigin = "anonymous";
      audioEl.preload = "auto";
      audioEl.volume = 0;

      const audioSrc = this.resolveAssetUrl(ac.assetId!, asset.url);
      audioEl.src = audioSrc;

      await new Promise<void>((resolve) => {
        audioEl.addEventListener("canplaythrough", () => resolve(), { once: true });
        audioEl.addEventListener("error", () => resolve(), { once: true });
        audioEl.load();
        setTimeout(resolve, 3000);
      });

      try {
        const source = audioCtx.createMediaElementSource(audioEl);
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0;
        source.connect(gainNode);
        gainNode.connect(destination);
        activeAudioElements.push({ element: audioEl, source, gainNode, clip: ac });
      } catch {
        /* skip audio that can't be connected */
      }
    }

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

    const totalFrames = Math.ceil(totalDuration * fps);
    const frameDuration = 1 / fps;

    for (let frame = 0; frame <= totalFrames; frame++) {
      if (this.cancelled) {
        recorder.stop();
        audioCtx.close();
        throw new Error("Отменено");
      }

      const currentTime = frame * frameDuration;
      const progress = 0.2 + (frame / totalFrames) * 0.7;
      if (frame % Math.max(1, Math.floor(fps / 2)) === 0) {
        report(progress, "Rendering");
      }

      this.ctx.fillStyle = "#000000";
      this.ctx.fillRect(0, 0, width, height);

      for (const clip of clips) {
        if (currentTime < clip.startTime || currentTime >= clip.startTime + clip.duration) continue;
        const asset = clip.assetId ? assetMap.get(clip.assetId) : null;

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

      for (const aa of activeAudioElements) {
        const clip = aa.clip;
        if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
          const clipOffset = currentTime - clip.startTime;
          if (aa.element.paused) {
            aa.element.currentTime = clipOffset;
            aa.element.play().catch(() => {});
          }
          aa.gainNode.gain.value = clip.volume;
        } else {
          if (!aa.element.paused) {
            aa.element.pause();
          }
          aa.gainNode.gain.value = 0;
        }
      }

      await new Promise(r => setTimeout(r, frameDuration * 50));
    }

    report(0.9, "Reading output");

    for (const aa of activeAudioElements) {
      aa.element.pause();
      aa.gainNode.gain.value = 0;
    }

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    await audioCtx.close();

    const ext = "webm";
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const fileName = `${exportSettings.format === "gif" ? "animation" : "video"}_${Date.now()}.${ext}`;

    report(1, "Complete");

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