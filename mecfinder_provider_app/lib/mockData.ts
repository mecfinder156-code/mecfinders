export const providerProfile = {
  name: 'Arju',
  businessName: 'Arju Auto Care',
  phone: '+91 99988 87770',
  email: 'arju.care@example.com',
  type: 'Mobile Mechanic',
  experience: '5-10 Years',
  rating: 4.8,
  reviews: 124,
  location: 'Sunrakh, Uttar Pradesh',
  isOnline: true,
  earningsToday: 2450,
  completedToday: 8,
  walletBalance: 12480,
};

export type RequestStatus = 'new' | 'pending' | 'accepted' | 'ongoing' | 'completed' | 'rejected';

export interface ServiceRequest {
  id: string;
  customerName: string;
  serviceNeeded: string;
  location: string;
  distance: string;
  time: string;
  status: RequestStatus;
  price?: number;
  emoji?: string;
}

export const mockRequests: ServiceRequest[] = [
  {
    id: 'REQ-1001',
    customerName: 'Rohit Sharma',
    serviceNeeded: 'Battery Jump Start',
    location: '124 Main St, Sunrakh',
    distance: '2.4 km',
    time: 'Just now',
    status: 'new',
    price: 450,
    emoji: '🔋',
  },
  {
    id: 'REQ-1002',
    customerName: 'Ankit Verma',
    serviceNeeded: 'Tyre Change',
    location: 'GLA University, Sunrakh',
    distance: '3.1 km',
    time: '5 mins ago',
    status: 'new',
    price: 300,
    emoji: '🛞',
  },
  {
    id: 'REQ-0999',
    customerName: 'Emily Davis',
    serviceNeeded: 'Brake Pad Replacement',
    location: '450 West Ave, Vrindavan',
    distance: '3.8 km',
    time: '1 hour ago',
    status: 'accepted',
    price: 1200,
    emoji: '🛠️',
  },
  {
    id: 'REQ-0998',
    customerName: 'Robert Wilson',
    serviceNeeded: 'Engine Diagnostics',
    location: '88 Oak Lane, Mathura',
    distance: '1.2 km',
    time: '3 hours ago',
    status: 'ongoing',
    emoji: '⚙️',
  },
  {
    id: 'REQ-0990',
    customerName: 'Alice Smith',
    serviceNeeded: 'Oil Change',
    location: 'Home Drive 21, Sunrakh',
    distance: '4.5 km',
    time: 'Yesterday',
    status: 'completed',
    price: 750,
    emoji: '🛢️',
  },
];

export interface ProviderService {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  oldPrice?: number;
  active: boolean;
  emoji: string;
}

export const mockServices: ProviderService[] = [
  { id: '1', name: 'Battery Jump Start', description: 'Quick roadside battery boost', category: 'Roadside', price: 450, oldPrice: 600, active: true, emoji: '🔋' },
  { id: '2', name: 'Tyre Change', description: 'Flat tyre replacement on the spot', category: 'Roadside', price: 300, oldPrice: 400, active: true, emoji: '🛞' },
  { id: '3', name: 'Lockout Service', description: 'Locked out? We unlock safely', category: 'Roadside', price: 500, oldPrice: 700, active: false, emoji: '🔑' },
  { id: '4', name: 'Oil Change', description: 'Engine oil & filter replacement', category: 'Maintenance', price: 750, oldPrice: 900, active: true, emoji: '🛢️' },
  { id: '5', name: 'Full Servicing', description: 'Complete bike/car checkup', category: 'Maintenance', price: 1209, oldPrice: 1572, active: true, emoji: '🧰' },
  { id: '6', name: 'Brake Pad Replacement', description: 'Safe & smooth braking restored', category: 'Repair', price: 1200, oldPrice: 1600, active: true, emoji: '🛠️' },
  { id: '7', name: 'Car Wash', description: 'Complete wash & cleaning', category: 'Repair', price: 148, oldPrice: 192, active: false, emoji: '🚿' },
];

export interface WalletTxn {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
}

export const mockTransactions: WalletTxn[] = [
  { id: 't1', title: 'Battery Jump Start', subtitle: 'REQ-1001 · Rohit Sharma', amount: 450, type: 'credit', date: 'Today, 6:10 PM' },
  { id: 't2', title: 'Payout to Bank', subtitle: 'HDFC ••••4521', amount: 5000, type: 'debit', date: 'Today, 1:20 PM' },
  { id: 't3', title: 'Oil Change', subtitle: 'REQ-0990 · Alice Smith', amount: 750, type: 'credit', date: 'Yesterday' },
  { id: 't4', title: 'Brake Pad Replacement', subtitle: 'REQ-0999 · Emily Davis', amount: 1200, type: 'credit', date: '2 days ago' },
  { id: 't5', title: 'Platform Fee', subtitle: 'Weekly commission', amount: 180, type: 'debit', date: '3 days ago' },
];
