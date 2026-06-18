/**
 * api/enquiry.js
 * Handles contact form submissions from the Thompson Chambers website.
 *
 * Sends an email notification via Resend (already used in the project).
 * Set the following env vars in Vercel:
 *   RESEND_API_KEY   — your Resend API key
 *   NOTIFY_EMAIL     — address to receive enquiry notifications (e.g. emekalaw@yahoo.com)
 *   FROM_EMAIL       — verified Resend sender (e.g. noreply@yourdomain.com)
 *   ALLOWED_ORIGIN   — your production URL for CORS
 */

export default async function handler(req, res) {
  const origin = process.env.ALLOWED_ORIGIN || '*';

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', origin);

  const { firstName, lastName, email, phone, area, message } = req.body || {};

  // Basic server-side validation
  if (!firstName || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields: firstName, email, message.' });
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'emekalaw@yahoo.com';
  const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@thompsonchambersng.com';

  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const practiceArea = area || 'Not specified';

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#0a1628;padding:24px;border-radius:8px 8px 0 0;border-bottom:3px solid #c9a84c">
        <h1 style="color:#ffffff;font-size:20px;margin:0">New Website Enquiry</h1>
        <p style="color:#c9a84c;margin:4px 0 0;font-size:13px">Thompson Chambers · emekalaw@yahoo.com</p>
      </div>
      <div style="background:#f5f7fa;padding:24px;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px">Name</td><td style="padding:8px 0;font-weight:600;color:#1c1c2e">${escHtml(fullName)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Email</td><td style="padding:8px 0"><a href="mailto:${escHtml(email)}" style="color:#1e52a0">${escHtml(email)}</a></td></tr>
          ${phone ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Phone</td><td style="padding:8px 0"><a href="tel:${escHtml(phone)}" style="color:#1e52a0">${escHtml(phone)}</a></td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Practice Area</td><td style="padding:8px 0;color:#1c1c2e">${escHtml(practiceArea)}</td></tr>
        </table>
        <div style="margin-top:16px;padding:16px;background:#ffffff;border-radius:6px;border-left:3px solid #c9a84c">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280">Message</p>
          <p style="margin:0;color:#1c1c2e;line-height:1.6;font-size:14px">${escHtml(message).replace(/\n/g, '<br>')}</p>
        </div>
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e9f0">
          <a href="mailto:${escHtml(email)}" style="display:inline-block;background:#c9a84c;color:#0a1628;padding:10px 22px;border-radius:4px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.08em">Reply to ${escHtml(firstName)}</a>
          ${phone ? `<a href="https://wa.me/${phone.replace(/\D/g,'')}" style="display:inline-block;background:#25d366;color:#ffffff;padding:10px 22px;border-radius:4px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.08em;margin-left:8px">WhatsApp</a>` : ''}
        </div>
      </div>
      <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:16px">Sent from the Thompson Chambers website contact form</p>
    </div>
  `;

  const textBody = `New Website Enquiry — Thompson Chambers\n\nName: ${fullName}\nEmail: ${email}\n${phone ? `Phone: ${phone}\n` : ''}Practice Area: ${practiceArea}\n\nMessage:\n${message}\n\n---\nSent from thompsonchambersng.com`;

  // If Resend is configured, send the email
  if (RESEND_API_KEY) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `Thompson Chambers Website <${FROM_EMAIL}>`,
          to: [NOTIFY_EMAIL],
          reply_to: email,
          subject: `New Enquiry: ${practiceArea} — ${fullName}`,
          html: htmlBody,
          text: textBody,
        }),
      });

      const resendData = await resendRes.json();

      if (!resendRes.ok) {
        console.error('Resend error:', resendData);
        // Still return 200 to the client — the lead isn't lost, just log it
        console.log('ENQUIRY_FALLBACK:', JSON.stringify({ fullName, email, phone, practiceArea, message }));
        return res.status(200).json({ ok: true, note: 'Email queued' });
      }

      return res.status(200).json({ ok: true, id: resendData.id });
    } catch (err) {
      console.error('Enquiry handler error:', err);
      console.log('ENQUIRY_FALLBACK:', JSON.stringify({ fullName, email, phone, practiceArea, message }));
      return res.status(200).json({ ok: true, note: 'Logged' });
    }
  }

  // No Resend key — just log to Vercel function logs and return success
  // You can pipe these to a database or webhook instead
  console.log('ENQUIRY:', JSON.stringify({ fullName, email, phone, practiceArea, message, ts: new Date().toISOString() }));
  return res.status(200).json({ ok: true });
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
