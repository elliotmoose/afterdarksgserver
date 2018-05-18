const express = require('express')
const bodyParse = require('body-parser')
const path = require('path')
const app = express()
const mysql = require('mysql');
const fs = require('fs');
const EXPIRY_PERIOD = 3600*24*2; //24 hours

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

app.post('/AddDiscountToWalletForUser', (req, res) => {

  var user_id = parseInt(req.body.user_id);
  var discount_id = parseInt(req.body.discount_id);

  if (user_id == undefined || discount_id == undefined) {
    Output(false, "No id specified", res);
    return;
  }
  else {
    var queryWallet = `SELECT wallet FROM users WHERE id='${user_id}'`;
    QueryDB(queryWallet).then(function (data) {

      if(data == [])
      {
        Output(false,"Hmm.. There seems to be an error,res");
        return;
      }


      let wallet = JSON.parse(data[0].wallet);

      //check if wallet exists
      if (wallet == undefined) { Output(false, `Wallet does not exist with user id: ${user_id}`, res); return; }

      //check if discount already added
      var isDiscountPresent = false;
      wallet.forEach(discount => {
        if (discount.id == discount_id) {
          isDiscountPresent = true;
        }
      });

      if(isDiscountPresent)
      {
        Output(false, "Discount already in wallet", res);
        return;
      }

      //check if wallet is full
      if (wallet.length == 4) {
        Output(false, "Your wallet is full!", res);
        return;
      }

      //check if discount has run out
      var discountQueryString = `SELECT curAvailCount FROM discounts WHERE id=${discount_id}`;
      QueryDB(discountQueryString).then(function (data) {

        var curAvailCount = data[0].curAvailCount;

        if (curAvailCount == 0) {
          Output(false, "Discount fully claimed", res);
          return;
        }

        var expiry = Math.round(new Date().getTime() / 1000) + EXPIRY_PERIOD ;
        var newDiscount = {
          id: discount_id,
          expiry: expiry
        };

        wallet.push(newDiscount);
        wallet = JSON.stringify(wallet);

        var updateWalletString = `UPDATE users SET wallet='${wallet}' WHERE id='${user_id}'`;
        QueryDB(updateWalletString).then(function (data) { //update wallet
          var reduceDiscountCounterString = `UPDATE discounts SET curAvailCount=${curAvailCount - 1} WHERE id='${discount_id}'`;
          QueryDB(reduceDiscountCounterString).then(function (data) { //set new counter
            var getNewWalletString = `SELECT wallet FROM users WHERE id='${user_id}'`;
            QueryDB(getNewWalletString).then(function (data) { //get new wallet to return
              let wallet = JSON.parse(data[0].wallet);
              Output(true, wallet, res);
              return;
            });
          });
        }).catch(function (err) {
          Output(false, err, res);
          return;
        });
      });
    });
  }
});

app.post('/AddDiscountClaim', (req, res) => {
  // var id = req.body.id;
  // var discount_id = req.body.discount_id;
  var user_id = parseInt(req.body.user_id);
  var discount_id = parseInt(req.body.discount_id);

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

      var hasDiscount = false;
      //check if the discount exists
      wallet.forEach(discountObject => {
        if (discountObject.id == discount_id) {
          hasDiscount = true;

          wallet = JSON.stringify(wallet.filter(discount => discount.id != discount_id));
          var epoch = Math.round(new Date().getTime() / 1000);

          var discountClaimString = `INSERT INTO discount_claims (id,discount_id,user_id,date) values (0,${discount_id},${user_id},${epoch})`;
          QueryDB(discountClaimString).then(function (data) { //add discount claim
            var updateWalletString = `UPDATE users SET wallet='${wallet}' WHERE id=${user_id}`;
            QueryDB(updateWalletString).then(function (data) { //update wallet            
              var getNewWalletString = `SELECT wallet FROM users WHERE id='${user_id}'`;
              QueryDB(getNewWalletString).then(function (data) { //get new wallet to return
                let wallet = JSON.parse(data[0].wallet);
                Output(true, wallet, res);
                return;
              });
            }).catch(function (err) {
              Output(false, err, res);
              return;
            });

          }).catch(function (err) {
            Output(false, err, res);
            return;
          });
        }
      });

      if (hasDiscount == false) {
        Output(false, "User does not have this discount", res);
        return;
      }
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
    //check whether any of the discounts have expired 
    //if expired, remove

    var walletOutput;
    QueryDB("SELECT wallet FROM users WHERE id='" + id + "'").then(function (walletData) {
      walletOutput = JSON.parse(walletData[0].wallet);
      
      var wallet = walletOutput.filter(CheckDiscountHasExpired);

      // wallet.forEach(discount => {
      //   console.log(epoch-discount.dateBegin>(60*60*24*3));
      // })
      // console.log("wallet:" + wallet);

      var query = `UPDATE users SET wallet='${JSON.stringify(wallet)}' WHERE id=${id}`;
      QueryDB(query).then(function (data) {        
        Output(true, wallet, res);
        return;
      });
    }).catch(function (err) {
      
      Output(false, err, res);
    });
  }
});



function CheckDiscountHasExpired(discount)
{
  var epoch = Math.round(new Date().getTime() / 1000);
  return (epoch-discount.expiry) < 3600*24*2;
}


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

  // if(success == false)
  // {
  //   console.log(JSON.stringify(output));
  // }
}