import type {
  Track,
  MediaAsset,
  ExportSettings,
} from "@/types/editor";
import { media as mediaApi } from "@/lib/api";
import { ensureFontLoaded } from "@/lib/google-fonts";
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

type ProgressCallback = (progress: number, stage: string) => void;

interface RenderResult {
  blob: Blob;
  url: string;
  fileName: string;
}

const FADE_DURATION = 0.5;

const QUALITY_MAP: Record<ExportSettings["quality"], { width: number; height: number; bitrate: number }> = {
  low: { width: 1280, height: 720, bitrate: 2_000_000 },
  medium: { width: 1920, height: 1080, bitrate: 5_000_000 },
  high: { width: 1920, height: 1080, bitrate: 8_000_000 },
  ultra: { width: 1920, height: 1080, bitrate: 12_000_000 },
};

interface ClipFilter {
  name: string;
  params: Record<string, number | string | boolean>;
}

interface ClipTransition {
  type: string;
  duration: number;
}

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
  fontFamily?: string;
  fontColor?: string;
  fontWeight?: number;
  textShadow?: number;
  textStroke?: number;
  textStrokeColor?: string;
  textBg?: boolean;
  textBgColor?: string;
  textBgOpacity?: number;
  trackMuted: boolean;
  filters: ClipFilter[];
  transition?: ClipTransition;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  fitMode: 'contain' | 'cover' | 'fill';
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

    for (const c of clips) {
      if (c.type === "text" && c.fontFamily) {
        ensureFontLoaded(c.fontFamily);
      }
    }
    await new Promise(r => setTimeout(r, 300));

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

    const audioClips = clips.filter(c => {
      if (c.trackMuted) return false;
      const asset = c.assetId ? assetMap.get(c.assetId) : null;
      return asset?.type === "audio";
    });

    const bitrate = exportSettings.bitrate > 0 ? exportSettings.bitrate * 1000 : quality.bitrate;

    const useMp4 =
      exportSettings.format === "mp4" &&
      typeof VideoEncoder !== "undefined" &&
      typeof VideoFrame !== "undefined";

    if (exportSettings.format === "mp4" && !useMp4) {
      console.warn("WebCodecs API (VideoEncoder) is not available. Falling back to WebM export.");
    }

    if (exportSettings.format === "gif") {
      return this.renderGif(
        clips, imageCache,
        width, height, fps, totalDuration,
        report
      );
    } else if (useMp4) {
      return this.renderMp4(
        clips, audioClips, assetMap, imageCache,
        width, height, fps, totalDuration, bitrate,
        exportSettings, report
      );
    } else {
      return this.renderWebm(
        clips, audioClips, assetMap, imageCache,
        width, height, fps, totalDuration, bitrate,
        exportSettings, report
      );
    }
  }

  private async renderGif(
    clips: ClipInfo[],
    imageCache: Map<string, HTMLImageElement>,
    width: number,
    height: number,
    fps: number,
    totalDuration: number,
    report: (progress: number, stage: string) => void
  ): Promise<RenderResult> {
    const canvas = this.canvas!;
    const ctx = this.ctx!;
    const totalFrames = Math.ceil(totalDuration * fps);
    const delayMs = Math.round(1000 / fps);

    const gif = GIFEncoder();

    report(0.25, "Рендеринг GIF");

    for (let frame = 0; frame <= totalFrames; frame++) {
      if (this.cancelled) throw new Error("Отменено");

      const currentTime = frame / fps;
      const progress = 0.25 + (frame / totalFrames) * 0.65;
      if (frame % Math.max(1, Math.floor(fps / 2)) === 0) {
        report(progress, "Рендеринг GIF");
      }

      this.renderFrameToCanvas(ctx, canvas, clips, imageCache, currentTime, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const palette = quantize(imageData.data, 256);
      const index = applyPalette(imageData.data, palette);

      gif.writeFrame(index, width, height, { palette, delay: delayMs });

      if (frame % 10 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    report(0.92, "Финализация GIF");

    gif.finish();

    const blob = new Blob([gif.bytes()], { type: "image/gif" });
    const url = URL.createObjectURL(blob);
    const fileName = `animation_${Date.now()}.gif`;

    report(1, "Готово");

    return { blob, url, fileName };
  }

  private async renderMp4(
    clips: ClipInfo[],
    audioClips: ClipInfo[],
    assetMap: Map<string, MediaAsset>,
    imageCache: Map<string, HTMLImageElement>,
    width: number,
    height: number,
    fps: number,
    totalDuration: number,
    bitrate: number,
    exportSettings: ExportSettings,
    report: (progress: number, stage: string) => void
  ): Promise<RenderResult> {
    const canvas = this.canvas!;
    const ctx = this.ctx!;
    const totalFrames = Math.ceil(totalDuration * fps);
    const frameDurationUs = Math.round(1_000_000 / fps);

    const videoConfig: VideoEncoderConfig = {
      codec: "avc1.42001f",
      width,
      height,
      bitrate,
      framerate: fps,
    };

    if (VideoEncoder.isConfigSupported) {
      try {
        const support = await VideoEncoder.isConfigSupported(videoConfig);
        if (!support.supported) {
          console.warn("VideoEncoder config not supported, falling back to WebM");
          return this.renderWebm(clips, audioClips, assetMap, imageCache, width, height, fps, totalDuration, bitrate, exportSettings, report);
        }
      } catch {
        console.warn("isConfigSupported check failed, falling back to WebM");
        return this.renderWebm(clips, audioClips, assetMap, imageCache, width, height, fps, totalDuration, bitrate, exportSettings, report);
      }
    }

    report(0.22, "Загрузка аудио");

    const tempAudioCtx = new AudioContext();
    const audioBufferMap = new Map<string, AudioBuffer>();

    for (const ac of audioClips) {
      if (!ac.assetId || audioBufferMap.has(ac.assetId)) continue;
      const asset = assetMap.get(ac.assetId);
      if (!asset) continue;

      const audioSrc = this.resolveAssetUrl(ac.assetId, asset.url);
      try {
        const response = await fetch(audioSrc);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await tempAudioCtx.decodeAudioData(arrayBuffer);
        audioBufferMap.set(ac.assetId, audioBuffer);
      } catch {
        console.warn(`Не удалось загрузить аудио: ${asset.name}`);
      }
    }

    await tempAudioCtx.close();

    const hasAudio = audioClips.some(ac => ac.assetId && audioBufferMap.has(ac.assetId));
    const audioSampleRate = 48000;
    const audioChannels = 2;

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width,
        height,
        frameRate: fps,
      },
      ...(hasAudio ? {
        audio: {
          codec: 'aac',
          numberOfChannels: audioChannels,
          sampleRate: audioSampleRate,
        },
      } : {}),
      fastStart: 'in-memory',
    });

    let videoEncoderFailed = false;

    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
      },
      error: (e) => {
        console.error("VideoEncoder error:", e);
        videoEncoderFailed = true;
      },
    });

    videoEncoder.configure(videoConfig);

    await new Promise(r => setTimeout(r, 50));

    if (videoEncoderFailed || videoEncoder.state === 'closed') {
      console.warn("VideoEncoder closed after configure, falling back to WebM");
      return this.renderWebm(clips, audioClips, assetMap, imageCache, width, height, fps, totalDuration, bitrate, exportSettings, report);
    }

    report(0.25, "Рендеринг видео (MP4)");

    for (let frame = 0; frame <= totalFrames; frame++) {
      if (this.cancelled) {
        videoEncoder.close();
        throw new Error("Отменено");
      }

      if (videoEncoderFailed || videoEncoder.state === 'closed') {
        console.warn("VideoEncoder closed mid-render, falling back to WebM");
        return this.renderWebm(clips, audioClips, assetMap, imageCache, width, height, fps, totalDuration, bitrate, exportSettings, report);
      }

      const currentTime = frame / fps;
      const progress = 0.25 + (frame / totalFrames) * 0.60;
      if (frame % Math.max(1, Math.floor(fps / 2)) === 0) {
        report(progress, "Рендеринг видео (MP4)");
      }

      if (videoEncoder.encodeQueueSize > 10) {
        await new Promise<void>(resolve => {
          const check = () => {
            if (videoEncoderFailed || videoEncoder.state === 'closed' || videoEncoder.encodeQueueSize <= 5) {
              resolve();
            } else {
              setTimeout(check, 1);
            }
          };
          check();
        });
        if (videoEncoderFailed || videoEncoder.state === 'closed') {
          console.warn("VideoEncoder closed during backpressure, falling back to WebM");
          return this.renderWebm(clips, audioClips, assetMap, imageCache, width, height, fps, totalDuration, bitrate, exportSettings, report);
        }
      }

      this.renderFrameToCanvas(ctx, canvas, clips, imageCache, currentTime, width, height);

      const videoFrame = new VideoFrame(canvas, {
        timestamp: frame * frameDurationUs,
      });

      const keyFrame = frame % (fps * 2) === 0;
      videoEncoder.encode(videoFrame, { keyFrame });
      videoFrame.close();

      if (frame % 30 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    await videoEncoder.flush();
    videoEncoder.close();

    // --- Render and encode audio ---
    if (hasAudio) {
      report(0.88, "Кодирование аудио (AAC)");

      const offlineCtx = new OfflineAudioContext(
        audioChannels,
        Math.ceil(totalDuration * audioSampleRate),
        audioSampleRate
      );

      for (const ac of audioClips) {
        if (!ac.assetId) continue;
        const buffer = audioBufferMap.get(ac.assetId);
        if (!buffer) continue;

        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;

        const gainNode = offlineCtx.createGain();
        gainNode.gain.value = ac.volume;

        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);

        const clipAudioDuration = Math.min(ac.duration, buffer.duration);
        source.start(ac.startTime, 0, clipAudioDuration);
      }

      const renderedAudioBuffer = await offlineCtx.startRendering();

      try {
        let audioEncoderFailed = false;

        const audioEncoder = new AudioEncoder({
          output: (chunk, meta) => {
            muxer.addAudioChunk(chunk, meta);
          },
          error: (e) => {
            console.error("AudioEncoder error:", e);
            audioEncoderFailed = true;
          },
        });

        audioEncoder.configure({
          codec: 'mp4a.40.2',
          sampleRate: audioSampleRate,
          numberOfChannels: audioChannels,
          bitrate: 128_000,
        });

        const totalSamples = renderedAudioBuffer.length;
        const chunkSize = 1024;

        for (let offset = 0; offset < totalSamples; offset += chunkSize) {
          if (this.cancelled) {
            audioEncoder.close();
            throw new Error("Отменено");
          }
          if (audioEncoderFailed) break;

          const framesInChunk = Math.min(chunkSize, totalSamples - offset);

          const audioData = new AudioData({
            format: 'f32-planar',
            sampleRate: audioSampleRate,
            numberOfFrames: framesInChunk,
            numberOfChannels: audioChannels,
            timestamp: Math.round((offset / audioSampleRate) * 1_000_000),
            data: this.createPlanarAudioBuffer(renderedAudioBuffer, offset, framesInChunk, audioChannels),
          });

          audioEncoder.encode(audioData);
          audioData.close();

          if ((offset / chunkSize) % 50 === 0) {
            await new Promise(r => setTimeout(r, 0));
          }
        }

        if (!audioEncoderFailed) {
          await audioEncoder.flush();
        }
        audioEncoder.close();
      } catch (audioErr) {
        console.warn("Audio encoding failed, producing video without audio:", audioErr);
      }
    }

    report(0.95, "Финализация MP4");

    muxer.finalize();

    const mp4Buffer = muxer.target.buffer;
    const blob = new Blob([mp4Buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    const fileName = `video_${Date.now()}.mp4`;

    report(1, "Готово");

    return { blob, url, fileName };
  }

  private createPlanarAudioBuffer(
    audioBuffer: AudioBuffer,
    offset: number,
    frameCount: number,
    channels: number,
  ): Float32Array {
    const planar = new Float32Array(frameCount * channels);
    for (let ch = 0; ch < channels; ch++) {
      const channelData = ch < audioBuffer.numberOfChannels
        ? audioBuffer.getChannelData(ch)
        : audioBuffer.getChannelData(0);
      const destOffset = ch * frameCount;
      for (let i = 0; i < frameCount; i++) {
        planar[destOffset + i] = channelData[offset + i];
      }
    }
    return planar;
  }

  private renderFrameToCanvas(
    ctx: CanvasRenderingContext2D,
    _canvas: HTMLCanvasElement,
    clips: ClipInfo[],
    imageCache: Map<string, HTMLImageElement>,
    currentTime: number,
    width: number,
    height: number,
  ): void {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    for (const clip of clips) {
      if (currentTime < clip.startTime || currentTime >= clip.startTime + clip.duration) continue;

      const elapsed = currentTime - clip.startTime;
      const remaining = clip.duration - elapsed;
      let fadeAlpha = clip.opacity;

      if (clip.duration > 0.2 && (clip.type === "image" || clip.type === "video")) {
        const fadeDur = Math.min(FADE_DURATION, clip.duration / 3);
        if (elapsed < fadeDur) {
          fadeAlpha = clip.opacity * (elapsed / fadeDur);
        } else if (remaining < fadeDur) {
          fadeAlpha = clip.opacity * (remaining / fadeDur);
        }
      }

      if (clip.transition && clip.transition.duration > 0 && elapsed < clip.transition.duration) {
        const tProg = elapsed / clip.transition.duration;
        fadeAlpha = this.applyTransitionAlpha(clip.transition.type, tProg, fadeAlpha);
      }

      if ((clip.type === "image" || clip.type === "video") && clip.assetId) {
        const img = imageCache.get(clip.assetId);
        if (img) {
          ctx.save();
          ctx.globalAlpha = fadeAlpha;
          this.applyCanvasFilters(clip.filters, width, height);
          this.applyTransitionTransform(clip.transition, elapsed, width, height);
          this.drawImageWithTransform(img, width, height, clip);
          ctx.restore();
        }
      }

      if (clip.type === "text") {
        ctx.save();
        ctx.globalAlpha = clip.opacity;
        const fontSize = Math.round((clip.fontSize || 48) * (height / 1080));
        const weight = clip.fontWeight || 600;
        const family = clip.fontFamily ? `"${clip.fontFamily}", sans-serif` : "sans-serif";
        ctx.font = `${weight} ${fontSize}px ${family}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const textContent = clip.text || clip.name;
        const cx = width / 2;
        const cy = height / 2;

        if (clip.textBg) {
          const metrics = ctx.measureText(textContent);
          const tw = metrics.width + fontSize * 0.6;
          const th = fontSize * 1.4;
          ctx.save();
          ctx.globalAlpha = clip.textBgOpacity ?? 0.6;
          ctx.fillStyle = clip.textBgColor || "#000000";
          ctx.beginPath();
          ctx.roundRect(cx - tw / 2, cy - th / 2, tw, th, fontSize * 0.15);
          ctx.fill();
          ctx.restore();
          ctx.globalAlpha = clip.opacity;
        }

        const shadowBlur = clip.textShadow ?? 8;
        if (shadowBlur > 0) {
          ctx.shadowColor = "rgba(0,0,0,0.7)";
          ctx.shadowBlur = shadowBlur;
        }

        const stroke = clip.textStroke ?? 0;
        if (stroke > 0) {
          ctx.strokeStyle = clip.textStrokeColor || "#000000";
          ctx.lineWidth = stroke * 2;
          ctx.lineJoin = "round";
          ctx.strokeText(textContent, cx, cy);
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = clip.fontColor || "#ffffff";
        ctx.fillText(textContent, cx, cy);
        ctx.restore();
      }
    }
  }

  private async renderWebm(
    clips: ClipInfo[],
    audioClips: ClipInfo[],
    assetMap: Map<string, MediaAsset>,
    imageCache: Map<string, HTMLImageElement>,
    width: number,
    height: number,
    fps: number,
    totalDuration: number,
    bitrate: number,
    exportSettings: ExportSettings,
    report: (progress: number, stage: string) => void
  ): Promise<RenderResult> {
    const canvas = this.canvas!;
    const ctx = this.ctx!;

    const mimeType = "video/webm;codecs=vp9,opus";
    const supportedMime = MediaRecorder.isTypeSupported(mimeType)
      ? mimeType
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";

    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();

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

    const stream = canvas.captureStream(fps);
    for (const audioTrack of destination.stream.getAudioTracks()) {
      stream.addTrack(audioTrack);
    }

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

      this.renderFrameToCanvas(ctx, canvas, clips, imageCache, currentTime, width, height);

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
          fontFamily: clip.fontFamily,
          fontColor: clip.fontColor,
          fontWeight: clip.fontWeight,
          textShadow: clip.textShadow,
          textStroke: clip.textStroke,
          textStrokeColor: clip.textStrokeColor,
          textBg: clip.textBg,
          textBgColor: clip.textBgColor,
          textBgOpacity: clip.textBgOpacity,
          trackMuted: track.muted,
          filters: (clip.filters || []).map(f => ({ name: f.name, params: f.params })),
          transition: clip.transition,
          positionX: clip.positionX ?? 50,
          positionY: clip.positionY ?? 50,
          scale: clip.scale ?? 100,
          rotation: clip.rotation ?? 0,
          fitMode: clip.fitMode || 'contain',
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

  private drawImageWithTransform(
    img: HTMLImageElement,
    canvasW: number,
    canvasH: number,
    clip: ClipInfo,
  ) {
    if (!this.ctx) return;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = canvasW / canvasH;
    let drawW: number, drawH: number, drawX: number, drawY: number;

    if (clip.fitMode === 'fill') {
      drawW = canvasW;
      drawH = canvasH;
      drawX = 0;
      drawY = 0;
    } else if (clip.fitMode === 'cover') {
      if (imgRatio > canvasRatio) {
        drawH = canvasH;
        drawW = canvasH * imgRatio;
      } else {
        drawW = canvasW;
        drawH = canvasW / imgRatio;
      }
      drawX = (canvasW - drawW) / 2;
      drawY = (canvasH - drawH) / 2;
    } else {
      if (imgRatio > canvasRatio) {
        drawW = canvasW;
        drawH = canvasW / imgRatio;
      } else {
        drawH = canvasH;
        drawW = canvasH * imgRatio;
      }
      drawX = (canvasW - drawW) / 2;
      drawY = (canvasH - drawH) / 2;
    }

    const hasTransform = clip.positionX !== 50 || clip.positionY !== 50 || clip.scale !== 100 || clip.rotation !== 0;
    if (hasTransform) {
      const offsetX = (clip.positionX - 50) / 100 * canvasW;
      const offsetY = (clip.positionY - 50) / 100 * canvasH;
      const s = clip.scale / 100;
      const centerX = canvasW / 2 + offsetX;
      const centerY = canvasH / 2 + offsetY;
      this.ctx.translate(centerX, centerY);
      this.ctx.rotate((clip.rotation * Math.PI) / 180);
      this.ctx.scale(s, s);
      this.ctx.translate(-canvasW / 2, -canvasH / 2);
    }

    this.ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }

  private applyCanvasFilters(filters: ClipFilter[], _w: number, _h: number) {
    if (!this.ctx || !filters || filters.length === 0) return;
    const parts: string[] = [];
    for (const f of filters) {
      const intensity = typeof f.params?.intensity === "number" ? f.params.intensity : 50;
      const norm = intensity / 100;
      switch (f.name) {
        case "Яркость": parts.push(`brightness(${0.5 + norm})`); break;
        case "Контраст": parts.push(`contrast(${0.5 + norm})`); break;
        case "Насыщенность": parts.push(`saturate(${norm * 2})`); break;
        case "Температура": parts.push(`sepia(${norm * 0.5}) saturate(${1 + norm * 0.3})`); break;
        case "Размытие": parts.push(`blur(${norm * 8}px)`); break;
        case "Резкость": parts.push(`contrast(${1 + norm * 0.3})`); break;
        case "Шум": parts.push(`contrast(${1 + norm * 0.1}) brightness(${1 - norm * 0.05})`); break;
        case "Глитч": parts.push(`hue-rotate(${norm * 90}deg) saturate(${1.5 + norm})`); break;
        case "Тёплый": parts.push("sepia(0.35) saturate(1.3) brightness(1.05)"); break;
        case "Холодный": parts.push("saturate(0.9) brightness(1.05) hue-rotate(15deg)"); break;
        case "Сепия": parts.push("sepia(0.8)"); break;
        case "Ч/Б": parts.push("grayscale(1)"); break;
        case "Негатив": parts.push("invert(1)"); break;
        case "Ретро": parts.push("sepia(0.4) contrast(1.1) brightness(0.95) saturate(0.85)"); break;
        case "Кинематограф": parts.push("contrast(1.2) saturate(0.85) brightness(0.95)"); break;
        case "Блёклый": parts.push("contrast(0.85) brightness(1.1) saturate(0.7)"); break;
        case "Высокий контраст": parts.push("contrast(1.5) saturate(1.2)"); break;
        case "Мягкий свет": parts.push("brightness(1.1) contrast(0.9) saturate(1.1)"); break;
        case "Зернистость": parts.push("contrast(1.05) brightness(0.97)"); break;
        case "Хроматическая аберрация": parts.push("saturate(1.3) contrast(1.1)"); break;
        case "Двойная экспозиция": parts.push("brightness(1.2) contrast(0.85)"); break;
        case "Глитч-наложение": parts.push(`hue-rotate(${norm * 120}deg) saturate(1.8) contrast(1.15)`); break;
        default: break;
      }
    }
    if (parts.length > 0) {
      this.ctx.filter = parts.join(" ");
    }
  }

  private applyTransitionAlpha(type: string, progress: number, baseAlpha: number): number {
    const t = Math.max(0, Math.min(1, progress));
    switch (type) {
      case "растворение": return baseAlpha * t;
      case "затемнение": return baseAlpha * t;
      case "засветка": return baseAlpha * t;
      case "масштаб": return baseAlpha * t;
      case "вспышка": return baseAlpha * (t < 0.5 ? t * 2 : 1);
      default: return baseAlpha * t;
    }
  }

  private applyTransitionTransform(
    transition: ClipTransition | undefined,
    elapsed: number,
    w: number,
    h: number
  ) {
    if (!this.ctx || !transition || transition.duration <= 0) return;
    if (elapsed >= transition.duration) return;

    const t = Math.max(0, Math.min(1, elapsed / transition.duration));
    const eased = t * t * (3 - 2 * t);

    switch (transition.type) {
      case "слайд влево":
        this.ctx.translate(w * (1 - eased), 0);
        break;
      case "слайд вправо":
        this.ctx.translate(-w * (1 - eased), 0);
        break;
      case "слайд вверх":
        this.ctx.translate(0, h * (1 - eased));
        break;
      case "слайд вниз":
        this.ctx.translate(0, -h * (1 - eased));
        break;
      case "масштаб": {
        const scale = 0.3 + 0.7 * eased;
        this.ctx.translate(w / 2, h / 2);
        this.ctx.scale(scale, scale);
        this.ctx.translate(-w / 2, -h / 2);
        break;
      }
      case "поворот": {
        const angle = (1 - eased) * Math.PI * 0.5;
        this.ctx.translate(w / 2, h / 2);
        this.ctx.rotate(angle);
        this.ctx.scale(eased, eased);
        this.ctx.translate(-w / 2, -h / 2);
        break;
      }
      case "пиксели": {
        if (eased < 0.8) {
          const pixelSize = Math.max(1, Math.round((1 - eased / 0.8) * 20));
          this.ctx.imageSmoothingEnabled = false;
          this.ctx.scale(1 / pixelSize, 1 / pixelSize);
          this.ctx.scale(pixelSize, pixelSize);
        }
        break;
      }
      default:
        break;
    }
  }
}

export default VideoRenderer;