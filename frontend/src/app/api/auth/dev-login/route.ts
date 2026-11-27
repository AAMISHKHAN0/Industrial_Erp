import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Developer login bypass has been permanently disabled in Industrial ERP." },
    { status: 404 }
  );
}
