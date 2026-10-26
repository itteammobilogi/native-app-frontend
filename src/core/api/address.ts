import { api } from './client';

// Raw user_addresses row. `area_code` is the pincode.
export type Address = {
  id: number;
  user_id: number;
  name: string;
  house_name: string | null;
  building: string | null;
  locality: string | null;
  city: string;
  state: string;
  country: string;
  area_code: string | null;
  email: string | null;
  phone: string;
  tax_number?: string | null;
  is_default: 0 | 1;
};

export type AddressInput = Omit<Address, 'id' | 'user_id' | 'is_default'> & { is_default?: 0 | 1 };

// No auth on this route — it reads the user id from the URL. An empty list
// comes back as status 201 {success:false}, which is not an error.
export const listAddresses = (userId: number) =>
  api
    .get<{ success: boolean; address?: Address[] }>(`/api/users/${userId}/address`)
    .then((r) => (r.data.success && Array.isArray(r.data.address) ? r.data.address : []));

export const getAddress = (id: number) =>
  api.get<{ success: boolean; address: Address }>(`/api/users/address/${id}`).then((r) => r.data.address);

export const createAddress =(userId: number, a: AddressInput) =>
  api
    .post<{ success: boolean; id: number }>('/api/users/address/create', { user_id: userId, ...a })
    .then((r) => r.data);

export const updateAddress = (id: number, a: Partial<AddressInput>) =>
  api.put('/api/users/edit/address', { id, ...a }).then((r) => r.data);

// There is no dedicated endpoint; the website sets default through edit.
export const setDefaultAddress = (id: number) =>
  api.put('/api/users/edit/address', { id, is_default: 1 }).then((r) => r.data);

// Path is misspelled ("delelte") on the server — keep it as-is.
export const deleteAddress = (id: number) =>
  api.delete('/api/users/delelte/address', { data: { id } }).then((r) => r.data);

export type PincodeLocation = { id: number; district: string; state_name: string; office_name: string; pincode?: string };

// Every post office / area under a pincode (website: LocationModal's list).
export const searchPincode = (pincode: string) =>
  api
    .get<{ success: boolean; location: PincodeLocation[] }>(`/api/location/${pincode}`)
    .then((r) => r.data.location ?? []);

export const lookupPincode = (pincode: string) =>
  api
    .get<{ success: boolean; location: PincodeLocation[] }>(`/api/location/${pincode}`)
    .then((r) => r.data.location?.[0] ?? null)
    .catch(() => null);

export const formatAddress = (a: Address) =>
  [a.house_name, a.building, a.locality, a.city, a.state, a.area_code].filter(Boolean).join(', ');
