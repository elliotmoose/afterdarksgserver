const Generator = require('../dist/MySQLModelGenerator');
const CONFIG = require('../dbconfig');
const generator = new Generator(CONFIG);
generator.generate('./model');