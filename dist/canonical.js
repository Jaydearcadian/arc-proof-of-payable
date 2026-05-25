const sortValue = (value) => {
    if (value === undefined)
        throw new Error("Cannot canonicalize undefined values");
    if (typeof value === "number" && !Number.isFinite(value))
        throw new Error("Cannot canonicalize non-finite numbers");
    if (Array.isArray(value))
        return value.map(sortValue);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entry]) => [key, sortValue(entry)]));
    }
    return value;
};
export const canonicalize = (value) => JSON.stringify(sortValue(value));
