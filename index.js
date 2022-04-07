const fs = require('fs');
const http = require('http');
const https = require('https');
const axios = require('axios');
const express = require('express');
const config = require('./config.json');

const app = express();
const basePath = config.basePath.endsWith('/') ? config.basePath.slice(0, -1) : config.basePath;

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

app.get(`${basePath}/get_access_token`, async (req, res) => {
  const { code, redirect } = req.query;
  if (!code) {
    console.log(`${getLogPrefix(req)}: Invalid request. (Missing code parameter)`);
    res.sendStatus(418);
  } else {
    try {
      const token = await getAccessToken(code);
      res.cookie('github_access_token', token);
      res.redirect(`${config.frontend.hostname}${redirect ? redirect : ''}`);
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

if (config.useHttp) {
  const { port } = config.http;
  const httpServer = http.createServer(app);
  httpServer.listen(port, () => {
    console.log(`Auth http server listening on port ${port}`)
  });
}

if (config.useHttps) {
  try {
    var privateKey  = fs.readFileSync(config.https.key, 'utf8');
    var certificate = fs.readFileSync(config.https.cert, 'utf8');
    var credentials = {key: privateKey, cert: certificate};
  } catch (e) {
    console.error('Failed to load private key file or certificate file');
    console.error(e);
    process.exit(1);
  }
  if (credentials) {
    const { port } = config.https;
    var httpsServer = https.createServer(credentials, app);
    httpsServer.listen(port, () => {
      console.log(`Auth https server listening on port ${port}`)
    });
  }
}
