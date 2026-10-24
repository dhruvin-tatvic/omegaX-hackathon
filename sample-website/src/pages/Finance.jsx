import { Link } from 'react-router-dom';
import { allBikes, bankPartners, formatINR, isFinanceNotOnSite } from '../data/catalogue';
import SEO from '../components/SEO';
import './Finance.css';

export default function Finance() {
  // Filter out bikes where finance details are not on site
  const financeBikes = allBikes.filter(b => !isFinanceNotOnSite(b.slug) && b.finance);

  return (
    <main className="finance-page">
      <SEO
        title="Motorcycle Financing & EMI Options"
        description="Calculate your monthly EMI, explore partner bank interest rates from 7.9% p.a., and browse per-bike finance schemes across all Apex Moto models."
        path="/finance"
      />

      {/* Page Hero */}
      <section className="page-hero">
        <div className="container">
          <span className="section-label page-hero__label">Financing Solutions</span>
          <h1>Motorcycle Finance & EMI Plans</h1>
          <p>Transparent rates, minimal documentation, and quick approvals through our trusted banking partners.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">

          {/* EMI Explanation */}
          <div className="finance-calc-box">
            <h2>How Is Your EMI Calculated?</h2>
            <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              Equated Monthly Instalment (EMI) is calculated using the standard reducing balance loan formula:
            </p>
            <div className="finance-formula">
              EMI = [P × R × (1 + R)^N] / [(1 + R)^N - 1]
            </div>
            <ul style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
              <li><strong>P (Principal Loan Amount):</strong> Ex-showroom price minus your down payment.</li>
              <li><strong>R (Monthly Interest Rate):</strong> Annual interest rate divided by 12 and then by 100.</li>
              <li><strong>N (Loan Tenure):</strong> Loan duration in total number of months (typically 12 to 72 months).</li>
            </ul>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
              * On-road costs (RTO registration and insurance) can also be bundled into the loan with select banking partners.
            </p>
          </div>

          {/* Bank Partners Table */}
          <div className="section-header">
            <span className="section-label">Banking Partners</span>
            <h2>Official Banking Partners & Interest Rates</h2>
            <p>Our approved banking consortium provides customized two-wheeler loan solutions with fast turnaround times.</p>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '4rem' }}>
            <table className="onroad" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Banking Partner</th>
                  <th>Interest Rate (p.a.)</th>
                  <th>Maximum Loan Tenure</th>
                  <th>Typical Down Payment</th>
                </tr>
              </thead>
              <tbody>
                {bankPartners.map((bp, i) => (
                  <tr key={i}>
                    <td><strong>{bp.bank}</strong></td>
                    <td style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{bp.interest_rate_pct}%</td>
                    <td>{bp.max_tenure_months} months</td>
                    <td>{bp.down_payment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-Bike Finance Plans */}
          <div className="section-header">
            <span className="section-label">Model Estimates</span>
            <h2>Per-Model EMI Estimates</h2>
            <p>Representative 48-month financing breakdown for each Apex Moto model (base variant).</p>
          </div>

          <div className="finance-bikes-grid">
            {financeBikes.map(bike => (
              <article key={bike.slug} className="finance-bike-card">
                <div className="finance-bike-header">
                  <h3 className="finance-bike-name">
                    <Link to={`/motorcycles/${bike.slug}`}>{bike.name}</Link>
                  </h3>
                  <span className="tag">{bike.category}</span>
                </div>

                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Ex-showroom: <span className="price" data-slug={bike.slug}>{formatINR(bike.ex_showroom_price_inr)}</span>
                </p>

                <table className="finance">
                  <thead>
                    <tr>
                      <th>Down Payment</th>
                      <th>Interest Rate</th>
                      <th>Tenure</th>
                      <th>Monthly EMI</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{formatINR(bike.finance.down_payment_inr)}</td>
                      <td>{bike.finance.interest_rate_pct}%</td>
                      <td>{bike.finance.tenure_months} mo</td>
                      <td>{formatINR(bike.finance.emi_inr)}</td>
                    </tr>
                  </tbody>
                </table>

                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  Basis: {bike.finance.basis}
                </p>

                <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                  <Link to={`/motorcycles/${bike.slug}`} className="btn btn-primary btn-sm">
                    View Motorcycle
                  </Link>
                  <Link to={`/book-test-ride?bike=${bike.slug}`} className="btn btn-ghost btn-sm">
                    Book Test Ride
                  </Link>
                </div>
              </article>
            ))}
          </div>

        </div>
      </section>
    </main>
  );
}
