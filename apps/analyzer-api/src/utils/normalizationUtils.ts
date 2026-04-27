export const normalizeNumber = (val: any, fallback: number = 0): number => {
    if (typeof val === "number") return val;
    if (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val))) {
        return Number(val);
    }
    return fallback;
};

export const normalizeStringArray = (val: any): string[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string" && val.trim() !== "") {
        return [val];
    }
    return [];
};
