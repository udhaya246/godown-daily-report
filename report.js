
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

// Supabase setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Twilio setup
const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const from = process.env.TWILIO_FROM;
const to = process.env.TWILIO_TO;

// Calculate IST date (UTC +5:30)
const now = new Date();
const istOffsetMs = 5.5 * 60 * 60 * 1000;
const istNow = new Date(now.getTime() + istOffsetMs);
const today = istNow.toISOString().split('T')[0];

console.log("🕒 GitHub Action UTC Time:", now.toISOString());
console.log("📅 IST-adjusted date used in query:", today);

(async () => {
  try {
    // Fetch today's materials
    const { data: rows, error } = await supabase
      .from('materials_to_sell')
      .select('*')
      .gte('date_to_sell', `${today}T00:00:00`)
      .lt('date_to_sell', `${today}T23:59:59`);

    if (error) {
      console.error('❌ Supabase error:', error.message);
      process.exit(1);
    }

    if (!rows || rows.length === 0) {
      console.log("ℹ️ No materials to sell today.");
      return;
    }

    console.log(`📦 ${rows.length} materials found for ${today}`);

    // Group by godown
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.godown_name]) grouped[row.godown_name] = [];
      grouped[row.godown_name].push(row);
    }

    // Build WhatsApp message
    let message = `📦 *Daily Material Sale Report - ${today}*\n\n`;
    for (const godown in grouped) {
      message += `🏭 *${godown}*\n`;
      for (const item of grouped[godown]) {
        message += `• ${item.material_name} - ${item.quantity}${item.unit} @ ₹${item.price_per_unit} = ₹${item.total_price}\n`;
      }
      message += `\n`;
    }

    console.log("📨 Message preview:\n" + message);

    // Send WhatsApp message
    try {
      const sent = await client.messages.create({
        from,
        to,
        body: message,
      });
      console.log('✅ WhatsApp report sent. SID:', sent.sid);
    } catch (err) {
      console.error('❌ Twilio error:', err?.message || err);
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
})();
