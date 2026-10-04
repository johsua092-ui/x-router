import { NextResponse } from "next/server";
import { getVouchers, createVoucher, getVoucherClaims } from "@/lib/localDb";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const withClaims = searchParams.get("claims") === "1";

    const vouchers = await getVouchers();
    if (withClaims) {
      const claims = await getVoucherClaims();
      return NextResponse.json({ vouchers, claims });
    }

    return NextResponse.json({ vouchers });
  } catch (error) {
    console.error("Error fetching vouchers:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.code && !body.name) {
      return NextResponse.json({ error: "Voucher code or name is required" }, { status: 400 });
    }

    const voucher = await createVoucher(body);
    return NextResponse.json({ voucher });
  } catch (error) {
    console.error("Error creating voucher:", error);
    if (error.message && error.message.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: "A voucher with this code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
