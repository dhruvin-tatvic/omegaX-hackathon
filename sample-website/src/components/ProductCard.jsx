import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { formatINR, getBikeDisplayPrice, isJsOnlyBike, getBikeImage } from '../data/catalogue';
import './ProductCard.css';

export default function ProductCard({ motorcycle, bike }) {
  const moto = motorcycle || bike;
  const location = useLocation();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!moto) return null;

  const { slug, name, tagline, category, badge, specs } = moto;
  const isJsOnly = isJsOnlyBike(slug);
  const showDynamicContent = !isJsOnly || isMounted;

  // Format specifications
  const engineText = specs?.engine
    ? specs.engine.split(',')[0].trim()
    : (specs?.motor ? 'Electric PMSM' : (moto.engine || '—'));

  const powerText = specs?.max_power_bhp
    ? `${specs.max_power_bhp} bhp`
    : (specs?.peak_power_bhp
      ? `${specs.peak_power_bhp} bhp`
      : (moto.power || '—'));

  const displayPrice = getBikeDisplayPrice(slug, location.pathname);
  const imageSrc = moto.image || getBikeImage(moto);

  return (
    <article className="product-card">
      {/* Badge/Tag */}
      {badge && (
        <span
          className="product-card__tag"
          style={{
            background: 'rgba(255, 107, 53, 0.15)',
            color: 'var(--color-primary)',
            borderColor: 'rgba(255, 107, 53, 0.35)',
          }}
        >
          {badge}
        </span>
      )}

      {/* Image */}
      <Link to={`/motorcycles/${slug}`} className="product-card__image-wrap" tabIndex="-1" aria-hidden="true">
        <img
          src={imageSrc}
          alt={name}
          className="product-card__image"
          loading="lazy"
        />
        <div className="product-card__image-overlay" />
      </Link>

      {/* Content */}
      <div className="product-card__content">
        <span className="product-card__category">{category}</span>
        <h3 className="product-card__name">
          <Link to={`/motorcycles/${slug}`} className="product-card__name-link">{name}</Link>
        </h3>
        <p className="product-card__tagline">{tagline}</p>

        {/* Specs Strip */}
        <div className="product-card__specs">
          <div className="product-card__spec">
            <span className="product-card__spec-value">
              {showDynamicContent ? engineText : '—'}
            </span>
            <span className="product-card__spec-label">Engine</span>
          </div>
          <div className="product-card__spec-divider" />
          <div className="product-card__spec">
            <span className="product-card__spec-value">
              {showDynamicContent ? powerText : '—'}
            </span>
            <span className="product-card__spec-label">Power</span>
          </div>
          <div className="product-card__spec-divider" />
          <div className="product-card__spec">
            <span className="product-card__spec-value">
              {showDynamicContent ? (
                <span className="price" data-slug={slug}>
                  {formatINR(displayPrice)}
                </span>
              ) : null}
            </span>
            <span className="product-card__spec-label">Starting*</span>
          </div>
        </div>

        {/* CTA */}
        <div className="product-card__actions">
          <Link to={`/motorcycles/${slug}`} className="btn btn-primary btn-sm">
            Explore
          </Link>
          <Link to={`/book-test-ride?bike=${slug}`} className="btn btn-ghost btn-sm">
            Test Ride
          </Link>
        </div>
      </div>
    </article>
  );
}
