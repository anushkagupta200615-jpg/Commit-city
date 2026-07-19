import { getDirectory } from "../../../lib/programs";

// The full program directory: every live GSoC organization for the
// current program year, plus curated LFX and Outreachy community rosters.

export async function GET() {
  try {
    const directory = await getDirectory();
    return Response.json(directory, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=21600",
      },
    });
  } catch {
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
