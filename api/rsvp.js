// Vercel serverless function: POST /api/rsvp
// Validates the RSVP, forwards it to the Google Sheet's Apps Script web app,
// and only reports success once the Sheet has confirmed the row was saved.
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   RSVP_SCRIPT_URL  – the Apps Script web-app URL ending in /exec
//   RSVP_SECRET      – must match SECRET in google-apps-script/Code.gs

const MENU = {
  starter: ['Caprese Salad', 'Togarashi Tuna', 'Short Rib & Bone Marrow'],
  main: ['Lamb Shank', 'Beef Fillet', 'Exotic Mushroom Risotto'],
  dessert: ['Cheesecake', 'Chocolate Marquise'],
};

const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

function validate(body) {
  const guest = clean(body.guest, 100);
  if (!guest) return { error: 'Please enter the guest’s full name.' };
  if (body.attendance !== 'yes' && body.attendance !== 'no') {
    return { error: 'Please let us know whether you’ll be joining us.' };
  }
  const rsvp = { guest, attendance: body.attendance };
  if (body.attendance === 'yes') {
    for (const course of ['starter', 'main', 'dessert']) {
      if (!MENU[course].includes(body[course])) {
        return { error: `Please choose a ${course}.` };
      }
      rsvp[course] = body[course];
    }
    rsvp.dietary = clean(body.dietary, 500);
    rsvp.song = clean(body.song, 200);
  }
  return { rsvp };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Hidden honeypot field: real guests never fill it in, spam bots do.
  if (body.website) return res.status(200).json({ ok: true });

  const { rsvp, error } = validate(body);
  if (error) return res.status(400).json({ ok: false, error });

  const url = process.env.RSVP_SCRIPT_URL;
  const secret = process.env.RSVP_SECRET;
  if (!url || !secret) {
    console.error('RSVP_SCRIPT_URL or RSVP_SECRET is not set');
    return res.status(500).json({ ok: false, error: 'RSVPs aren’t switched on yet. Please try again later.' });
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...rsvp, secret }),
      redirect: 'follow',
    });
    const text = await r.text();
    let result;
    try { result = JSON.parse(text); } catch { result = null; }
    if (!result || !result.ok) {
      console.error('Sheet did not confirm save', r.status, text.slice(0, 300));
      return res.status(502).json({ ok: false, error: 'We couldn’t save your RSVP just now. Please try again in a moment.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Sheet request failed', err);
    return res.status(502).json({ ok: false, error: 'We couldn’t save your RSVP just now. Please try again in a moment.' });
  }
};
