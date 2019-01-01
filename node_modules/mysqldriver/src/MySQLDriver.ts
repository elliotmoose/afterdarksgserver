import * as MySQL from "mysql";
import UUIDv4 from "uuid/v4";
import { IConfig, ISQLTableColumn, IJSObjectFieldInfo, IJSObjectInfo } from "./Interfaces";
const ALIAS_COLUMN_NAME = "COLUMN_NAME";
const ALIAS_DATA_TYPE = "DATA_TYPE";
const ALIAS_COLUMN_KEY = "COLUMN_KEY";
const ALIAS_CHARACTER_MAXIMUM_LENGTH = "CHARACTER_MAXIMUM_LENGTH";
const ALIAS_IS_NULLABLE = "IS_NULLABLE";
const ALIAS_COLUMN_DEFAULT = "COLUMN_DEFAULT";

const ALIAS_TABLE_NAME = 'TABLE_NAME';

class MySQLDriver {
    config: IConfig
    connection: MySQL.Connection

    constructor(config: IConfig) {
        this.config = config;
        this.config.port = config.port || 3306;
        this.connection = this.createConnection();
    }

    /**
     * Create a new connection to the database
     */
    createConnection() {
        const { host, user, password, database, port } = this.config;
        return MySQL.createConnection({
            host,
            user,
            password,
            database,
            port
        });
    }
    generateId() {
        return UUIDv4();
    }
    /**
     * Insert records into the database
     * @param {string} table_name The name of the table to insert the records into
     * @param {object} record The record to be insert into the database
     * @return {object}
     */
    async insertRecord(table_name: string, record: any) {
        let self = this;
        let { database } = self.config;
        let clean_record = await self._prepareRecord(database, table_name, record);
        return await self._insertRecordRaw(table_name, clean_record);
    }
    /**
     * Get records from a table that match the where criteria
     * @param {string} table_name
     * @param {object} where The search criteria to do a match
     * @return {Array}
     */
    async getRecords(table_name: string, where: any) {
        let self = this;
        return await self._selectRecordRaw(table_name, where);
    }

    /**
     * Get record from a table that match the where criteria
     * @param {string} table_name
     * @param {object} where The search criteria to do a match
     * @return {*}
     */
    async getRecord(table_name: string, where: any) {
        let self = this;
        const result = await self._selectRecordRaw(table_name, where);
        if (result.length > 1) {
            throw new Error(`MySQLDriver.getRecord: More than one record found.`);
        }
        if (result.length === 0) {
            return undefined;
        }
        return result[0];
    }

    /**
     * Update records in a given table
     * @param {string} table_name 
     * @param {object} properties The properties to be updated
     * @param {object} where THe criteria to search
     * @return {object}
     */
    async updateRecords(table_name: string, properties: any, where: any) {
        let self = this;
        let { database } = self.config;
        let clean_properties = await self._prepareRecord(database, table_name, properties);
        return await self._updateRecordsRaw(table_name, clean_properties, where);
    }
    /**
     * Delete records from a table that match there where criteria
     * @param {string} table_name 
     * @param {object} where 
     * @return {object}
     */
    async deleteRecords(table_name: string, where: any) {
        let self = this;
        return await self._deleteRecordRaw(table_name, where);
    }

    /**
     * Get a record via an sql query
     * @param {string} sql 
     * @param {Array} values 
     * @return {object}
     */
    async getRecordSql(sql: string, values: Array<any>): Promise<Array<any>> {
        let self = this;
        let records = await self.getRecordsSql(sql, values);
        if (records.length > 1) {
            throw new Error(`MySQLDriver.getRecordSql: More than one record found for value.`);
        }
        if (records.length === 0) {
            return [];
        }

        return records[0];
    }
    /**
     * Gets records from the database via a provided sql statement
     * @param {string} sql 
     * @param {Array} values 
     * @return {Array}
     */
    async getRecordsSql(sql: string, values: Array<any>): Promise<Array<any>> {
        let self = this;
        let records = await self.query(sql, values);
        return records;
    }

    /**
     * Gets all tables in the current database
     * @return {Array}
     */
    async getTableNames() {
        const self = this;
        let { database } = self.config;
        const table_names = await self._getTableNames(database);
        return table_names;

    }
    /**
     * Get the table information from the information schema
     * @param {string} table_name 
     * @return {Array<ISQLTableColumn>}
     */
    async getTableInfo(table_name: string) {
        let self = this;
        let { database } = self.config;
        let info = await self._getTableInfo(database, table_name);
        return info;
    }

    /**
     * Get the field names for a given table
     * @param {string} table_name 
     * @returns {Array}
     */
    async getTableFieldNames(table_name: string) {
        let self = this;
        let { database } = self.config;
        let info = await self._getTableInfo(database, table_name);
        return info.map(field_info => field_info.COLUMN_NAME);
    }
    /**
     * Query the database connection asynchronously
     * @param {*} query 
     * @param {Array} values 
     * @return {Array}
     */
    async query(query: string, values: Array<any> = []): Promise<Array<any>> {
        let self = this;
        this._checkValues(values);
        return new Promise<Array<any>>((resolve, reject) => {
            self._query(query, values, function (err: any, rows: Array<any>) {
                if (err) {
                    let error: any = new Error(`MySQLDriver: query: SQL query error.`);
                    let data = {
                        err,
                        query,
                        values
                    };
                    error.data = data;
                    console.log(data);
                    reject(error);
                } else {
                    resolve(rows);
                }
            })
        })
    }

    /**
     * Gets the schema of the database as an array of table schema objects
     * @returns {Array<IJSObjectInfo>}>}
     */
    async getJSSchema() {
        const self = this;
        const tables = await self.getTableNames();
        const schema = tables.map(
            async (table_name: string) => {
                let table_schema = await self.tableGetJSSchema(table_name);
                return table_schema;
            }
        )
        return await Promise.all(schema);
    }
    /**
     * 
     * @param {string} table_name 
     * @return {IJSObjectInfo}
     */
    async tableGetJSSchema(table_name: string) {
        const self = this;
        const columns = await self.getTableInfo(table_name);
        let schema: IJSObjectInfo = {
            table_name: table_name,
            fields: []
        };
        let fields: Array<IJSObjectFieldInfo> = [];
        columns.map(
            (column: any) => {
                let field: IJSObjectFieldInfo = {
                    column_name: column[ALIAS_COLUMN_NAME],
                    data_type: column[ALIAS_DATA_TYPE],
                    key: column[ALIAS_COLUMN_KEY],
                    max_length: column[ALIAS_CHARACTER_MAXIMUM_LENGTH],
                    is_nullable: column[ALIAS_IS_NULLABLE],
                    default_value: column[ALIAS_COLUMN_DEFAULT]
                };
                fields.push(field);
            }
        )
        schema.fields = fields;
        return schema;


    }

    /**
     * Query the database
     * @param {*} query 
     * @param {*} values 
     * @param {*} callback 
     */
    _query(query: string, values: Array<string>, callback: Function) {
        let self = this;
        //Check if connection is healthy
        if (self.connection.state === 'disconnected') {
            self.connection = self.createConnection();
        }
        //Make the request
        self.connection.query(query, values, function (err, rows) {
            rows = rows ? JSON.parse(JSON.stringify(rows)) : [];
            callback(err, rows);
        });
    }
    async closeConnection() {
        let self = this;
        return new Promise((resolve, reject) => {
            self.connection.end((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            })
        })
    }

    //INTERNAL FUNCTIONS
    /**
     * Get the field
     * @param {string} database_name 
     * @param {string} table_name 
     * @returns {Array<ISQLTableColumn>}
     */
    async _getTableInfo(database_name: string, table_name: string) {
        let self = this;
        let result: Array<ISQLTableColumn> = await self.query(`SELECT 
            \`COLUMN_NAME\` as '${ALIAS_COLUMN_NAME}', 
            \`DATA_TYPE\` AS '${ALIAS_DATA_TYPE}', 
            \`COLUMN_KEY\` AS '${ALIAS_COLUMN_KEY}', 
            \`CHARACTER_MAXIMUM_LENGTH\` as '${ALIAS_CHARACTER_MAXIMUM_LENGTH}',
            \`IS_NULLABLE\` as '${ALIAS_IS_NULLABLE}',
            \`COLUMN_DEFAULT\` as '${ALIAS_COLUMN_DEFAULT}'
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE \`TABLE_NAME\` = ? AND \`TABLE_SCHEMA\` = ?`, [table_name, database_name]);
        return result;
    }

    /**
     * Gets all table names in a given database
     * @param {*} database_name 
     * @returns {Array}
     */
    async _getTableNames(database_name: string) {
        let self = this;
        const tables: Array<any> = await self.query(`SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES WHERE \`TABLE_SCHEMA\` = ?`, [database_name]);
        const table_names = tables.map(
            table => table[ALIAS_TABLE_NAME]
        )
        return table_names;
    }
    /**
     * Checks the record against the database schema and removes any irrelevant fields for insertion
     * @param {*} database_name 
     * @param {*} table_name 
     * @param {*} record_raw 
     */
    async _prepareRecord(database_name: string, table_name: string, record_raw: any) {
        let self = this;
        if (!(typeof table_name === 'string')) {
            let error: any = new Error(`MySQLDriver in function _prepareRecord: Provided table name is not a string.`);
            error.table_name = table_name;
            error.record_raw = record_raw;
            throw error;
        }
        let prepared_record: any = {};
        let table_info = await self._getTableInfo(database_name, table_name);
        table_info.map(field => {
            let key = field[ALIAS_COLUMN_NAME];
            if (key in record_raw && (record_raw[key] !== undefined)) { //Only add items that have been specified in the record, and are not undefined in value
                let value = record_raw[key];
                prepared_record[key] = value;
            }
        })
        return prepared_record;
    }
    /**
     * INTERNAL: Insert records into the database without any processing
     * @param {string} table_name The name of the table to insert the records into
     * @param {object} record The record to be insert into the database
     */
    async _insertRecordRaw(table_name: string, record: any) {
        let self = this;
        const insert_sql = `INSERT INTO \`${table_name}\``;
        let params: Array<string> = [];
        const keys_sql = Object.keys(record).map(key => {
            let escaped_key = key.replace(/`/g, key);
            let value = record[key];
            params.push(value);
            return escaped_key;
        }).reduce((last, cur, index) => {
            return `${last}, ${cur}`;
        });
        const values_sql = Object.keys(record).map(key => {
            return '?';
        }).reduce((last, cur, index) => {
            return `${last}, ${cur}`;
        });
        return await self.query(`${insert_sql} (${keys_sql}) VALUES (${values_sql})`, params);
    }
    /**
     * INTERNAL: Update records in a given table without any processing
     * @param {string} table_name 
     * @param {object} properties The properties to be updated
     * @param {object} where THe criteria to search
     */
    async _updateRecordsRaw(table_name: string, properties: any, where: any) {
        let self = this;
        if (!where || Object.keys(where).length < 1) {
            var error: any = new Error(`MySQLDriver: Cannot update record without where clause.`);
            error.table_name = table_name;
            error.properties = properties;
            error.where = where;
            throw error;
        }
        const update_sql = `UPDATE \`${table_name}\``;
        let params: Array<string> = [];
        const properties_sql = Object.keys(properties).map(key => {
            var property = properties[key];
            params.push(property);
            return `\`${key}\` = ?`;
        }).reduce((last, cur, index) => {
            return `${last}, ${cur}`;
        });
        const where_sql = Object.keys(where).map(key => {
            var value = where[key];
            params.push(value);
            return `\`${key}\` = ?`;
        }).reduce((last, cur, index) => {
            return `${last} AND ${cur}`;
        });
        return await self.query(`${update_sql} SET ${properties_sql} WHERE ${where_sql}`, params);
    }
    /**
     * INTERNAL: Select records from a given table without any data processing
     * @param {string} table_name 
     * @param {object} where 
     */
    async _selectRecordRaw(table_name: string, where: any = {}) {
        let self = this;
        const select_sql = `SELECT * FROM \`${table_name}\``;
        let params: Array<any> = [];
        if (Object.keys(where).length === 0) {
            //Handles the case where there is no where clause
            return await self.query(`${select_sql}`);
        } else {
            //Proceed to generate where clause if exists
            const where_sql = Object.keys(where).map(key => {
                let value = where[key];
                params.push(value);
                return `\`${key}\` = ?`;
            }).reduce((last, cur, index) => {
                return `${last} AND ${cur}`
            });
            return await self.query(`${select_sql} WHERE ${where_sql}`, params);
        }
    }
    /**
     * INTERNAL: Delete records from a given table without any data processing
     * @param {*} table_name 
     * @param {*} where 
     */
    async _deleteRecordRaw(table_name: string, where: any) {
        let self = this;
        const select_sql = `DELETE FROM \`${table_name}\``;
        let params: Array<string> = [];
        const where_sql = Object.keys(where).map((key) => {
            let value: string = where[key];
            params.push(value);
            return `\`${key}\` = ?`;
        }).reduce((last, cur, index) => {
            return `${last} AND ${cur}`
        });
        return await self.query(`${select_sql} WHERE ${where_sql}`, params);
    }
    /**
     * Checks an array of values and ensures that it is not undefined
     * @param {Array<string>} values 
     */
    async _checkValues(values: Array<string>) {
        values.map(
            value => {
                if (value === undefined) {
                    throw new Error(`DB._checkValues: SQL prepared value cannot be undefined.`);
                }
            }
        );
    }
}

export = MySQLDriver;