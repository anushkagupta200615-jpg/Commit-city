import { fetchGitHubData } from "../../../../lib/github";
import { buildCityModel } from "../../../../lib/city";
import { renderSkylineSvg } from "../../../../lib/skylineSvg";

// Live SVG skyline for README embeds:
// ![city](https://your-host/api/skyline/username)

export async function GET(request, { params }) {
  const { username } = await params;

  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(username)) {
    return new Response("invalid username", { status: 400 });
  }

  try {
    const data = await fetchGitHubData(username);
    if (data.notFound) return new Response("not found", { status: 404 });

    const city = buildCityModel(data);
    const svg = renderSkylineSvg({
      seed: username.toLowerCase(),
      towers: city.towers,
      label: `@${data.user.login} · ${city.towerCount} towers · ${city.totalContributions.toLocaleString()} contributions`,
    });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch {
    return new Response("error", { status: 500 });
  }
}
