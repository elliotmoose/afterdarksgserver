const configs = {
    https : true,
    port: 80,
    SSLPORT: 443,
    domain: 'afterdarksg.com'
}

configs.SSL_PK_PATH = `/etc/letsencrypt/live/${configs.domain}/privkey.pem`;
configs.SSL_CERT_PATH = `/etc/letsencrypt/live/${configs.domain}/cert.pem`;

module.exports.configs = configs
