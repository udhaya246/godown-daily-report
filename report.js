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

// 🧠 Get current UTC and IST range
const now = new Date();
const istOffsetMs = 5.5 * 60 * 60 * 1000;
const istNow = new Date(now.getTime() + istOffsetMs);

// 🧮 Calculate IST day start/end in UTC
const istStart = new Date(Date.UTC(
  istNow.getUTCFullYear(),
  istNow.getUTCMonth(),
  istNow.getUTCDate(),
  -5, -30 // subtract 5:30 to shift IST to UTC
));
const istEnd = new Date(istStart.getTime() + 24 * 60 * 60 * 1000);

console.log("🕒 GitHub UTC time:", now.toISOString());
console.log("📅 IST Date (in UTC range):", istStart.toISOString(), "→", istEnd.toISOString());

(async () => {
  try {
    // 📦 Fetch today's records from Supabase
    const { data: rows, error } = await supabase
      .from('materials_to_sell')
      .select('id, godown_name, material_name, unit, quantity, price_per_unit, total_price, date_to_sell')
      .gte('date_to_sell', istStart.toISOString())
      .lt('date_to_sell', istEnd.toISOString());

    if (error) {
      console.error('❌ Supabase query error:', error.message);
      process.exit(1);
    }

    console.log('✅ Raw rows returned from Supabase:', rows);

    if (!rows || rows.length === 0) {
      console.log('ℹ️ No materials to sell today.');
      return;
    }

    // 🧺 Group materials by godown
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.godown_name]) {
        grouped[row.godown_name] = [];
      }
      grouped[row.godown_name].push(row);
    }

    // 🧾 Build the WhatsApp message
    const todayIST = istStart.toISOString().split('T')[0];
    let message = `📦 *Daily Material Sale Report - ${todayIST}*\n\n`;

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
    console.error('❌ Unexpected error:', err.message || err);
    process.exit(1);
  }
})();
