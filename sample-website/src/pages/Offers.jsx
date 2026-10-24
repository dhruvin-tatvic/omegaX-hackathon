import { useForm } from '../hooks/useForm';
import { motorcycles } from '../data/motorcycles';
import { offers, financingOptions } from '../data/offers';
import { Link } from 'react-router-dom';
import './Offers.css';

const enquiryInitial = { name: '', mobile: '', city: '', motorcycle: '', consent: false };
const enquiryRules = {
  name: { required: true, label: 'Name', minLength: 2 },
  mobile: { required: true, label: 'Mobile', pattern: /^[6-9]\d{9}$/, patternMsg: 'Enter valid 10-digit number' },
  city: { required: true, label: 'City' },
  motorcycle: { required: true, label: 'Interested Motorcycle' },
  consent: { required: false, isCheckbox: true, checkboxMsg: 'Consent is required' },
};

export default function Offers() {
  const { values, errors, touched, isSubmitting, isSuccess, handleChange, handleBlur, handleSubmit, reset } = useForm(enquiryInitial, enquiryRules);

  return (
    <main className="offers-page">
      {/* Page Hero */}
      <section className="page-hero">
        <div className="container">
          <span className="section-label page-hero__label">Exclusive Deals</span>
          <h1>Offers & Promotions</h1>
          <p>From monsoon specials to financing deals — discover the best time to ride home an Apex Moto.</p>
        </div>
      </section>

      {/* Offers Grid */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-label">Current Promotions</span>
            <h2>Active Offers</h2>
            <p>All prices are indicative and subject to change. Contact your nearest dealer for confirmed pricing.</p>
          </div>

          <div className="offers-grid">
            {offers.map(offer => (
              <article
                key={offer.id}
                className="offer-card"
                style={{ '--offer-gradient': offer.gradient }}
              >
                <div className="offer-card__header">
                  <div>
                    <span
                      className="offer-card__badge"
                      style={{ background: `${offer.badgeColor}22`, color: offer.badgeColor, borderColor: `${offer.badgeColor}44` }}
                    >
                      {offer.badge}
                    </span>
                    <h3 className="offer-card__title">{offer.title}</h3>
                    <p className="offer-card__subtitle">{offer.subtitle}</p>
                  </div>
                </div>

                <p className="offer-card__desc">{offer.description}</p>

                <div className="offer-card__benefits">
                  {offer.benefits.map((b, i) => (
                    <div key={i} className="offer-card__benefit">
                      <span style={{ color: offer.badgeColor }} aria-hidden="true">✓</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>

                <div className="offer-card__footer">
                  <div className="offer-card__validity">
                    <span className="offer-card__validity-label">Valid till:</span>
                    <span className="offer-card__validity-date">{offer.validTill}</span>
                  </div>
                  <div className="offer-card__models">
                    {offer.models.map(m => (
                      <span key={m} className="offer-card__model-tag">{m}</span>
                    ))}
                  </div>
                </div>

                <div className="offer-card__actions">
                  <Link to="/book-test-ride" className="btn btn-primary btn-sm">
                    Request Callback
                  </Link>
                  <Link to="/motorcycles" className="btn btn-outline btn-sm">
                    Explore Models
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Financing */}
      <section className="section offers-financing" style={{ background: 'var(--color-bg-section)' }}>
        <div className="container">
          <div className="section-header section-header--centered">
            <span className="section-label">Easy Finance</span>
            <h2>Financing Options</h2>
            <p>Partner banks offering attractive rates on all Apex Moto models.</p>
          </div>
          <div className="offers-financing__table">
            <div className="offers-financing__header">
              <span>Bank</span>
              <span>Interest Rate</span>
              <span>Loan Tenure</span>
              <span>Down Payment</span>
            </div>
            {financingOptions.map((opt, i) => (
              <div key={i} className="offers-financing__row">
                <span className="offers-financing__bank">{opt.bank}</span>
                <span className="offers-financing__rate">{opt.rate}</span>
                <span>{opt.tenure}</span>
                <span>{opt.downPayment}</span>
              </div>
            ))}
          </div>
          <p className="offers-financing__disclaimer">
            * Rates are indicative. Final rates depend on credit profile and are subject to bank approval.
            Contact your nearest dealer for assistance.
          </p>
        </div>
      </section>

      {/* Enquiry Form */}
      <section className="section">
        <div className="container">
          <div className="offers-enquiry-layout">
            <div className="offers-enquiry-text">
              <span className="section-label">Get In Touch</span>
              <h2>Request a Callback</h2>
              <p>Share your details and our team will call you back to discuss the best offer for you.</p>
              <div className="offers-enquiry-features">
                {['Quick 24-hour response', 'No pressure, no obligation', 'Expert guidance on finance', 'Exclusive dealer-only deals'].map(f => (
                  <div key={f} className="offers-enquiry-feature">
                    <span style={{ color: 'var(--color-primary)' }}>✓</span> {f}
                  </div>
                ))}
              </div>
            </div>

            <div className="offers-enquiry-form-wrap">
              {isSuccess ? (
                <div className="form-success" role="alert">
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }} aria-hidden="true">🎉</div>
                  <h3>Request Received!</h3>
                  <p>Thank you {values.name}! We'll call you back within 24 hours.</p>
                  <em style={{ display: 'block', fontSize: '0.8rem', marginTop: '1rem', color: 'rgba(34,197,94,0.6)' }}>
                    Demo notice: No data has been stored or transmitted.
                  </em>
                  <button className="btn btn-primary" onClick={reset} style={{ marginTop: '1.5rem' }}>Submit Another</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="offers-enquiry-form" noValidate aria-label="Callback enquiry form">
                  <div className="form-group">
                    <label className="form-label" htmlFor="enq-name">Full Name *</label>
                    <input
                      id="enq-name" name="name" type="text"
                      className={`form-control ${errors.name && touched.name ? 'error' : ''}`}
                      placeholder="Your name"
                      value={values.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      aria-required="true"
                    />
                    {errors.name && touched.name && <span className="form-error" role="alert">⚠ {errors.name}</span>}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="enq-mobile">Mobile Number *</label>
                      <input
                        id="enq-mobile" name="mobile" type="tel"
                        className={`form-control ${errors.mobile && touched.mobile ? 'error' : ''}`}
                        placeholder="10-digit mobile"
                        value={values.mobile}
                        maxLength={10}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        aria-required="true"
                      />
                      {errors.mobile && touched.mobile && <span className="form-error" role="alert">⚠ {errors.mobile}</span>}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="enq-city">City *</label>
                      <input
                        id="enq-city" name="city" type="text"
                        className={`form-control ${errors.city && touched.city ? 'error' : ''}`}
                        placeholder="Your city"
                        value={values.city}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        aria-required="true"
                      />
                      {errors.city && touched.city && <span className="form-error" role="alert">⚠ {errors.city}</span>}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="enq-motorcycle">Interested Motorcycle *</label>
                    <select
                      id="enq-motorcycle" name="motorcycle"
                      className={`form-control ${errors.motorcycle && touched.motorcycle ? 'error' : ''}`}
                      value={values.motorcycle}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      aria-required="true"
                    >
                      <option value="">Select a model…</option>
                      {motorcycles.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                    {errors.motorcycle && touched.motorcycle && <span className="form-error" role="alert">⚠ {errors.motorcycle}</span>}
                  </div>

                  <div className="checkbox-group">
                    <input
                      id="enq-consent" name="consent" type="checkbox"
                      checked={values.consent}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                    <label htmlFor="enq-consent" className="checkbox-label">
                      I agree to be contacted by Apex Moto. This is a demo form — no data is stored. *
                    </label>
                  </div>
                  {errors.consent && touched.consent && <span className="form-error" role="alert">⚠ {errors.consent}</span>}

                  <button
                    type="submit"
                    id="submit-enquiry-btn"
                    className="btn btn-primary btn-lg"
                    disabled={isSubmitting}
                    style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                  >
                    {isSubmitting ? 'Sending…' : 'Request a Callback →'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
