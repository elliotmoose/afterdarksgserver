const MySQLDriver = require('mysqldriver');
const config = require('../config');

var DB;
module.exports.ConnectWithDriver = function(){     
    const dbconfig = {
        host: "localhost",
        user: config.remote ? "afterdarksg" : "mooselliot",
        password: config.remote ? "Rahultheman97" : "S9728155f",
        database: config.remote ? "afterdarksg" : "afterdarksg_test",
        port: 3306
    }

    DB = new MySQLDriver(dbconfig);
    console.log('connected to database')
    return DB    
}