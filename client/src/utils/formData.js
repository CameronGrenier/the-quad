export async function parseFormData(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded')) {
    return await request.formData();
  } else if (contentType.includes('application/json')) {
    const json = await request.json();
    const formData = new FormData();
    Object.entries(json).forEach(([key, value]) => {
      formData.append(key, value);
    });
    return formData;
  }
  return new FormData();
}