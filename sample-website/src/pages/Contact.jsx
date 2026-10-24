import { useForm } from '../hooks/useForm';
import './Contact.css';

const initialValues = {
  name: '', email: '', mobile: '', subject: '', message: '', consent: false,
};

const validationRules = {
  name: { required: true, label: 'Name', minLength: 2 },
  email: { required: true, label: 'Email', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: 'Enter a valid email address' },
  mobile: { required: true, label: 'Mobile', pattern: /^[6-9]\d{9}$/, patternMsg: 'Enter a valid 10-digit Indian mobile number' },
  subject: { required: true, label: 'Subject' },
  message: { required: true, label: 'Message', minLength: 10 },
  consent: { required: false, isCheckbox: true, checkboxMsg: 'Consent is required to proceed' },
};

const contactInfo = [
  { icon: '📞', label: 'Customer Support', value: '1800-XXX-APEX (Toll Free)', sub: 'Mon–Sat: 9:00 AM – 7:00 PM' },
  { icon: '📧', label: 'Email Us', value: 'support@apexmoto.in', sub: 'Response within 24–48 hours' },
  { icon: '📍', label: 'Head Office', value: 'Apex Moto Ltd., 1 Innovation Drive, Pune, Maharashtra 411001', sub: 'By appointment only' },
  { icon: '💬', label: 'Live Chat', value: 'Available on our app', sub: 'Mon–Sun: 8:00 AM – 10:00 PM' },
];

export default function Contact() {
  const { values, errors, touched, isSubmitting, isSuccess, handleChange, handleBlur, handleSubmit, reset } = useForm(initialValues, validationRules);

  return (
    <main className="contact-page">
      {/* Page Hero */}
      <section className="page-hero">
        <div className="container">
          <span className="section-label page-hero__label">Get in Touch</span>
          <h1>Contact Us</h1>
          <p>We're here to help. Whether you have a product query, need after-sales support, or just want to talk motorcycles — reach out.</p>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="contact-info-section">
        <div className="container">
          <div className="contact-info-grid">
            {contactInfo.map((item, i) => (
              <div key={i} className="contact-info-card">
                <span className="contact-info-card__icon" aria-hidden="true">{item.icon}</span>
                <div>
                  <span className="contact-info-card__label">{item.label}</span>
                  <p className="contact-info-card__value">{item.value}</p>
                  <span className="contact-info-card__sub">{item.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="section">
        <div className="container">
          <div className="contact-layout">
            <div>
              <span className="section-label">Send a Message</span>
              <h2>How Can We Help?</h2>
              <p>Fill out the form and our team will get back to you within 1–2 business days.</p>
            </div>

            <div className="contact-form-wrap">
              {isSuccess ? (
                <div className="form-success" role="alert">
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }} aria-hidden="true">✅</div>
                  <h3>Message Sent!</h3>
                  <p>Thank you, {values.name}! We've received your message and will respond soon.</p>
                  <em style={{ display: 'block', fontSize: '0.8rem', marginTop: '1rem', color: 'rgba(34,197,94,0.6)' }}>
                    Demo notice: No data has been stored or transmitted.
                  </em>
                  <button className="btn btn-primary" onClick={reset} style={{ marginTop: '1.5rem' }}>
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="contact-form" noValidate aria-label="Contact us form">
                  <p className="contact-form__note" role="note">
                    <strong>⚠️ Demo Notice:</strong> This form simulates message submission. No data is transmitted or stored.
                  </p>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="con-name">Full Name *</label>
                      <input
                        id="con-name" name="name" type="text"
                        className={`form-control ${errors.name && touched.name ? 'error' : ''}`}
                        placeholder="Your full name"
                        value={values.name}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="name"
                        aria-required="true"
                      />
                      {errors.name && touched.name && <span className="form-error" role="alert">⚠ {errors.name}</span>}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="con-email">Email Address *</label>
                      <input
                        id="con-email" name="email" type="email"
                        className={`form-control ${errors.email && touched.email ? 'error' : ''}`}
                        placeholder="your@email.com"
                        value={values.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="email"
                        aria-required="true"
                      />
                      {errors.email && touched.email && <span className="form-error" role="alert">⚠ {errors.email}</span>}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="con-mobile">Mobile Number *</label>
                      <input
                        id="con-mobile" name="mobile" type="tel"
                        className={`form-control ${errors.mobile && touched.mobile ? 'error' : ''}`}
                        placeholder="10-digit mobile"
                        value={values.mobile}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        maxLength={10}
                        autoComplete="tel"
                        aria-required="true"
                      />
                      {errors.mobile && touched.mobile && <span className="form-error" role="alert">⚠ {errors.mobile}</span>}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="con-subject">Subject *</label>
                      <select
                        id="con-subject" name="subject"
                        className={`form-control ${errors.subject && touched.subject ? 'error' : ''}`}
                        value={values.subject}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        aria-required="true"
                      >
                        <option value="">Select a topic…</option>
                        <option>Product Enquiry</option>
                        <option>Test Ride Request</option>
                        <option>After-Sales Support</option>
                        <option>Dealer Query</option>
                        <option>Financing Assistance</option>
                        <option>Media / Press Enquiry</option>
                        <option>Other</option>
                      </select>
                      {errors.subject && touched.subject && <span className="form-error" role="alert">⚠ {errors.subject}</span>}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="con-message">Message *</label>
                    <textarea
                      id="con-message" name="message"
                      className={`form-control contact-form__textarea ${errors.message && touched.message ? 'error' : ''}`}
                      placeholder="Tell us how we can help you…"
                      value={values.message}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      rows={5}
                      aria-required="true"
                    />
                    {errors.message && touched.message && <span className="form-error" role="alert">⚠ {errors.message}</span>}
                  </div>

                  <div className="checkbox-group">
                    <input
                      id="con-consent" name="consent" type="checkbox"
                      checked={values.consent}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                    <label htmlFor="con-consent" className="checkbox-label">
                      I consent to Apex Moto processing my details to respond to this enquiry. I understand this is a demonstration form and no data is actually stored. *
                    </label>
                  </div>
                  {errors.consent && touched.consent && <span className="form-error" role="alert">⚠ {errors.consent}</span>}

                  <button
                    type="submit"
                    id="submit-contact-btn"
                    className="btn btn-primary btn-lg"
                    disabled={isSubmitting}
                    style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                  >
                    {isSubmitting ? 'Sending…' : 'Send Message →'}
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
