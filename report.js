
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Twilio setup
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const from = process.env.TWILIO_FROM;
const to = process.env.TWILIO_TO;

// Get IST date (UTC +5:30)
const now = new Date();
const istOffset = 5.5 * 60 * 60 * 1000;
const istNow = new Date(now.getTime() + istOffset);
const today = istNow.toISOString().split('T')[0];

console.log("🕒 GitHub Action UTC Time:", now.toISOString());
console.log("📅 IST-adjusted date used in query:", today);

(async () => {
  try {
    // Fetch today's materials from Supabase
    const { data: rows, error } = await supabase
      .from('materials_to_sell')
      .select('*')
      .gte('date_to_sell', `${today}T00:00:00`)
      .lt('date_to_sell', `${today}T23:59:59`)


    if (error) {
      console.error('❌ Supabase error:', error.message);
      process.exit(1);
    }

    if (!rows || rows.length === 0) {
      console.log("ℹ️ No materials to sell today.");
      return;
    }

    // Group by godown
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.godown_name]) {
        grouped[row.godown_name] = [];
      }
      grouped[row.godown_name].push(row);
    }

    // Build message
    let message = `📦 *Daily Material Sale Report - ${today}*\n\n`;

    for (const [godown, materials] of Object.entries(grouped)) {
      message += `🏭 *${godown}*\n`;
      for (const m of materials) {
        message += `• ${m.material_name} - ${m.quantity}${m.unit} @ ₹${m.price_per_unit} = ₹${m.total_price}\n`;
      }
      message += '\n';
    }

    // Send WhatsApp message
    const result = await twilioClient.messages.create({
      from,
      to,
      body: message,
    });

    console.log('✅ WhatsApp message sent:', result.sid);
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
})();