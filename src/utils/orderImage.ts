import { Order } from '../types';

export const getOrderImage = (order: Order): string => {
  if (order.image && order.image.trim() !== '') {
    return order.image;
  }

  const text = `${order.product || ''} ${order.variant || ''}`.toLowerCase();

  if (text.includes('rose') || text.includes('গোলাপ') || text.includes('পরবাস') || text.includes('porbash')) {
    return 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=400&auto=format&fit=crop&q=80';
  }
  if (text.includes('watch') || text.includes('ঘড়ি') || text.includes('ঘড়ি') || text.includes('combo') || text.includes('golden')) {
    return 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=400&auto=format&fit=crop&q=80';
  }
  if (text.includes('doll') || text.includes('toy') || text.includes('পুতুল')) {
    return 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400&auto=format&fit=crop&q=80';
  }
  if (text.includes('dispancer') || text.includes('dispenser') || text.includes('cutting') || text.includes('কাটিং')) {
    return 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=400&auto=format&fit=crop&q=80';
  }
  if (text.includes('panjabi') || text.includes('shirt') || text.includes('পোশাক') || text.includes('saree') || text.includes('কাপড়') || text.includes('pant')) {
    return 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&auto=format&fit=crop&q=80';
  }
  if (text.includes('earbud') || text.includes('headphone') || text.includes('ইয়ারবাড')) {
    return 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&auto=format&fit=crop&q=80';
  }
  if (text.includes('wallet') || text.includes('ওয়ালেট')) {
    return 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&auto=format&fit=crop&q=80';
  }

  // General commerce product fallback
  return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80';
};
