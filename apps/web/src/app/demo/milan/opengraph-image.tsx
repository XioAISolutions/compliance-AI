import { ImageResponse } from "next/og";
import {
  MILAN_SCENARIO_TEXT,
  computeCognitiveRisk,
} from "../../../lib/demo/cognitive-risk";

/**
 * Programmatic Open Graph image for /demo/milan.
 *
 * Renders the submission line, the headline, and the live cognitive-risk
 * score against the canonical scenario so any social share / Slack
 * unfurl / lablab embed surfaces the thesis instead of an empty card.
 *
 * The score is derived from MILAN_SCENARIO_TEXT at request time, so
 * the OG image always matches what the page actually shows.
 */

export const runtime = "nodejs";
export const alt =
  "XIO ProofOps Agent — autonomous proof, approval, and audit trails for regulated business decisions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const risk = computeCognitiveRisk(MILAN_SCENARIO_TEXT);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 0% 0%, rgba(34,211,238,0.28), transparent 38%), linear-gradient(135deg, #0f172a 0%, #0a0a0a 100%)",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            color: "#67e8f9",
            fontWeight: 600,
          }}
        >
          <span>Milan AI Week</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>XIO ProofOps Agent</span>
        </div>

        {/* Main thesis */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 32,
            maxWidth: 900,
          }}
        >
          <div
            style={{
              fontSize: 60,
              lineHeight: 1.1,
              fontWeight: 600,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            Most AI agents generate answers.
          </div>
          <div
            style={{
              fontSize: 60,
              lineHeight: 1.1,
              fontWeight: 600,
              color: "#67e8f9",
              letterSpacing: "-0.02em",
            }}
          >
            XIO ProofOps generates defensible business evidence.
          </div>
        </div>

        {/* Bottom row: score + metrics */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 18,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#9ca3af",
              }}
            >
              Cognitive risk · derived from input
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
              <span
                style={{
                  fontSize: 96,
                  fontWeight: 700,
                  color: "#fb7185",
                  lineHeight: 1,
                }}
              >
                {risk.score}
              </span>
              <span
                style={{
                  fontSize: 32,
                  color: "#9ca3af",
                  fontWeight: 500,
                }}
              >
                /100
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 18,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#9ca3af",
              }}
            >
              Sponsor tracks
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 22, color: "#a5f3fc" }}>
              {["Vultr", "Gemini", "Speechmatics", "Featherless"].map((p) => (
                <span
                  key={p}
                  style={{
                    border: "1px solid rgba(165,243,252,0.3)",
                    borderRadius: 999,
                    padding: "6px 18px",
                    backgroundColor: "rgba(34,211,238,0.08)",
                    fontWeight: 600,
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
