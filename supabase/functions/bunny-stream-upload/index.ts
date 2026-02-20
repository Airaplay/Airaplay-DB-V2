import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UploadResponse {
  success: boolean;
  videoId?: string;
  videoGuid?: string;
  publicUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const BUNNY_LIBRARY_ID = Deno.env.get("BUNNY_STREAM_LIBRARY_ID");
    const BUNNY_API_KEY = Deno.env.get("BUNNY_STREAM_API_KEY");
    const BUNNY_HOSTNAME = Deno.env.get("BUNNY_STREAM_HOSTNAME");

    if (!BUNNY_LIBRARY_ID || !BUNNY_API_KEY || !BUNNY_HOSTNAME) {
      throw new Error("Bunny Stream credentials not configured");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const collectionId = formData.get("collectionId") as string | null;

    if (!file) {
      throw new Error("No file provided");
    }

    console.log(`Uploading file: ${file.name} (${file.size} bytes)`);

    const videoTitle = title || file.name.split(".")[0];

    const createVideoUrl = `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`;
    const createVideoPayload: Record<string, unknown> = {
      title: videoTitle,
      moments: [],
      chapters: [],
    };

    if (collectionId) {
      createVideoPayload.collectionId = collectionId;
    }

    const createResponse = await fetch(createVideoUrl, {
      method: "POST",
      headers: {
        "AccessKey": BUNNY_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createVideoPayload),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Failed to create video:", errorText);
      throw new Error(`Failed to create video: ${createResponse.status} - ${errorText}`);
    }

    const videoData = await createResponse.json() as { guid: string; videoLibraryId: number };
    const videoGuid = videoData.guid;
    const videoLibraryId = videoData.videoLibraryId;

    console.log(`Video created with GUID: ${videoGuid}`);

    const uploadUrl = `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoGuid}`;

    const fileBuffer = await file.arrayBuffer();

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "AccessKey": BUNNY_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Failed to upload video:", errorText);
      throw new Error(`Failed to upload video: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadResult = await uploadResponse.json() as { success: boolean; message: string; statusCode: number };
    console.log("Upload result:", uploadResult);

    // Configure video settings with cache headers and encoding optimization
    try {
      const configureResponse = await fetch(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoGuid}`, {
        method: "POST",
        headers: {
          "AccessKey": BUNNY_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enableMP4Fallback: true,
          // Enable CDN caching
          enableCDN: true,
        }),
      });

      if (configureResponse.ok) {
        console.log("Configured video for optimized playback with caching");
      } else {
        console.warn("Failed to configure video settings, continuing anyway");
      }
    } catch (configError) {
      console.warn("Error configuring video settings:", configError);
      // Non-critical, continue anyway
    }

    const publicUrl = `https://${BUNNY_HOSTNAME}/${videoGuid}/playlist.m3u8`;
    const thumbnailUrl = `https://${BUNNY_HOSTNAME}/${videoGuid}/thumbnail.jpg`;

    // Validate URL format before responding
    if (!publicUrl.startsWith('https://')) {
      throw new Error(`Invalid URL protocol: ${publicUrl}`);
    }

    if (!BUNNY_HOSTNAME.includes('.b-cdn.net')) {
      throw new Error(`Invalid Bunny hostname: ${BUNNY_HOSTNAME}`);
    }

    if (!publicUrl.includes('/playlist.m3u8')) {
      throw new Error(`Invalid HLS URL format: ${publicUrl}`);
    }

    console.log(`✅ Upload complete - Video ready for playback:
      - Video GUID: ${videoGuid}
      - Playback URL: ${publicUrl}
      - Thumbnail URL: ${thumbnailUrl}`);

    const response: UploadResponse = {
      success: true,
      videoId: videoGuid,
      videoGuid: videoGuid,
      publicUrl: publicUrl,
      thumbnailUrl: thumbnailUrl,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // Add cache headers to response
        "Cache-Control": "public, max-age=3600", // 1 hour for API response
      },
    });
  } catch (error) {
    console.error("Error uploading to Bunny Stream:", error);

    const errorResponse: UploadResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
