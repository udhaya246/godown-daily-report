
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

(async () => {
  const today = new Date().toISOString().split('T')[0]; // yyyy-mm-dd

  const { data, error } = await supabase
    .from('materials_to_sell')
    .select('*')
    .eq('date_to_sell', today);

  if (error) {
    console.error('❌ Supabase error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('ℹ️ No materials to sell today.');
    return;
  }

  const grouped = {};
  for (const item of data) {
    if (!grouped[item.godown_name]) grouped[item.godown_name] = [];
    grouped[item.godown_name].push(item);
  }

  let message = `📦 *Daily Material Sale Report - ${today}*\n\n`;
  for (const godown in grouped) {
    message += `🏭 *${godown}*\n`;
    grouped[godown].forEach(item => {
      message += `• ${item.material_name} - ${item.quantity}${item.unit} @ ₹${item.price_per_unit} = ₹${item.total_price}\n`;
    });
    message += `\n`;
  }

  try {
    await client.messages.create({
      from: process.env.TWILIO_FROM,
      to: process.env.TWILIO_TO,
      body: message
    });
    console.log('✅ WhatsApp report sent to CEO.');
  } catch (err) {
    console.error('❌ Twilio error:', err);
  }
})();
