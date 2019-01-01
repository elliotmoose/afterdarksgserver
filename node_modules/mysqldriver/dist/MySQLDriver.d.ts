import * as MySQL from "mysql";
import { IConfig, ISQLTableColumn, IJSObjectInfo } from "./Interfaces";
declare class MySQLDriver {
    config: IConfig;
    connection: MySQL.Connection;
    constructor(config: IConfig);
    /**
     * Create a new connection to the database
     */
    createConnection(): MySQL.Connection;
    generateId(): string;
    /**
     * Insert records into the database
     * @param {string} table_name The name of the table to insert the records into
     * @param {object} record The record to be insert into the database
     * @return {object}
     */
    insertRecord(table_name: string, record: any): Promise<any[]>;
    /**
     * Get records from a table that match the where criteria
     * @param {string} table_name
     * @param {object} where The search criteria to do a match
     * @return {Array}
     */
    getRecords(table_name: string, where: any): Promise<any[]>;
    /**
     * Get record from a table that match the where criteria
     * @param {string} table_name
     * @param {object} where The search criteria to do a match
     * @return {*}
     */
    getRecord(table_name: string, where: any): Promise<any>;
    /**
     * Update records in a given table
     * @param {string} table_name
     * @param {object} properties The properties to be updated
     * @param {object} where THe criteria to search
     * @return {object}
     */
    updateRecords(table_name: string, properties: any, where: any): Promise<any[]>;
    /**
     * Delete records from a table that match there where criteria
     * @param {string} table_name
     * @param {object} where
     * @return {object}
     */
    deleteRecords(table_name: string, where: any): Promise<any[]>;
    /**
     * Get a record via an sql query
     * @param {string} sql
     * @param {Array} values
     * @return {object}
     */
    getRecordSql(sql: string, values: Array<any>): Promise<Array<any>>;
    /**
     * Gets records from the database via a provided sql statement
     * @param {string} sql
     * @param {Array} values
     * @return {Array}
     */
    getRecordsSql(sql: string, values: Array<any>): Promise<Array<any>>;
    /**
     * Gets all tables in the current database
     * @return {Array}
     */
    getTableNames(): Promise<any[]>;
    /**
     * Get the table information from the information schema
     * @param {string} table_name
     * @return {Array<ISQLTableColumn>}
     */
    getTableInfo(table_name: string): Promise<ISQLTableColumn[]>;
    /**
     * Get the field names for a given table
     * @param {string} table_name
     * @returns {Array}
     */
    getTableFieldNames(table_name: string): Promise<string[]>;
    /**
     * Query the database connection asynchronously
     * @param {*} query
     * @param {Array} values
     * @return {Array}
     */
    query(query: string, values?: Array<any>): Promise<Array<any>>;
    /**
     * Gets the schema of the database as an array of table schema objects
     * @returns {Array<IJSObjectInfo>}>}
     */
    getJSSchema(): Promise<IJSObjectInfo[]>;
    /**
     *
     * @param {string} table_name
     * @return {IJSObjectInfo}
     */
    tableGetJSSchema(table_name: string): Promise<IJSObjectInfo>;
    /**
     * Query the database
     * @param {*} query
     * @param {*} values
     * @param {*} callback
     */
    _query(query: string, values: Array<string>, callback: Function): void;
    closeConnection(): Promise<{}>;
    /**
     * Get the field
     * @param {string} database_name
     * @param {string} table_name
     * @returns {Array<ISQLTableColumn>}
     */
    _getTableInfo(database_name: string, table_name: string): Promise<ISQLTableColumn[]>;
    /**
     * Gets all table names in a given database
     * @param {*} database_name
     * @returns {Array}
     */
    _getTableNames(database_name: string): Promise<any[]>;
    /**
     * Checks the record against the database schema and removes any irrelevant fields for insertion
     * @param {*} database_name
     * @param {*} table_name
     * @param {*} record_raw
     */
    _prepareRecord(database_name: string, table_name: string, record_raw: any): Promise<any>;
    /**
     * INTERNAL: Insert records into the database without any processing
     * @param {string} table_name The name of the table to insert the records into
     * @param {object} record The record to be insert into the database
     */
    _insertRecordRaw(table_name: string, record: any): Promise<any[]>;
    /**
     * INTERNAL: Update records in a given table without any processing
     * @param {string} table_name
     * @param {object} properties The properties to be updated
     * @param {object} where THe criteria to search
     */
    _updateRecordsRaw(table_name: string, properties: any, where: any): Promise<any[]>;
    /**
     * INTERNAL: Select records from a given table without any data processing
     * @param {string} table_name
     * @param {object} where
     */
    _selectRecordRaw(table_name: string, where?: any): Promise<any[]>;
    /**
     * INTERNAL: Delete records from a given table without any data processing
     * @param {*} table_name
     * @param {*} where
     */
    _deleteRecordRaw(table_name: string, where: any): Promise<any[]>;
    /**
     * Checks an array of values and ensures that it is not undefined
     * @param {Array<string>} values
     */
    _checkValues(values: Array<string>): Promise<void>;
}
export = MySQLDriver;
//# sourceMappingURL=MySQLDriver.d.ts.map