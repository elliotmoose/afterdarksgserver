const express = require('express');
const path = require('path');
const app = express();
const api_v1 = require('./api_v1');
const config = require('./config');
const https = require('https');
const http = require('http');

app.use('/api/v1',api_v1);
app.use(express.static(path.join(__dirname, "public")));
app.use('/scripts', express.static(__dirname + '/node_modules'));

// app.listen(80);

if (config.https) {
    //Create server over HTTPS
    var fs = require('fs');
    var privateKey = fs.readFileSync(config.SSL_PK_PATH);
    var certificate = fs.readFileSync(config.SSL_CERT_PATH);
    var options = {
        key: privateKey,
        cert: certificate
    };

    //Redirect HTTP connections to HTTPS server
    http.createServer(function (req, res) {
        console.log(req.headers['host'])
        console.log(req.url)
        res.writeHead(301, {
            'Location': 'https://' + req.headers['host'] + req.url
        });
        res.end();
    }).listen(config.port);

    //Start the server over HTTPS
    console.log(`PORT: ${config.SSLPORT}`);
    console.log(options);
    var server = https.createServer(options, app).listen(config.SSLPORT, function () {
        var host = server.address().address;
        var port = server.address().port;
        console.log('https %s host listening on port %s', host, port);
    });
} else {

    //Start the server over HTTP
    var http_server = app.listen(config.port, function () {
        var host = http_server.address().address;
        var port = http_server.address().port;
        console.log('http %s host listening on port %s', host, port);
    });
}