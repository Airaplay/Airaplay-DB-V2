import { supabase } from './supabase';
import { CurrencyDetectionResult } from './currencyDetection';
import { fetchWithCache, CACHE_KEYS, CACHE_TTL, configCache } from './configCache';

export interface PaymentChannel {
  id: string;
  channel_name: string;
  channel_type: string;
  is_enabled: boolean;
  icon_url: string | null;
  configuration: any;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentChannelConfig {
  channel_name: string;
  channel_type: 'paystack' | 'flutterwave' | 'usdt';
  is_enabled: boolean;
  icon_url?: string;
  configuration: {
    public_key?: string;
    secret_key?: string;
    encryption_key?: string;
    api_version?: 'v3' | 'v4';
    webhook_url?: string;
    wallet_address?: string;
    network?: string;
    [key: string]: any;
  };
  display_order: number;
}

/**
 * Get all enabled payment channels for public use
 * Cached for 6 hours as payment channels rarely change
 */
export const getEnabledPaymentChannels = async (): Promise<PaymentChannel[]> => {
  try {
    return fetchWithCache(
      CACHE_KEYS.PAYMENT_CHANNELS,
      CACHE_TTL.SIX_HOURS,
      async () => {
        const { data, error } = await supabase
          .from('treat_payment_channels')
          .select('id, channel_name, channel_type, is_enabled, icon_url, configuration, display_order, created_at, updated_at')
          .eq('is_enabled', true)
          .order('display_order', { ascending: true });

        if (error) throw error;

        return data || [];
      }
    );
  } catch (error) {
    console.error('Error fetching enabled payment channels:', error);
    throw error;
  }
};

/**
 * Get all payment channels (admin only)
 */
export const getAllPaymentChannels = async (): Promise<PaymentChannel[]> => {
  try {
    const { data, error } = await supabase
      .from('treat_payment_channels')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching all payment channels:', error);
    throw error;
  }
};

/**
 * Create a new payment channel (admin only)
 */
export const createPaymentChannel = async (channelData: PaymentChannelConfig): Promise<PaymentChannel> => {
  try {
    const { data, error } = await supabase
      .from('treat_payment_channels')
      .insert({
        channel_name: channelData.channel_name,
        channel_type: channelData.channel_type,
        is_enabled: channelData.is_enabled,
        icon_url: channelData.icon_url || null,
        configuration: channelData.configuration,
        display_order: channelData.display_order
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error creating payment channel:', error);
    throw error;
  }
};

/**
 * Update a payment channel (admin only)
 */
export const updatePaymentChannel = async (
  channelId: string, 
  updates: Partial<PaymentChannelConfig>
): Promise<PaymentChannel> => {
  try {
    const { data, error } = await supabase
      .from('treat_payment_channels')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', channelId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error updating payment channel:', error);
    throw error;
  }
};

/**
 * Delete a payment channel (admin only)
 */
export const deletePaymentChannel = async (channelId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('treat_payment_channels')
      .delete()
      .eq('id', channelId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting payment channel:', error);
    throw error;
  }
};

/**
 * Toggle payment channel status (admin only)
 */
export const togglePaymentChannelStatus = async (channelId: string): Promise<PaymentChannel> => {
  try {
    // First get current status
    const { data: currentChannel, error: fetchError } = await supabase
      .from('treat_payment_channels')
      .select('is_enabled')
      .eq('id', channelId)
      .single();

    if (fetchError) throw fetchError;

    // Toggle the status
    const { data, error } = await supabase
      .from('treat_payment_channels')
      .update({
        is_enabled: !currentChannel.is_enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', channelId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error toggling payment channel status:', error);
    throw error;
  }
};

/**
 * Process payment through selected channel
 */
export const processPayment = async (
  channelId: string,
  amount: number,
  packageId: string,
  userEmail: string,
  currencyData: CurrencyDetectionResult
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    // Get payment channel details
    const { data: channel, error: channelError } = await supabase
      .from('treat_payment_channels')
      .select('*')
      .eq('id', channelId)
      .eq('is_enabled', true)
      .single();

    if (channelError) throw channelError;

    if (!channel) {
      throw new Error('Payment channel not found or disabled');
    }

    // Call the payment processing edge function
    const { data, error } = await supabase.functions.invoke('process-payment', {
      body: {
        channel_id: channelId,
        channel_type: channel.channel_type,
        amount: amount,
        package_id: packageId,
        user_email: userEmail,
        configuration: channel.configuration,
        currency: currencyData.currency.code,
        currency_symbol: currencyData.currency.symbol,
        currency_name: currencyData.currency.name,
        exchange_rate: currencyData.currency.exchangeRate,
        detected_country: currencyData.country,
        detected_country_code: currencyData.countryCode
      }
    });

    if (error) {
      console.error('Edge function invocation error:', error);

      // Extract error details from the edge function response
      let errorMessage = 'Payment processing failed';
      if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
        data: data || null
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error processing payment:', error);

    let errorMessage = 'Payment processing failed';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Validate payment channel configuration
 */
export const validateChannelConfig = (
  channelType: string, 
  configuration: any
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  switch (channelType) {
    case 'paystack':
      if (!configuration.public_key) {
        errors.push('Paystack public key is required');
      }
      if (!configuration.secret_key) {
        errors.push('Paystack secret key is required');
      }
      break;

    case 'flutterwave':
      const apiVersion = configuration.api_version || 'v3';
      if (!configuration.public_key) {
        errors.push('Flutterwave public key is required');
      }
      if (!configuration.secret_key) {
        errors.push('Flutterwave secret key is required');
      }
      if (apiVersion === 'v4' && !configuration.encryption_key) {
        errors.push('Flutterwave V4 encryption key is required');
      }
      break;

    case 'usdt':
      if (!configuration.wallet_address) {
        errors.push('USDT wallet address is required');
      }
      if (!configuration.network) {
        errors.push('Network (TRC-20, ERC-20, etc.) is required');
      }
      break;

    default:
      errors.push('Invalid channel type');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};