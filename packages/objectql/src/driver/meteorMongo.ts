import { JsonMap } from "@salesforce/ts-types";
import { SteedosDriver } from "./index"
import { ObjectId } from "mongodb";
import { SteedosQueryOptions, SteedosQueryFilters } from "../types/query";
import { SteedosIDType } from "../types";
import { SteedosDriverConfig } from "./driver";
import { formatFiltersToODataQuery } from "@steedos/filters";
import { createFilter } from 'odata-v4-mongodb';
import { createQuery } from 'odata-v4-mongodb';
import _ = require("underscore");

var Fiber = require('fibers');

declare var Creator: any;

export class SteedosMeteorMongoDriver implements SteedosDriver {
    connect() {
    }
    disconnect() {
    }

    constructor(config: SteedosDriverConfig) {
    }

    formatFiltersToMongoQuery(filters: any): JsonMap {
        let odataQuery: string = formatFiltersToODataQuery(filters)
        let query: JsonMap = createFilter(odataQuery)
        return query;
    }

    /* TODO： */
    getMongoFilters(filters: SteedosQueryFilters): JsonMap {
        if (_.isUndefined(filters)) {
            return {}
        }
        if (_.isString(filters))
            return createFilter(filters)
        let mongoFilters: JsonMap = this.formatFiltersToMongoQuery(filters);
        return mongoFilters
    }

    getMongoFieldsOptions(fields: string[] | string): JsonMap {
        if (typeof fields == "string") {
            fields = (<string>fields).split(",").map((n) => { return n.trim(); });
        }
        if (!(fields && fields.length)) {
            throw new Error("fields must not be undefined or empty");
        }
        let projection: JsonMap = {};
        (<string[]>fields).forEach((field) => {
            if (field) {
                projection[field] = 1;
            }
        });
        return projection;
    }

    getMongoSortOptions(sort: string): JsonMap {
        let result: JsonMap = undefined;
        if (sort && typeof sort === "string") {
            let arraySort: string[] = sort.split(",").map((n) => { return n.trim(); });
            let stringSort: string = "";
            arraySort.forEach((n) => {
                if (n) {
                    stringSort += `${n},`
                }
            });
            stringSort = stringSort.replace(/,$/g, "");
            result = createQuery(`$orderby=${stringSort}`).sort;
        }
        return result;
    }

    /* TODO： */
    getMongoOptions(options: SteedosQueryOptions): JsonMap {
        if (_.isUndefined(options)) {
            return {};
        }
        let result: JsonMap = {};
        let projection: JsonMap = this.getMongoFieldsOptions(options.fields);
        let sort: JsonMap = this.getMongoSortOptions(options.sort);
        result.fields = projection;
        result.sort = sort;
        result.limit = options.top;
        result.skip = options.skip;
        return result;
    }

    collection(name: string) {
        return Creator.Collections[name];
    };

    async find(tableName: string, query: SteedosQueryOptions) {
        let collection = this.collection(tableName);

        let mongoFilters = this.getMongoFilters(query.filters);
        let mongoOptions = this.getMongoOptions(query);

        return await new Promise((resolve, reject) => {
            Fiber(function () {
                resolve(collection.find(mongoFilters, mongoOptions).fetch());
            }).run()
        });
    }

    async count(tableName: string, query: SteedosQueryOptions) {
        let collection = this.collection(tableName);
        let mongoFilters = this.getMongoFilters(query.filters);
        let mongoOptions = this.getMongoOptions(query);
        return await new Promise((resolve, reject) => {
            Fiber(function () {
                resolve(collection.find(mongoFilters, mongoOptions).count());
            }).run()
        });
    }

    async findOne(tableName: string, id: SteedosIDType, query: SteedosQueryOptions) {
        let collection = this.collection(tableName);
        let mongoOptions = this.getMongoOptions(query);

        return await new Promise((resolve, reject) => {
            Fiber(function () {
                resolve(collection.findOne({ _id: id }, mongoOptions));
            }).run()
        });
    }

    async insert(tableName: string, data: JsonMap) {
        data._id = data._id || new ObjectId().toHexString();
        let collection = this.collection(tableName);
        let result = collection.insertOne(data);
        return result;
    }

    async update(tableName: string, id: SteedosIDType, data: JsonMap) {
        let collection = this.collection(tableName);
        let result = collection.update({ _id: id }, data);
        return result;
    }

    async delete(tableName: string, id: SteedosIDType) {
        let collection = this.collection(tableName);
        let result = collection.delete({ _id: id })
        return result;
    }

}