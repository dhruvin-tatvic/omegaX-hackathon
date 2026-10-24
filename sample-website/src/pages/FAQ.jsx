import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './FAQ.css';

const FAQ_ITEMS = [
  {
    q: 'What is the price range of Apex Moto motorcycles?',
    a: 'Apex Moto motorcycles start at ₹99,000 ex-showroom for the entry commuter Storm 125 and go up to ₹5,29,000 ex-showroom for the flagship Thunderstrike 650 Rally adventure tourer across 18 models.',
  },
  {
    q: 'Which is the most affordable and which is the most powerful motorcycle?',
    a: 'The most affordable motorcycle in our lineup is the Storm 125 priced at ₹99,000 ex-showroom. The most powerful machines are our 648cc twin-cylinder models — the Thunderstrike 650, Thunderstrike 650 Rally, Voyager 650, Zenith 650 Scrambler, and Nightfall 650 — each producing 47 bhp (or 46 bhp for Nightfall 650).',
  },
  {
    q: 'Does Apex Moto have an electric motorcycle?',
    a: 'Yes, the Spark E1 is our high-performance electric motorcycle. It features a 9 kW peak mid-drive PMSM motor, a 4.0 kWh battery pack, an IDC range of 140 km per charge, and fast-charging capability (0–80% in 50 minutes) priced at ₹1,49,000 ex-showroom.',
  },
  {
    q: 'What manufacturer warranty is offered on Apex Moto motorcycles?',
    a: 'All Apex Moto motorcycles come standard with a comprehensive 5-year / 60,000 km manufacturer warranty covering the engine, transmission, frame, and electrical architecture, with optional extended warranty packages available through authorized dealers.',
  },
  {
    q: 'How do I book a test ride?',
    a: 'You can book a free, zero-obligation test ride online via our Book a Test Ride page or walk into any of our 8 flagship dealerships in Delhi, Mumbai, Bangalore, Pune, Chennai, Hyderabad, Jaipur, and Kolkata. Helmet and safety gear are provided.',
  },
  {
    q: 'What documents are required to purchase and register a motorcycle?',
    a: 'To complete purchase and RTO registration, you will need: government-issued photo ID (Aadhaar card or passport), PAN card, current proof of address, 4 passport-size photographs, and a valid two-wheeler driving licence.',
  },
  {
    q: 'What financing options and interest rates are available?',
    a: 'Through our partner banking consortium (SBI, HDFC Bank, ICICI Bank, and Axis Bank), we offer attractive interest rates starting from 7.9% p.a., flexible repayment tenures up to 72 months, and down payment options ranging from 0% to 20%.',
  },
  {
    q: 'In which cities does Apex Moto have authorized dealerships?',
    a: 'Apex Moto operates 8 flagship authorized dealerships located in Delhi (Connaught Place), Mumbai (Bandra West), Bangalore (Brigade Road), Pune (Camp), Chennai (Anna Nagar), Hyderabad (Jubilee Hills), Jaipur (Pink City / Tonk Road), and Kolkata (Park Street).',
  },
  {
    q: 'What is the typical delivery timeframe after booking?',
    a: 'In-stock motorcycles are delivered within 3 to 5 business days after full payment or loan disbursement. Special variants and limited editions (such as Thunderstrike 650 Rally, Phantom 350 Bobber, Zenith 650 Scrambler, and Nightfall 650) have an estimated delivery window of 2 to 3 weeks.',
  },
  {
    q: 'What does the on-road price include?',
    a: 'The on-road price comprises the base ex-showroom price plus state road transport office (RTO) registration fees, road tax, mandatory 5-year third-party/1-year own damage insurance, and municipal cess where applicable.',
  },
  {
    q: 'Can I exchange my existing two-wheeler for a new Apex Moto?',
    a: 'Yes, all 8 authorized dealerships have on-site vehicle appraisal counters that offer fair market evaluations and immediate exchange bonuses towards the down payment of your new Apex Moto motorcycle.',
  },
  {
    q: 'Where can I download the official motorcycle brochures?',
    a: 'Every motorcycle model page has a dedicated link to download its official one-page brochure PDF containing complete technical specifications, variant pricing, on-road price estimates, and color options.',
  },
];

export default function FAQ() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  return (
    <main className="faq-page">
      <SEO
        title="Frequently Asked Questions (FAQ) — Buyer Guide"
        description="Find answers to common questions about Apex Moto motorcycles, pricing, warranty, financing rates, test rides, delivery timelines, and dealer locations."
        path="/faq"
        schema={faqSchema}
      />

      {/* Page Hero */}
      <section className="page-hero">
        <div className="container">
          <span className="section-label page-hero__label">Rider Help Centre</span>
          <h1>Frequently Asked Questions</h1>
          <p>Everything you need to know about purchasing, financing, maintaining, and enjoying your Apex Moto motorcycle.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="faq-list">
            {FAQ_ITEMS.map((item, index) => (
              <article key={index} className="faq-item">
                <h2 className="faq-question">
                  <span className="faq-question-num">#{index + 1}</span>
                  {item.q}
                </h2>
                <p className="faq-answer">{item.a}</p>
              </article>
            ))}
          </div>

          <div style={{ marginTop: '3.5rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
              Still have questions? Our customer concierge and dealership experts are here to help.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/contact" className="btn btn-primary">
                Contact Customer Support
              </Link>
              <Link to="/dealers" className="btn btn-outline">
                Find Nearest Dealer
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
