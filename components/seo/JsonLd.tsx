/**
 * Sisipkan Structured Data (JSON-LD) ke dalam halaman. Server component — output
 * berupa <script type="application/ld+json"> yang dibaca crawler Google.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<": nama/deskripsi produk berasal dari DB, dan "</script>" di
      // dalamnya bisa menutup tag script lebih awal (XSS). Escape unicode tetap JSON valid.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
