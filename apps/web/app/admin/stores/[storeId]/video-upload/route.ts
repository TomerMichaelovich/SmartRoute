import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { MAP_VIDEO_CONTENT_TYPES, MAP_VIDEO_MAX_BYTES, mapVideoPathPrefix } from "@/src/presentation/map-videos";
import { requireAdmin } from "@/src/presentation/auth/admin";

// Videos are far larger than a Server Action body may be, so the browser uploads them straight
// to Vercel Blob. This route only hands out the short-lived upload token, to admins who may map
// this store, and only for a path under the store's own video folder. The editor saves the
// video's map pin itself once the upload finishes (no upload-completed webhook is used).
export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  try {
    await requireAdmin({ mapStore: storeId });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(mapVideoPathPrefix(storeId))) throw new Error("Invalid upload path");
        return {
          allowedContentTypes: MAP_VIDEO_CONTENT_TYPES,
          maximumSizeInBytes: MAP_VIDEO_MAX_BYTES,
          addRandomSuffix: false,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
