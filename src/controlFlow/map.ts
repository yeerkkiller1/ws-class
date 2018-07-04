import { isArray } from "../reflection/type";

export function mapRecursive<O extends Types.AnyAll>(
    obj: Types.AnyAllNoObjectBuffer,
    map: (t: Types.AnyAllNoObjectBuffer) => { terminalLeaf: O } | "recurse"
): O {
    {
        let result = map(obj);
        if(typeof result === "object") {
            return result.terminalLeaf;
        }
    }

    let result: Types.AnyAllNoObjectBuffer;
    if(isArray(obj)) {
        let arr: Types.AnyAll[] = [];
        for(let i = 0; i < obj.length; i++) {
            arr.push(mapRecursive(obj[i], map));
        }
        result = arr as Types.AnyAllNoObject;
    } else if(typeof obj === "object" && obj !== null && !(obj instanceof Buffer)) {
        let lookup: Types.DictionaryArr = {};
        for(let key in obj) {
            lookup[key] = mapRecursive(obj[key], map);
        }
        result = lookup as Types.AnyAllNoObject;
    } else {
        result = obj;
    }
    return result as O;
}