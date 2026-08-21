import { ImageResponse } from "next/og";

const size = { width: 1200, height: 630 };

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(circle at 18% 20%, #9d174d 0%, transparent 34%), radial-gradient(circle at 82% 70%, #155e75 0%, transparent 36%), #090813",
          color: "white",
          padding: "72px 82px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 76,
              height: 76,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              background:
                "linear-gradient(135deg, #67e8f9, #f472b6, #fdba74)",
              color: "#090813",
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            VI
          </div>
          <div
            style={{ fontSize: 38, fontWeight: 900, letterSpacing: -2 }}
          >
            GTAVIWORLD.IO
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#67e8f9",
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 5,
            }}
          >
            VERIFIED GTA VI INTELLIGENCE
          </div>
          <div
            style={{
              marginTop: 18,
              maxWidth: 900,
              fontSize: 76,
              fontWeight: 900,
              lineHeight: 1.02,
              letterSpacing: -4,
            }}
          >
            The signal beyond the noise.
          </div>
          <div style={{ marginTop: 24, color: "#d4d4d8", fontSize: 28 }}>
            News · Analysis · Quick Hits · Clear verification labels
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=86400",
      },
    },
  );
}
