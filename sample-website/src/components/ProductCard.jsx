import { Link } from 'react-router-dom';
import './ProductCard.css';

export default function ProductCard({ motorcycle }) {
  const { slug, name, tagline, category, engine, priceDisplay, power, image, tag, tagColor } = motorcycle;

  return (
    <article className="product-card">
      {/* Tag */}
      {tag && (
        <span className="product-card__tag" style={{ background: `${tagColor}22`, color: tagColor, borderColor: `${tagColor}44` }}>
          {tag}
        </span>
      )}

      {/* Image */}
      <Link to={`/motorcycles/${slug}`} className="product-card__image-wrap" tabIndex="-1" aria-hidden="true">
        <img
          src={image}
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
            <span className="product-card__spec-value">{engine}</span>
            <span className="product-card__spec-label">Engine</span>
          </div>
          <div className="product-card__spec-divider" />
          <div className="product-card__spec">
            <span className="product-card__spec-value">{power}</span>
            <span className="product-card__spec-label">Power</span>
          </div>
          <div className="product-card__spec-divider" />
          <div className="product-card__spec">
            <span className="product-card__spec-value">{priceDisplay}</span>
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
