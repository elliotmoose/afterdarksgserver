var mysql = require('mysql');


function Connect()
{
    var con = mysql.createConnection({
        host: "localhost",
        user: "mooselliot",
        password: "S9728155f"
      });
      
      con.connect(function(err) {
        if (err) throw err;
        console.log("Connected!");
      });
}

function Select()
{

}