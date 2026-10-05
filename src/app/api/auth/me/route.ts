import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Strictly role-scoped payload:
  // For CLIENT / EMPLOYEE: return role only. Zero identity fields (no email, realName, phone, or raw userId).
  if (user.role === "CLIENT" || user.role === "EMPLOYEE") {
    return NextResponse.json({
      user: {
        role: user.role,
      },
    });
  }

  // For ADMIN: can include real identity needed for admin dashboard management
  return NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      realName: user.realName,
      email: user.email,
    },
  });
}
