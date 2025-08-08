const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = require('../env');
const User = require('../db/models/User');

async function makeAuthedGmailClient(userId) {
  const user = await User.findById(userId);
  if (!user || !user.refreshToken) throw new Error('No refresh token');

  const oAuth2 = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  oAuth2.setCredentials({
    refresh_token: user.refreshToken,
    access_token: user.accessToken || undefined,
  });

  oAuth2.on('tokens', async (tokens) => {
    if (tokens.access_token || tokens.expiry_date) {
      user.accessToken = tokens.access_token || user.accessToken;
      user.tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : user.tokenExpiry;
      await user.save();
    }
  });

  return google.gmail({ version: 'v1', auth: oAuth2 });
}

module.exports = { makeAuthedGmailClient };
