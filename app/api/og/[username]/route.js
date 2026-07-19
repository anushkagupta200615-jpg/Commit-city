import { ImageResponse } from "next/og";
import { fetchGitHubData } from "../../../../lib/github";
import { buildCityModel } from "../../../../lib/city";
import { renderSkylineSvg } from "../../../../lib/skylineSvg";

// PNG social preview card (Open Graph / Twitter) for a city.

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
      animate: false,
    });
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "#02040f",
            position: "relative",
          }}
        >
          <img
            src={dataUri}
            width={1200}
            height={600}
            style={{ position: "absolute", top: 15, left: 0 }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 40,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ color: "#ffffff", fontSize: 44, fontWeight: 700 }}>
              {`${data.user.name || data.user.login}'s Commit City`}
            </div>
            <div style={{ color: "#9aa7c7", fontSize: 26 }}>
              {`${city.towerCount} towers · ${city.totalContributions.toLocaleString()} contributions · ${city.analysis.totalStars.toLocaleString()} stars`}
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch {
    return new Response("error", { status: 500 });
  }
}
