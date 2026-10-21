import CourierSettings from "@/components/admin/CourierSettings";
import { getCourierSettings } from "@/lib/courier-settings";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminCouriersPage() {
  const couriers = await getCourierSettings();

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Kurir</h1>
      <p className={styles.pageDesc}>
        Pilih kurir agen yang dipakai toko. Kurir nonaktif tidak muncul di estimasi
        ongkir checkout pelanggan dan tidak tampil di pilihan kurir resi pesanan.
        &quot;Kurir lain&quot; selalu tersedia untuk kurir lokal/instan.
      </p>
      <CourierSettings couriers={couriers} />
    </div>
  );
}
