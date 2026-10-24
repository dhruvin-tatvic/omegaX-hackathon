import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from '../hooks/useForm';
import { motorcycles } from '../data/motorcycles';
import './BookTestRide.css';

const initialValues = {
  fullName: '',
  mobile: '',
  email: '',
  city: '',
  motorcycle: '',
  preferredDate: '',
  consent: false,
};

const validationRules = {
  fullName: { required: true, label: 'Full Name', minLength: 2 },
  mobile: { required: true, label: 'Mobile Number', pattern: /^[6-9]\d{9}$/, patternMsg: 'Enter a valid 10-digit Indian mobile number' },
  email: { required: true, label: 'Email', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: 'Enter a valid email address' },
  city: { required: true, label: 'City' },
  motorcycle: { required: true, label: 'Preferred Motorcycle' },
  preferredDate: { required: true, label: 'Preferred Date' },
  consent: { required: true, isCheckbox: true, checkboxMsg: 'You must agree to continue' },
};

const todayStr = new Date().toISOString().split('T')[0];

export default function BookTestRide() {
  const [searchParams] = useSearchParams();
  const bikeParam = searchParams.get('bike');
  const matchedBike = motorcycles.find(
    m => m.slug === bikeParam || m.name.toLowerCase() === (bikeParam || '').toLowerCase()
  );

  const formInitial = useMemo(() => ({
    ...initialValues,
    motorcycle: matchedBike ? matchedBike.name : '',
  }), [matchedBike]);

  const { values, errors, touched, isSubmitting, isSuccess, handleChange, handleBlur, handleSubmit, reset } = useForm(formInitial, validationRules);

  return (
    <main className="book-ride-page">
      {/* Page Hero */}
      <section className="page-hero">
        <div className="container">
          <span className="section-label page-hero__label">Experience Apex Moto</span>
          <h1>Book a Test Ride</h1>
          <p>Feel the power, the balance, the character — before you decide. Test rides are free and available at all our dealerships.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="book-ride-layout">
            {/* Form */}
            <div className="book-ride-form-wrap">
              {isSuccess ? (
                <div className="form-success" role="alert">
                  <div className="form-success__icon" aria-hidden="true">✅</div>
                  <h3>Test Ride Booked!</h3>
                  <p>Thank you, {values.fullName}! Your test ride request for the {values.motorcycle} has been received. Our team will contact you within 24 hours to confirm your appointment.</p>
                  <p className="form-success__disclaimer">
                    <em>Note: This is a simulated confirmation for demonstration purposes. No actual booking has been made.</em>
                  </p>
                  <button className="btn btn-primary" onClick={reset} style={{ marginTop: '1.5rem' }}>
                    Book Another Ride
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="book-ride-form" noValidate aria-label="Test ride booking form">
                  <p className="book-ride-form__note" role="note">
                    <strong>⚠️ Demo Notice:</strong> This form simulates a booking for demonstration purposes only. No data is transmitted or stored.
                  </p>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="fullName">Full Name *</label>
                      <input
                        id="fullName" name="fullName" type="text"
                        className={`form-control ${errors.fullName && touched.fullName ? 'error' : ''}`}
                        placeholder="Rahul Sharma"
                        value={values.fullName}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="name"
                        aria-required="true"
                        aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                      />
                      {errors.fullName && touched.fullName && (
                        <span className="form-error" id="fullName-error" role="alert">⚠ {errors.fullName}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="mobile">Mobile Number *</label>
                      <input
                        id="mobile" name="mobile" type="tel"
                        className={`form-control ${errors.mobile && touched.mobile ? 'error' : ''}`}
                        placeholder="98XXXXXXXX"
                        value={values.mobile}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="tel"
                        maxLength={10}
                        aria-required="true"
                        aria-describedby={errors.mobile ? 'mobile-error' : undefined}
                      />
                      {errors.mobile && touched.mobile && (
                        <span className="form-error" id="mobile-error" role="alert">⚠ {errors.mobile}</span>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="email">Email Address *</label>
                      <input
                        id="email" name="email" type="email"
                        className={`form-control ${errors.email && touched.email ? 'error' : ''}`}
                        placeholder="rahul@example.com"
                        value={values.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="email"
                        aria-required="true"
                        aria-describedby={errors.email ? 'email-error' : undefined}
                      />
                      {errors.email && touched.email && (
                        <span className="form-error" id="email-error" role="alert">⚠ {errors.email}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="city">City *</label>
                      <input
                        id="city" name="city" type="text"
                        className={`form-control ${errors.city && touched.city ? 'error' : ''}`}
                        placeholder="Mumbai"
                        value={values.city}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="address-level2"
                        aria-required="true"
                        aria-describedby={errors.city ? 'city-error' : undefined}
                      />
                      {errors.city && touched.city && (
                        <span className="form-error" id="city-error" role="alert">⚠ {errors.city}</span>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="motorcycle">Preferred Motorcycle *</label>
                      <select
                        id="motorcycle" name="motorcycle"
                        className={`form-control ${errors.motorcycle && touched.motorcycle ? 'error' : ''}`}
                        value={values.motorcycle}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        aria-required="true"
                        aria-describedby={errors.motorcycle ? 'motorcycle-error' : undefined}
                      >
                        <option value="">Select a motorcycle…</option>
                        {motorcycles.map(m => (
                          <option key={m.id} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                      {errors.motorcycle && touched.motorcycle && (
                        <span className="form-error" id="motorcycle-error" role="alert">⚠ {errors.motorcycle}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="preferredDate">Preferred Date *</label>
                      <input
                        id="preferredDate" name="preferredDate" type="date"
                        className={`form-control ${errors.preferredDate && touched.preferredDate ? 'error' : ''}`}
                        value={values.preferredDate}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        min={todayStr}
                        aria-required="true"
                        aria-describedby={errors.preferredDate ? 'date-error' : undefined}
                      />
                      {errors.preferredDate && touched.preferredDate && (
                        <span className="form-error" id="date-error" role="alert">⚠ {errors.preferredDate}</span>
                      )}
                    </div>
                  </div>

                  <div className="checkbox-group">
                    <input
                      id="consent" name="consent" type="checkbox"
                      checked={values.consent}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      aria-required="true"
                      aria-describedby={errors.consent ? 'consent-error' : undefined}
                    />
                    <label htmlFor="consent" className="checkbox-label">
                      I agree to be contacted by Apex Moto regarding my test ride request. I understand this is a demonstration form and no actual appointment is created. *
                    </label>
                  </div>
                  {errors.consent && touched.consent && (
                    <span className="form-error" id="consent-error" role="alert">⚠ {errors.consent}</span>
                  )}

                  <button
                    type="submit"
                    id="submit-testrip-btn"
                    className="btn btn-primary btn-lg"
                    disabled={isSubmitting}
                    style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                  >
                    {isSubmitting ? (
                      <><span className="book-ride-spinner" aria-hidden="true" /> Processing…</>
                    ) : 'Book My Test Ride →'}
                  </button>
                </form>
              )}
            </div>

            {/* Info Sidebar */}
            <aside className="book-ride-info" aria-label="Test ride information">
              <h3>What to Expect</h3>
              <div className="book-ride-steps">
                {[
                  { step: '01', title: 'Submit Request', desc: 'Fill in your details and preferred date.' },
                  { step: '02', title: 'Dealer Confirms', desc: 'Your nearest dealer will call to confirm within 24 hours.' },
                  { step: '03', title: 'Visit the Showroom', desc: 'Bring your driving licence and spend 30 minutes with the motorcycle.' },
                  { step: '04', title: 'Ride Free', desc: 'Test rides are completely free, with no obligation to purchase.' },
                ].map(s => (
                  <div key={s.step} className="book-ride-step">
                    <span className="book-ride-step__number">{s.step}</span>
                    <div>
                      <h4>{s.title}</h4>
                      <p>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="book-ride-info__card">
                <h4>📞 Need Help?</h4>
                <p>Call us directly at</p>
                <strong style={{ color: 'var(--color-primary)' }}>1800-XXX-APEX</strong>
                <p className="book-ride-info__hours">Mon–Sat, 9am–7pm</p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
