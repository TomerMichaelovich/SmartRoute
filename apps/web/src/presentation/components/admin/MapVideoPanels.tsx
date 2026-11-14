"use client";

import { useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import type { StoreMapVideo } from "@/src/infrastructure/repositories/interfaces/map-video-repository";
import { MAP_VIDEO_CONTENT_TYPES, MAP_VIDEO_EXTENSIONS, MAP_VIDEO_MAX_BYTES, mapVideoPathPrefix } from "@/src/presentation/map-videos";

// Above this the Blob client splits the upload into parallel, retried parts.
const MULTIPART_THRESHOLD_BYTES = 50 * 1024 * 1024;
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" };

/**
 * The popup that opens where the admin clicked on the map: pick a video file and a title, and it
 * uploads straight from the browser to Blob (with progress), then pins it at that spot.
 */
export function MapVideoUploadPopup({
  storeId,
  screenLeft,
  screenTop,
  normX,
  normY,
  addMapVideo,
  onClose,
}: {
  storeId: string;
  screenLeft: number;
  screenTop: number;
  normX: number;
  normY: number;
  addMapVideo: (video: { videoUrl: string; title: string; x: number; y: number }) => Promise<void>;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploading = progress !== null;

  async function handleSubmit(formData: FormData) {
    const file = formData.get("video");
    if (!(file instanceof File) || file.size === 0) return;
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!MAP_VIDEO_EXTENSIONS.includes(ext)) {
      setError("רק קבצי MP4, MOV או WebM");
      return;
    }
    if (file.size > MAP_VIDEO_MAX_BYTES) {
      setError("הקובץ גדול מ-1GB");
      return;
    }
    setError(null);
    setProgress(0);
    try {
      const blob = await upload(`${mapVideoPathPrefix(storeId)}${crypto.randomUUID()}.${ext}`, file, {
        access: "public",
        handleUploadUrl: `/admin/stores/${storeId}/video-upload`,
        contentType: MAP_VIDEO_CONTENT_TYPES.includes(file.type) ? file.type : CONTENT_TYPE_BY_EXTENSION[ext],
        multipart: file.size > MULTIPART_THRESHOLD_BYTES,
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });
      const title = String(formData.get("title") ?? "").trim() || file.name.replace(/\.[^.]+$/, "");
      await addMapVideo({ videoUrl: blob.url, title, x: normX, y: normY });
      onClose();
    } catch (e) {
      console.error(e);
      setError("ההעלאה נכשלה - נסו שוב");
      setProgress(null);
    }
  }

  return (
    <div
      style={{ left: screenLeft, top: screenTop }}
      className="absolute z-10 flex w-64 -translate-x-1/2 flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg"
    >
      <form action={handleSubmit} className="flex flex-col gap-2">
        <input
          name="title"
          placeholder="כותרת (למשל: מעבר 4 - חטיפים)"
          autoFocus
          disabled={uploading}
          className="rounded-lg border border-neutral-300 p-1.5 text-sm"
        />
        <input
          type="file"
          name="video"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          required
          disabled={uploading}
          className="text-xs text-neutral-600 file:me-2 file:rounded-full file:border-0 file:bg-neutral-100 file:px-2 file:py-1 file:text-xs"
        />
        {uploading && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full bg-cyan-600" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs tabular-nums text-neutral-600">{Math.round(progress)}%</span>
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={uploading}
            className="flex-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {uploading ? "מעלה..." : "העלה סרטון"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 disabled:opacity-50"
          >
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
}

/** Plays a pinned video over the page; the admin can also remove the pin (and its file) from here. */
export function MapVideoPlayer({
  video,
  deleteMapVideo,
  onClose,
}: {
  video: StoreMapVideo;
  deleteMapVideo: (videoId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [deleting, startDelete] = useTransition();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-4xl flex-col gap-2 rounded-2xl bg-white p-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate text-sm font-semibold text-neutral-900">{video.title}</h3>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                if (!confirm(`למחוק את הסרטון "${video.title}"?`)) return;
                startDelete(async () => {
                  await deleteMapVideo(video.id);
                  onClose();
                });
              }}
              className="text-sm text-red-600 hover:underline disabled:opacity-50"
            >
              {deleting ? "מוחק..." : "מחק סרטון"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              className="rounded-full px-2 text-lg leading-none text-neutral-500 hover:text-neutral-900"
            >
              ✕
            </button>
          </div>
        </div>
        <video key={video.id} src={video.videoUrl} controls autoPlay playsInline className="max-h-[80vh] w-full rounded-lg bg-black" />
      </div>
    </div>
  );
}
