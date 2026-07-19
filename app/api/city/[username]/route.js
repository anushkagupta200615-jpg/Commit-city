import { fetchGitHubData } from "../../../../lib/github";
import { buildCityModel } from "../../../../lib/city";

export async function GET(request, { params }) {
  const { username } = await params;

  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(username)) {
    return Response.json({ error: "invalid_username" }, { status: 400 });
  }

  try {
    const data = await fetchGitHubData(username);
    if (data.notFound) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    return Response.json({
      user: data.user,
      city: buildCityModel(data),
    });
  } catch (err) {
    if (err.message === "rate_limited") {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
