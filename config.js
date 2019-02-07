const configs = {
    localdebug : false,
    https : true,
    live : false,
    https : false,
    port: 80,
    SSLPORT: 443,
    domain: 'afterdarksg.com'
}

configs.SSL_PK_PATH = `/etc/letsencrypt/live/${configs.domain}/privkey.pem`;
configs.SSL_CERT_PATH = `/etc/letsencrypt/live/${configs.domain}/fullchain.pem`;

if(configs.live)
{
    configs.https = true;
}

module.exports = configs;
