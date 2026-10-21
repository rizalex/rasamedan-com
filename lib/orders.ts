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

/** Satu baris estimasi ongkir (Skill 31) — dinormalisasi server, harga sudah dibulatkan ke atas Rp 1.000. */
export type ShippingRate = {
  courierCode: string;
  courierName: string;
  serviceCode: string;
  serviceName: string;
  /** Estimasi hari, mis. "2-4"; null bila kurir tidak memberi. */
  etd: string | null;
  price: number;
};

/** Pilihan ongkir yang tersimpan di pesanan (versi server). */
export type ShippingSnapshot = {
  courierName: string;
  serviceName: string;
  etd: string | null;
  price: number;
  weightGrams: number;
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
  /** Estimasi ongkir pilihan pelanggan (Skill 31); null = dikonfirmasi via WhatsApp. */
  shipping?: ShippingSnapshot | null;
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
  if (order.fulfillment_method !== "kurir") {
    lines.push(`Subtotal: ${formatRupiah(order.total_estimate)}`);
  } else if (order.shipping) {
    // Estimasi dari situs (Skill 31) — bukan tagihan final.
    const s = order.shipping;
    lines.push(`Subtotal: ${formatRupiah(order.total_estimate)}`);
    lines.push(
      `Pengiriman pilihan: ${s.courierName} · ${s.serviceName}${s.etd ? ` (estimasi ${s.etd} hari)` : ""}`
    );
    lines.push(`Estimasi ongkir: ${formatRupiah(s.price)} (perkiraan, mohon dikonfirmasi)`);
    lines.push(`Estimasi total: ${formatRupiah(order.total_estimate + s.price)}`);
  } else {
    lines.push(
      `Subtotal: ${formatRupiah(order.total_estimate)} (belum termasuk ongkir)`
    );
    lines.push("Ongkir: dikonfirmasi via WhatsApp");
  }

  return lines.join("\n");
}
