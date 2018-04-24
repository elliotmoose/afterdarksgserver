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
app.use(bodyParse.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, "public")))
app.use('/scripts', express.static(__dirname + '/node_modules'));


// Handles request to root only.
app.get('/', (req, res) => {
  res.status(200);
  res.type('text/html');
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

//query functions
app.get('/GetBarNames', (req, res) => {
  QueryDB("SELECT * FROM bars_info").then(function (data) {
    Output(true, data, res);
  }).catch(function (err) {
    Output(false, err, res);
  });
});

app.get('/GetDiscounts', (req, res) => {
  QueryDB("SELECT * FROM discounts").then(function (data) {
    Output(true, data, res);
  }).catch(function (err) {
    Output(false, err, res);
  });
});

//action functions
app.post('/GenerateUser', (req, res) => {
  var id = req.body.uuid;
  if (id == undefined) {
    Output(false, "No uuid specified", res);
    return;
  }
  else {
    var dateBegin = Math.round(new Date().getTime() / 1000);
    var queryString = "INSERT INTO users (id,uuid,username,password,personalized,wallet,date_begin) VALUES (0,'" + id + "','','',0,'[]'," + dateBegin + ")";

    QueryDB(queryString).then(function (data) {
      Output(true, data, res);
    }).catch(function (err) {
      Output(false, err, res);
    });
  }
});

app.post('/RetrieveUser', (req, res) => {
  var id = req.body.uuid;
  if (id == undefined) {
    Output(false, "No uuid specified", res);
    return;
  }
  else {
    var queryString = "SELECT * FROM users WHERE uuid='" + id + "'";
    Query(queryString, res);
  }
});

app.post('/AddDiscountToWalletForUser', (req, res) => {
  var id = req.body.id;
  var discount_id = req.body.discount_id;
  if (id == undefined || discount_id == undefined) {
    Output(false, "No id specified", res);
    return;
  }
  else {
    var queryString = "UPDATE * FROM users WHERE id='" + id + "'";
    QueryDB(queryString).then(function (data) {
      Output(true, data, res);
    }).catch(function (err) {
      Output(false, err, res);
    });
  }
});

app.post('/GetWalletForUser', (req, res) => {
  var id = req.body.id;
  if (id == undefined) {
    Output(false, "No id specified", res);
    return;
  }
  else {
    var walletOutput;
    QueryDB("SELECT wallet FROM users WHERE id='" + id + "'").then(function (walletData) {
      walletOutput = JSON.parse(walletData[0].wallet);      
    }).then(function(){
      Output(true, walletOutput, res);
      return;
    }).catch(function (err) {
      Output(false, err, res);
    });
  }
});

app.listen(8080)


function ConnectDatabase() {
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

function Query(query, res) {
  var con = ConnectDatabase()
  con.connect(function (err) {

    if (err) {
      Output(false, err, res);
      return;
    }

    con.query(query, function (err, result, fields) {

      if (err) {
        Output(false, err, res);
        return;
      }

      Output(true, result, res);
      return;
    });
  });
}

function QueryDB(query) {
  return new Promise(function (resolve, reject) {
    var con = ConnectDatabase()
    con.connect(function (err) {
      if (err) {
        reject(err);
      }
      con.query(query, function (err, result, fields) {
        if (err) {
          reject(err);
        }
        resolve(result);
      });
    });
  });
}


function Output(success, output, res) {
  var response = { success: String(success), output: output };
  res.status(200);
  res.send(response);
}