import { NextResponse } from "next/server"

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  return NextResponse.json({ status: "ok", actionId: params.id, decision: "approved" })
}
