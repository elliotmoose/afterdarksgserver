const configs = {
    localdebug : true,
    https : true,
    port: 80,
    SSLPORT: 443,
    domain: 'afterdarksg.com'
}

configs.SSL_PK_PATH = `/etc/letsencrypt/live/${configs.domain}/privkey.pem`;
configs.SSL_CERT_PATH = `/etc/letsencrypt/live/${configs.domain}/fullchain.pem`;


if(configs.localdebug)
{
    configs.https = false;
}

module.exports = configs