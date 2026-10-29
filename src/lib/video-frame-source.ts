import { media as mediaApi } from "@/lib/api";

const SEEK_TIMEOUT_MS = 4000;
const LOAD_TIMEOUT_MS = 60000;

export interface VideoClipRef {
  key: string;
  assetId?: string;
  startTime: number;
  duration: number;
  offset: number;
}

const waitEvent = (el: HTMLMediaElement, event: string, timeoutMs: number) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timeout: ${event}`));
    }, timeoutMs);
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error(`video error on ${event}`));
    };
    const cleanup = () => {
      clearTimeout(timer);
      el.removeEventListener(event, onOk);
      el.removeEventListener("error", onErr);
    };
    el.addEventListener(event, onOk, { once: true });
    el.addEventListener("error", onErr, { once: true });
  });

export class VideoFrameSource {
  private blobUrls = new Map<string, string>();
  private elements = new Map<string, HTMLVideoElement>();

  async loadAsset(
    assetId: string,
    asset: { url: string; name: string },
    fetchChunked: (serverId: number) => Promise<ArrayBuffer>,
  ): Promise<boolean> {
    if (this.blobUrls.has(assetId)) return true;
    const blob = await this.fetchBlob(assetId, asset, fetchChunked);
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const probe = this.createElement(url);
    try {
      await waitEvent(probe, "loadeddata", LOAD_TIMEOUT_MS);
    } catch (e) {
      console.warn(`[VideoFrames] Не удалось открыть видео "${asset.name}"`, e);
      URL.revokeObjectURL(url);
      return false;
    }
    this.blobUrls.set(assetId, url);
    probe.removeAttribute("src");
    probe.load();
    return true;
  }

  async prepareClips(clips: VideoClipRef[]): Promise<void> {
    for (const clip of clips) {
      if (!clip.assetId || this.elements.has(clip.key)) continue;
      const url = this.blobUrls.get(clip.assetId);
      if (!url) continue;
      const el = this.createElement(url);
      await waitEvent(el, "loadeddata", LOAD_TIMEOUT_MS).catch(() => {});
      this.elements.set(clip.key, el);
    }
  }

  get(key: string): HTMLVideoElement | undefined {
    const el = this.elements.get(key);
    return el && el.readyState >= 2 ? el : undefined;
  }

  sourceTime(clip: VideoClipRef, timelineTime: number, el: HTMLVideoElement): number {
    const t = clip.offset + (timelineTime - clip.startTime);
    const max = isFinite(el.duration) ? Math.max(0, el.duration - 0.04) : t;
    return Math.min(Math.max(0, t), max);
  }

  async seekAll(clips: VideoClipRef[], timelineTime: number): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (const clip of clips) {
      if (timelineTime < clip.startTime || timelineTime >= clip.startTime + clip.duration) continue;
      const el = this.elements.get(clip.key);
      if (!el) continue;
      const target = this.sourceTime(clip, timelineTime, el);
      if (Math.abs(el.currentTime - target) < 0.0005 && el.readyState >= 2) continue;
      el.currentTime = target;
      jobs.push(waitEvent(el, "seeked", SEEK_TIMEOUT_MS).catch(() => {}));
    }
    if (jobs.length) await Promise.all(jobs);
  }

  syncPlayback(clips: VideoClipRef[], timelineTime: number): void {
    for (const clip of clips) {
      const el = this.elements.get(clip.key);
      if (!el) continue;
      const active = timelineTime >= clip.startTime && timelineTime < clip.startTime + clip.duration;
      if (!active) {
        if (!el.paused) el.pause();
        continue;
      }
      const target = this.sourceTime(clip, timelineTime, el);
      if (Math.abs(el.currentTime - target) > 0.25) el.currentTime = target;
      if (el.paused) el.play().catch(() => {});
    }
  }

  pauseAll(): void {
    this.elements.forEach(el => el.pause());
  }

  dispose(): void {
    this.elements.forEach(el => {
      el.pause();
      el.removeAttribute("src");
      el.load();
    });
    this.elements.clear();
    this.blobUrls.forEach(url => URL.revokeObjectURL(url));
    this.blobUrls.clear();
  }

  private createElement(url: string): HTMLVideoElement {
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.src = url;
    return el;
  }

  private async fetchBlob(
    assetId: string,
    asset: { url: string; name: string },
    fetchChunked: (serverId: number) => Promise<ArrayBuffer>,
  ): Promise<Blob | null> {
    const tryFetch = async (url: string) => {
      try {
        const resp = await fetch(url, { mode: "cors" });
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return blob.size > 0 ? blob : null;
      } catch {
        return null;
      }
    };

    if (asset.url && (asset.url.startsWith("blob:") || asset.url.startsWith("http"))) {
      const blob = await tryFetch(asset.url);
      if (blob) return blob;
    }

    const serverId = assetId.startsWith("server_") ? parseInt(assetId.replace("server_", ""), 10) : NaN;
    if (isNaN(serverId)) return null;

    try {
      const presign = await mediaApi.presign(serverId);
      for (const u of [presign.cdn_url, presign.url]) {
        if (typeof u === "string" && u) {
          const blob = await tryFetch(u);
          if (blob) return blob;
        }
      }
    } catch {
      /* fallback below */
    }

    try {
      const buf = await fetchChunked(serverId);
      return buf.byteLength > 0 ? new Blob([buf]) : null;
    } catch (e) {
      console.warn(`[VideoFrames] Не удалось скачать "${asset.name}"`, e);
      return null;
    }
  }
}
