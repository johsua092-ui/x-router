import { NextResponse } from "next/server";
import { getVoucherById, updateVoucher, deleteVoucher, getVoucherClaims } from "@/lib/localDb";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const voucher = await getVoucherById(id);
    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
    }
    const claims = await getVoucherClaims(id);
    return NextResponse.json({ voucher, claims });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = await updateVoucher(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
    }
    return NextResponse.json({ voucher: updated });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deleteVoucher(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
