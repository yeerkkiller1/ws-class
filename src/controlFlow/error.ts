export function throwAsync(err: any) {
    setTimeout(() => {
        throw err;
    }, 0);
}