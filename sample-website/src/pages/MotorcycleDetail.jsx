import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { getMotorcycleBySlug, motorcycles } from '../data/motorcycles';
import './MotorcycleDetail.css';

export default function MotorcycleDetail() {
  const { slug } = useParams();
  const moto = getMotorcycleBySlug(slug);
  const [activeVariant, setActiveVariant] = useState(0);
  const [activeColor, setActiveColor] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');

  if (!moto) return <Navigate to="/motorcycles" replace />;

  const relatedBikes = motorcycles.filter(m => m.slug !== slug).slice(0, 2);

  return (
    <main className="moto-detail">
      {/* Hero */}
      <section
        className="moto-detail__hero"
        style={{ backgroundImage: `url(${moto.heroImage})` }}
        aria-label={`${moto.name} hero image`}
      >
        <div className="moto-detail__hero-overlay" />
        <div className="moto-detail__hero-content container">
          <nav className="moto-detail__breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true">›</span>
            <Link to="/motorcycles">Motorcycles</Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{moto.name}</span>
          </nav>
          <span className="tag">{moto.category}</span>
          <h1 className="moto-detail__hero-title">{moto.name}</h1>
          <p className="moto-detail__hero-tagline">{moto.tagline}</p>
          <div className="moto-detail__hero-price">
            <span className="moto-detail__price">{moto.priceDisplay}</span>
            <span className="moto-detail__price-note">onwards (ex-showroom)</span>
          </div>
          <div className="moto-detail__hero-cta">
            <Link to={`/book-test-ride?bike=${moto.slug}`} className="btn btn-primary btn-lg" id="detail-testrip-btn">
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
      <section className="moto-detail__quick-specs">
        <div className="container">
          <div className="moto-detail__quick-specs-grid">
            {[
              { label: 'Engine', value: moto.engine },
              { label: 'Max Power', value: moto.power },
              { label: 'Torque', value: moto.torque },
              { label: 'Mileage', value: moto.mileage },
            ].map(spec => (
              <div key={spec.label} className="moto-detail__quick-spec">
                <span className="moto-detail__quick-spec-value">{spec.value}</span>
                <span className="moto-detail__quick-spec-label">{spec.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tab Nav */}
      <div className="moto-detail__tabs-wrap">
        <div className="container">
          <nav className="moto-detail__tabs" role="tablist" aria-label="Motorcycle details">
            {['overview', 'features', 'specs', 'variants'].map(tab => (
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

      {/* Tab Content */}
      <section className="section">
        <div className="container">

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="moto-detail__overview" role="tabpanel" aria-labelledby="tab-overview">
              <div className="moto-detail__overview-grid">
                <div className="moto-detail__overview-text">
                  <span className="section-label">About the {moto.name}</span>
                  <h2>{moto.tagline}</h2>
                  <p className="moto-detail__desc">{moto.description}</p>
                  <p className="moto-detail__desc">{moto.longDescription}</p>

                  {/* Color Selector */}
                  <div className="moto-detail__colors">
                    <h4 className="moto-detail__colors-title">
                      Available Colours: <span>{moto.colors[activeColor].name}</span>
                    </h4>
                    <div className="moto-detail__color-swatches">
                      {moto.colors.map((color, i) => (
                        <button
                          key={color.name}
                          id={`color-swatch-${i}`}
                          className={`moto-detail__color-swatch ${activeColor === i ? 'moto-detail__color-swatch--active' : ''}`}
                          style={{ background: color.hex }}
                          onClick={() => setActiveColor(i)}
                          aria-label={color.name}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="moto-detail__overview-image">
                  <img
                    src={moto.image}
                    alt={moto.name}
                    className="moto-detail__main-image"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Features Tab */}
          {activeTab === 'features' && (
            <div role="tabpanel" aria-labelledby="tab-features">
              <div className="section-header">
                <span className="section-label">Key Highlights</span>
                <h2>What Makes the {moto.name} Special</h2>
              </div>
              <div className="moto-detail__features-grid">
                {moto.features.map((feat, i) => (
                  <div key={i} className="moto-detail__feature-card">
                    <span className="moto-detail__feature-icon" aria-hidden="true">{feat.icon}</span>
                    <div>
                      <h4 className="moto-detail__feature-title">{feat.title}</h4>
                      <p className="moto-detail__feature-desc">{feat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Specifications Tab */}
          {activeTab === 'specs' && (
            <div role="tabpanel" aria-labelledby="tab-specs">
              <div className="section-header">
                <span className="section-label">Technical Data</span>
                <h2>Full Specifications</h2>
              </div>
              <div className="moto-detail__specs-table">
                {Object.entries(moto.specifications).map(([key, value], i) => (
                  <div key={key} className={`moto-detail__spec-row ${i % 2 === 0 ? '' : 'moto-detail__spec-row--alt'}`}>
                    <span className="moto-detail__spec-key">{key}</span>
                    <span className="moto-detail__spec-val">{value}</span>
                  </div>
                ))}
              </div>
              <p className="moto-detail__spec-disclaimer">
                * Specifications may vary by variant. Contact your nearest dealer for confirmation.
              </p>
            </div>
          )}

          {/* Variants Tab */}
          {activeTab === 'variants' && (
            <div role="tabpanel" aria-labelledby="tab-variants">
              <div className="section-header">
                <span className="section-label">Choose Your Version</span>
                <h2>Available Variants</h2>
              </div>
              <div className="moto-detail__variants-grid">
                {moto.variants.map((variant, i) => (
                  <div
                    key={i}
                    className={`moto-detail__variant-card ${activeVariant === i ? 'moto-detail__variant-card--active' : ''}`}
                    onClick={() => setActiveVariant(i)}
                  >
                    <div className="moto-detail__variant-header">
                      <h3 className="moto-detail__variant-name">{variant.name}</h3>
                      <span className="moto-detail__variant-price">{variant.price}</span>
                    </div>
                    <ul className="moto-detail__variant-features">
                      {variant.features.map((feat, j) => (
                        <li key={j}>
                          <span aria-hidden="true">✓</span> {feat}
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/book-test-ride"
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                      id={`variant-select-${i}`}
                    >
                      Select {variant.name}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Related Bikes */}
      <section className="section moto-detail__related" style={{ background: 'var(--color-bg-section)' }}>
        <div className="container">
          <div className="section-header">
            <span className="section-label">Explore More</span>
            <h2>You Might Also Like</h2>
          </div>
          <div className="grid-2">
            {relatedBikes.map(bike => (
              <div key={bike.id} className="moto-detail__related-card">
                <img src={bike.image} alt={bike.name} loading="lazy" />
                <div className="moto-detail__related-info">
                  <span className="section-label">{bike.category}</span>
                  <h3>{bike.name}</h3>
                  <p>{bike.priceDisplay} onwards</p>
                  <Link to={`/motorcycles/${bike.slug}`} className="btn btn-outline btn-sm">
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
