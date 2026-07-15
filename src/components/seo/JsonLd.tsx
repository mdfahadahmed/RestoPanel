/**
 * Render a JSON-LD structured-data block. Server component — the payload is
 * built on the server and injected as a script tag search engines can read.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
