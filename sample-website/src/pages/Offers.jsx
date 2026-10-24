import { useForm } from '../hooks/useForm';
import { offers as baseOffers } from '../data/offers';
import { bankPartners, formatINR, getBikeDisplayPrice, offerTermsConflict, getBikeBySlug } from '../data/catalogue';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './Offers.css';

const enquiryInitial = { name: '', mobile: '', city: '', motorcycle: '', consent: false };
const enquiryRules = {
  name: { required: true, label: 'Name', minLength: 2 },
  mobile: { required: true, label: 'Mobile', pattern: /^[6-9]\d{9}$/, patternMsg: 'Enter valid 10-digit number' },
  city: { required: true, label: 'City' },
  motorcycle: { required: true, label: 'Interested Motorcycle' },
  consent: { required: false, isCheckbox: true, checkboxMsg: 'Consent is required' },
};

// Map model names in offers to catalogue slugs
const MODEL_SLUG_MAP = {
  'Thunderstrike 650': 'thunderstrike-650',
  'Phantom 350': 'phantom-350',
  'Storm 200': 'storm-200',
  'Zenith 450 Scrambler': 'zenith-450-scrambler',
};

export default function Offers() {
  const { values, errors, touched, isSuccess, handleChange, handleBlur, handleSubmit, reset } = useForm(enquiryInitial, enquiryRules);

  // Apply offer terms conflict rule
  const adjustedOffers = baseOffers.map(offer => {
    if (offer.id === 2) {
      const benefits = offerTermsConflict
        ? [
            '0% down payment through select banks',
            'EMI starting at ₹4,999/month',
            'Quick 24-hour loan approval',
            '7-year repayment flexibility',
          ]
        : [
            'Down payment from 0% with select banks',
            'EMI starting at ₹4,999/month',
            'Quick 24-hour loan approval',
            'Repayment up to 6 years',
          ];
      return { ...offer, benefits };
    }
    return offer;
  });

  return (
    <main className="offers-page">
      <SEO
        title="Exclusive Offers & Financing Deals"
        description="Explore current cashback, bundle offers, and zero down payment finance deals across the Apex Moto lineup."
        path="/offers"
      />

      {/* Page Hero */}
      <section className="page-hero">
        <div className="container">
          <span className="section-label page-hero__label">Exclusive Deals</span>
          <h1>Offers & Promotions</h1>
          <p>From seasonal specials to partner financing deals — discover the best time to ride home an Apex Moto.</p>
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
            {adjustedOffers.map(offer => (
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

                  {/* Models list with ex-showroom prices */}
                  <div className="offer-card__models">
                    {offer.models.map(m => {
                      const slug = MODEL_SLUG_MAP[m];
                      if (!slug) return <span key={m} className="offer-card__model-tag">{m}</span>;
                      const price = getBikeDisplayPrice(slug, '/offers');
                      return (
                        <span key={m} className="offer-card__model-tag">
                          {m} • Starting <span className="price" data-slug={slug}>{formatINR(price)}</span>
                        </span>
                      );
                    })}
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

      {/* Financing Options from Bank Partners */}
      <section className="section offers-financing" style={{ background: 'var(--color-bg-section)' }}>
        <div className="container">
          <div className="section-header section-header--centered">
            <span className="section-label">Easy Finance</span>
            <h2>Financing Options & Partner Banks</h2>
            <p>Official banking partners offering competitive interest rates and flexible tenures on all Apex Moto models.</p>
          </div>

          <div className="offers-financing__table">
            <div className="offers-financing__header">
              <span>Bank</span>
              <span>Interest Rate</span>
              <span>Max Loan Tenure</span>
              <span>Down Payment</span>
            </div>
            {bankPartners.map((opt, i) => (
              <div key={i} className="offers-financing__row">
                <span className="offers-financing__bank">{opt.bank}</span>
                <span className="offers-financing__rate">{opt.interest_rate_pct}% p.a.</span>
                <span>{opt.max_tenure_months} months</span>
                <span>{opt.down_payment}</span>
              </div>
            ))}
          </div>
          <p className="offers-financing__disclaimer">
            * Rates and loan tenure are indicative. Final terms depend on customer credit profile and bank underwriting criteria.
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

                  <div className="form-group">
                    <label className="form-label" htmlFor="enq-mobile">Mobile Number *</label>
                    <input
                      id="enq-mobile" name="mobile" type="tel"
                      className={`form-control ${errors.mobile && touched.mobile ? 'error' : ''}`}
                      placeholder="9876543210"
                      value={values.mobile}
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

                  <div className="form-group">
                    <label className="form-label" htmlFor="enq-moto">Interested Motorcycle *</label>
                    <select
                      id="enq-moto" name="motorcycle"
                      className={`form-control ${errors.motorcycle && touched.motorcycle ? 'error' : ''}`}
                      value={values.motorcycle}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      aria-required="true"
                    >
                      <option value="">Select a motorcycle</option>
                      <option value="Thunderstrike 650">Thunderstrike 650</option>
                      <option value="Phantom 350">Phantom 350</option>
                      <option value="Storm 200">Storm 200</option>
                      <option value="Zenith 450 Scrambler">Zenith 450 Scrambler</option>
                    </select>
                    {errors.motorcycle && touched.motorcycle && <span className="form-error" role="alert">⚠ {errors.motorcycle}</span>}
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                    Submit Enquiry
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
