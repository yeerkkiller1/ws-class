import { canHaveChildren, isArray } from "./type";
import { JSONStringifyDangerousPretty } from "../format/stringify";

function getPathRaw(object: any, path: string[]): {} {
    for(let i = 0; i < path.length; i++) {
        object = object[path[i]];
    }
    return object;
}

// Creates a new object where all objects are sorted by keys
function createSortedObject<T extends Types.AnyAll>(proposedData: T, dataContract: T, sortArray = false): T {
    let optional = isOptional(proposedData);
    let exactObject = isObjectExact(proposedData);
    let sorted = isSortArray(proposedData);
    proposedData = unwrapSpecialObjects(proposedData);

    let result: T;
    if(isSortArray(dataContract)) {
        result = createSortedObject(proposedData, unwrapSpecialObjects(dataContract), true);
    }
    else if(!canHaveChildren(dataContract) || !canHaveChildren(proposedData)) {
        result = proposedData;
    }
    else if(isArray(proposedData)) {
        let newArray: Types.Arr = [];
        for(let i = 0; i < proposedData.length; i++) {
            newArray[i] = createSortedObject(proposedData[i], dataContract[i]);
        }
        if(sortArray) {
            newArray.sort((a, b) => {
                let aStr = JSON.stringify(unwrapSpecialRecursive(a));
                let bStr = JSON.stringify(unwrapSpecialRecursive(b));

                return (
                    aStr < bStr ? -1 :
                    aStr > bStr ? +1 :
                    0
                );
            });
        }
        result = newArray as T;
    } else {
        let newObj: Types.DictionaryArr = {};
        for(let key in proposedData) {
            newObj[key] = createSortedObject(proposedData[key], dataContract[key]);
        }
        result = newObj as T;
    }

    if(optional) {
        result = opt(result);
    }
    if(exactObject) {
        result = objectExact(result);
    }
    if(sorted) {
        result = anyOrder(result);
    }
    return result;
}


// Yeah... Symbols break Wallaby, so this will work
const optionalSymbol = "afs80jsfajnfasdnn78787230940fgzsdfklj0asdf08u5unique";
/** Pass a value/object/anything into this, and then into a dataContract of throwIfNotImplementsData, and it will be optional in the data contract. */
export function opt<T extends Types.AnyAll>(value: T): T {
    return {
        value,
        [optionalSymbol]: true
    } as T;
}
function isOptional<T extends Types.AnyAll>(value: T) {
    if(canHaveChildren(value) && optionalSymbol in value) {
        return true;
    }
    return false;
}

// TODO: Lol, make object attributes abstract, instead of all this hardcoding.
const objectExactSymbol = "afsd90amajnasdf0j9fg0j8asd0jasdfnfasd0jiasdfunique";
export function objectExact<T extends Types.AnyAll>(value: T): T {
    return {
        value,
        [objectExactSymbol]: true
    } as T;
}
function isObjectExact<T extends Types.AnyAll>(value: T) {
    if(canHaveChildren(value) && objectExactSymbol in value) {
        return true;
    }
    return false;
}


const sortSymbol = "940afasd9asdfasdfsdffgzsdfklj0asdf08u5unique";
export function anyOrder<T extends Types.AnyAll>(value: T) {
    return {
        value,
        [sortSymbol]: true
    } as T;
}
function isSortArray(value: Types.AnyAll) {
    if(canHaveChildren(value) && sortSymbol in value) {
        return true;
    }
    return false;
}
function unwrapSpecialObjects<T extends Types.AnyAll>(value: T): T {
    if(canHaveChildren(value) && (optionalSymbol in value || sortSymbol in value || objectExactSymbol in value)) {
        return value["value"] as T;
    }
    return value;
}
function unwrapSpecialRecursive<T extends Types.AnyAll>(data: T): T {
    if(isOptional(data) || isSortArray(data) || isObjectExact(data)) {
        return unwrapSpecialRecursive(unwrapSpecialObjects(data));
    }
    if(!canHaveChildren(data)) return data;
    if(isArray(data)) {
        let newArray: Types.Arr = [];
        for(let i = 0; i < data.length; i++) {
            newArray[i] = unwrapSpecialRecursive(data[i]);
        }
        return newArray as T;
    } else {
        let newObj: Types.DictionaryArr = {};
        for(let key in data) {
            newObj[key] = unwrapSpecialRecursive(data[key]);
        }
        return newObj as T;
    }
}

/* Just for debugging. "x.y.z" => ["x", "y", "z"] */
export function p(pathString: string): string[] {
    if(!pathString) return [];
    let arr = pathString.split(".");
    if(pathString.endsWith("?")) {
        return opt(pathString.slice(0, -1).split("."));
    }
    return arr;
}

/* Just for debugging. "x.y.z" => JSON.stringify(["x", "y", "z"]) */
export function ph(pathString: string) {
    return JSON.stringify(p(pathString));
}

/** Path array. Just an array of paths. Makes [p("a"), p("b"), p("c")] into pa("a", "b", "c") */
export function pa(...pathStrings: string[]) {
    return pathStrings.map(p);
}

export function throwIfNotImplementsData(proposedData: Types.AnyAll, dataContract: Types.AnyAll) {
    proposedData = createSortedObject(proposedData, dataContract);
    dataContract = createSortedObject(dataContract, dataContract);
    let pathBroken = notImplementsData(proposedData, dataContract);
    proposedData = unwrapSpecialRecursive(proposedData);
    dataContract = unwrapSpecialRecursive(dataContract);    
    if(pathBroken) {
        let receivedValue = getPathRaw(proposedData, pathBroken);
        let expectValue = getPathRaw(dataContract, pathBroken);

        let expectText = `expect ${JSON.stringify(receivedValue)} to be ${JSON.stringify(expectValue)}`;

        if(pathBroken.length > 0) {
            let parentValue = getPathRaw(dataContract, pathBroken.slice(0, -1));
            if(isArray(parentValue)) {
                if(expectValue === undefined) {
                    expectText = `unexpected ${JSON.stringify(receivedValue)}`;
                } else {
                    expectText = `expected ${JSON.stringify(expectValue)} to exist`;
                }
            }
        }

        let name = (
`Incorrect value at ${pathBroken.join(".")}, ${expectText}
  Received
${JSONStringifyDangerousPretty(proposedData, 30, 2)}
  and expected it to be a subset of
${JSONStringifyDangerousPretty(dataContract, 30, 2)}
`);
        throw new Error(name);
    }
}

/** AKA, is not compatible with.
 * 
 *      INVERSE OF (Says if the proposedData has every property and with the same value as dataContract. Ignores extra properties in proposedData,
 *          unless the properties are in arrays (or it could be said, it throws property called "length" differs))
 * 
 * Returns false if it is compatible with, and an array of the first incompatible path if it isn't compatible with.
 * 
 * [undefined] is compatible with [], because that makes optional values easier to implement.
*/
export function notImplementsData(proposedData: Types.AnyAll, dataContract: Types.AnyAll): false | string[] {
    let exactObject = isObjectExact(dataContract);
    dataContract = unwrapSpecialObjects(dataContract);
    if(!canHaveChildren(proposedData) || !canHaveChildren(dataContract)) {
        let primitiveEqual = proposedData === dataContract;
        if(primitiveEqual) return false;
        return [];
    }
    
    let aIsArray = proposedData instanceof Array;
    let bIsArray = dataContract instanceof Array;
    if(aIsArray !== bIsArray) {
        if(aIsArray) {
            return ["(received array, contract is not)"];
        }
        if(bIsArray) {
            return ["(received not array, contract says it must be an array)"];
        }
        /* ignore coverage */ throw new Error("Impossible");
    }
    let path: false | string[] = false;
    if(isArray(proposedData) && isArray(dataContract)) {
        if(exactObject) {
            throw new Error(`Used objectExact on array. There is no need for this, arrays are already exactly matching (unless there are optional properties).`);
        }
        let proposedIndex = 0;
        for(let i = 0; i < Math.max(dataContract.length, proposedData.length); i++) {
            let a = proposedData[proposedIndex];
            let b = dataContract[i];
            let optional = isOptional(b);
            // Hmm... why did we call unwrapSpecialObjects here? Doesn't notImplementsData do that right away?
            //if(optional) b = unwrapSpecialObjects(b);
            let notImplements = notImplementsData(a, b);
            if(notImplements) {
                if(optional) {
                    // Retry it
                    proposedIndex--;
                } else {
                    path = notImplements;
                    path.unshift(i.toString());
                    break;
                }
            }
            proposedIndex++;
        }
    } else {
        for(let key in dataContract) {
            let a = proposedData[key];
            let b = dataContract[key];
            path = notImplementsData(a, b);
            if(path) {
                path.unshift(key);
                break;
            }
        }
        if(exactObject) {
            for(let key in proposedData) {
                if(key in dataContract) continue;
                let a = proposedData[key];
                let b = dataContract[key];
                path = notImplementsData(a, b);
                if(path) {
                    path.unshift(key);
                    break;
                }
            }
        }
    }

    return path;
}

export function throws(code: () => void) {
    let didThrow = false;
    try {
        code();
    } catch(e) {
        return;
    }
    // This is the one line we will never have code coverage for
    
    /* ignore coverage */ throw new Error("Expected an error");
}