// https://stackoverflow.com/questions/41476063/typescript-remove-key-from-type-subtraction-type
type Omit<O, D extends string> = Pick<O, Exclude<keyof O, D>>;