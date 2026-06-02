export async function onRequestPost(context) {
  const groqKey = context.env.GROQ_KEY;
  if (!groqKey) {
    return new Response(JSON.stringify({ error: "AI service not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + groqKey,
    },
    body: JSON.stringify(body),
  });

  const data = await groqRes.json();
  return new Response(JSON.stringify(data), {
    status: groqRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
