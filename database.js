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

module.exports.PreparedQuery = function(query,values){
    return new Promise(function (resolve, reject) {
      con.query(query,values, function (err, result, fields) {
        if (err) {
          reject(err);
        }
        resolve(result);
      });
    });
  }

module.exports.ParseObjectToKeyValues = function(obj)
{
    var keyString = '('
    var valueString = '('
    for(let key in obj)
    {
        if(obj[key] === undefined || obj[key] === null)
        {
            continue
        }
        else
        {
            keyString += `${key},`
            valueString += `${obj[key]},`
        }
    }

    keyString = keyString.replace(/.$/,")")
    valueString = valueString.replace(/.$/,")")

    return {key : keyString, value : valueString}
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