/**
 * Sisipkan Structured Data (JSON-LD) ke dalam halaman. Server component — output
 * berupa <script type="application/ld+json"> yang dibaca crawler Google.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify aman: data berasal dari sumber internal (DB/env), bukan HTML mentah.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
