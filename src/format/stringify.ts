import { canHaveChildren, isArray } from "../reflection/type";
import { isEmpty } from "../reflection/misc";

/** Creates something that looks like a javascript object, sort of. */
export function JSONStringifyDangerousPretty(
    obj: Types.AnyAll,
    /** Inclusive */
    maxCharsPerLine = 50,
    indentCount = 0
): string {
    let indent = " ".repeat(indentCount);
    if(!canHaveChildren(obj)) {
        return indent + JSON.stringify(obj);
    }
    let rawStr = JSON.stringify(obj);
    if(rawStr.length <= maxCharsPerLine - indentCount) {
        return indent + rawStr;
    }

    const indentAmount = 2;

    if(isArray(obj)) {
        if(obj.length === 0) {
            return "[]";
        }
        return (
            indent + "[\n"
            + obj.map(x => JSONStringifyDangerousPretty(x, maxCharsPerLine, indentCount + indentAmount)).join(",\n") + "\n"
            + indent + "]"
        );
    } else {
        if(isEmpty(obj)) {
            return "{}";
        }
        let output = indent + "{\n";
        for(let key in obj) {
            let cleanKey = key;
            if(key.match(/\s/g)) {
                cleanKey = JSON.stringify(key);
            }
            let valueStr = JSONStringifyDangerousPretty(obj[key], maxCharsPerLine, indentCount + indentAmount);
            valueStr = valueStr.substr(indentCount + indentAmount);
            output += indent + " ".repeat(indentAmount) + cleanKey + ": " + valueStr + ",\n";
        }
        output += indent + "}";
        return output;
    }
}