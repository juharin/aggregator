import {
  createBrowserSupabaseClient,
  User
} from '@supabase/auth-helpers-nextjs';
import { ProductWithPrice } from 'types';
import type { Database } from 'types_db';

export const supabase = createBrowserSupabaseClient<Database>();

export const getActiveProductsWithPrices = async (): Promise<
  ProductWithPrice[]
> => {
  const { data, error } = await supabase
    .from('products')
    .select('*, prices(*)')
    .eq('active', true)
    .eq('prices.active', true)
    .order('metadata->index')
    .order('unit_amount', { foreignTable: 'prices' });

  if (error) {
    console.log(error.message);
  }
  // TODO: improve the typing here.
  return (data as any) || [];
};

export const updateUserName = async (user: User, name: string) => {
  await supabase
    .from('users')
    .update({
      full_name: name
    })
    .eq('id', user.id);
};

export const getUser = async (user: User) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id);
  
  if (error) {
    console.log(error.message);
  }
  return (data as any) || [];
};

export const updatePolarAccessToken = async (user: User, accessToken: string) => {
  const { data, error } = await supabase
    .from('users')
    .update({
      polar_access_token: accessToken
    })
    .eq('id', user.id)
    .select();
  
  if (error) {
    console.log(error.message);
  }
  return (data as any) || [];
};

export const updatePolarTokenExpiresIn = async (user: User, timestamp: Date) => {
  const { data, error } = await supabase
    .from('users')
    .update({
      polar_expires_in: timestamp
    })
    .eq('id', user.id)
    .select();

  if (error) {
    console.log(error.message);
  }
  return (data as any) || [];
};
