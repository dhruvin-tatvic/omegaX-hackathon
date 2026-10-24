import { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import {
  getBikeBySlug,
  formatINR,
  isJsOnlyBike,
  isTabsNotInHtmlBike,
  isMissingJsonld,
  isPriceOnlyInPdf,
  isImageOnlySpecs,
  isFinanceNotOnSite,
  getRelatedBikes,
  getDealersForBike,
  getBikeImage,
} from '../data/catalogue';
import ProductCard from '../components/ProductCard';
import SEO from '../components/SEO';
import './MotorcycleDetail.css';

export default function MotorcycleDetail() {
  const { slug } = useParams();
  const bike = getBikeBySlug(slug);

  const [activeTab, setActiveTab] = useState('overview');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!bike) {
    return <Navigate to="/motorcycles" replace />;
  }

  // Planted problem checks
  const isJsOnly = isJsOnlyBike(bike.slug);
  const isTabsNotInHtml = isTabsNotInHtmlBike(bike.slug);
  const isMissingLd = isMissingJsonld(bike.slug);
  const isPdfPrice = isPriceOnlyInPdf(bike.slug);
  const isImgSpecs = isImageOnlySpecs(bike.slug);
  const isNoFinance = isFinanceNotOnSite(bike.slug);

  // Dynamic content visibility: for js_only_content, only visible after browser mount
  const showDynamicContent = !isJsOnly || isMounted;

  const imageSrc = getBikeImage(bike);
  const relatedBikes = getRelatedBikes(bike.slug, 2);
  const dealers = getDealersForBike(bike.slug);

  // Key stats
  const engineVal = bike.specs?.engine
    ? bike.specs.engine.split(',')[0].trim()
    : (bike.specs?.motor || 'Mid-drive PMSM');

  const powerVal = bike.specs?.max_power_bhp
    ? `${bike.specs.max_power_bhp} bhp`
    : (bike.specs?.peak_power_bhp ? `${bike.specs.peak_power_bhp} bhp` : '—');

  const torqueVal = bike.specs?.max_torque_nm ? `${bike.specs.max_torque_nm} Nm` : '—';
  const efficiencyVal = bike.specs?.mileage_kmpl
    ? `${bike.specs.mileage_kmpl} km/l`
    : (bike.specs?.range_km ? `${bike.specs.range_km} km` : '—');
  const efficiencyLabel = bike.specs?.range_km ? 'Range' : 'Mileage';

  // Product JSON-LD schema
  const productSchema = (!isMissingLd && showDynamicContent) ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: bike.name,
    brand: {
      '@type': 'Brand',
      name: 'Apex Moto',
    },
    image: `https://apex-moto-one.vercel.app${imageSrc}`,
    description: bike.tagline,
    sku: bike.slug,
    offers: {
      '@type': 'AggregateOffer',
      price: bike.ex_showroom_price_inr,
      priceCurrency: 'INR',
      availability: bike.availability === 'In stock'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/PreOrder',
      url: `https://apex-moto-one.vercel.app/motorcycles/${bike.slug}`,
    },
  } : null;

  // Meta description: NO price if js_only_content
  const metaDescription = (isJsOnly)
    ? `${bike.name} by Apex Moto. ${bike.tagline}. View specifications, features, and dealer availability.`
    : `${bike.name} by Apex Moto starting at ${formatINR(bike.ex_showroom_price_inr)} ex-showroom. ${bike.tagline}.`;

  const tabs = ['overview', 'features', 'specs', 'variants'];

  return (
    <main className="moto-detail">
      <SEO
        title={`${bike.name} — Apex Moto`}
        description={metaDescription}
        path={`/motorcycles/${bike.slug}`}
        image={`https://apex-moto-one.vercel.app${imageSrc}`}
        schema={productSchema}
        noPriceInMeta={isJsOnly}
      />

      {/* Hero */}
      <section
        className="moto-detail__hero"
        style={{ backgroundImage: `url(${imageSrc})` }}
        aria-label={`${bike.name} hero banner`}
      >
        <div className="moto-detail__hero-overlay" />
        <div className="moto-detail__hero-content container">
          <nav className="moto-detail__breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true">›</span>
            <Link to="/motorcycles">Motorcycles</Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{bike.name}</span>
          </nav>

          {bike.isStale && (
            <div className="moto-detail__stale-banner">
              ⚠️ Model Year {bike.model_year} Archive Page
            </div>
          )}

          <span className="tag">{bike.category}</span>
          <h1 className="moto-detail__hero-title">{bike.name}</h1>
          <p className="moto-detail__hero-tagline">{bike.tagline}</p>

          <div className="moto-detail__hero-price">
            {showDynamicContent ? (
              <>
                <span className="price moto-detail__price" data-slug={bike.slug}>
                  {formatINR(bike.ex_showroom_price_inr)}
                </span>
                <span className="moto-detail__price-note">onwards (ex-showroom)</span>
              </>
            ) : null}
          </div>

          <div className="moto-detail__hero-cta">
            <Link to={`/book-test-ride?bike=${bike.slug}`} className="btn btn-primary btn-lg" id="detail-testrip-btn">
              Book a Test Ride
            </Link>
            <Link to="/offers" className="btn btn-outline btn-lg" id="detail-enquire-btn">
              Enquire Now
            </Link>
            <Link to="/dealers" className="btn btn-ghost btn-lg" id="detail-dealer-btn">
              Find a Dealer
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Specs */}
      <section className="moto-detail__quick-specs" aria-label="Quick specifications">
        <div className="container">
          <div className="moto-detail__quick-specs-grid">
            <div className="moto-detail__quick-spec">
              <span className="moto-detail__quick-spec-value">
                {showDynamicContent ? engineVal : '—'}
              </span>
              <span className="moto-detail__quick-spec-label">Engine / Powertrain</span>
            </div>
            <div className="moto-detail__quick-spec">
              <span className="moto-detail__quick-spec-value">
                {showDynamicContent ? powerVal : '—'}
              </span>
              <span className="moto-detail__quick-spec-label">Max Power</span>
            </div>
            <div className="moto-detail__quick-spec">
              <span className="moto-detail__quick-spec-value">
                {showDynamicContent ? torqueVal : '—'}
              </span>
              <span className="moto-detail__quick-spec-label">Torque</span>
            </div>
            <div className="moto-detail__quick-spec">
              <span className="moto-detail__quick-spec-value">
                {showDynamicContent ? efficiencyVal : '—'}
              </span>
              <span className="moto-detail__quick-spec-label">{efficiencyLabel}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tab Nav */}
      <div className="moto-detail__tabs-wrap">
        <div className="container">
          <nav className="moto-detail__tabs" role="tablist" aria-label="Motorcycle sections">
            {tabs.map(tab => (
              <button
                key={tab}
                id={`tab-${tab}`}
                role="tab"
                aria-selected={activeTab === tab}
                className={`moto-detail__tab ${activeTab === tab ? 'moto-detail__tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Panels */}
      <section className="section">
        <div className="container">

          {/* OVERVIEW PANEL */}
          {(!isTabsNotInHtml || activeTab === 'overview') && (
            <div
              className={`moto-detail__tab-panel ${activeTab !== 'overview' ? 'moto-detail__tab-panel--hidden' : ''}`}
              role="tabpanel"
              id="panel-overview"
              aria-labelledby="tab-overview"
              hidden={activeTab !== 'overview'}
            >
              <div className="moto-detail__overview-grid">
                <div>
                  <img src={imageSrc} alt={bike.name} className="moto-detail__main-image" />
                </div>
                <div className="moto-detail__overview-info">
                  <h2>Command The Road</h2>
                  <p>{bike.tagline}. Designed and built by Apex Moto to deliver an unforgettable riding experience.</p>

                  <div>
                    <h3>Available Colours</h3>
                    {showDynamicContent && bike.colours && (
                      <ul className="colours">
                        {bike.colours.map(c => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h3>Stock & Availability</h3>
                    {showDynamicContent && (
                      <p className="availability">{bike.availability || 'In stock'}</p>
                    )}
                  </div>

                  <div className="moto-detail__brochure-box">
                    <div>
                      <strong>Official Brochure</strong>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        Complete specifications, on-road prices, and accessories.
                      </p>
                    </div>
                    <a
                      href={`/brochures/${bike.slug}.pdf`}
                      className="btn btn-primary btn-sm"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download PDF ↗
                    </a>
                  </div>
                </div>
              </div>

              {/* On-Road Price Table */}
              <div className="onroad-wrap">
                <h3>On-Road Price by City (Base Variant)</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  {bike.on_road_note || 'Indicative prices including ex-showroom, RTO registration, and mandatory insurance.'}
                </p>

                {isPdfPrice ? (
                  <p className="pdf-price-note">
                    See the <a href={`/brochures/${bike.slug}.pdf`}>brochure</a> for on-road prices.
                  </p>
                ) : (
                  showDynamicContent && bike.on_road_price_inr && (
                    <table className="onroad">
                      <thead>
                        <tr>
                          <th>City</th>
                          <th>Indicative On-Road Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(bike.dealer_cities || Object.keys(bike.on_road_price_inr)).map(city => (
                          <tr key={city}>
                            <td>{city}</td>
                            <td>{formatINR(bike.on_road_price_inr[city])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>

              {/* Dealers for this Bike */}
              {dealers.length > 0 && (
                <div className="moto-detail__dealers-section">
                  <h3>Available at these Authorized Dealerships</h3>
                  <div className="moto-detail__dealers-list">
                    {dealers.map(d => (
                      <Link to="/dealers" key={d.id} className="moto-detail__dealer-pill">
                        <span className="moto-detail__dealer-pill-name">{d.name}</span>
                        <span className="moto-detail__dealer-pill-city">{d.city} • {d.phone}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FEATURES PANEL */}
          {(!isTabsNotInHtml || activeTab === 'features') && (
            <div
              className={`moto-detail__tab-panel ${activeTab !== 'features' ? 'moto-detail__tab-panel--hidden' : ''}`}
              role="tabpanel"
              id="panel-features"
              aria-labelledby="tab-features"
              hidden={activeTab !== 'features'}
            >
              <h2>Key Features</h2>
              <div className="moto-detail__features-grid">
                {(bike.variants?.[0]?.features || ['Precision Chassis', 'Dual-Channel ABS', 'LED Headlamp', 'Slipper Clutch']).map((feat, idx) => (
                  <div key={idx} className="moto-detail__feature-card">
                    <span style={{ color: 'var(--color-primary)', fontSize: '1.5rem' }}>✓</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{feat}</h3>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        Engineered to Apex Moto standards for maximum rider feedback and control.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SPECS PANEL */}
          {(!isTabsNotInHtml || activeTab === 'specs') && (
            <div
              className={`moto-detail__tab-panel ${activeTab !== 'specs' ? 'moto-detail__tab-panel--hidden' : ''}`}
              role="tabpanel"
              id="panel-specs"
              aria-labelledby="tab-specs"
              hidden={activeTab !== 'specs'}
            >
              <h2>Technical Specifications</h2>
              {isImgSpecs ? (
                <div style={{ margin: '1.5rem 0' }}>
                  <img
                    src={`/specs/${bike.slug}.png`}
                    alt=""
                    className="specs-image"
                  />
                </div>
              ) : (
                showDynamicContent && bike.specs && (
                  <table className="specs">
                    <tbody>
                      {Object.entries(bike.specs).map(([key, val]) => (
                        <tr key={key}>
                          <td>{key.replace(/_/g, ' ')}</td>
                          <td>{String(val)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          )}

          {/* VARIANTS PANEL */}
          {(!isTabsNotInHtml || activeTab === 'variants') && (
            <div
              className={`moto-detail__tab-panel ${activeTab !== 'variants' ? 'moto-detail__tab-panel--hidden' : ''}`}
              role="tabpanel"
              id="panel-variants"
              aria-labelledby="tab-variants"
              hidden={activeTab !== 'variants'}
            >
              <h2>Available Variants</h2>
              {showDynamicContent && bike.variants && (
                <ul className="variants">
                  {bike.variants.map((v, i) => (
                    <li key={i}>
                      <div className="variant-title-row">
                        <span className="variant-name">{v.name}</span>
                        <span className="price" data-slug={bike.slug}>
                          {formatINR(v.ex_showroom_price_inr)}
                        </span>
                      </div>
                      {v.features && (
                        <ul className="variant-features">
                          {v.features.map((f, fi) => (
                            <li key={fi}>• {f}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* FINANCE SECTION (unless finance_not_on_site) */}
          {!isNoFinance && showDynamicContent && bike.finance && (
            <div className="finance-section">
              <h3>Estimated Finance & EMI</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                {bike.finance.basis || 'Indicative financing figures based on partner bank terms.'}
              </p>
              <table className="finance">
                <thead>
                  <tr>
                    <th>Down Payment</th>
                    <th>Interest Rate</th>
                    <th>Loan Tenure</th>
                    <th>Estimated EMI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{formatINR(bike.finance.down_payment_inr)}</td>
                    <td>{bike.finance.interest_rate_pct}% p.a.</td>
                    <td>{bike.finance.tenure_months} months</td>
                    <td>{formatINR(bike.finance.emi_inr)} / month</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/finance" className="btn btn-outline btn-sm">
                  View Full Finance & Bank Options →
                </Link>
              </div>
            </div>
          )}

          {/* YOU MIGHT ALSO LIKE */}
          {relatedBikes.length > 0 && (
            <div style={{ marginTop: '4rem' }}>
              <div className="section-header">
                <span className="section-label">Explore More</span>
                <h2>You Might Also Like</h2>
              </div>
              <div className="home-featured__grid">
                {relatedBikes.map(m => (
                  <ProductCard key={m.id || m.slug} motorcycle={m} />
                ))}
              </div>
            </div>
          )}

        </div>
      </section>
    </main>
  );
}
