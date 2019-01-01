import * as FS from 'fs';
import * as PATH from 'path';
import { IConfig, IJSObjectFieldInfo, IJSObjectInfo } from './Interfaces';
import MySQLDriver = require('./MySQLDriver');

//const Config = require("./Config");
class MySQLModelGenerator {
    db: MySQLDriver
    constructor(config: IConfig) {
        this.db = new MySQLDriver(config);
    }
    async generate(outfolder: string){
        let self = this;
        if(!FS.existsSync(outfolder)){
            FS.mkdirSync(outfolder);
        }
        let table_names = await self.db.getTableNames();
        let tasks = table_names.map(table_name => { return self.generateModel(table_name, outfolder) });
        return await Promise.all(tasks);
    }
    async generateModel(table_name: string, outfolder: string){
        let js_obj_info = await this.db.tableGetJSSchema(table_name);
        generateClass(js_obj_info, outfolder);
    }
}

function generateClass(table_schema: IJSObjectInfo, outfolder: string) {
    let table_name = table_schema.table_name;
    let class_name = getClassName(table_name);
    const field_initializers = table_schema.fields.map(
        field => {
            return `        this.${field.column_name} = db_objects.${field.column_name};`;
        }
    ).reduce(
        (last, cur, indx) => {
            return `${last}\n${cur}`;
        }
    );

    const class_jsdoc = '    /**\n     * @param {{' + table_schema.fields.map(
        field => {
            return `${field.column_name}?:any`;
        }
    ).reduce(
        (last, cur, indx) => {
            return `${last},${cur}`;
        }
    ) + '}} db_objects\n     */';

    const method_validate =
        `    validate(db_fields) {\n` +
        //                `        var db_fields = Object.keys(this)\n` +
        `        var properties = Object.keys(this)\n` +
        //Validate by number of properties
        `        if(db_fields.length !== properties.length) {\n` +
        `            console.log('db_fields:');\n` +
        `            console.log(db_fields);\n` +
        `            console.log('properties:');\n` +
        `            console.log(properties);\n` +
        `            throw new Error(\`${class_name}.validate: Validate error: Field lengths do not match.\`)\n` +
        `        }\n` +
        //Generate the db field validation
        `        for(var i in db_fields) {\n` +
        `            var property_index = properties.indexOf(db_fields[i])\n` +
        `            if(property_index === -1) {\n` +
        `                throw new Error(\`${class_name}.validate: Validate_error: \${db_fields[i]} not found in db.\`)\n` +
        `            }\n` +
        `            else {\n` +
        `                properties.splice(property_index, 1); //Remove the properties. All properties should be removed if validation passes\n` +
        `            }\n` +
        `        }\n` +
        //Generate the property array validation
        `        if(properties.length > 0) {\n` +
        `            console.log(\`${class_name}.validate: Missing properties in DB:\`);\n` +
        `            console.log(properties);\n` +
        `            throw new Error(\`${class_name}.validate: Property mismatch\`);\n` +
        `        }\n` +
        // `        console.log(\`${class_name} successfully validated.\`)\n` +
        `    }`;
    const method_get_table_name =
        `    getTableName() {\n` +
        `        return '${table_name}';\n` +
        `    }`;
    let output =
        `class ${class_name} {\n` +
        `${class_jsdoc}\n` +
        `    constructor(db_objects){\n` +
        `${field_initializers}\n` +
        `    }\n` +
        `${method_validate}\n` +
        `${method_get_table_name}\n` +
        `}\n` +
        `module.exports = ${class_name};`;
    let outfile = getOutputFilePath(table_name, outfolder);
    console.log(`[updated] - ${table_name}`);
    FS.writeFileSync(outfile, output);
}

function getOutputFilePath(table_name: string, outfolder: string) {
    let class_name = getClassName(table_name);
    let outfile = PATH.join(outfolder, `${class_name}.js`);
    return outfile;
}

function getClassName(table_name: string) {
    let class_name = `${table_name}`;
    return class_name;
}
export = MySQLModelGenerator;