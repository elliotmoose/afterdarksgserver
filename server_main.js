const express = require('express');
const path = require('path');
const app = express();
const api = require('./api');
const config = require('./config');
var https = require('https');

app.use('/api',api);
app.use(express.static(path.join(__dirname, "public")));
app.use('/scripts', express.static(__dirname + '/node_modules'));

// app.listen(80);

const domain = 'afterdarksg.com';
//Create server over HTTPS

// https.createServer(options, app)
//   .listen(80, function () {
//     console.log('Example app listening on port 80! Go to https://localhost/')
//   })

// //Redirect HTTP connections to HTTPS server
// http.createServer(function (req, res) {
//     res.writeHead(301, {
//         "Location": "https://" + req.headers['host'] + req.url
//     });
//     res.end();
// }).listen(config.port);

//Start the server over HTTPS
// var server = https.createServer(options, app).listen(config.SSLPORT, function () {
//     var host = server.address().address;
//     var port = server.address().port;
//     console.log("%s host listening on port %s", host, port);
// });

console.log(config)
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
        res.writeHead(301, {
            'Location': 'https://' + req.headers['host'] + req.url
        });
        res.end();
    }).listen(config.port);

    //Start the server over HTTPS
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