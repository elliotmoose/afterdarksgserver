const express = require('express')
const bodyParse = require('body-parser')
const path = require('path')
const app = express()
const mysql = require('mysql');




app.use((request, response, next) => {
  //console.log(request.headers)
  next()
})

app.use(bodyParse.json())
app.use(bodyParse.urlencoded({extended:false}))
app.use(express.static(path.join(__dirname,"public")))
app.use('/scripts', express.static(__dirname + '/node_modules'));


// Handles request to root only.
app.get('/', (req, res) => {

    // If you needed to modify the status code and content type, you would do so
    // using the Express API, like so. However, this isn't necessary here; Express
    // handles this automatically.
    res.status(200);
    res.type('text/html');
  
    // Use sendFile(absPath) rather than sendfile(path), which is deprecated.
    res.sendFile(path.resolve(__dirname, 'index.html'));
  });

  app.get('/GetBarNames', (req, res) => {

    var con = ConnectDatabase()

    con.connect(function(err) {
        if (err) throw err;
        con.query("SELECT * FROM bars_info", function (err, result, fields) {
          if (err) throw err;
          res.status(200);
          res.json(result)
        });
      });
  });
  app.get('/GetDiscounts', (req, res) => {

    var con = ConnectDatabase()

    con.connect(function(err) {
        if (err) throw err;
        con.query("SELECT * FROM discounts", function (err, result, fields) {
          if (err) throw err;
          res.status(200);
          res.json(result)
        });
      });      
  });

app.listen(8080)


function ConnectDatabase()
{
    var con = mysql.createConnection({
        host: "localhost",
        user: "mooselliot",
        password: "S9728155f",
        database: "afterdarksg"
      });
      
    //   con.connect(function(err) {
    //     if (err) throw err;
    //     console.log("Connected!");
    //   });
      
      return con;
}