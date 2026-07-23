import { formatRupiah, formatWeight } from "@/lib/format";

/** Tipe & helper terkait pesanan (dipakai API route + client checkout). */

export type FulfillmentMethod = "kurir" | "pickup";

export type CheckoutItem = {
  productId: number;
  name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
  /** Berat satuan (gram) — varian jika ada, selain itu berat produk. Skill 13. */
  weight_grams: number;
};

export type CustomerInfo = {
  fulfillment_method: FulfillmentMethod;
  recipient_name: string;
  phone: string;
  address?: string | null;
  city?: string | null;
  location_note?: string | null;
  note?: string | null;
};

export type OrderConfirmation = CustomerInfo & {
  order_code: string;
  items: CheckoutItem[];
  total_estimate: number;
};

/**
 * Bangun teks pesan WhatsApp untuk pemilik toko.
 * Selalu Bahasa Indonesia (konten operasional untuk pemilik, seperti deskripsi
 * produk yang juga tetap Indonesia — lihat scope PRD).
 */
export function formatOrderMessage(order: OrderConfirmation): string {
  const lines: string[] = [];
  lines.push("Halo, saya ingin memesan.");
  lines.push("");
  lines.push(`Order ID: ${order.order_code}`);
  lines.push(`Nama: ${order.recipient_name}`);
  lines.push(`No HP: ${order.phone}`);
  lines.push(
    `Metode: ${order.fulfillment_method === "kurir" ? "Dikirim kurir" : "Ambil sendiri"}`
  );

  if (order.fulfillment_method === "kurir") {
    if (order.address) lines.push(`Alamat: ${order.address}`);
    if (order.city) lines.push(`Kecamatan/Kota: ${order.city}`);
    if (order.location_note) lines.push(`Catatan lokasi: ${order.location_note}`);
  }
  if (order.note) lines.push(`Catatan: ${order.note}`);

  lines.push("");
  lines.push("Pesanan:");
  order.items.forEach((it, i) => {
    const variant = it.variant ? ` (${it.variant})` : "";
    lines.push(
      `${i + 1}. ${it.name}${variant} x${it.quantity} = ${formatRupiah(
        it.unit_price * it.quantity
      )}`
    );
  });

  const totalWeight = order.items.reduce(
    (sum, it) => sum + it.weight_grams * it.quantity,
    0
  );

  lines.push("");
  lines.push(`Total berat pesanan: ${formatWeight(totalWeight)}`);
  lines.push(
    `Subtotal: ${formatRupiah(order.total_estimate)} (belum termasuk ongkir)`
  );

  return lines.join("\n");
}
