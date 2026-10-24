// =============================================
// APEX MOTO — Dealer Data
// Static data for frontend demonstration only.
// All dealer information is fictional.
// =============================================

export const dealers = [
  {
    id: 1,
    name: 'Apex Moto Delhi Central',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001',
    address: '42, Connaught Place, Central Delhi, New Delhi - 110001',
    phone: '+91-11-4123-5678',
    email: 'delhi.central@apexmoto.in',
    hours: 'Mon–Sat: 9:00 AM – 7:00 PM | Sun: 10:00 AM – 5:00 PM',
    services: ['Sales', 'Service', 'Accessories', 'Test Ride'],
    mapEmbed: null,
    featured: true,
  },
  {
    id: 2,
    name: 'Apex Moto Mumbai West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400053',
    address: 'Shop 12, Linking Road, Bandra West, Mumbai - 400053',
    phone: '+91-22-2655-9900',
    email: 'mumbai.west@apexmoto.in',
    hours: 'Mon–Sat: 9:30 AM – 7:30 PM | Sun: 11:00 AM – 5:00 PM',
    services: ['Sales', 'Service', 'Accessories', 'Test Ride', 'Finance'],
    mapEmbed: null,
    featured: true,
  },
  {
    id: 3,
    name: 'Apex Moto Bangalore Tech City',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
    address: '77, Brigade Road, Shivajinagar, Bengaluru - 560001',
    phone: '+91-80-4567-8901',
    email: 'bangalore.tc@apexmoto.in',
    hours: 'Mon–Sat: 9:00 AM – 8:00 PM | Sun: 10:00 AM – 6:00 PM',
    services: ['Sales', 'Service', 'Accessories', 'Test Ride', 'Finance', 'Insurance'],
    mapEmbed: null,
    featured: true,
  },
  {
    id: 4,
    name: 'Apex Moto Pune Camp',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    address: '15, MG Road, Camp Area, Pune - 411001',
    phone: '+91-20-2633-7788',
    email: 'pune.camp@apexmoto.in',
    hours: 'Mon–Sat: 9:00 AM – 7:00 PM | Sun: 10:00 AM – 4:00 PM',
    services: ['Sales', 'Service', 'Accessories', 'Test Ride'],
    mapEmbed: null,
    featured: false,
  },
  {
    id: 5,
    name: 'Apex Moto Chennai Anna Nagar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600040',
    address: '88, 2nd Avenue, Anna Nagar, Chennai - 600040',
    phone: '+91-44-2626-5544',
    email: 'chennai.an@apexmoto.in',
    hours: 'Mon–Sat: 9:30 AM – 7:00 PM | Sun: 10:00 AM – 4:00 PM',
    services: ['Sales', 'Service', 'Accessories', 'Test Ride', 'Finance'],
    mapEmbed: null,
    featured: false,
  },
  {
    id: 6,
    name: 'Apex Moto Hyderabad Jubilee Hills',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500033',
    address: '34, Road No. 10, Jubilee Hills, Hyderabad - 500033',
    phone: '+91-40-2355-1234',
    email: 'hyderabad.jh@apexmoto.in',
    hours: 'Mon–Sat: 10:00 AM – 8:00 PM | Sun: 11:00 AM – 5:00 PM',
    services: ['Sales', 'Service', 'Accessories', 'Test Ride', 'Finance', 'Insurance'],
    mapEmbed: null,
    featured: false,
  },
  {
    id: 7,
    name: 'Apex Moto Jaipur Pink City',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302001',
    address: '23, Tonk Road, Near SMS Hospital, Jaipur - 302001',
    phone: '+91-141-2366-7890',
    email: 'jaipur.pc@apexmoto.in',
    hours: 'Mon–Sat: 9:00 AM – 7:00 PM | Sun: 10:00 AM – 4:00 PM',
    services: ['Sales', 'Service', 'Accessories', 'Test Ride'],
    mapEmbed: null,
    featured: false,
  },
  {
    id: 8,
    name: 'Apex Moto Kolkata Park Street',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700016',
    address: '56, Park Street, Kolkata - 700016',
    phone: '+91-33-2229-4455',
    email: 'kolkata.ps@apexmoto.in',
    hours: 'Mon–Sat: 10:00 AM – 7:30 PM | Sun: 11:00 AM – 5:00 PM',
    services: ['Sales', 'Service', 'Accessories', 'Test Ride', 'Finance'],
    mapEmbed: null,
    featured: false,
  },
];

export const cities = [...new Set(dealers.map(d => d.city))];

export const getDealersByCity = (city) => {
  if (!city || city === 'All') return dealers;
  return dealers.filter(d => d.city.toLowerCase() === city.toLowerCase());
};

export const getDealersByPincode = (pincode) => {
  if (!pincode) return dealers;
  return dealers.filter(d => d.pincode.includes(pincode));
};
