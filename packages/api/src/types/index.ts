export interface User {
  id: string;
  api_key_hash: string;
  created_at: string;
}

export interface Link {
  id: string;
  code: string;
  long_url: string;
  user_id: string | null;
  active: boolean;
  click_count: number;
  expiry_at: string | null;
  max_clicks: number | null;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClickEvent {
  id: string;
  link_id: string;
  clicked_at: string;
  referrer: string | null;
  country: string | null;
  user_agent: string | null;
  ip_hash: string;
}

/** Typed subset of ip-api.com JSON used by the geo service. */
export interface GeoResponse {
  status: 'success' | 'fail';
  countryCode?: string;
  message?: string;
}
