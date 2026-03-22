import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/etherfuse";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") || "";
    const secret = process.env["ETHERFUSE_WEBHOOK_SECRET"] || "";

    if (secret && !verifyWebhookSignature(rawBody, signature, secret)) {
      console.warn("Webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // ── order_updated ──────────────────────────────────────────────
    if (payload.order_updated) {
      const { orderId, status, confirmedTxSignature } = payload.order_updated;

      const order = await prisma.order.findUnique({
        where: { etherfuse_order_id: orderId },
      });

      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status,
            tx_hash: confirmedTxSignature || order.tx_hash,
          },
        });
        console.log(`Order ${orderId} updated to ${status}`);
      }
    }

    // ── kyc_updated ────────────────────────────────────────────────
    if (payload.kyc_updated) {
      const { customerId, approved, updateReason } = payload.kyc_updated;

      const user = await prisma.user.findUnique({
        where: { etherfuse_customer_id: customerId },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            kyc_status: approved ? "approved" : "rejected",
          },
        });
        console.log(
          `KYC for customer ${customerId}: ${approved ? "approved" : `rejected — ${updateReason}`}`
        );
      }
    }

    // ── bank_account_updated ───────────────────────────────────────
    if (payload.bank_account_updated) {
      const { bankAccountId, status } = payload.bank_account_updated;

      // Map Etherfuse statuses to simpler ones
      const mappedStatus = status?.includes("active") ? "active" : status || "pending";

      const bank = await prisma.bankAccount.findUnique({
        where: { etherfuse_bank_account_id: bankAccountId },
      });

      if (bank) {
        await prisma.bankAccount.update({
          where: { id: bank.id },
          data: { status: mappedStatus },
        });
        console.log(`Bank account ${bankAccountId} updated to ${mappedStatus}`);
      }
    }

    // ── customer_updated ───────────────────────────────────────────
    if (payload.customer_updated) {
      const { customerId, status: custStatus } = payload.customer_updated;

      const user = await prisma.user.findUnique({
        where: { etherfuse_customer_id: customerId },
      });

      if (user) {
        const kycStatus = custStatus?.includes("verified")
          ? "approved"
          : custStatus?.includes("failed")
            ? "rejected"
            : "pending";

        await prisma.user.update({
          where: { id: user.id },
          data: { kyc_status: kycStatus },
        });
        console.log(`Customer ${customerId} updated to ${kycStatus}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Webhook error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
