const fs = require('fs');
const http = require('http');
const https = require('https');
const axios = require('axios');
const express = require('express');

const app = express();

function envOrDef(env, def) {
  if (process.env[env]) return process.env[env];
  if (def !== undefined) return def;
  console.error(`Missing ${env} environment variable`);
  process.exit(1)
}

config = {
  http: {
    port: envOrDef('HTTP_PORT'),
  },
  basePath: envOrDef('BASE_PATH', ''),
  githubApi: {
    clientId: envOrDef('CLIENT_ID'),
    clientSecret: envOrDef('CLIENT_SECRET'),
  },
  frontend: {
    domain: envOrDef('FRONTEND_DOMAIN'),
    origin: envOrDef('FRONTEND_ORIGIN'),
    failRedirect: envOrDef('FRONTEND_FAIL_REDIRECT')
  },
}

async function getAccessToken(code) {
  const { clientId, clientSecret } = config.githubApi;
  const options = {
    headers: {
      'Accept': 'application/json'
    }
  }
  const res = await axios.post('https://github.com/login/oauth/access_token', {
    client_id: clientId,
    client_secret: clientSecret,
    code
  }, options);

  if (res.status === 200 && res.data.access_token) {
    return res.data.access_token;
  }

  throw Error('Failed to get access token', {cause: `Github responded with: ${JSON.stringify({status: res.status, data: res.data})}`});
}

function getLogPrefix(req) {
  return `${req.ip} ${req.method} ${req.path} ${JSON.stringify(req.query)}`;
}

app.get(`${config.basePath}/get_access_token`, async (req, res) => {
  const { code, redirect } = req.query;
  if (!code) {
    console.log(`${getLogPrefix(req)}: Invalid request. (Missing code parameter)`);
    res.sendStatus(418);
  } else {
    try {
      const token = await getAccessToken(code);
      res.cookie('github_access_token', token, {domain: config.frontend.domain, path: '/workbook', sameSite: 'None'});
      res.redirect(`${config.frontend.origin}${redirect ? redirect : ''}`);
      console.log(`${getLogPrefix(req)}: Authorization successful.`);
    } catch(e) {
      const cause = e.cause ? ` (${e.cause})` : '';
      console.log(`${getLogPrefix(req)}: Authorization failed. ${e.message}.${cause}`)
      res.redirect(config.frontend.failRedirect);
    }
  }
})

app.get('*', (req, res) => {
  console.log(`${getLogPrefix(req)}: Invalid request. (Unknown path)`)
  res.sendStatus(418);
});

const httpServer = http.createServer(app);
httpServer.listen(config.http.port, () => {
  console.log(`Auth http server listening on port ${config.http.port}`)
});
