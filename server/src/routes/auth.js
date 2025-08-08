const express = require('express');
const jwt = require('jsonwebtoken');
const { oauth2Client, GOOGLE_SCOPES } = require('../auth/google');
const { JWT_SECRET, CLIENT_URL } = require('../env');
const User = require('../db/models/User');

const router = express.Router();

router.get('/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES
  });
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  const code = req.query.code;
  const { tokens } = await oauth2Client.getToken(code);
  const idToken = tokens.id_token;
  const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
  const googleId = payload.sub;
  const email = payload.email;
  const name = payload.name;
  const picture = payload.picture;

  let user = await User.findOne({ googleId });
  if (user) {
    user.email = email; user.name = name; user.picture = picture;
    if (tokens.access_token) user.accessToken = tokens.access_token;
    if (tokens.refresh_token) user.refreshToken = tokens.refresh_token;
    if (tokens.expiry_date)  user.tokenExpiry = new Date(tokens.expiry_date);
    await user.save();
  } else {
    user = await User.create({
      googleId, email, name, picture,
      accessToken: tokens.access_token || null,
      refreshToken: tokens.refresh_token || null,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null
    });
  }

  const jwtToken = jwt.sign({ userId: String(user._id) }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('jid', jwtToken, { httpOnly: true, sameSite: 'lax' });
  res.redirect(`${CLIENT_URL}/dashboard`);
});

router.post('/logout', (req, res) => { res.clearCookie('jid'); res.json({ ok: true }); });

router.get('/me', async (req, res) => {
  const token = req.cookies['jid'];
  if (!token) return res.json({ user: null });
  try {
    const { userId } = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(userId).lean();
    if (!user) return res.json({ user: null });
    const { _id, email, name, picture } = user;
    res.json({ user: { id: String(_id), email, name, picture } });
  } catch {
    res.json({ user: null });
  }
});

module.exports = router;
