var mysql = require('mysql');

var con;

module.exports.Connect = function() {
  con = mysql.createConnection({
    host: "localhost",
    user: "mooselliot",
    password: "S9728155f",
    database: "afterdarksg"
  });

  con.connect(function (err) {
    if (err) throw err;
    console.log("Connected to database");
  });
  return con;
}


module.exports.Select = function()
{

}

module.exports.Insert = function()
{
  
}


module.exports.Query = function(query) {
  return new Promise(function (resolve, reject) {
    con.query(query, function (err, result, fields) {
      if (err) {
        reject(err);
      }
      resolve(result);
    });
  });
}