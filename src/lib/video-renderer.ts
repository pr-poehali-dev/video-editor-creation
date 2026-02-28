import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import type {
  Track,
  MediaAsset,
  ExportSettings,
  TimelineClip,
} from "@/types/editor";

type ProgressCallback = (progress: number, stage: string) => void;

interface RenderResult {
  blob: Blob;
  url: string;
  fileName: string;
}

interface QualityProfile {
  width: number;
  height: number;
  crf: number;
}

interface FormatProfile {
  videoCodec: string;
  audioCodec: string | null;
  extension: string;
}

const QUALITY_MAP: Record<ExportSettings["quality"], QualityProfile> = {
  low: { width: 1280, height: 720, crf: 28 },
  medium: { width: 1920, height: 1080, crf: 23 },
  high: { width: 1920, height: 1080, crf: 18 },
  ultra: { width: 3840, height: 2160, crf: 15 },
};

const FORMAT_MAP: Record<ExportSettings["format"], FormatProfile> = {
  mp4: { videoCodec: "libx264", audioCodec: "aac", extension: "mp4" },
  webm: { videoCodec: "libvpx-vp9", audioCodec: "libopus", extension: "webm" },
  avi: { videoCodec: "libx264", audioCodec: "aac", extension: "avi" },
  mov: { videoCodec: "libx264", audioCodec: "aac", extension: "mov" },
  gif: { videoCodec: "gif", audioCodec: null, extension: "gif" },
};

const CORE_URL =
  "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js";
const WASM_URL =
  "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm";

interface ClipWithAsset {
  clip: TimelineClip;
  asset: MediaAsset | undefined;
  inputIndex: number;
  inputName: string;
}

export class VideoRenderer {
  private ffmpeg: FFmpeg;
  private loaded = false;

  constructor() {
    this.ffmpeg = new FFmpeg();
  }

  async init(): Promise<void> {
    if (this.loaded) return;

    await this.ffmpeg.load({
      coreURL: CORE_URL,
      wasmURL: WASM_URL,
    });

    this.loaded = true;
  }

  async render(
    tracks: Track[],
    assets: MediaAsset[],
    exportSettings: ExportSettings,
    onProgress?: ProgressCallback
  ): Promise<RenderResult> {
    if (!this.loaded) {
      await this.init();
    }

    const report = (progress: number, stage: string) => {
      onProgress?.(Math.min(Math.max(progress, 0), 1), stage);
    };

    const quality = QUALITY_MAP[exportSettings.quality];
    const format = FORMAT_MAP[exportSettings.format];
    const [resW, resH] = this.parseResolution(
      exportSettings.resolution,
      quality
    );
    const fps = exportSettings.fps || 30;
    const totalDuration = this.computeTotalDuration(tracks);

    if (totalDuration <= 0) {
      throw new Error("Timeline is empty — nothing to render.");
    }

    this.ffmpeg.on("progress", ({ progress }) => {
      report(0.3 + progress * 0.6, "Encoding");
    });

    const assetMap = new Map<string, MediaAsset>(
      assets.map((a) => [a.id, a])
    );

    const videoClips = this.collectClips(tracks, ["video", "image"], assetMap);
    const audioClips = this.collectClips(tracks, ["audio"], assetMap);
    const videoTracksWithAudio = this.collectClips(
      tracks,
      ["video"],
      assetMap
    );

    report(0, "Loading assets");
    const allClips = [...videoClips, ...audioClips];
    const uniqueAssetIds = new Set<string>();
    const inputFiles: { name: string; assetId: string }[] = [];

    for (const entry of allClips) {
      if (!entry.asset) continue;
      if (uniqueAssetIds.has(entry.asset.id)) continue;
      uniqueAssetIds.add(entry.asset.id);

      const ext = this.getExtension(entry.asset.url, entry.asset.type);
      const inputName = `input_${entry.asset.id}.${ext}`;

      report(
        (inputFiles.length / Math.max(allClips.length, 1)) * 0.3,
        `Loading ${entry.asset.name}`
      );

      const data = await fetchFile(entry.asset.url);
      await this.ffmpeg.writeFile(inputName, data);
      inputFiles.push({ name: inputName, assetId: entry.asset.id });
    }

    report(0.3, "Building render graph");

    const outputName = `output.${format.extension}`;
    const args = this.buildFFmpegCommand(
      videoClips,
      audioClips,
      videoTracksWithAudio,
      inputFiles,
      outputName,
      resW,
      resH,
      fps,
      totalDuration,
      quality,
      format,
      exportSettings
    );

    report(0.35, "Rendering");
    await this.ffmpeg.exec(args);

    report(0.9, "Reading output");
    const outputData = await this.ffmpeg.readFile(outputName);

    const mimeType = this.getMimeType(format.extension);
    const blob = new Blob([outputData], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const fileName = `export_${Date.now()}.${format.extension}`;

    await this.cleanup(inputFiles.map((f) => f.name), outputName);

    report(1, "Complete");

    return { blob, url, fileName };
  }

  terminate(): void {
    try {
      this.ffmpeg.terminate();
    } catch {
      /* already terminated */
    }
    this.loaded = false;
    this.ffmpeg = new FFmpeg();
  }

  private parseResolution(
    resolution: string,
    fallback: QualityProfile
  ): [number, number] {
    const match = resolution.match(/^(\d+)\s*[xX×]\s*(\d+)$/);
    if (match) {
      return [parseInt(match[1], 10), parseInt(match[2], 10)];
    }
    return [fallback.width, fallback.height];
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

  private collectClips(
    tracks: Track[],
    types: string[],
    assetMap: Map<string, MediaAsset>
  ): ClipWithAsset[] {
    const results: ClipWithAsset[] = [];
    for (const track of tracks) {
      if (!track.visible && track.type !== "audio") continue;
      if (track.muted && track.type === "audio") continue;

      for (const clip of track.clips) {
        if (!types.includes(clip.type) && !types.includes(track.type)) continue;
        const asset = clip.assetId ? assetMap.get(clip.assetId) : undefined;
        results.push({
          clip,
          asset,
          inputIndex: -1,
          inputName: "",
        });
      }
    }
    return results.sort((a, b) => a.clip.startTime - b.clip.startTime);
  }

  private getExtension(url: string, type: string): string {
    try {
      const pathname = new URL(url).pathname;
      const ext = pathname.split(".").pop()?.toLowerCase();
      if (ext && ext.length <= 5 && ext.length >= 2) return ext;
    } catch {
      /* fall through */
    }

    switch (type) {
      case "video":
        return "mp4";
      case "audio":
        return "mp3";
      case "image":
        return "png";
      default:
        return "bin";
    }
  }

  private buildFFmpegCommand(
    videoClips: ClipWithAsset[],
    audioClips: ClipWithAsset[],
    videoTracksWithAudio: ClipWithAsset[],
    inputFiles: { name: string; assetId: string }[],
    outputName: string,
    width: number,
    height: number,
    fps: number,
    totalDuration: number,
    quality: QualityProfile,
    format: FormatProfile,
    settings: ExportSettings
  ): string[] {
    const args: string[] = ["-y"];
    const inputIndexMap = new Map<string, number>();
    let currentInput = 0;

    args.push(
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=${width}x${height}:r=${fps}:d=${totalDuration}`
    );
    const bgIndex = currentInput++;

    for (const file of inputFiles) {
      args.push("-i", file.name);
      inputIndexMap.set(file.assetId, currentInput++);
    }

    const filterParts: string[] = [];
    let lastVideoLabel = `[${bgIndex}:v]`;
    let overlayCount = 0;

    const sortedVideoClips = [...videoClips].sort(
      (a, b) => a.clip.startTime - b.clip.startTime
    );

    for (const entry of sortedVideoClips) {
      if (!entry.asset) continue;
      const idx = inputIndexMap.get(entry.asset.id);
      if (idx === undefined) continue;

      const clip = entry.clip;
      const startTime = clip.startTime;
      const endTime = clip.startTime + clip.duration;
      const speed = clip.speed || 1;
      const opacity = clip.opacity ?? 1;

      const overlayLabel = `ov${overlayCount}`;
      const scaledLabel = `sc${overlayCount}`;

      if (entry.asset.type === "image" || clip.type === "image") {
        filterParts.push(
          `[${idx}:v]loop=loop=-1:size=1:start=0,` +
            `setpts=PTS-STARTPTS,` +
            `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,` +
            `setpts=PTS+${startTime}/TB` +
            `${opacity < 1 ? `,format=yuva420p,colorchannelmixer=aa=${opacity}` : ""}` +
            `[${scaledLabel}]`
        );
      } else {
        const trimStart = clip.offset || 0;
        const trimEnd = trimStart + clip.duration * speed;
        filterParts.push(
          `[${idx}:v]trim=start=${trimStart}:end=${trimEnd},` +
            `setpts=(PTS-STARTPTS)/${speed},` +
            `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,` +
            `setpts=PTS+${startTime}/TB` +
            `${opacity < 1 ? `,format=yuva420p,colorchannelmixer=aa=${opacity}` : ""}` +
            `[${scaledLabel}]`
        );
      }

      filterParts.push(
        `${lastVideoLabel}[${scaledLabel}]overlay=` +
          `enable='between(t,${startTime},${endTime})':` +
          `eof_action=pass[${overlayLabel}]`
      );

      lastVideoLabel = `[${overlayLabel}]`;
      overlayCount++;
    }

    const audioEntries: string[] = [];
    const allAudioSources = [...audioClips, ...videoTracksWithAudio];

    for (const entry of allAudioSources) {
      if (!entry.asset) continue;
      if (entry.asset.type === "image") continue;
      const idx = inputIndexMap.get(entry.asset.id);
      if (idx === undefined) continue;

      const clip = entry.clip;
      if (clip.type === "image") continue;
      const speed = clip.speed || 1;
      const volume = clip.volume ?? 1;
      const trimStart = clip.offset || 0;
      const trimEnd = trimStart + clip.duration * speed;
      const aLabel = `a${audioEntries.length}`;

      let atempo = "";
      if (speed !== 1) {
        let remaining = speed;
        const tempoFilters: string[] = [];
        while (remaining > 2.0) {
          tempoFilters.push("atempo=2.0");
          remaining /= 2.0;
        }
        while (remaining < 0.5) {
          tempoFilters.push("atempo=0.5");
          remaining /= 0.5;
        }
        tempoFilters.push(`atempo=${remaining}`);
        atempo = `,${tempoFilters.join(",")}`;
      }

      filterParts.push(
        `[${idx}:a]atrim=start=${trimStart}:end=${trimEnd},` +
          `asetpts=PTS-STARTPTS${atempo},` +
          `volume=${volume},` +
          `adelay=${Math.round(clip.startTime * 1000)}|${Math.round(clip.startTime * 1000)}` +
          `[${aLabel}]`
      );

      audioEntries.push(`[${aLabel}]`);
    }

    let finalAudioLabel = "";
    if (audioEntries.length > 0 && format.audioCodec !== null) {
      const mixLabel = "amixed";
      if (audioEntries.length === 1) {
        finalAudioLabel = audioEntries[0];
      } else {
        filterParts.push(
          `${audioEntries.join("")}amix=inputs=${audioEntries.length}:duration=longest:dropout_transition=0[${mixLabel}]`
        );
        finalAudioLabel = `[${mixLabel}]`;
      }
    }

    const finalVideoLabel =
      overlayCount > 0 ? lastVideoLabel : `[${bgIndex}:v]`;

    if (filterParts.length > 0) {
      args.push("-filter_complex", filterParts.join(";"));
      args.push("-map", finalVideoLabel);

      if (finalAudioLabel && format.audioCodec !== null) {
        args.push("-map", finalAudioLabel);
      }
    } else {
      args.push("-map", `${bgIndex}:v`);
    }

    if (format.videoCodec === "gif") {
      args.push("-c:v", "gif");
      args.push("-r", String(Math.min(fps, 15)));
    } else {
      args.push("-c:v", format.videoCodec);
      args.push("-crf", String(quality.crf));
      args.push("-r", String(fps));

      if (format.videoCodec === "libx264") {
        args.push("-preset", "ultrafast");
        args.push("-pix_fmt", "yuv420p");
        args.push("-movflags", "+faststart");
      }

      if (format.videoCodec === "libvpx-vp9") {
        args.push("-b:v", "0");
        args.push("-deadline", "realtime");
        args.push("-cpu-used", "8");
      }
    }

    if (format.audioCodec !== null && finalAudioLabel) {
      args.push("-c:a", format.audioCodec);

      if (format.audioCodec === "aac") {
        args.push("-b:a", "192k");
      } else if (format.audioCodec === "libopus") {
        args.push("-b:a", "128k");
      }
    } else if (format.audioCodec === null || !finalAudioLabel) {
      args.push("-an");
    }

    if (settings.bitrate > 0 && format.videoCodec !== "gif") {
      args.push("-b:v", `${settings.bitrate}k`);
    }

    args.push("-t", String(totalDuration));
    args.push("-shortest");
    args.push(outputName);

    return args;
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      mp4: "video/mp4",
      webm: "video/webm",
      avi: "video/x-msvideo",
      mov: "video/quicktime",
      gif: "image/gif",
    };
    return mimeTypes[extension] || "application/octet-stream";
  }

  private async cleanup(
    inputNames: string[],
    outputName: string
  ): Promise<void> {
    const filesToDelete = [...inputNames, outputName];
    for (const file of filesToDelete) {
      try {
        await this.ffmpeg.deleteFile(file);
      } catch {
        /* file may not exist */
      }
    }
  }
}

export default VideoRenderer;