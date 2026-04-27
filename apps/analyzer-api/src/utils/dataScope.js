"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCoworkingCompanyScopeWhere = exports.buildTechParkCompanyScopeWhere = exports.applyScopeToStateCityWhere = exports.canAccessStateCity = exports.getDataScopeFromRequest = void 0;
var normalizeText = function (value) {
    if (typeof value !== "string")
        return undefined;
    var trimmed = value.trim();
    return trimmed ? trimmed : undefined;
};
var equalsIgnoreCase = function (left, right) {
    if (!left || !right)
        return false;
    return left.trim().toLowerCase() === right.trim().toLowerCase();
};
var caseInsensitiveEquals = function (value) { return ({
    equals: value,
    mode: "insensitive",
}); };
var normalizePermission = function (value) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9.]+/g, "_");
};
var hasPermission = function (permissionSet, permission) {
    var normalized = normalizePermission(permission);
    if (!normalized)
        return false;
    if (permissionSet.has("*") ||
        permissionSet.has("SYSTEM.ADMIN") ||
        permissionSet.has("SYSTEM.SUPER_ADMIN")) {
        return true;
    }
    if (permissionSet.has(normalized))
        return true;
    var moduleKey = normalized.split(".")[0];
    return Boolean(moduleKey && permissionSet.has("".concat(moduleKey, ".*")));
};
var hasAnyPermission = function (permissionSet, permissions) {
    return permissions.some(function (permission) { return hasPermission(permissionSet, permission); });
};
var getDataScopeFromRequest = function (req) {
    var _a, _b, _c, _d, _e;
    var role = normalizeText((_a = req.user) === null || _a === void 0 ? void 0 : _a.role);
    var state = normalizeText((_b = req.user) === null || _b === void 0 ? void 0 : _b.state);
    var city = normalizeText((_c = req.user) === null || _c === void 0 ? void 0 : _c.city);
    var permissionSet = new Set((((_d = req.user) === null || _d === void 0 ? void 0 : _d.permissions) || [])
        .map(function (permission) { return normalizePermission(permission); })
        .filter(Boolean));
    var flags = (_e = req.user) === null || _e === void 0 ? void 0 : _e.accessFlags;
    var hasNationalScope = Boolean(flags === null || flags === void 0 ? void 0 : flags.national) || hasAnyPermission(permissionSet, ["SCOPE.NATIONAL_VIEW"]);
    var hasStateScope = Boolean(flags === null || flags === void 0 ? void 0 : flags.state) || hasAnyPermission(permissionSet, ["SCOPE.STATE_VIEW"]);
    var hasCityScope = Boolean(flags === null || flags === void 0 ? void 0 : flags.city) || hasAnyPermission(permissionSet, ["SCOPE.CITY_VIEW"]);
    if (hasNationalScope) {
        return { role: role, denyAll: false };
    }
    if (hasStateScope) {
        return {
            role: role,
            state: state,
            denyAll: !state,
        };
    }
    if (hasCityScope) {
        return {
            role: role,
            state: state,
            city: city,
            denyAll: !state || !city,
        };
    }
    return { role: role, state: state, city: city, denyAll: true };
};
exports.getDataScopeFromRequest = getDataScopeFromRequest;
var canAccessStateCity = function (scope, state, city) {
    if (scope.denyAll)
        return false;
    var normalizedState = normalizeText(state);
    var normalizedCity = normalizeText(city);
    // Scoped users must not access records with missing location fields.
    if (scope.state && !normalizedState) {
        return false;
    }
    if (scope.city && !normalizedCity) {
        return false;
    }
    if (scope.state && normalizedState && !equalsIgnoreCase(scope.state, normalizedState)) {
        return false;
    }
    if (scope.city && normalizedCity && !equalsIgnoreCase(scope.city, normalizedCity)) {
        return false;
    }
    return true;
};
exports.canAccessStateCity = canAccessStateCity;
var applyScopeToStateCityWhere = function (where, scope, opts) {
    var _a, _b, _c;
    if (opts === void 0) { opts = {}; }
    if (scope.denyAll) {
        where.id = "__NO_SCOPE_ACCESS__";
        return where;
    }
    var stateField = opts.stateField || "state";
    var cityField = opts.cityField || "city";
    var andClauses = [];
    if (scope.state) {
        andClauses.push((_a = {}, _a[stateField] = caseInsensitiveEquals(scope.state), _a));
    }
    if (scope.city) {
        andClauses.push((_b = {}, _b[cityField] = caseInsensitiveEquals(scope.city), _b));
    }
    if (andClauses.length === 0)
        return where;
    if (Array.isArray(where.AND)) {
        (_c = where.AND).push.apply(_c, andClauses);
    }
    else if (where.AND) {
        where.AND = __spreadArray([where.AND], andClauses, true);
    }
    else {
        where.AND = andClauses;
    }
    return where;
};
exports.applyScopeToStateCityWhere = applyScopeToStateCityWhere;
var buildTechParkCompanyScopeWhere = function (scope) {
    if (scope.denyAll) {
        return { id: "__NO_SCOPE_ACCESS__" };
    }
    var newTechParkFilter = {};
    if (scope.state) {
        newTechParkFilter.state = caseInsensitiveEquals(scope.state);
    }
    if (scope.city) {
        newTechParkFilter.city = caseInsensitiveEquals(scope.city);
    }
    return Object.keys(newTechParkFilter).length > 0
        ? { newTechPark: newTechParkFilter }
        : {};
};
exports.buildTechParkCompanyScopeWhere = buildTechParkCompanyScopeWhere;
var buildCoworkingCompanyScopeWhere = function (scope) {
    if (scope.denyAll) {
        return { id: "__NO_SCOPE_ACCESS__" };
    }
    var coworkingSpaceFilter = {};
    if (scope.state) {
        coworkingSpaceFilter.state = caseInsensitiveEquals(scope.state);
    }
    if (scope.city) {
        coworkingSpaceFilter.city = caseInsensitiveEquals(scope.city);
    }
    return Object.keys(coworkingSpaceFilter).length > 0
        ? { coworkingSpace: coworkingSpaceFilter }
        : {};
};
exports.buildCoworkingCompanyScopeWhere = buildCoworkingCompanyScopeWhere;
