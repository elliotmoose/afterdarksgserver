const configs = {
    https : false,
    live : false,
    remote : false,
    port: 80,
    SSLPORT: 443,
    domain: 'afterdarksg.com'
}

configs.SSL_PK_PATH = `/etc/letsencrypt/live/${configs.domain}/privkey.pem`;
configs.SSL_CERT_PATH = `/etc/letsencrypt/live/${configs.domain}/fullchain.pem`;


if(configs.remote)
{
    configs.https = true;
}

module.exports = configs;
