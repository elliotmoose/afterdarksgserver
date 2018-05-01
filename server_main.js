const express = require('express')
const bodyParse = require('body-parser')
const path = require('path')
const app = express()
const mysql = require('mysql');
const fs = require('fs');

var con = ConnectDatabase();



//#region express
app.use((request, response, next) => {
  //console.log(request.headers)
  next()
})

app.use(bodyParse.json())
app.use(bodyParse.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, "public")))
app.use('/scripts', express.static(__dirname + '/node_modules'));
//#endregion



// Handles request to root only.
app.get('/', (req, res) => {
  res.status(200);
  res.type('text/html');
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

//#region Get Generic Data 
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

app.get('/GetImageForBar/:id', (req, res) => {
  var id = req.params.id;

  if (id == undefined) {
    Output(false, "No bar id specified", res);
  }

  var imagePath = path.resolve(__dirname, "bar_images/" + id + "/0.jpg");

  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  }
  else {
    Output(false, `image does not exist for this id ${id}`, res);
  }
});

//#endregion
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

app.get('/AddDiscountToWalletForUser', (req, res) => {
  // var id = req.body.id;
  // var discount_id = req.body.discount_id;
  var user_id = parseInt(req.query.user_id);
  var discount_id = parseInt(req.query.discount_id);

  if (user_id == undefined || discount_id == undefined) {
    Output(false, "No id specified", res);
    return;
  }
  else {
    var queryWallet = `SELECT wallet FROM users WHERE id='${user_id}'`;
    QueryDB(queryWallet).then(function (data) {

      let wallet = JSON.parse(data[0].wallet);

      //check if wallet exists
      if (wallet == undefined) { Output(false, `Wallet does not exist with user id: ${user_id}`, res); }

        wallet = JSON.stringify(wallet.push(discount_id));

        var updateWalletString = `UPDATE users SET wallet='${wallet}' WHERE id='${user_id}'`;
        QueryDB(updateWalletString).then(function (data) { //update wallet
          var getNewWalletString = `SELECT wallet FROM users WHERE id='${user_id}'`;
          QueryDB(getNewWalletString).then(function(data){ //get new wallet to return
            let wallet = JSON.parse(data[0].wallet);
            Output(true, wallet, res);
          });
        }).catch(function (err) {
          Output(false, err, res);
        });
    });
  }
});

app.get('/AddDiscountToWalletForUser', (req, res) => {
  // var id = req.body.id;
  // var discount_id = req.body.discount_id;
  var user_id = parseInt(req.query.user_id);
  var discount_id = parseInt(req.query.discount_id);

  if (user_id == undefined || discount_id == undefined) {
    Output(false, "No id specified", res);
    return;
  }
  else {
    var queryWallet = `SELECT wallet FROM users WHERE id='${user_id}'`;
    QueryDB(queryWallet).then(function (data) {

      let wallet = JSON.parse(data[0].wallet);

      //check if wallet exists
      if (wallet == undefined) { Output(false, `Wallet does not exist with user id: ${user_id}`, res); }

      //check if the discount exists
      if (wallet.indexOf(discount_id) > -1) {

        wallet = JSON.stringify(wallet.filter(discount => discount != discount_id));

        var updateWalletString = `UPDATE users SET wallet='${wallet}' WHERE id='${user_id}'`;
        QueryDB(updateWalletString).then(function (data) { //update wallet
          var getNewWalletString = `SELECT wallet FROM users WHERE id='${user_id}'`;
          QueryDB(getNewWalletString).then(function(data){ //get new wallet to return
            let wallet = JSON.parse(data[0].wallet);
            Output(true, wallet, res);
          });
        }).catch(function (err) {
          Output(false, err, res);
        });

      } else {
        Output(false, "Couldnt find discount with ID:" + JSON.stringify(discount_id), res);
        return
      }

    });
  }
});

app.post('/AddDiscountClaim', (req, res) => {
  var user_id = req.body.user_id;
  var discount_id = req.body.discount_id;

  if (user_id == undefined || discount_id == undefined) {
    Output(false, "No id specified", res);
    return;
  }
  else {
    var epoch = Math.round(new Date().getTime() / 1000);
    var queryString = `INSERT INTO discount_claims (id,discount_id,user_id,date) values (0,${discount_id},${user_id},${epoch})`;

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
    }).then(function () {
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

  con.connect(function (err) {
    if (err) throw err;
    console.log("Connected to database");
  });
  // con.connect(function (err) {

  //   if (err) {
  //     Output(false, err, res);
  //     return;
  //   }
  // });
  return con;
}

// function Query(query, res) {

//     con.query(query, function (err, result, fields) {

//       if (err) {
//         Output(false, err, res);
//         return;
//       }

//       Output(true, result, res);
//       return;
//     });

// }

function QueryDB(query) {
  return new Promise(function (resolve, reject) {

    con.query(query, function (err, result, fields) {
      if (err) {
        reject(err);
      }
      resolve(result);
    });
  });
}


function Output(success, output, res) {
  var response = { success: String(success), output: output };
  res.status(200);
  res.send(response);
}