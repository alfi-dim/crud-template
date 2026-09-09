export async function readJsonAction(request: Request): Promise<unknown> {
  if (request.method !== "POST") {
    throw new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new Response("Unsupported media type", { status: 415 });
  }

  try {
    return await request.json();
  } catch {
    throw new Response("Invalid JSON request body", { status: 400 });
  }
}
