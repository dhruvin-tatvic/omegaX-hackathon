import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { allBikes } from '../data/catalogue';
import SEO from '../components/SEO';
import './BookTestRide.css';

export default function BookTestRide() {
  const [searchParams] = useSearchParams();
  const bikeParam = searchParams.get('bike');
  const matchedBike = allBikes.find(
    m => m.slug === bikeParam || m.name.toLowerCase() === (bikeParam || '').toLowerCase()
  );

  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    city: '',
    motorcycle: matchedBike ? matchedBike.name : '',
    preferredDate: '',
    consent: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <main className="book-ride-page">
      <SEO
        title="Book a Test Ride — Experience Apex Moto"
        description="Schedule a complimentary test ride for any of our 18 motorcycles at an authorized Apex Moto dealership near you."
        path="/book-test-ride"
      />

      {/* Page Hero */}
      <section className="page-hero">
        <div className="container">
          <span className="section-label page-hero__label">Experience Apex Moto</span>
          <h1>Book a Test Ride</h1>
          <p>Feel the power, balance, and character before you decide. Test rides are free and available across all 8 flagship dealerships.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="book-ride-layout">
            {/* Form */}
            <div className="book-ride-form-wrap">
              <form
                method="POST"
                action="/api/test-ride"
                className="book-ride-form"
                aria-label="Test ride booking form"
              >
                <p className="book-ride-form__note" role="note">
                  <strong>⚠️ Demo Notice:</strong> This form simulates a test ride booking for demonstration purposes only. Submissions redirect to a confirmation page.
                </p>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="fullName">Full Name *</label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      className="form-control"
                      placeholder="Rahul Sharma"
                      value={formData.fullName}
                      onChange={handleChange}
                      autoComplete="name"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="mobile">Mobile Number *</label>
                    <input
                      id="mobile"
                      name="mobile"
                      type="tel"
                      required
                      pattern="[6-9][0-9]{9}"
                      className="form-control"
                      placeholder="9876543210"
                      value={formData.mobile}
                      onChange={handleChange}
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="email">Email Address *</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="form-control"
                      placeholder="rahul@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      autoComplete="email"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="city">City *</label>
                    <select
                      id="city"
                      name="city"
                      required
                      className="form-control"
                      value={formData.city}
                      onChange={handleChange}
                    >
                      <option value="">Select your city</option>
                      <option value="Delhi">Delhi</option>
                      <option value="Mumbai">Mumbai</option>
                      <option value="Bangalore">Bangalore</option>
                      <option value="Pune">Pune</option>
                      <option value="Chennai">Chennai</option>
                      <option value="Hyderabad">Hyderabad</option>
                      <option value="Jaipur">Jaipur</option>
                      <option value="Kolkata">Kolkata</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="motorcycle">Motorcycle Model *</label>
                    <select
                      id="motorcycle"
                      name="motorcycle"
                      required
                      className="form-control"
                      value={formData.motorcycle}
                      onChange={handleChange}
                    >
                      <option value="">Select a motorcycle</option>
                      {allBikes.map(b => (
                        <option key={b.slug} value={b.name}>
                          {b.name} ({b.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="preferredDate">Preferred Date *</label>
                    <input
                      id="preferredDate"
                      name="preferredDate"
                      type="date"
                      required
                      min={todayStr}
                      className="form-control"
                      value={formData.preferredDate}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="form-group form-group--checkbox">
                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      id="consent"
                      name="consent"
                      required
                      checked={formData.consent}
                      onChange={handleChange}
                    />
                    <span>
                      I hold a valid two-wheeler driving licence and agree to the{' '}
                      <a href="#terms" onClick={e => e.preventDefault()}>Test Ride Terms & Conditions</a> *
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg book-ride-form__submit"
                  id="submit-test-ride-btn"
                >
                  Confirm Test Ride Booking →
                </button>
              </form>
            </div>

            {/* Sidebar info */}
            <aside className="book-ride-sidebar" aria-label="Test ride information">
              <div className="book-ride-info-card">
                <h3>What to Expect</h3>
                <ul className="book-ride-checklist">
                  <li>
                    <span aria-hidden="true">⏱️</span>
                    <div>
                      <strong>30–45 Minute Experience</strong>
                      <p>Dedicated session with an Apex Moto product specialist.</p>
                    </div>
                  </li>
                  <li>
                    <span aria-hidden="true">🛡️</span>
                    <div>
                      <strong>Safety Gear Provided</strong>
                      <p>Sanitised helmet and riding jacket available at all locations.</p>
                    </div>
                  </li>
                  <li>
                    <span aria-hidden="true">🛣️</span>
                    <div>
                      <strong>Curated Route</strong>
                      <p>City and open-road stretches to experience both power and handling.</p>
                    </div>
                  </li>
                  <li>
                    <span aria-hidden="true">📋</span>
                    <div>
                      <strong>Zero Obligation</strong>
                      <p>No sales pressure. Just honest riding and expert consultation.</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="book-ride-requirements">
                <h4>What to Bring:</h4>
                <ul>
                  <li>Valid two-wheeler driving licence (original)</li>
                  <li>Closed-toe shoes or riding boots (mandatory)</li>
                  <li>Your own helmet if preferred (DOT/ECE approved)</li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
