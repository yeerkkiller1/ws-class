export function isEmpty<T>(obj: {[key: string]: T}): boolean {
    for(var key in obj) {
        return false;
    }
    return true;
}