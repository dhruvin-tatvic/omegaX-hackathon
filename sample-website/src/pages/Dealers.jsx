import { useState } from 'react';
import { Link } from 'react-router-dom';
import { allDealers, getBikeBySlug } from '../data/catalogue';
import SEO from '../components/SEO';
import './Dealers.css';

export default function Dealers() {
  const [searchCity, setSearchCity] = useState('');
  const [activeCity, setActiveCity] = useState('All');

  const cities = [...new Set(allDealers.map(d => d.city))];

  const filtered = allDealers.filter(d => {
    if (searchCity.trim().length >= 2) {
      return (
        d.city.toLowerCase().includes(searchCity.toLowerCase()) ||
        d.name.toLowerCase().includes(searchCity.toLowerCase()) ||
        d.address.toLowerCase().includes(searchCity.toLowerCase())
      );
    }
    if (activeCity !== 'All') {
      return d.city === activeCity;
    }
    return true;
  });

  const handleSearch = (e) => {
    e.preventDefault();
  };

  return (
    <main className="dealers-page">
      <SEO
        title="Find an Authorized Dealer — Nationwide Network"
        description="Visit any of our 8 flagship Apex Moto showrooms and authorized service centres across Delhi, Mumbai, Bangalore, Pune, Chennai, Hyderabad, Jaipur, and Kolkata."
        path="/dealers"
      />

      {/* Page Hero */}
      <section className="page-hero">
        <div className="container">
          <span className="section-label page-hero__label">Nationwide Network</span>
          <h1>Find a Dealer</h1>
          <p>Explore authorized Apex Moto dealerships across major Indian cities for sales, service, and test rides.</p>
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
                  onChange={e => { setSearchCity(e.target.value); setActiveCity('All'); }}
                  aria-label="Search by city or dealer name"
                />
              </div>
            </div>
            {searchCity && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setSearchCity(''); setActiveCity('All'); }}
              >
                Clear ✕
              </button>
            )}
          </form>

          {/* City Tabs */}
          {!searchCity && (
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
      <section className="section">
        <div className="container">
          <p className="dealers-count">
            Showing <strong>{filtered.length}</strong> {filtered.length === 1 ? 'dealership' : 'dealerships'}
            {activeCity !== 'All' && <> in <em>{activeCity}</em></>}
          </p>

          {filtered.length > 0 ? (
            <div className="dealers-grid">
              {filtered.map(dealer => (
                <article
                  key={dealer.id}
                  className={`dealer-card ${dealer.premium ? 'dealer-card--premium' : ''}`}
                >
                  <div className="dealer-card__header">
                    <div>
                      <h3 className="dealer-card__name">{dealer.name}</h3>
                      <span className="dealer-card__city">{dealer.city}, {dealer.state}</span>
                    </div>
                    {dealer.premium && (
                      <span className="dealer-card__badge">Flagship</span>
                    )}
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

                  {/* Stocked Motorcycles */}
                  {dealer.stocks && dealer.stocks.length > 0 && (
                    <div className="dealer-card__stocks">
                      <div className="dealer-card__stocks-title">Bikes in Stock:</div>
                      <ul className="dealer-card__stocks-list">
                        {dealer.stocks.map(slug => {
                          const bike = getBikeBySlug(slug);
                          return (
                            <li key={slug} className="dealer-card__stock-item">
                              <Link to={`/motorcycles/${slug}`}>
                                {bike ? bike.name : slug}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

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
              <span aria-hidden="true" style={{ fontSize: '2.5rem' }}>🔍</span>
              <h3>No dealers found</h3>
              <p>Try searching for a different city.</p>
              <button
                className="btn btn-primary"
                onClick={() => { setSearchCity(''); setActiveCity('All'); }}
              >
                View All Dealerships
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
