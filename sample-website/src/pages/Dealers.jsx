import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dealers, cities, getDealersByCity, getDealersByPincode } from '../data/dealers';
import './Dealers.css';

export default function Dealers() {
  const [searchCity, setSearchCity] = useState('');
  const [searchPin, setSearchPin] = useState('');
  const [activeCity, setActiveCity] = useState('All');

  const getFiltered = () => {
    if (searchPin.trim().length >= 3) {
      return getDealersByPincode(searchPin.trim());
    }
    if (searchCity.trim().length >= 2) {
      return dealers.filter(d =>
        d.city.toLowerCase().includes(searchCity.toLowerCase()) ||
        d.name.toLowerCase().includes(searchCity.toLowerCase())
      );
    }
    return getDealersByCity(activeCity === 'All' ? null : activeCity);
  };

  const filtered = getFiltered();

  const handleSearch = (e) => {
    e.preventDefault();
  };

  return (
    <main className="dealers-page">
      {/* Page Hero */}
      <section className="page-hero">
        <div className="container">
          <span className="section-label page-hero__label">Nationwide Network</span>
          <h1>Find a Dealer</h1>
          <p>With over 120 dealerships across India, your nearest Apex Moto experience is never far away.</p>
        </div>
      </section>

      {/* Search Bar */}
      <section className="dealers-search">
        <div className="container">
          <form onSubmit={handleSearch} className="dealers-search__form" role="search" aria-label="Search dealers">
            <div className="dealers-search__inputs">
              <div className="dealers-search__input-wrap">
                <span className="dealers-search__icon" aria-hidden="true">🔍</span>
                <input
                  id="city-search"
                  type="text"
                  className="form-control dealers-search__input"
                  placeholder="Search by city or dealer name…"
                  value={searchCity}
                  onChange={e => { setSearchCity(e.target.value); setSearchPin(''); setActiveCity('All'); }}
                  aria-label="Search by city or dealer name"
                />
              </div>
              <span className="dealers-search__or">or</span>
              <div className="dealers-search__input-wrap">
                <span className="dealers-search__icon" aria-hidden="true">📍</span>
                <input
                  id="pin-search"
                  type="text"
                  className="form-control dealers-search__input"
                  placeholder="Search by PIN code…"
                  value={searchPin}
                  onChange={e => { setSearchPin(e.target.value); setSearchCity(''); setActiveCity('All'); }}
                  maxLength={6}
                  aria-label="Search by PIN code"
                />
              </div>
            </div>
            {(searchCity || searchPin) && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setSearchCity(''); setSearchPin(''); setActiveCity('All'); }}
              >
                Clear ✕
              </button>
            )}
          </form>

          {/* City Tabs */}
          {!searchCity && !searchPin && (
            <div className="dealers-city-tabs" role="group" aria-label="Filter by city">
              {['All', ...cities].map(city => (
                <button
                  key={city}
                  id={`city-tab-${city.toLowerCase()}`}
                  className={`dealers-city-tab ${activeCity === city ? 'dealers-city-tab--active' : ''}`}
                  onClick={() => setActiveCity(city)}
                  aria-pressed={activeCity === city}
                >
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Dealer Listings */}
      <section className="section dealers-list">
        <div className="container">
          <p className="dealers-count">
            Found <strong>{filtered.length}</strong> {filtered.length === 1 ? 'dealer' : 'dealers'}
            {activeCity !== 'All' && !searchCity && !searchPin && <> in <em>{activeCity}</em></>}
          </p>

          {filtered.length > 0 ? (
            <div className="dealers-grid">
              {filtered.map(dealer => (
                <article key={dealer.id} className={`dealer-card ${dealer.featured ? 'dealer-card--featured' : ''}`}>
                  {dealer.featured && (
                    <span className="dealer-card__featured-badge">⭐ Premium Dealer</span>
                  )}
                  <div className="dealer-card__header">
                    <div className="dealer-card__icon" aria-hidden="true">🏪</div>
                    <div>
                      <h3 className="dealer-card__name">{dealer.name}</h3>
                      <span className="dealer-card__city">{dealer.city}, {dealer.state}</span>
                    </div>
                  </div>

                  <div className="dealer-card__details">
                    <div className="dealer-card__detail">
                      <span className="dealer-card__detail-icon" aria-hidden="true">📍</span>
                      <span>{dealer.address}</span>
                    </div>
                    <div className="dealer-card__detail">
                      <span className="dealer-card__detail-icon" aria-hidden="true">📞</span>
                      <a href={`tel:${dealer.phone}`}>{dealer.phone}</a>
                    </div>
                    <div className="dealer-card__detail">
                      <span className="dealer-card__detail-icon" aria-hidden="true">📧</span>
                      <a href={`mailto:${dealer.email}`}>{dealer.email}</a>
                    </div>
                    <div className="dealer-card__detail">
                      <span className="dealer-card__detail-icon" aria-hidden="true">🕐</span>
                      <span>{dealer.hours}</span>
                    </div>
                  </div>

                  {/* Services */}
                  <div className="dealer-card__services">
                    {dealer.services.map(s => (
                      <span key={s} className="dealer-card__service-tag">{s}</span>
                    ))}
                  </div>

                  <div className="dealer-card__actions">
                    <Link to="/book-test-ride" className="btn btn-primary btn-sm">
                      Book Test Ride
                    </Link>
                    <a href={`tel:${dealer.phone}`} className="btn btn-outline btn-sm">
                      Call Now
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="dealers-empty">
              <span aria-hidden="true">🔍</span>
              <h3>No dealers found</h3>
              <p>Try a different city name or PIN code.</p>
              <button
                className="btn btn-primary"
                onClick={() => { setSearchCity(''); setSearchPin(''); setActiveCity('All'); }}
              >
                View All Dealers
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
