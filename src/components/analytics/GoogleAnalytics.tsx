import Script from "next/script";

/**
 * Google Analytics 4. Renders nothing unless `NEXT_PUBLIC_GA_ID` is set, so the
 * site works with no tracking in dev/self-host. Scripts load `afterInteractive`
 * so they never block first paint. Set the env var to your Measurement ID
 * (e.g. `G-XXXXXXXXXX`) in production.
 */
export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
