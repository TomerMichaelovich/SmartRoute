/** What the map editor's video pins accept: phone recordings (MP4, iPhone MOV) and WebM. */
export const MAP_VIDEO_CONTENT_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const MAP_VIDEO_EXTENSIONS = ["mp4", "mov", "webm"];
export const MAP_VIDEO_MAX_BYTES = 1024 * 1024 * 1024;

/** Every video of a store lives under its own Blob folder, so the upload token can't write elsewhere. */
export function mapVideoPathPrefix(storeId: string): string {
  return `store-videos/${storeId}/`;
}
