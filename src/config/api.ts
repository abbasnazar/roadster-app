export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://localhost:8080/api';

export const API_ENDPOINTS = {
  HEALTH: '/health',
  PRODUCTS: '/products',
  CATEGORIES: '/categories',
  BLOGS: '/blogs',
  SEND_OTP: '/customer/send-otp',
  VERIFY_OTP: '/customer/verify-otp',
  USERS_LOGIN: '/users/login',
  USERS_REGISTER: '/users/register',
  USERS_FORGOT_PASSWORD: '/users/forgot-password',
  SELLERS_LOGIN: '/sellers/login',
  SELLERS_REGISTER: '/sellers/register',
  SELLERS_FORGOT_PASSWORD: '/sellers/forgot-password',
  CUSTOMER_GOOGLE_SIGNIN: '/customer/google-signin',
  CUSTOMER_PROFILE: '/customer/profile',
  CUSTOMER_LOGOUT: '/customer/logout',
  SELLER_DASHBOARD: '/sellers/dashboard',
  SELLER_PROFILE: '/sellers/profile',
  GARAGE_ME: '/garage/me',
  GARAGE: '/garage',
  SOCIAL_FEED: '/social/feed',
  SOCIAL_POSTS: '/social/posts',
  TRENDING_HASHTAGS: '/social/hashtags/trending',
  CLUBS: '/clubs',
  EVENTS: '/events',
};
