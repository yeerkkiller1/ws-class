declare namespace Types { 
    type ErasedType = string&number;

    export type Any = Dictionary | Primitive;
    export interface Dictionary { [key: string]: Any }
    export type Primitive = string|number|boolean|null|undefined|void;
    export type PrimitiveAnd = string&number&boolean&null&undefined&void;


    //Eh... we need to hack around `type X = X[]` not being allowed, even though it is not really circular.
    //type AnyWithoutArray = Any[];
    type AnyArrNoObject = Dictionary | Primitive;
    export type AnyArr = AnyArrNoObject | object;
    
    export interface DictionaryArr { [key: string]: AnyArr }
    export type Arr = Array<AnyArr | AnyArr[] | AnyArr[][] | AnyArr[][][] | AnyArr[][][][] | AnyArr[][][][][]>
    export type AnyAll = AnyArr | Arr;


    type MakeArr<T> = T | T[] | T[][] | T[][][] | T[][][][] | T[][][][][];
    export type AnyAllNoObject = MakeArr<Primitive | { [key in string]: AnyAllNoObject }>;

    export type AnyAllNoObjectBuffer = MakeArr<Uint8Array | Primitive | { [key in string]: AnyAllNoObjectBuffer }>;// | { [key: number]: AnyAllNoObjectBuffer };

    
    type MakeAndArr<T> = T & T[] & T[][] & T[][][] & T[][][][] & T[][][][][];
    export type AnyAndAll = MakeAndArr<PrimitiveAnd & { [key in string]: AnyAndAll }>;



    export type Graph<T> = { value: T; children: {[key: string]: Graph<T>} };
    export type GraphParent<T> = {
        value: T;
        children: {[key: string]: GraphParent<T>};
        parent: GraphParent<T>|undefined;
        path: string[];
        pathHash: string;
    };

    export type DeepReadonly<T> = {
        readonly [P in keyof T]: DeepReadonly<T[P]>;
    }

    /*
    TODO: Use this when we use TS 2.8, (except use our own primitive)
    export type primitive = string | number | boolean | undefined | null
    export type DeepReadonly<T> =
        T extends primitive ? T :
        T extends Array<infer U> ? DeepReadonlyArray<U> :
        DeepReadonlyObject<T>
    ;

    export interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

    export type DeepReadonlyObject<T> = {
    readonly [P in keyof T]: DeepReadonly<T[P]>
    }
    */
}