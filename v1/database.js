const MySQLDriver = require('mysqldriver');
const config = require('../config');

var DB;
module.exports.ConnectWithDriver = function(){     
    const dbconfig = {
        host: "localhost",
        user: config.live ? "afterdarksg" : "mooselliot",
        password: config.live ? "Rahultheman97" : "S9728155f",
        database: config.live ? "afterdarksg" : "afterdarksg_test",
        port: 3306
    }

    DB = new MySQLDriver(dbconfig);
    console.log('connected to database')
    return DB    
}