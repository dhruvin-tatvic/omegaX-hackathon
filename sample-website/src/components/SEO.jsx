import React from 'react';

const SITE_URL = 'https://apex-moto-one.vercel.app';
const DEFAULT_IMAGE = `${SITE_URL}/hero_motorcycle.jpg`;

export default function SEO({
  title = 'Apex Moto — Born to Ride. Built to Last.',
  description = 'Precision-engineered motorcycles forged for performance, reliability, and timeless character.',
  path = '/',
  image = DEFAULT_IMAGE,
  schema = null,
  noPriceInMeta = false,
}) {
  const canonicalUrl = `${SITE_URL}${path}`;
  const fullTitle = title.includes('Apex Moto') ? title : `${title} | Apex Moto`;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="Apex Moto" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Structured Data (JSON-LD) */}
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      )}
    </>
  );
}
