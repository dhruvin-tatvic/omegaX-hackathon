// =============================================
// APEX MOTO — Offers & Promotions Data
// Static data for frontend demonstration only.
// All offers are fictional and for demo purposes.
// =============================================

export const offers = [
  {
    id: 1,
    title: 'Monsoon Mania Sale',
    subtitle: 'Save up to ₹25,000',
    description: 'Celebrate the season with exclusive discounts on selected Apex Moto models. Get cashback, free accessories and extended warranty on the Thunderstrike 650 and Phantom 350.',
    badge: 'Limited Time',
    badgeColor: '#FF6B35',
    validTill: 'November 30, 2026',
    models: ['Thunderstrike 650', 'Phantom 350'],
    benefits: [
      '₹25,000 cash discount on Thunderstrike 650',
      '₹15,000 cash discount on Phantom 350',
      'Free accessories kit worth ₹8,000',
      'Extended warranty (2 + 2 years)',
    ],
    gradient: 'linear-gradient(135deg, #FF6B35 0%, #E85520 100%)',
  },
  {
    id: 2,
    title: 'Zero Down Payment',
    subtitle: 'Drive home today',
    description: 'Get your dream Apex Moto with zero down payment on all models through our partner financing options. EMIs starting at just ₹4,999 per month.',
    badge: 'Finance Offer',
    badgeColor: '#3B82F6',
    validTill: 'December 31, 2026',
    models: ['All Models'],
    benefits: [
      '0% down payment through select banks',
      'EMI starting at ₹4,999/month',
      'Quick 24-hour loan approval',
      '7-year repayment flexibility',
    ],
    gradient: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
  },
  {
    id: 3,
    title: 'Storm Urban Champion Package',
    subtitle: 'City ready. Savings included.',
    description: 'Purchase the Storm 200 and get a premium urban accessories bundle worth ₹12,000 absolutely free. Built for city warriors.',
    badge: 'Bundle Offer',
    badgeColor: '#22C55E',
    validTill: 'October 31, 2026',
    models: ['Storm 200'],
    benefits: [
      'Free helmet (₹5,000 value)',
      'Free riding jacket (₹4,500 value)',
      'Free smart phone mount',
      '1st year insurance at 50% off',
    ],
    gradient: 'linear-gradient(135deg, #15803D 0%, #22C55E 100%)',
  },
  {
    id: 4,
    title: 'Zenith Scrambler Adventure Pack',
    subtitle: 'Gear up for the trail',
    description: 'The Zenith 450 Scrambler comes with a complete adventure riding kit. No excuses to stay on tarmac.',
    badge: 'Adventure Offer',
    badgeColor: '#84CC16',
    validTill: 'January 15, 2027',
    models: ['Zenith 450 Scrambler'],
    benefits: [
      'Free off-road riding kit',
      'Free aluminium pannier set (₹15,000 value)',
      'Complimentary off-road training day',
      '3-year extended warranty',
    ],
    gradient: 'linear-gradient(135deg, #4A5A30 0%, #84CC16 100%)',
  },
  {
    id: 5,
    title: 'Corporate Fleet Discount',
    subtitle: 'Buy 3 or more, save big',
    description: 'Apex Moto offers exclusive corporate pricing for businesses purchasing 3 or more motorcycles. Contact our fleet team for a personalised quote.',
    badge: 'Corporate',
    badgeColor: '#A855F7',
    validTill: 'Ongoing',
    models: ['All Models'],
    benefits: [
      'Up to 12% fleet discount',
      'Dedicated fleet service team',
      'Priority service appointments',
      'Custom livery options available',
    ],
    gradient: 'linear-gradient(135deg, #7E22CE 0%, #A855F7 100%)',
  },
  {
    id: 6,
    title: 'Student Rider Programme',
    subtitle: 'Your first bike, our best deal',
    description: 'Show your valid student ID and get special pricing on the Storm 200 and Phantom 350. Plus free riding lessons at our partner academies.',
    badge: 'Student Offer',
    badgeColor: '#F59E0B',
    validTill: 'March 31, 2027',
    models: ['Storm 200', 'Phantom 350'],
    benefits: [
      '₹10,000 special student discount',
      '3 free riding skill sessions',
      'Free first service',
      '1-year roadside assistance',
    ],
    gradient: 'linear-gradient(135deg, #B45309 0%, #F59E0B 100%)',
  },
];

export const financingOptions = [
  { bank: 'HDFC Bank', rate: '8.5% p.a.', tenure: 'Up to 60 months', downPayment: '0-20%' },
  { bank: 'ICICI Bank', rate: '9.0% p.a.', tenure: 'Up to 72 months', downPayment: '0-20%' },
  { bank: 'SBI', rate: '7.9% p.a.', tenure: 'Up to 60 months', downPayment: '10-20%' },
  { bank: 'Axis Bank', rate: '9.5% p.a.', tenure: 'Up to 48 months', downPayment: '0-15%' },
];
