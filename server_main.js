const express = require('express');
const path = require('path');
const app = express();
const api = require('./api');

app.use('/api',api);
app.use(express.static(path.join(__dirname, "public")));
app.use('/scripts', express.static(__dirname + '/node_modules'));

app.listen(8080);