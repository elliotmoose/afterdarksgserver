"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var MySQL = __importStar(require("mysql"));
var v4_1 = __importDefault(require("uuid/v4"));
var ALIAS_COLUMN_NAME = "COLUMN_NAME";
var ALIAS_DATA_TYPE = "DATA_TYPE";
var ALIAS_COLUMN_KEY = "COLUMN_KEY";
var ALIAS_CHARACTER_MAXIMUM_LENGTH = "CHARACTER_MAXIMUM_LENGTH";
var ALIAS_IS_NULLABLE = "IS_NULLABLE";
var ALIAS_COLUMN_DEFAULT = "COLUMN_DEFAULT";
var ALIAS_TABLE_NAME = 'TABLE_NAME';
var MySQLDriver = /** @class */ (function () {
    function MySQLDriver(config) {
        this.config = config;
        this.config.port = config.port || 3306;
        this.connection = this.createConnection();
    }
    /**
     * Create a new connection to the database
     */
    MySQLDriver.prototype.createConnection = function () {
        var _a = this.config, host = _a.host, user = _a.user, password = _a.password, database = _a.database, port = _a.port;
        return MySQL.createConnection({
            host: host,
            user: user,
            password: password,
            database: database,
            port: port
        });
    };
    MySQLDriver.prototype.generateId = function () {
        return v4_1.default();
    };
    /**
     * Insert records into the database
     * @param {string} table_name The name of the table to insert the records into
     * @param {object} record The record to be insert into the database
     * @return {object}
     */
    MySQLDriver.prototype.insertRecord = function (table_name, record) {
        return __awaiter(this, void 0, void 0, function () {
            var self, database, clean_record;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        database = self.config.database;
                        return [4 /*yield*/, self._prepareRecord(database, table_name, record)];
                    case 1:
                        clean_record = _a.sent();
                        return [4 /*yield*/, self._insertRecordRaw(table_name, clean_record)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get records from a table that match the where criteria
     * @param {string} table_name
     * @param {object} where The search criteria to do a match
     * @return {Array}
     */
    MySQLDriver.prototype.getRecords = function (table_name, where) {
        return __awaiter(this, void 0, void 0, function () {
            var self;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        return [4 /*yield*/, self._selectRecordRaw(table_name, where)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get record from a table that match the where criteria
     * @param {string} table_name
     * @param {object} where The search criteria to do a match
     * @return {*}
     */
    MySQLDriver.prototype.getRecord = function (table_name, where) {
        return __awaiter(this, void 0, void 0, function () {
            var self, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        return [4 /*yield*/, self._selectRecordRaw(table_name, where)];
                    case 1:
                        result = _a.sent();
                        if (result.length > 1) {
                            throw new Error("MySQLDriver.getRecord: More than one record found.");
                        }
                        if (result.length === 0) {
                            return [2 /*return*/, undefined];
                        }
                        return [2 /*return*/, result[0]];
                }
            });
        });
    };
    /**
     * Update records in a given table
     * @param {string} table_name
     * @param {object} properties The properties to be updated
     * @param {object} where THe criteria to search
     * @return {object}
     */
    MySQLDriver.prototype.updateRecords = function (table_name, properties, where) {
        return __awaiter(this, void 0, void 0, function () {
            var self, database, clean_properties;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        database = self.config.database;
                        return [4 /*yield*/, self._prepareRecord(database, table_name, properties)];
                    case 1:
                        clean_properties = _a.sent();
                        return [4 /*yield*/, self._updateRecordsRaw(table_name, clean_properties, where)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Delete records from a table that match there where criteria
     * @param {string} table_name
     * @param {object} where
     * @return {object}
     */
    MySQLDriver.prototype.deleteRecords = function (table_name, where) {
        return __awaiter(this, void 0, void 0, function () {
            var self;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        return [4 /*yield*/, self._deleteRecordRaw(table_name, where)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get a record via an sql query
     * @param {string} sql
     * @param {Array} values
     * @return {object}
     */
    MySQLDriver.prototype.getRecordSql = function (sql, values) {
        return __awaiter(this, void 0, void 0, function () {
            var self, records;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        return [4 /*yield*/, self.getRecordsSql(sql, values)];
                    case 1:
                        records = _a.sent();
                        if (records.length > 1) {
                            throw new Error("MySQLDriver.getRecordSql: More than one record found for value.");
                        }
                        if (records.length === 0) {
                            return [2 /*return*/, []];
                        }
                        return [2 /*return*/, records[0]];
                }
            });
        });
    };
    /**
     * Gets records from the database via a provided sql statement
     * @param {string} sql
     * @param {Array} values
     * @return {Array}
     */
    MySQLDriver.prototype.getRecordsSql = function (sql, values) {
        return __awaiter(this, void 0, void 0, function () {
            var self, records;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        return [4 /*yield*/, self.query(sql, values)];
                    case 1:
                        records = _a.sent();
                        return [2 /*return*/, records];
                }
            });
        });
    };
    /**
     * Gets all tables in the current database
     * @return {Array}
     */
    MySQLDriver.prototype.getTableNames = function () {
        return __awaiter(this, void 0, void 0, function () {
            var self, database, table_names;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        database = self.config.database;
                        return [4 /*yield*/, self._getTableNames(database)];
                    case 1:
                        table_names = _a.sent();
                        return [2 /*return*/, table_names];
                }
            });
        });
    };
    /**
     * Get the table information from the information schema
     * @param {string} table_name
     * @return {Array<ISQLTableColumn>}
     */
    MySQLDriver.prototype.getTableInfo = function (table_name) {
        return __awaiter(this, void 0, void 0, function () {
            var self, database, info;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        database = self.config.database;
                        return [4 /*yield*/, self._getTableInfo(database, table_name)];
                    case 1:
                        info = _a.sent();
                        return [2 /*return*/, info];
                }
            });
        });
    };
    /**
     * Get the field names for a given table
     * @param {string} table_name
     * @returns {Array}
     */
    MySQLDriver.prototype.getTableFieldNames = function (table_name) {
        return __awaiter(this, void 0, void 0, function () {
            var self, database, info;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        database = self.config.database;
                        return [4 /*yield*/, self._getTableInfo(database, table_name)];
                    case 1:
                        info = _a.sent();
                        return [2 /*return*/, info.map(function (field_info) { return field_info.COLUMN_NAME; })];
                }
            });
        });
    };
    /**
     * Query the database connection asynchronously
     * @param {*} query
     * @param {Array} values
     * @return {Array}
     */
    MySQLDriver.prototype.query = function (query, values) {
        if (values === void 0) { values = []; }
        return __awaiter(this, void 0, void 0, function () {
            var self;
            return __generator(this, function (_a) {
                self = this;
                this._checkValues(values);
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        self._query(query, values, function (err, rows) {
                            if (err) {
                                var error = new Error("MySQLDriver: query: SQL query error.");
                                var data = {
                                    err: err,
                                    query: query,
                                    values: values
                                };
                                error.data = data;
                                console.log(data);
                                reject(error);
                            }
                            else {
                                resolve(rows);
                            }
                        });
                    })];
            });
        });
    };
    /**
     * Gets the schema of the database as an array of table schema objects
     * @returns {Array<IJSObjectInfo>}>}
     */
    MySQLDriver.prototype.getJSSchema = function () {
        return __awaiter(this, void 0, void 0, function () {
            var self, tables, schema;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        return [4 /*yield*/, self.getTableNames()];
                    case 1:
                        tables = _a.sent();
                        schema = tables.map(function (table_name) { return __awaiter(_this, void 0, void 0, function () {
                            var table_schema;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, self.tableGetJSSchema(table_name)];
                                    case 1:
                                        table_schema = _a.sent();
                                        return [2 /*return*/, table_schema];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(schema)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     *
     * @param {string} table_name
     * @return {IJSObjectInfo}
     */
    MySQLDriver.prototype.tableGetJSSchema = function (table_name) {
        return __awaiter(this, void 0, void 0, function () {
            var self, columns, schema, fields;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        return [4 /*yield*/, self.getTableInfo(table_name)];
                    case 1:
                        columns = _a.sent();
                        schema = {
                            table_name: table_name,
                            fields: []
                        };
                        fields = [];
                        columns.map(function (column) {
                            var field = {
                                column_name: column[ALIAS_COLUMN_NAME],
                                data_type: column[ALIAS_DATA_TYPE],
                                key: column[ALIAS_COLUMN_KEY],
                                max_length: column[ALIAS_CHARACTER_MAXIMUM_LENGTH],
                                is_nullable: column[ALIAS_IS_NULLABLE],
                                default_value: column[ALIAS_COLUMN_DEFAULT]
                            };
                            fields.push(field);
                        });
                        schema.fields = fields;
                        return [2 /*return*/, schema];
                }
            });
        });
    };
    /**
     * Query the database
     * @param {*} query
     * @param {*} values
     * @param {*} callback
     */
    MySQLDriver.prototype._query = function (query, values, callback) {
        var self = this;
        //Check if connection is healthy
        if (self.connection.state === 'disconnected') {
            self.connection = self.createConnection();
        }
        //Make the request
        self.connection.query(query, values, function (err, rows) {
            rows = rows ? JSON.parse(JSON.stringify(rows)) : [];
            callback(err, rows);
        });
    };
    MySQLDriver.prototype.closeConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var self;
            return __generator(this, function (_a) {
                self = this;
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        self.connection.end(function (err) {
                            if (err) {
                                reject(err);
                            }
                            else {
                                resolve();
                            }
                        });
                    })];
            });
        });
    };
    //INTERNAL FUNCTIONS
    /**
     * Get the field
     * @param {string} database_name
     * @param {string} table_name
     * @returns {Array<ISQLTableColumn>}
     */
    MySQLDriver.prototype._getTableInfo = function (database_name, table_name) {
        return __awaiter(this, void 0, void 0, function () {
            var self, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        return [4 /*yield*/, self.query("SELECT \n            `COLUMN_NAME` as '" + ALIAS_COLUMN_NAME + "', \n            `DATA_TYPE` AS '" + ALIAS_DATA_TYPE + "', \n            `COLUMN_KEY` AS '" + ALIAS_COLUMN_KEY + "', \n            `CHARACTER_MAXIMUM_LENGTH` as '" + ALIAS_CHARACTER_MAXIMUM_LENGTH + "',\n            `IS_NULLABLE` as '" + ALIAS_IS_NULLABLE + "',\n            `COLUMN_DEFAULT` as '" + ALIAS_COLUMN_DEFAULT + "'\n            FROM INFORMATION_SCHEMA.COLUMNS\n            WHERE `TABLE_NAME` = ? AND `TABLE_SCHEMA` = ?", [table_name, database_name])];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Gets all table names in a given database
     * @param {*} database_name
     * @returns {Array}
     */
    MySQLDriver.prototype._getTableNames = function (database_name) {
        return __awaiter(this, void 0, void 0, function () {
            var self, tables, table_names;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        return [4 /*yield*/, self.query("SELECT TABLE_NAME \n            FROM INFORMATION_SCHEMA.TABLES WHERE `TABLE_SCHEMA` = ?", [database_name])];
                    case 1:
                        tables = _a.sent();
                        table_names = tables.map(function (table) { return table[ALIAS_TABLE_NAME]; });
                        return [2 /*return*/, table_names];
                }
            });
        });
    };
    /**
     * Checks the record against the database schema and removes any irrelevant fields for insertion
     * @param {*} database_name
     * @param {*} table_name
     * @param {*} record_raw
     */
    MySQLDriver.prototype._prepareRecord = function (database_name, table_name, record_raw) {
        return __awaiter(this, void 0, void 0, function () {
            var self, error, prepared_record, table_info;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        if (!(typeof table_name === 'string')) {
                            error = new Error("MySQLDriver in function _prepareRecord: Provided table name is not a string.");
                            error.table_name = table_name;
                            error.record_raw = record_raw;
                            throw error;
                        }
                        prepared_record = {};
                        return [4 /*yield*/, self._getTableInfo(database_name, table_name)];
                    case 1:
                        table_info = _a.sent();
                        table_info.map(function (field) {
                            var key = field[ALIAS_COLUMN_NAME];
                            if (key in record_raw && (record_raw[key] !== undefined)) { //Only add items that have been specified in the record, and are not undefined in value
                                var value = record_raw[key];
                                prepared_record[key] = value;
                            }
                        });
                        return [2 /*return*/, prepared_record];
                }
            });
        });
    };
    /**
     * INTERNAL: Insert records into the database without any processing
     * @param {string} table_name The name of the table to insert the records into
     * @param {object} record The record to be insert into the database
     */
    MySQLDriver.prototype._insertRecordRaw = function (table_name, record) {
        return __awaiter(this, void 0, void 0, function () {
            var self, insert_sql, params, keys_sql, values_sql;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        insert_sql = "INSERT INTO `" + table_name + "`";
                        params = [];
                        keys_sql = Object.keys(record).map(function (key) {
                            var escaped_key = key.replace(/`/g, key);
                            var value = record[key];
                            params.push(value);
                            return escaped_key;
                        }).reduce(function (last, cur, index) {
                            return last + ", " + cur;
                        });
                        values_sql = Object.keys(record).map(function (key) {
                            return '?';
                        }).reduce(function (last, cur, index) {
                            return last + ", " + cur;
                        });
                        return [4 /*yield*/, self.query(insert_sql + " (" + keys_sql + ") VALUES (" + values_sql + ")", params)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * INTERNAL: Update records in a given table without any processing
     * @param {string} table_name
     * @param {object} properties The properties to be updated
     * @param {object} where THe criteria to search
     */
    MySQLDriver.prototype._updateRecordsRaw = function (table_name, properties, where) {
        return __awaiter(this, void 0, void 0, function () {
            var self, error, update_sql, params, properties_sql, where_sql;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        if (!where || Object.keys(where).length < 1) {
                            error = new Error("MySQLDriver: Cannot update record without where clause.");
                            error.table_name = table_name;
                            error.properties = properties;
                            error.where = where;
                            throw error;
                        }
                        update_sql = "UPDATE `" + table_name + "`";
                        params = [];
                        properties_sql = Object.keys(properties).map(function (key) {
                            var property = properties[key];
                            params.push(property);
                            return "`" + key + "` = ?";
                        }).reduce(function (last, cur, index) {
                            return last + ", " + cur;
                        });
                        where_sql = Object.keys(where).map(function (key) {
                            var value = where[key];
                            params.push(value);
                            return "`" + key + "` = ?";
                        }).reduce(function (last, cur, index) {
                            return last + " AND " + cur;
                        });
                        return [4 /*yield*/, self.query(update_sql + " SET " + properties_sql + " WHERE " + where_sql, params)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * INTERNAL: Select records from a given table without any data processing
     * @param {string} table_name
     * @param {object} where
     */
    MySQLDriver.prototype._selectRecordRaw = function (table_name, where) {
        if (where === void 0) { where = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var self, select_sql, params, where_sql;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        select_sql = "SELECT * FROM `" + table_name + "`";
                        params = [];
                        if (!(Object.keys(where).length === 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, self.query("" + select_sql)];
                    case 1: 
                    //Handles the case where there is no where clause
                    return [2 /*return*/, _a.sent()];
                    case 2:
                        where_sql = Object.keys(where).map(function (key) {
                            var value = where[key];
                            params.push(value);
                            return "`" + key + "` = ?";
                        }).reduce(function (last, cur, index) {
                            return last + " AND " + cur;
                        });
                        return [4 /*yield*/, self.query(select_sql + " WHERE " + where_sql, params)];
                    case 3: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * INTERNAL: Delete records from a given table without any data processing
     * @param {*} table_name
     * @param {*} where
     */
    MySQLDriver.prototype._deleteRecordRaw = function (table_name, where) {
        return __awaiter(this, void 0, void 0, function () {
            var self, select_sql, params, where_sql;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        select_sql = "DELETE FROM `" + table_name + "`";
                        params = [];
                        where_sql = Object.keys(where).map(function (key) {
                            var value = where[key];
                            params.push(value);
                            return "`" + key + "` = ?";
                        }).reduce(function (last, cur, index) {
                            return last + " AND " + cur;
                        });
                        return [4 /*yield*/, self.query(select_sql + " WHERE " + where_sql, params)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Checks an array of values and ensures that it is not undefined
     * @param {Array<string>} values
     */
    MySQLDriver.prototype._checkValues = function (values) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                values.map(function (value) {
                    if (value === undefined) {
                        throw new Error("DB._checkValues: SQL prepared value cannot be undefined.");
                    }
                });
                return [2 /*return*/];
            });
        });
    };
    return MySQLDriver;
}());
module.exports = MySQLDriver;
//# sourceMappingURL=MySQLDriver.js.map