export async function uploadFileToR2(env, file, path) {
  if (!env.R2_BUCKET) {
    throw new Error("Missing R2_BUCKET binding");
  }
  const buffer = await file.arrayBuffer();
  const contentType = file.type || 'application/octet-stream';
  await env.R2_BUCKET.put(path, buffer, { httpMetadata: { contentType } });
  return `/images/${path}`;
}

export async function serveImageFromR2(env, imagePath, corsHeaders) {
  let object = await env.R2_BUCKET.get(imagePath);
  if (object === null && imagePath.includes('/')) {
    const parts = imagePath.split('/');
    object = await env.R2_BUCKET.get(parts.pop());
  }
  if (object === null) {
    return new Response("Image not found", { status: 404, headers: corsHeaders });
  }
  const extension = imagePath.split('.').pop().toLowerCase();
  const contentTypes = {
    'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png',
    'gif':'image/gif','svg':'image/svg+xml','webp':'image/webp',
    'bmp':'image/bmp','ico':'image/x-icon'
  };
  const contentType = contentTypes[extension] || 'application/octet-stream';
  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*"
    }
  });
}