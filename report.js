const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Twilio setup
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const from = process.env.TWILIO_FROM;
const to = process.env.TWILIO_TO;

// 🕒 Calculate IST day range in UTC
const now = new Date();
const istOffsetMs = 5.5 * 60 * 60 * 1000;
const istNow = new Date(now.getTime() + istOffsetMs);

const istStart = new Date(Date.UTC(
  istNow.getUTCFullYear(),
  istNow.getUTCMonth(),
  istNow.getUTCDate(),
  -5, -30  // Shift back to UTC equivalent of IST start of day
));
const istEnd = new Date(istStart.getTime() + 24 * 60 * 60 * 1000);

console.log("🕒 GitHub UTC time:", now.toISOString());
console.log("📅 IST Date (in UTC range):", istStart.toISOString(), "→", istEnd.toISOString());

(async () => {
  try {
    // 🔍 Fetch today's materials from Supabase using UTC range
    const { data: rows, error } = await supabase
      .from('materials_to_sell')
      .select('*')
      .gte('date_to_sell', istStart.toISOString())
      .lt('date_to_sell', istEnd.toISOString());
    console.log("✅ Raw rows returned from Supabase:", rows);

    if (error) {
      console.error('❌ Supabase error:', error.message);
      process.exit(1);
    }

    if (!rows || rows.length === 0) {
      console.log("ℹ️ No materials to sell today.");
      return;
    }

    // 🗂️ Group by godown
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.godown_name]) {
        grouped[row.godown_name] = [];
      }
      grouped[row.godown_name].push(row);
    }

    // 📝 Build message
    let message = `📦 *Daily Material Sale Report - ${istNow.toISOString().split('T')[0]}*\n\n`;
    for (const [godown, materials] of Object.entries(grouped)) {
      message += `🏭 *${godown}*\n`;
      for (const m of materials) {
        message += `• ${m.material_name} - ${m.quantity}${m.unit} @ ₹${m.price_per_unit} = ₹${m.total_price}\n`;
      }
      message += '\n';
    }

    // 📤 Send WhatsApp message
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
