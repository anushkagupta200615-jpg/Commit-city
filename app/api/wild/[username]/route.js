import { buildWildProfile } from "../../../../lib/wild";

// External open-source footprint: PR credibility + contribution DNA.

export async function GET(request, { params }) {
  const { username } = await params;

  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(username)) {
    return Response.json({ error: "invalid_username" }, { status: 400 });
  }

  try {
    const profile = await buildWildProfile(username);
    return Response.json(profile);
  } catch (err) {
    if (err.message === "rate_limited") {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
