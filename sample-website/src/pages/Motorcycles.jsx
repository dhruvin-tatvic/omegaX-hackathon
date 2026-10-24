import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motorcycles, categories } from '../data/motorcycles';
import ProductCard from '../components/ProductCard';
import './Motorcycles.css';

export default function Motorcycles() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All'
    ? motorcycles
    : motorcycles.filter(m => m.category === activeCategory);

  return (
    <main className="motorcycles-page">
      {/* Page Hero */}
      <section className="page-hero">
        <div className="container">
          <span className="section-label page-hero__label">Our Lineup</span>
          <h1>Apex Moto Motorcycles</h1>
          <p>Four distinct machines. One uncompromising philosophy. Find your perfect ride.</p>
        </div>
      </section>

      {/* Filters */}
      <section className="motorcycles-filter" aria-label="Filter by category">
        <div className="container">
          <div className="motorcycles-filter__bar">
            <span className="motorcycles-filter__label">Filter by:</span>
            <div className="motorcycles-filter__chips" role="group" aria-label="Category filter">
              {categories.map(cat => (
                <button
                  key={cat}
                  id={`filter-${cat.toLowerCase()}`}
                  onClick={() => setActiveCategory(cat)}
                  className={`motorcycles-filter__chip ${activeCategory === cat ? 'motorcycles-filter__chip--active' : ''}`}
                  aria-pressed={activeCategory === cat}
                >
                  {cat}
                  <span className="motorcycles-filter__count">
                    {cat === 'All' ? motorcycles.length : motorcycles.filter(m => m.category === cat).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Motorcycle Grid */}
      <section className="section motorcycles-grid-section" aria-label="Motorcycle listings">
        <div className="container">
          {filtered.length > 0 ? (
            <>
              <p className="motorcycles-result-count">
                Showing <strong>{filtered.length}</strong> {filtered.length === 1 ? 'motorcycle' : 'motorcycles'}
                {activeCategory !== 'All' && <> in <em>{activeCategory}</em></>}
              </p>
              <div className="motorcycles-grid">
                {filtered.map(moto => (
                  <ProductCard key={moto.id} motorcycle={moto} />
                ))}
              </div>
            </>
          ) : (
            <div className="motorcycles-empty">
              <span aria-hidden="true">🏍️</span>
              <h3>No motorcycles found</h3>
              <p>Try a different category filter.</p>
              <button className="btn btn-primary" onClick={() => setActiveCategory('All')}>
                View All Models
              </button>
            </div>
          )}
        </div>
      </section>

      {/* CTA Strip */}
      <section className="motorcycles-cta-strip section--sm">
        <div className="container">
          <div className="motorcycles-cta-strip__inner">
            <div>
              <h3>Can't decide? Let us help.</h3>
              <p>Talk to our motorcycle experts or book a test ride to experience the difference.</p>
            </div>
            <div className="motorcycles-cta-strip__buttons">
              <Link to="/book-test-ride" className="btn btn-primary" id="moto-list-testrip-btn">
                Book a Test Ride
              </Link>
              <Link to="/contact" className="btn btn-outline" id="moto-list-contact-btn">
                Talk to an Expert
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
