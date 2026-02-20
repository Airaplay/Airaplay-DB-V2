import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendEmailRequest {
  template_type: 'welcome' | 'purchase_treat' | 'approved_withdrawal' | 'newsletter' | 'weekly_report';
  recipient_email: string;
  recipient_user_id?: string;
  variables: Record<string, string>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: SendEmailRequest = await req.json();
    const { template_type, recipient_email, recipient_user_id, variables } = body;

    // Validate request
    if (!template_type || !recipient_email || !variables) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get ZeptoMail configuration
    const { data: config, error: configError } = await supabase
      .from('zeptomail_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      console.error('Failed to get ZeptoMail config:', configError);
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get email template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_type', template_type)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.error('Failed to get email template:', templateError);
      return new Response(
        JSON.stringify({ error: 'Email template not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Replace variables in subject and content
    let subject = template.subject;
    let htmlContent = template.html_content;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), value);
    }

    // Send email via ZeptoMail API
    const zeptomailResponse = await fetch('https://api.zeptomail.com/v1.1/email', {
      method: 'POST',
      headers: {
        'Authorization': config.api_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: {
          address: config.from_email,
          name: config.from_name,
        },
        to: [
          {
            email_address: {
              address: recipient_email,
            },
          },
        ],
        subject: subject,
        htmlbody: htmlContent,
        ...(config.bounce_address && { bounce_address: config.bounce_address }),
      }),
    });

    const zeptomailData = await zeptomailResponse.json();

    // Log email
    const emailLog = {
      template_type,
      recipient_email,
      recipient_user_id: recipient_user_id || null,
      subject,
      html_content: htmlContent,
      status: zeptomailResponse.ok ? 'sent' : 'failed',
      provider_message_id: zeptomailData.message_id || null,
      error_message: zeptomailResponse.ok ? null : JSON.stringify(zeptomailData),
      metadata: { variables },
      sent_at: zeptomailResponse.ok ? new Date().toISOString() : null,
    };

    const { error: logError } = await supabase
      .from('email_logs')
      .insert(emailLog);

    if (logError) {
      console.error('Failed to log email:', logError);
    }

    if (!zeptomailResponse.ok) {
      return new Response(
        JSON.stringify({
          error: 'Failed to send email',
          details: zeptomailData,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        message_id: zeptomailData.message_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
