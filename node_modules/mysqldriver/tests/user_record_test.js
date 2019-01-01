const MySQLDriver = require('./../dist/MySQLDriver');
const CONFIG = require("../dbconfig");
var DB = new MySQLDriver(CONFIG);

async function main() {
    var id = DB.generateId();
    const user = await DB.insertRecord('user', {id, idnumber:id, displayname: '', username: 'conrad'});
    const record = await DB.getRecord('user', {username: 'conrad'});
    console.log(record);
    await DB.deleteRecords('user', {id: id});
    var id = await DB.generateId();
    console.log(id);
    await DB.closeConnection();
}
main().then(
        data => console.log(data)
    )
    .catch(
        err => console.error(err)
    )