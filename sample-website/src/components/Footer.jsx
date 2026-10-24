import { Link } from 'react-router-dom';
import logoImg from '../assets/images/apex_moto_logo.jpg';
import './Footer.css';

const footerLinks = {
  'Motorcycles': [
    { label: 'All Models', path: '/motorcycles' },
    { label: 'Thunderstrike 650', path: '/motorcycles/thunderstrike-650' },
    { label: 'Phantom 350', path: '/motorcycles/phantom-350' },
    { label: 'Storm 200', path: '/motorcycles/storm-200' },
    { label: 'Zenith 450 Scrambler', path: '/motorcycles/zenith-450-scrambler' },
  ],
  'Experience': [
    { label: 'Book a Test Ride', path: '/book-test-ride' },
    { label: 'Find a Dealer', path: '/dealers' },
    { label: 'Offers & Promotions', path: '/offers' },
    { label: 'Contact Us', path: '/contact' },
  ],
  'Company': [
    { label: 'About Apex Moto', path: '/about' },
    { label: 'Our Philosophy', path: '/about#philosophy' },
    { label: 'Careers', path: '/contact' },
    { label: 'Press & Media', path: '/contact' },
  ],
};

const socialLinks = [
  { name: 'Instagram', icon: '📸', url: '#' },
  { name: 'Facebook', icon: '👤', url: '#' },
  { name: 'YouTube', icon: '▶️', url: '#' },
  { name: 'Twitter', icon: '🐦', url: '#' },
];

const currentYear = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__top container">
        {/* Brand Column */}
        <div className="footer__brand">
          <Link to="/" aria-label="Apex Moto Home">
            <img src={logoImg} alt="Apex Moto" className="footer__logo" />
          </Link>
          <p className="footer__tagline">Born to Ride. Built to Last.</p>
          <p className="footer__desc">
            Apex Moto crafts motorcycles that embody the spirit of the road — precision engineering,
            enduring quality, and the freedom to go anywhere.
          </p>
          <div className="footer__social">
            {socialLinks.map(s => (
              <a
                key={s.name}
                href={s.url}
                className="footer__social-link"
                aria-label={s.name}
                title={s.name}
              >
                <span aria-hidden="true">{s.icon}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Links Columns */}
        {Object.entries(footerLinks).map(([category, links]) => (
          <div key={category} className="footer__col">
            <h4 className="footer__col-title">{category}</h4>
            <ul className="footer__col-links">
              {links.map(link => (
                <li key={link.path}>
                  <Link to={link.path} className="footer__link">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom Bar */}
      <div className="footer__bottom">
        <div className="footer__bottom-inner container">
          <p className="footer__copyright">
            © {currentYear} Apex Moto. All rights reserved. This is a fictional brand created for demonstration purposes only.
          </p>
          <div className="footer__legal">
            <a href="#" className="footer__legal-link">Privacy Policy</a>
            <a href="#" className="footer__legal-link">Terms of Use</a>
            <a href="#" className="footer__legal-link">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
