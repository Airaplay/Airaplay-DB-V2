import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validatePaymentRequest, validateContentType } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PaymentRequest {
  channel_id: string;
  channel_type: string;
  amount: number;
  package_id: string;
  user_email: string;
  configuration: any;
  currency: string;
  currency_symbol: string;
  currency_name: string;
  exchange_rate: number;
  detected_country?: string;
  detected_country_code?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  let requestData: PaymentRequest | null = null;

  try {
    const contentType = req.headers.get("content-type");
    if (!validateContentType(contentType)) {
      return new Response(
        JSON.stringify({ error: "Invalid content type" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    requestData = await req.json();

    const validation = validatePaymentRequest(requestData);
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: validation.errors
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const {
      channel_id,
      channel_type,
      amount,
      package_id,
      user_email,
      configuration,
      currency,
      currency_symbol,
      currency_name,
      exchange_rate,
      detected_country,
      detected_country_code,
    } = requestData;

    // Validate configuration exists and has required keys
    if (!configuration || typeof configuration !== 'object') {
      console.error("Invalid or missing configuration");
      return new Response(
        JSON.stringify({
          error: "Payment gateway not properly configured",
          message: "The payment system is currently being set up. Please try again later or contact support."
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check for required API keys based on channel type
    if ((channel_type === 'paystack' || channel_type === 'flutterwave') && !configuration.secret_key) {
      console.error(`${channel_type} secret key is missing`);
      return new Response(
        JSON.stringify({
          error: "Payment gateway not properly configured",
          message: "The payment system requires configuration. Please contact support."
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", user_email)
      .maybeSingle();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amountUSD = exchange_rate > 0 ? amount / exchange_rate : amount;

    // Log premium currency transactions (GBP/EUR with USD equivalent < $1)
    const premiumCurrencies = ['GBP', 'EUR'];
    const isPremiumCurrency = premiumCurrencies.includes(currency.toUpperCase());
    if (isPremiumCurrency && amountUSD < 1.00) {
      console.log(`[Premium Currency] ${currency} transaction allowed:`, {
        amount: amount,
        currency: currency,
        amountUSD: amountUSD,
        exchange_rate: exchange_rate,
        user_email: user_email,
        detected_country: detected_country
      });
    }

    const { data: paymentData, error: paymentError } = await supabase
      .from("treat_payments")
      .insert({
        user_id: userData.id,
        package_id: package_id,
        amount: amount,
        currency: currency || "USD",
        currency_symbol: currency_symbol || "$",
        currency_name: currency_name || "US Dollar",
        exchange_rate: exchange_rate || 1,
        amount_usd: amountUSD,
        detected_country: detected_country || null,
        detected_country_code: detected_country_code || null,
        payment_method: channel_type,
        status: "pending",
        payment_channel_id: channel_id,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment record:", paymentError);
      return new Response(
        JSON.stringify({ error: "Failed to create payment record" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let paymentResponse: any = {};

    switch (channel_type) {
      case "paystack":
        paymentResponse = await processPaystackPayment(
          amount,
          user_email,
          paymentData.id,
          configuration,
          currency
        );
        break;

      case "flutterwave":
        paymentResponse = await processFlutterwavePayment(
          amount,
          user_email,
          paymentData.id,
          configuration,
          currency
        );
        break;

      case "usdt":
        paymentResponse = await processUSDTPayment(
          amount,
          paymentData.id,
          configuration,
          currency
        );
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Unsupported payment channel" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    if (paymentResponse.reference) {
      await supabase
        .from("treat_payments")
        .update({
          external_reference: paymentResponse.reference,
          payment_data: paymentResponse,
        })
        .eq("id", paymentData.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentData.id,
        ...paymentResponse,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Payment processing error:", error);

    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("Error details:", {
      message: errorMessage,
      stack: errorStack,
      requestData: requestData ? JSON.stringify(requestData) : "unavailable"
    });

    return new Response(
      JSON.stringify({
        error: "Payment processing failed",
        message: errorMessage,
        details: errorMessage.includes("API key")
          ? "Payment gateway configuration error. Please contact support."
          : errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function processPaystackPayment(
  amount: number,
  email: string,
  paymentId: string,
  config: any,
  currency: string = "NGN"
) {
  const paystackAmount = Math.round(amount * 100);
  const reference = "treat_" + paymentId;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const callbackUrl = supabaseUrl + "/functions/v1/payment-webhook";

  const supportedCurrencies = ["NGN", "USD", "GHS", "ZAR", "KES"];
  const paystackCurrency = supportedCurrencies.includes(currency) ? currency : "NGN";

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + config.secret_key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
      amount: paystackAmount,
      currency: paystackCurrency,
      reference: reference,
      callback_url: callbackUrl,
      metadata: {
        payment_id: paymentId,
        channel: "paystack",
        original_currency: currency,
      },
    }),
  });

  const data = await response.json();

  console.log("Paystack API response:", JSON.stringify(data, null, 2));

  if (!response.ok || !data.status) {
    const errorMsg = data.message || `Paystack API error: ${response.status} ${response.statusText}`;
    console.error("Paystack error details:", {
      status: response.status,
      statusText: response.statusText,
      data: data,
      currency: paystackCurrency,
      amount: paystackAmount
    });
    throw new Error(errorMsg);
  }

  return {
    reference: data.data.reference,
    authorization_url: data.data.authorization_url,
    access_code: data.data.access_code,
  };
}

async function processFlutterwavePayment(
  amount: number,
  email: string,
  paymentId: string,
  config: any,
  currency: string = "USD"
) {
  const txRef = "treat_" + paymentId;
  
  // Use custom URL scheme for mobile app redirect
  const redirectUrl = `airaplay://payment/success?provider=flutterwave&reference=${txRef}`;

  const apiVersion = config.api_version || "v3";

  // Flutterwave supported currencies
  const flutterwaveSupportedCurrencies = [
    "NGN", "USD", "GHS", "KES", "UGX", "TZS", "ZAR",
    "XAF", "XOF", "GBP", "EUR", "RWF", "ZMW", "MWK",
    "AUD", "CAD", "BRL", "CNY", "INR", "JPY", "MXN", "SAR", "AED"
  ];

  // Validate and convert currency if needed
  let flutterwaveCurrency = currency;
  let flutterwaveAmount = amount;

  if (!flutterwaveSupportedCurrencies.includes(currency)) {
    console.log(`Currency ${currency} not supported by Flutterwave, defaulting to USD`);
    flutterwaveCurrency = "USD";
    // Amount should already be in the correct value based on exchange rate from frontend
  }

  // Round amount to 2 decimal places for currency precision
  flutterwaveAmount = Math.round(flutterwaveAmount * 100) / 100;

  const headers: Record<string, string> = {
    "Authorization": "Bearer " + config.secret_key,
    "Content-Type": "application/json",
  };

  if (config.encryption_key) {
    headers["X-Encryption-Key"] = config.encryption_key;
  }

  const payload = {
    tx_ref: txRef,
    amount: String(flutterwaveAmount),
    currency: flutterwaveCurrency,
    redirect_url: redirectUrl,
    payment_options: "card,banktransfer,ussd,mobilemoney",
    customer: {
      email: email,
      name: email.split('@')[0],
    },
    customizations: {
      title: "Airaplay Treats",
      description: "Purchase treats for Airaplay",
      logo: ""
    },
    meta: {
      payment_id: paymentId,
      channel: "flutterwave",
      api_version: apiVersion,
      original_currency: currency,
      original_amount: amount,
    },
  };

  console.log("Flutterwave payment request:", JSON.stringify(payload, null, 2));

  const response = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  console.log("Flutterwave API response:", JSON.stringify(data, null, 2));

  if (!response.ok) {
    const errorMsg = `Flutterwave API error: ${response.status} ${response.statusText}`;
    console.error("Flutterwave HTTP error details:", {
      status: response.status,
      statusText: response.statusText,
      data: data,
      currency: flutterwaveCurrency,
      amount: flutterwaveAmount
    });
    throw new Error(data.message || errorMsg);
  }

  if (data.status !== "success" || !data.data) {
    const errorMsg = data.message || `Flutterwave ${apiVersion} initialization failed`;
    console.error("Flutterwave error:", {
      message: errorMsg,
      data: data,
      currency: flutterwaveCurrency,
      amount: flutterwaveAmount,
      requestPayload: payload
    });
    throw new Error(errorMsg);
  }

  if (!data.data.link) {
    console.error("No payment link in response:", data);
    throw new Error("Payment link not generated by Flutterwave. Please try again or use a different payment method.");
  }

  return {
    reference: txRef,
    payment_link: data.data.link,
    api_version: apiVersion,
  };
}

async function processUSDTPayment(
  amount: number,
  paymentId: string,
  config: any,
  currency: string = "USD"
) {
  const reference = "treat_usdt_" + paymentId;
  const instructions = `Send exactly ${amount} ${currency} equivalent in USDT to the wallet address above using ${config.network} network. Payment will be verified manually.`;

  return {
    reference: reference,
    wallet_address: config.wallet_address,
    network: config.network,
    amount_usdt: amount,
    currency: currency,
    instructions: instructions,
  };
}
