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
var FS = __importStar(require("fs"));
var PATH = __importStar(require("path"));
var MySQLDriver = require("./MySQLDriver");
//const Config = require("./Config");
var MySQLModelGenerator = /** @class */ (function () {
    function MySQLModelGenerator(config) {
        this.db = new MySQLDriver(config);
    }
    MySQLModelGenerator.prototype.generate = function (outfolder) {
        return __awaiter(this, void 0, void 0, function () {
            var self, table_names, tasks;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        self = this;
                        if (!FS.existsSync(outfolder)) {
                            FS.mkdirSync(outfolder);
                        }
                        return [4 /*yield*/, self.db.getTableNames()];
                    case 1:
                        table_names = _a.sent();
                        tasks = table_names.map(function (table_name) { return self.generateModel(table_name, outfolder); });
                        return [4 /*yield*/, Promise.all(tasks)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MySQLModelGenerator.prototype.generateModel = function (table_name, outfolder) {
        return __awaiter(this, void 0, void 0, function () {
            var js_obj_info;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.tableGetJSSchema(table_name)];
                    case 1:
                        js_obj_info = _a.sent();
                        generateClass(js_obj_info, outfolder);
                        return [2 /*return*/];
                }
            });
        });
    };
    return MySQLModelGenerator;
}());
function generateClass(table_schema, outfolder) {
    var table_name = table_schema.table_name;
    var class_name = getClassName(table_name);
    var field_initializers = table_schema.fields.map(function (field) {
        return "        this." + field.column_name + " = db_objects." + field.column_name + ";";
    }).reduce(function (last, cur, indx) {
        return last + "\n" + cur;
    });
    var class_jsdoc = '    /**\n     * @param {{' + table_schema.fields.map(function (field) {
        return field.column_name + "?:any";
    }).reduce(function (last, cur, indx) {
        return last + "," + cur;
    }) + '}} db_objects\n     */';
    var method_validate = "    validate(db_fields) {\n" +
        //                `        var db_fields = Object.keys(this)\n` +
        "        var properties = Object.keys(this)\n" +
        //Validate by number of properties
        "        if(db_fields.length !== properties.length) {\n" +
        "            console.log('db_fields:');\n" +
        "            console.log(db_fields);\n" +
        "            console.log('properties:');\n" +
        "            console.log(properties);\n" +
        ("            throw new Error(`" + class_name + ".validate: Validate error: Field lengths do not match.`)\n") +
        "        }\n" +
        //Generate the db field validation
        "        for(var i in db_fields) {\n" +
        "            var property_index = properties.indexOf(db_fields[i])\n" +
        "            if(property_index === -1) {\n" +
        ("                throw new Error(`" + class_name + ".validate: Validate_error: ${db_fields[i]} not found in db.`)\n") +
        "            }\n" +
        "            else {\n" +
        "                properties.splice(property_index, 1); //Remove the properties. All properties should be removed if validation passes\n" +
        "            }\n" +
        "        }\n" +
        //Generate the property array validation
        "        if(properties.length > 0) {\n" +
        ("            console.log(`" + class_name + ".validate: Missing properties in DB:`);\n") +
        "            console.log(properties);\n" +
        ("            throw new Error(`" + class_name + ".validate: Property mismatch`);\n") +
        "        }\n" +
        // `        console.log(\`${class_name} successfully validated.\`)\n` +
        "    }";
    var method_get_table_name = "    getTableName() {\n" +
        ("        return '" + table_name + "';\n") +
        "    }";
    var output = "class " + class_name + " {\n" +
        (class_jsdoc + "\n") +
        "    constructor(db_objects){\n" +
        (field_initializers + "\n") +
        "    }\n" +
        (method_validate + "\n") +
        (method_get_table_name + "\n") +
        "}\n" +
        ("module.exports = " + class_name + ";");
    var outfile = getOutputFilePath(table_name, outfolder);
    console.log("[updated] - " + table_name);
    FS.writeFileSync(outfile, output);
}
function getOutputFilePath(table_name, outfolder) {
    var class_name = getClassName(table_name);
    var outfile = PATH.join(outfolder, class_name + ".js");
    return outfile;
}
function getClassName(table_name) {
    var class_name = "" + table_name;
    return class_name;
}
module.exports = MySQLModelGenerator;
//# sourceMappingURL=MySQLModelGenerator.js.map