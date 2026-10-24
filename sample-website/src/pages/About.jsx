import './About.css';
import heroImg from '../assets/images/hero_motorcycle.jpg';
import { Link } from 'react-router-dom';

const milestones = [
  { year: '2014', title: 'Founded', desc: 'Apex Moto established in Pune with a vision to redefine Indian motorcycling.' },
  { year: '2016', title: 'First Model', desc: 'Launch of the Phantom 350 — 10,000 units sold in the first year.' },
  { year: '2018', title: 'National Reach', desc: 'Expanded to 50 dealerships across 20 Indian cities.' },
  { year: '2020', title: 'Adventure Launch', desc: 'Thunderstrike 650 launches — our first twin-cylinder adventure bike.' },
  { year: '2022', title: 'Street Division', desc: 'Storm 200 and Zenith 450 Scrambler join the lineup.' },
  { year: '2024', title: '50,000 Riders', desc: 'Apex Moto community crosses 50,000 registered riders nationwide.' },
  { year: '2026', title: 'Next Chapter', desc: 'New flagship model in development. The journey continues.' },
];

const values = [
  { icon: '🔬', title: 'Precision Engineering', desc: 'Every tolerance, every material, every system is chosen for performance and longevity.' },
  { icon: '🌿', title: 'Sustainable Progress', desc: 'Moving towards cleaner technologies without sacrificing the soul of motorcycling.' },
  { icon: '🤝', title: 'Community First', desc: 'Our riders are our brand ambassadors. We build for them, with their feedback.' },
  { icon: '🎨', title: 'Design with Purpose', desc: 'Beauty must serve function. Every curve, panel and line has a reason.' },
];

export default function About() {
  return (
    <main className="about-page">
      {/* Page Hero */}
      <section className="about-hero">
        <div className="about-hero__image" style={{ backgroundImage: `url(${heroImg})` }} />
        <div className="about-hero__overlay" />
        <div className="about-hero__content container">
          <span className="section-label">Our Story</span>
          <h1>Born on Indian Roads,<br /><span style={{ color: 'var(--color-primary)' }}>Built for Every Road.</span></h1>
          <p>Apex Moto was born from a simple belief — that Indian riders deserved motorcycles that matched their passion, spirit, and ambition.</p>
        </div>
      </section>

      {/* Mission */}
      <section className="section about-mission">
        <div className="container">
          <div className="about-mission__grid">
            <div>
              <span className="section-label">Our Mission</span>
              <h2>Redefining the Joy of Riding</h2>
              <p>
                At Apex Moto, we don't just build motorcycles — we build experiences. Each machine
                in our lineup is the result of thousands of hours of engineering, testing on real Indian
                roads, and listening to the riders who trust us with their journey.
              </p>
              <p>
                We believe that a motorcycle is more than transport. It's freedom. It's character.
                It's the clearest expression of who you are and where you're going.
              </p>
              <div className="about-mission__stats">
                {[
                  { v: '50K+', l: 'Happy Riders' },
                  { v: '120+', l: 'Dealerships' },
                  { v: '4', l: 'Iconic Models' },
                  { v: '10', l: 'Years of Excellence' },
                ].map(s => (
                  <div key={s.l} className="about-mission__stat">
                    <span className="stat-number">{s.v}</span>
                    <span className="stat-label">{s.l}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="about-mission__image-wrap">
              <img src={heroImg} alt="Apex Moto motorcycle on mountain road" className="about-mission__image" />
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section about-values" style={{ background: 'var(--color-bg-section)' }}>
        <div className="container">
          <div className="section-header section-header--centered">
            <span className="section-label">What We Stand For</span>
            <h2>Our Design Philosophy</h2>
            <p>Four principles that guide every decision, every design, every motorcycle we build.</p>
          </div>
          <div className="grid-4">
            {values.map((v, i) => (
              <div key={i} className="about-value-card">
                <span className="about-value-card__icon" aria-hidden="true">{v.icon}</span>
                <h3 className="about-value-card__title">{v.title}</h3>
                <p className="about-value-card__desc">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="section about-timeline">
        <div className="container">
          <div className="section-header section-header--centered">
            <span className="section-label">Our Journey</span>
            <h2>Milestones That Define Us</h2>
          </div>
          <div className="about-timeline__track">
            {milestones.map((m, i) => (
              <div key={i} className={`about-milestone ${i % 2 === 0 ? 'about-milestone--left' : 'about-milestone--right'}`}>
                <div className="about-milestone__card">
                  <span className="about-milestone__year">{m.year}</span>
                  <h4 className="about-milestone__title">{m.title}</h4>
                  <p className="about-milestone__desc">{m.desc}</p>
                </div>
                <div className="about-milestone__dot" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section--sm about-cta">
        <div className="container">
          <div className="about-cta__card">
            <h2>Ready to Experience Apex Moto?</h2>
            <p>Visit your nearest dealership and book a complimentary test ride today.</p>
            <div className="about-cta__buttons">
              <Link to="/motorcycles" className="btn btn-primary btn-lg" id="about-explore-btn">
                Explore Motorcycles
              </Link>
              <Link to="/dealers" className="btn btn-outline btn-lg" id="about-dealer-btn">
                Find a Dealer
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
