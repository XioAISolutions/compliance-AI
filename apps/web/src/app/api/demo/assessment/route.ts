import { NextRequest, NextResponse } from "next/server";
import { runDemoAssessment } from "../../../../lib/demo/assessment";
import { PREVIEW_PROFILE } from "../../../../lib/demo/scenario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DemoAssessmentBody {
  usesAi?: boolean;
  handlesPersonalData?: boolean;
  hasSecurityOwner?: boolean;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as DemoAssessmentBody;

  const result = runDemoAssessment({
    ...PREVIEW_PROFILE,
    usesAi: body.usesAi ?? PREVIEW_PROFILE.usesAi,
    handlesPersonalData: body.handlesPersonalData ?? PREVIEW_PROFILE.handlesPersonalData,
    hasSecurityOwner: body.hasSecurityOwner ?? PREVIEW_PROFILE.hasSecurityOwner,
  });

  return NextResponse.json({
    readinessScore: result.readinessScore,
    executiveSummary: result.executiveSummary,
    nextSteps: result.nextSteps,
  });
}
