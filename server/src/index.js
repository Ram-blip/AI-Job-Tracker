const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { PORT, CLIENT_URL } = require('./env');
const { connectMongo } = require('./db/mongoose');

const authRouter = require('./routes/auth');
const gmailRouter = require('./routes/gmail');
const applicationsRouter = require('./routes/applications');

async function start() {
  await connectMongo();

  const app = express();
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(cors({ origin: CLIENT_URL, credentials: true }));

  app.get('/health', (_, res) => res.json({ ok: true }));

  app.use('/auth', authRouter);
  app.use('/gmail', gmailRouter);
  app.use('/applications', applicationsRouter);

  app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
  const { GOOGLE_CLIENT_ID } = require('./env');
  // console.log('[debug] GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID);
}
start().catch(err => { console.error('Failed to start server', err); process.exit(1); });
