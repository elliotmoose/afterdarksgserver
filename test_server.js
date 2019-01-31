var express = require('express');
var app = express();

app.use('/', (req, res) => {
	res.end('test');
});

app.listen(80, () => {
	console.log('started');
});
