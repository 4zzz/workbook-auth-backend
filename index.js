const http = require('http');
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
    origin: envOrDef('FRONTEND_ORIGIN'),
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
  res.setHeader('Access-Control-Allow-Origin', config.frontend.origin);
  if (!code) {
    console.log(`${getLogPrefix(req)}: Invalid request. (Missing code parameter)`);
    res.sendStatus(418);
  } else {
    try {
      const accessToken = await getAccessToken(code);
      res.send(JSON.stringify({accessToken}));
      console.log(`${getLogPrefix(req)}: Authentication successful.`);
    } catch(e) {
      const cause = e.cause ? ` (${e.cause})` : '';
      console.log(`${getLogPrefix(req)}: Authentication failed. ${e.message}.${cause}`)
      res.send(JSON.stringify({error: 'Authentication failed'}));
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
