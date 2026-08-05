/**
 * USPS Service
 * Client-side service for USPS API integration
 */
import api from './api';

export interface Address {
  firm_name?: string;
  address1?: string;
  address2: string;
  city?: string;
  state?: string;
  zip5?: string;
  zip4?: string;
}

export interface ValidatedAddress extends Address {
  delivery_point?: string;
  dpv_confirmation?: string;
  return_text?: string;
}

export interface ZipCodeResult {
  zip5: string;
  zip4: string;
  address2?: string;
  city?: string;
  state?: string;
}

export interface CityStateResult {
  zip5: string;
  city: string;
  state: string;
}

export interface TrackingInfo {
  tracking_id: string;
  status: string;
  delivery_status: string;
  expected_delivery_date?: string;
  events: Array<{
    timestamp: string;
    event_type: string;
    status: string;
    location?: string;
    detail?: string;
  }>;
  last_updated: string;
}

export interface Shipment {
  _id: string;
  tracking_number: string;
  description: string;
  service_type: string;
  created_at: string;
  current_status: string;
  delivered_at?: string;
  current_tracking?: TrackingInfo;
}

export interface ServiceOrder {
  _id: string;
  client_id: string;
  client_name: string;
  service_name: string;
  service_category: string;
  price: number;
  status: string;
  requires_shipping: boolean;
  requires_return_label: boolean;
  shipping_option: string;
  tracking_number: string;
  tracking_status: string;
  tracking_history: Array<{
    date: string;
    time: string;
    status: string;
    location: string;
    description: string;
  }>;
  return_tracking_number: string;
  return_tracking_status: string;
  return_tracking_history: Array<any>;
  from_address: { name: string; street: string; city: string; state: string; zip: string };
  to_address: { name: string; street: string; city: string; state: string; zip: string };
  notes: string;
  created_at: string;
  shipped_at?: string;
  delivered_at?: string;
}

export const uspsService = {
  /**
   * Validate a single address
   */
  async validateAddress(address: Address): Promise<ValidatedAddress> {
    const response = await api.post<ValidatedAddress>(
      '/usps/address/validate',
      address
    );
    return response.data;
  },

  /**
   * Validate multiple addresses (max 5)
   */
  async validateAddressesBatch(addresses: Address[]): Promise<{
    success_count: number;
    error_count: number;
    results: Array<{ index: number; address: ValidatedAddress }>;
    errors: Array<{ index: number; error: string }>;
  }> {
    const response = await api.post(
      '/usps/address/validate-batch',
      { addresses }
    );
    return response.data;
  },

  /**
   * Look up ZIP code from address
   */
  async lookupZipCode(address: {
    address2: string;
    city?: string;
    state?: string;
  }): Promise<ZipCodeResult> {
    const response = await api.post<ZipCodeResult>(
      '/usps/zipcode/lookup',
      address
    );
    return response.data;
  },

  /**
   * Look up city and state from ZIP code
   */
  async lookupCityState(zipCode: string): Promise<CityStateResult> {
    const response = await api.get<CityStateResult>(
      `/usps/zipcode/citystate/${zipCode}`
    );
    return response.data;
  },

  /**
   * Track a package by tracking number
   */
  async trackPackage(trackingNumber: string): Promise<TrackingInfo> {
    const response = await api.get<TrackingInfo>(
      `/usps/tracking/${trackingNumber}`
    );
    return response.data;
  },

  /**
   * Get user's shipments (client view)
   */
  async getMyShipments(): Promise<Shipment[]> {
    const response = await api.get<{ count: number; shipments: Shipment[] }>(
      '/usps/shipments/my-shipments'
    );
    return response.data.shipments;
  },

  /**
   * Get all shipments (admin view)
   */
  async getAllShipments(): Promise<Shipment[]> {
    const response = await api.get<{ count: number; shipments: Shipment[] }>(
      '/usps/shipments/all'
    );
    return response.data.shipments;
  },

  /**
   * Create a new shipment (admin only)
   */
  async createShipment(data: {
    to_user_id: string;
    description: string;
  }): Promise<{
    success: boolean;
    shipment: Shipment;
    message: string;
  }> {
    const response = await api.post('/usps/shipments/create', null, {
      params: data,
    });
    return response.data;
  },

  // ═══════════════════════════════════════════════════════
  // SERVICE ORDERS (Client-facing tracking)
  // ═══════════════════════════════════════════════════════

  /**
   * Get my service orders (client view)
   */
  async getMyServiceOrders(): Promise<ServiceOrder[]> {
    const response = await api.get<{ orders: ServiceOrder[]; total: number }>(
      '/service-orders/my-orders'
    );
    return response.data.orders || [];
  },

  /**
   * Get a single service order
   */
  async getServiceOrder(orderId: string): Promise<ServiceOrder> {
    const response = await api.get<ServiceOrder>(`/service-orders/${orderId}`);
    return response.data;
  },

  /**
   * Request tracking update for a service order
   */
  async updateServiceOrderTracking(orderId: string): Promise<any> {
    const response = await api.post(`/service-orders/${orderId}/update-tracking`);
    return response.data;
  },
};

export default uspsService;
